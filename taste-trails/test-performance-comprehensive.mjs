// ========================================
// COMPREHENSIVE DISCOVERY PERFORMANCE TEST
// Tests multiple query patterns
// ========================================

async function testQuery(lat, lng, radius, label) {
  const params = new URLSearchParams({ lat, lng, radius });
  const url = `http://localhost:8081/api/restaurants?${params.toString()}`;
  
  const start = Date.now();
  const response = await fetch(url);
  const totalTime = Date.now() - start;
  const data = await response.json();
  
  console.log(`${label}:`);
  console.log(`  Status: ${response.status}`);
  console.log(`  Count: ${data.count}`);
  console.log(`  DB Query: ${data.timings.dbQueryMs}ms`);
  console.log(`  Activity Query: ${data.timings.activityQueryMs}ms`);
  console.log(`  Distance Calc: ${data.timings.distanceCalcMs}ms`);
  console.log(`  Sorting: ${data.timings.sortMs}ms`);
  console.log(`  TOTAL (server): ${data.timings.totalMs}ms`);
  console.log(`  TOTAL (client): ${totalTime}ms`);
  console.log();
  
  return data.timings.totalMs;
}

console.log('🔬 COMPREHENSIVE PERFORMANCE TEST\n');
console.log('Testing discovery API with multiple query patterns...\n');
console.log('=========================================\n');

try {
  // Test 1: 5 mile radius (standard use case)
  const time1 = await testQuery('35.2271', '-80.8431', '5', 'TEST 1: 5 Mile Radius');
  
  // Test 2: 1 mile radius (smaller result set)
  const time2 = await testQuery('35.2271', '-80.8431', '1', 'TEST 2: 1 Mile Radius');
  
  // Test 3: 10 mile radius (larger result set)
  const time3 = await testQuery('35.2271', '-80.8431', '10', 'TEST 3: 10 Mile Radius');
  
  // Test 4: Very small radius (edge case)
  const time4 = await testQuery('35.2271', '-80.8431', '0.1', 'TEST 4: 0.1 Mile Edge Case');
  
  // Calculate statistics
  const times = [time1, time2, time3, time4];
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const maxTime = Math.max(...times);
  const minTime = Math.min(...times);
  
  console.log('=========================================');
  console.log('📊 PERFORMANCE STATISTICS\n');
  console.log(`  Average Query Time: ${Math.round(avgTime)}ms`);
  console.log(`  Fastest Query: ${minTime}ms`);
  console.log(`  Slowest Query: ${maxTime}ms`);
  console.log(`  Consistency: ${maxTime - minTime}ms variance\n`);
  
  if (avgTime < 150) {
    console.log('✅ EXCELLENT: Below 150ms target');
  } else if (avgTime < 500) {
    console.log('⚠️  ACCEPTABLE: Under 500ms (usable)');
    console.log('💡 RECOMMENDATION: Add database indexes to reach <150ms target');
  } else if (avgTime < 1000) {
    console.log('⚠️  MARGINAL: 500-1000ms (consider optimization)');
    console.log('💡 URGENT: Add database indexes');
  } else {
    console.log('❌ POOR: Over 1000ms (needs immediate optimization)');
    console.log('💡 CRITICAL: Check for blocking operations and add indexes');
  }
  
  console.log('\n=========================================');
  console.log('📝 NEXT STEPS:\n');
  console.log('1. Review sql/add_discovery_indexes.sql');
  console.log('2. Run SQL in Supabase Dashboard');
  console.log('3. Retest with: node test-performance-comprehensive.mjs');
  console.log('4. Expected result: ~100-150ms queries\n');
  
} catch (error) {
  console.log(`❌ Test failed: ${error.message}`);
}
