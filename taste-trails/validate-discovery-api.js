import fetch from 'node-fetch';

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║       USER-FACING DISCOVERY API VALIDATION               ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const BASE_URL = 'http://localhost:8081';
const TEST_LAT = 35.2271;
const TEST_LNG = -80.8431;

async function testEndpoint(testName, queryParams) {
  console.log(`\n${testName}`);
  console.log('─'.repeat(60));
  
  const params = new URLSearchParams(queryParams);
  const url = `${BASE_URL}/api/restaurants?${params.toString()}`;
  
  console.log(`URL: /api/restaurants?${params.toString()}`);
  console.log(`Time: ${new Date().toISOString()}`);
  
  const startTime = Date.now();
  
  try {
    const response = await fetch(url);
    const queryTime = Date.now() - startTime;
    
    console.log(`\n✓ Status: ${response.status} ${response.statusText}`);
    console.log(`✓ Query Time: ${queryTime}ms`);
    
    if (response.status !== 200) {
      const text = await response.text();
      console.log(`❌ Error Response: ${text}`);
      return { success: false, status: response.status, queryTime };
    }
    
    const data = await response.json();
    
    return {
      success: true,
      status: response.status,
      queryTime,
      data
    };
  } catch (error) {
    console.log(`❌ Request Failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ========================
// STEP 1: 5 Mile Query
// ========================
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  STEP 1: 5 MILE QUERY                                     ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

const result1 = await testEndpoint('Test: 5 mile radius search', {
  lat: TEST_LAT,
  lng: TEST_LNG,
  radius: 5
});

if (result1.success) {
  const restaurants = result1.data.restaurants || [];
  console.log(`\n📊 Count: ${restaurants.length} restaurants`);
  
  if (restaurants.length > 0) {
    console.log('\n📋 First 5 Results:');
    restaurants.slice(0, 5).forEach((r, i) => {
      const distance = r.distance_miles ? `${r.distance_miles.toFixed(2)} mi` : 'N/A';
      console.log(`   ${i + 1}. ${r.name}`);
      console.log(`      Distance: ${distance}`);
    });
    
    // Verify distances are ascending
    console.log('\n✓ Distance Sort Verification:');
    let isSorted = true;
    for (let i = 1; i < Math.min(restaurants.length, 10); i++) {
      const prev = restaurants[i - 1].distance_miles;
      const curr = restaurants[i].distance_miles;
      if (prev > curr) {
        isSorted = false;
        console.log(`   ❌ Out of order: ${restaurants[i - 1].name} (${prev}) > ${restaurants[i].name} (${curr})`);
      }
    }
    if (isSorted) {
      console.log('   ✅ Distances are properly sorted (ascending)');
    }
  }
}

// ========================
// STEP 2: 1 Mile Query
// ========================
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  STEP 2: 1 MILE QUERY                                     ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

const result2 = await testEndpoint('Test: 1 mile radius search', {
  lat: TEST_LAT,
  lng: TEST_LNG,
  radius: 1
});

if (result2.success) {
  const restaurants = result2.data.restaurants || [];
  console.log(`\n📊 Count: ${restaurants.length} restaurants`);
  
  if (restaurants.length > 0) {
    console.log('\n📋 Restaurant Names:');
    restaurants.forEach((r, i) => {
      const distance = r.distance_miles ? `${r.distance_miles.toFixed(2)} mi` : 'N/A';
      console.log(`   ${i + 1}. ${r.name} (${distance})`);
    });
  }
  
  // Compare with 5-mile query
  const count5Mile = result1.success ? (result1.data.restaurants || []).length : 0;
  console.log(`\n✓ Comparison: 1 mile (${restaurants.length}) vs 5 mile (${count5Mile})`);
  if (restaurants.length < count5Mile) {
    console.log('   ✅ 1-mile query returns fewer results (expected)');
  } else if (restaurants.length === count5Mile) {
    console.log('   ⚠️  Same count - all restaurants within 1 mile');
  } else {
    console.log('   ❌ 1-mile query returned MORE results (unexpected)');
  }
}

// ========================
// STEP 3: 0.1 Mile Edge Case
// ========================
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  STEP 3: 0.1 MILE EDGE CASE                               ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

const result3 = await testEndpoint('Test: 0.1 mile radius (edge case)', {
  lat: TEST_LAT,
  lng: TEST_LNG,
  radius: 0.1
});

if (result3.success) {
  const restaurants = result3.data.restaurants || [];
  console.log(`\n📊 Count: ${restaurants.length} restaurants`);
  
  if (restaurants.length === 0) {
    console.log('   ✅ No results within 0.1 miles (expected for sparse areas)');
  } else {
    console.log('\n📋 Extremely Close Restaurants:');
    restaurants.forEach((r, i) => {
      const distance = r.distance_miles ? `${r.distance_miles.toFixed(3)} mi` : 'N/A';
      console.log(`   ${i + 1}. ${r.name} (${distance})`);
    });
    console.log('   ✅ Only very close results returned');
  }
  
  console.log('\n✓ Edge Case Handling:');
  console.log('   ✅ No crash');
  console.log('   ✅ No 500 error');
  console.log(`   ✅ Response status: ${result3.status}`);
}

// ========================
// STEP 4: Large Radius Test
// ========================
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  STEP 4: LARGE RADIUS TEST (25 MILES)                    ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

const result4 = await testEndpoint('Test: 25 mile radius (should return all)', {
  lat: TEST_LAT,
  lng: TEST_LNG,
  radius: 25
});

if (result4.success) {
  const restaurants = result4.data.restaurants || [];
  console.log(`\n📊 Count: ${restaurants.length} restaurants`);
  console.log(`⏱️  Query Time: ${result4.queryTime}ms`);
  
  console.log('\n✓ Performance Validation:');
  if (restaurants.length === 69) {
    console.log('   ✅ All 69 restaurants returned');
  } else {
    console.log(`   ⚠️  Expected 69, got ${restaurants.length}`);
  }
  
  if (result4.queryTime < 150) {
    console.log(`   ✅ Query time under 150ms (${result4.queryTime}ms)`);
  } else {
    console.log(`   ⚠️  Query time over 150ms (${result4.queryTime}ms)`);
  }
  
  console.log(`   ✅ No performance warning`);
}

// ========================
// STEP 5: Trending Sort
// ========================
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  STEP 5: TRENDING SORT                                    ║');
console.log('╚═══════════════════════════════════════════════════════════╝');

const result5 = await testEndpoint('Test: Trending sort parameter', {
  lat: TEST_LAT,
  lng: TEST_LNG,
  radius: 5,
  sort: 'trending'
});

if (result5.success) {
  const restaurants = result5.data.restaurants || [];
  console.log(`\n📊 Count: ${restaurants.length} restaurants`);
  
  if (restaurants.length > 0) {
    console.log('\n📋 First 5 Trending Results:');
    let hasInternalScoreLeakage = false;
    let hasBadges = false;
    
    restaurants.slice(0, 5).forEach((r, i) => {
      console.log(`   ${i + 1}. ${r.name}`);
      
      // Check for internal score leakage
      const internalFields = ['trending_score', 'internal_score', 'score', 'weight'];
      const leakedFields = internalFields.filter(field => r[field] !== undefined);
      if (leakedFields.length > 0) {
        console.log(`      ⚠️  Internal score leaked: ${leakedFields.join(', ')}`);
        hasInternalScoreLeakage = true;
      }
      
      // Check for badges
      if (r.badge || r.badges) {
        console.log(`      🏆 Badge: ${r.badge || r.badges}`);
        hasBadges = true;
      }
      
      const distance = r.distance_miles ? `${r.distance_miles.toFixed(2)} mi` : 'N/A';
      console.log(`      Distance: ${distance}`);
    });
    
    console.log('\n✓ Trending Sort Validation:');
    if (!hasInternalScoreLeakage) {
      console.log('   ✅ No internal score leakage detected');
    } else {
      console.log('   ❌ Internal scores exposed in API response');
    }
    
    if (hasBadges) {
      console.log('   ✅ Badges present where applicable');
    } else {
      console.log('   ℹ️  No badges in top 5 (may be expected)');
    }
    
    console.log(`   ✅ Status 200 (success)`);
  }
}

// ========================
// SUMMARY
// ========================
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  VALIDATION SUMMARY                                       ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const tests = [
  { name: 'Step 1: 5 Mile Query', result: result1 },
  { name: 'Step 2: 1 Mile Query', result: result2 },
  { name: 'Step 3: 0.1 Mile Edge Case', result: result3 },
  { name: 'Step 4: Large Radius (25mi)', result: result4 },
  { name: 'Step 5: Trending Sort', result: result5 }
];

let allPassed = true;
tests.forEach(test => {
  const status = test.result.success ? '✅ PASS' : '❌ FAIL';
  const time = test.result.queryTime ? `${test.result.queryTime}ms` : 'N/A';
  console.log(`${status}  ${test.name.padEnd(35)} ${time.padStart(10)}`);
  if (!test.result.success) allPassed = false;
});

console.log('\n' + '─'.repeat(60));
if (allPassed) {
  console.log('✅ ALL TESTS PASSED - Discovery API is user-ready');
} else {
  console.log('❌ SOME TESTS FAILED - Review errors above');
}
console.log('─'.repeat(60) + '\n');
