// Performance test for discovery API
// Tests the 5-mile query and reports detailed timing breakdown

const params = new URLSearchParams({
  lat: '35.2271',
  lng: '-80.8431',
  radius: '5'
});

const url = `http://localhost:8081/api/restaurants?${params.toString()}`;

console.log('🔍 Testing Discovery API Performance...\n');
console.log(`URL: ${url}\n`);

const start = Date.now();

try {
  const response = await fetch(url);
  const totalTime = Date.now() - start;
  
  console.log(`✅ Status: ${response.status}`);
  console.log(`⏱️  Total Request Time: ${totalTime}ms\n`);
  
  if (response.ok) {
    const data = await response.json();
    
    console.log('📊 SERVER TIMING BREAKDOWN:');
    console.log('=====================================');
    if (data.timings) {
      console.log(`  DB Query (restaurants):  ${data.timings.dbQueryMs}ms`);
      console.log(`  Activity Query:          ${data.timings.activityQueryMs}ms`);
      console.log(`  Distance Calc/Enrich:    ${data.timings.distanceCalcMs}ms`);
      console.log(`  Sorting:                 ${data.timings.sortMs}ms`);
      console.log(`  TOTAL (server):          ${data.timings.totalMs}ms`);
      console.log('=====================================\n');
      
      // Performance analysis
      const slowest = Object.entries(data.timings)
        .filter(([key]) => key !== 'totalMs')
        .sort((a, b) => b[1] - a[1])[0];
      
      console.log(`🎯 Bottleneck: ${slowest[0]} (${slowest[1]}ms)`);
      console.log(`📈 Results: ${data.count} restaurants\n`);
      
      // Performance verdict
      if (data.timings.totalMs < 150) {
        console.log('✅ PERFORMANCE: EXCELLENT (< 150ms target)');
      } else if (data.timings.totalMs < 1000) {
        console.log('⚠️  PERFORMANCE: ACCEPTABLE (150-1000ms)');
      } else {
        console.log('❌ PERFORMANCE: POOR (> 1000ms - NEEDS OPTIMIZATION)');
      }
      
      // Recommendations
      if (data.timings.dbQueryMs > 1000) {
        console.log('\n💡 RECOMMENDATION: Add indexes on lat/lng columns');
        console.log('   Run: sql/add_discovery_indexes.sql in Supabase Dashboard');
      }
      
      if (data.timings.activityQueryMs > 1000) {
        console.log('\n💡 RECOMMENDATION: Add index on restaurant_activity table');
        console.log('   (restaurant_id, created_at DESC, type)');
      }
      
    } else {
      console.log('⚠️  No timing data available (old API version?)');
    }
    
  } else {
    const text = await response.text();
    console.log(`❌ Error: ${text}`);
  }
  
} catch (error) {
  console.log(`❌ Request failed: ${error.message}`);
}
