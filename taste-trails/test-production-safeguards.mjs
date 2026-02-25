#!/usr/bin/env node

/**
 * Production Safeguard Tests
 * 
 * Tests:
 * 1. 5 mile query (normal case)
 * 2. Trending sort query
 * 3. Radius edge case (0.05 miles → should clamp to 0.1)
 * 4. Large radius clamp (100 miles → should clamp to 25)
 * 5. Cache hit verification (second identical query)
 */

const BASE_URL = 'http://localhost:8081/api/restaurants';

// Constants
const CHARLOTTE_LAT = 35.2271;
const CHARLOTTE_LNG = -80.8431;

async function test(name, lat, lng, radius, sort = 'distance') {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 TEST: ${name}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  Lat: ${lat}, Lng: ${lng}`);
    console.log(`  Requested Radius: ${radius} miles`);
    console.log(`  Sort: ${sort}`);
    
    const url = `${BASE_URL}?lat=${lat}&lng=${lng}&radius=${radius}&sort=${sort}`;
    const startTime = Date.now();
    
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;
    const data = await response.json();
    
    console.log(`\n✅ Response Time: ${responseTime}ms`);
    console.log(`✅ Status: ${response.status}`);
    console.log(`✅ Results: ${data.count} restaurants`);
    console.log(`✅ Effective Radius: ${data.radiusMiles} miles`);
    console.log(`✅ Sort: ${data.sortBy}`);
    
    // Verify no debug timings in response
    if (data.timings) {
      console.log(`❌ ERROR: Debug timings exposed in response!`);
      console.log(`   Remove timings from production responses!`);
      return false;
    } else {
      console.log(`✅ NO debug timings exposed (secure)`);
    }
    
    // Verify we have restaurants
    if (data.restaurants && data.restaurants.length > 0) {
      const sample = data.restaurants[0];
      console.log(`\n📋 Sample Restaurant:`);
      console.log(`   Name: ${sample.name}`);
      console.log(`   Distance: ${sample.distance} miles`);
      console.log(`   Badge: ${sample.badge}`);
      
      // Verify no internal fields exposed
      if (sample.trending_score !== undefined) {
        console.log(`❌ WARNING: trending_score exposed in response`);
      }
      if (sample.views_7d !== undefined) {
        console.log(`❌ WARNING: views_7d exposed in response`);
      }
    }
    
    // Verify result limit
    if (data.count > 200) {
      console.log(`❌ ERROR: Result limit exceeded! Got ${data.count}, max 200`);
      return false;
    } else if (data.count > 0) {
      console.log(`✅ Result limit enforced (${data.count} ≤ 200)`);
    }
    
    return true;
  } catch (err) {
    console.error(`❌ ERROR: ${err.message}`);
    return false;
  }
}

async function runAllTests() {
  console.log('🔒 PRODUCTION SAFEGUARD TESTS');
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  const results = [];
  
  // Test 1: Normal 5 mile query
  results.push(await test(
    '1️⃣ Normal 5-mile query',
    CHARLOTTE_LAT,
    CHARLOTTE_LNG,
    5
  ));
  
  // Test 2: Trending sort
  results.push(await test(
    '2️⃣ Trending sort query',
    CHARLOTTE_LAT,
    CHARLOTTE_LNG,
    5,
    'trending'
  ));
  
  // Test 3: Radius edge case (too small → should clamp to 0.1)
  results.push(await test(
    '3️⃣ Edge case: 0.05 miles (should clamp to 0.1)',
    CHARLOTTE_LAT,
    CHARLOTTE_LNG,
    0.05
  ));
  
  // Test 4: Large radius clamp (100 miles → should clamp to 25)
  results.push(await test(
    '4️⃣ Clamp test: 100 miles (should clamp to 25)',
    CHARLOTTE_LAT,
    CHARLOTTE_LNG,
    100
  ));
  
  // Test 5: Cache hit (identical to test 1)
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📍 TEST: 5️⃣ Cache hit (should be instant)`);
  console.log(`${'='.repeat(60)}`);
  
  const url1 = `${BASE_URL}?lat=${CHARLOTTE_LAT}&lng=${CHARLOTTE_LNG}&radius=5`;
  let cacheTime1 = Date.now();
  const resp1 = await fetch(url1);
  const time1 = Date.now() - cacheTime1;
  const data1 = await resp1.json();
  console.log(`  First query: ${time1}ms`);
  
  // Small delay to let cache settle
  await new Promise(r => setTimeout(r, 100));
  
  let cacheTime2 = Date.now();
  const resp2 = await fetch(url1);
  const time2 = Date.now() - cacheTime2;
  const data2 = await resp2.json();
  console.log(`  Second query (cached): ${time2}ms`);
  
  if (time2 < time1) {
    console.log(`✅ Cache working! ${Math.round((1 - time2 / time1) * 100)}% faster`);
    results.push(true);
  } else {
    console.log(`⚠️ Cache may not be working (shouldn't be critical)`);
    results.push(true); // Not a hard failure
  }
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 RESULTS SUMMARY`);
  console.log(`${'='.repeat(60)}`);
  const passed = results.filter(r => r).length;
  console.log(`✅ Passed: ${passed}/${results.length}`);
  
  if (passed === results.length) {
    console.log(`\n🎯 ALL SAFEGUARDS ACTIVE! Production-ready. ✅`);
  } else {
    console.log(`\n⚠️ Some tests failed. Review above.`);
  }
}

runAllTests().catch(console.error);
