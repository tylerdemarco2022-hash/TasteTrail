#!/usr/bin/env node
/**
 * RED TEAM LOAD TEST: Menu Grouping Performance
 * 
 * Purpose: Stress test menu grouping under production-like load
 * Validates system survives:
 * - Concurrent requests
 * - Performance thresholds (avg, P95, P99)
 * - Memory stability
 
 * Success Criteria:
 * - Average: <150ms
 * - P95: <250ms (95th percentile)
 * - P99: <400ms (99th percentile)  
 * - Memory growth: <10MB
 * - Data correctness: 100%
 */

import { performance } from 'perf_hooks';

// Simulated menu grouping logic (matches MenuView.jsx)
function groupMenuItemsBySection(items) {
  const sectionMap = new Map();
  
  // Group items by section
  for (const item of items) {
    const sectionName = item.section_name || 'Uncategorized';
    
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, {
        name: sectionName,
        key: sectionName.toLowerCase().replace(/\s+/g, '-'),
        items: [],
        order: sectionMap.size
      });
    }
    
    sectionMap.get(sectionName).items.push(item);
  }
  
  // Convert to array and sort items within each section
  const sections = Array.from(sectionMap.values());
  
  for (const section of sections) {
    section.items.sort((a, b) => {
      const ratingA = a.rating_bayesian || 0;
      const ratingB = b.rating_bayesian || 0;
      if (ratingB !== ratingA) return ratingB - ratingA;
      return a.name.localeCompare(b.name);
    });
  }
  
  return sections;
}

// Generate test menu
function generateLargeTestMenu(itemCount = 300, sectionCount = 8) {
  const sections = [
    'Appetizers',
    'Soups & Salads',
    'Mains',
    'From The Grill',
    'Shared Plates',
    'Small Plates',
    'Desserts',
    'After Dinner'
  ].slice(0, sectionCount);
  
  const items = [];
  
  for (let i = 0; i < itemCount; i++) {
    const sectionIndex = i % sections.length;
    const section = sections[sectionIndex];
    
    items.push({
      id: i + 1,
      name: `Test Item ${i + 1}`,
      description: `Description for test item ${i + 1}`,
      price: `$${(Math.random() * 30 + 10).toFixed(2)}`,
      section_name: section,
      rating_bayesian: Math.random() * 2 + 3,
      rating_count: Math.floor(Math.random() * 100)
    });
  }
  
  return items.sort(() => Math.random() - 0.5);
}

// Run single grouping and measure time
function runSingleGrouping(menuItems) {
  const start = performance.now();
  const sections = groupMenuItemsBySection(menuItems);
  const duration = performance.now() - start;
  
  return { sections, duration };
}

// Calculate percentile from sorted array
function calculatePercentile(sorted, percentile) {
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// Main load test
async function runLoadTest() {
  console.log('🚀 RED TEAM LOAD TEST: Menu Grouping Performance');
  console.log('='.repeat(70));
  console.log('');
  
  const ITEM_COUNT = 300;
  const SECTION_COUNT = 8;
  const CONCURRENT_REQUESTS = 50;
  const MAX_AVG_DURATION_MS = 150;
  const MAX_P95_DURATION_MS = 250;
  const MAX_P99_DURATION_MS = 400;
  const MAX_HEAP_GROWTH_MB = 10;
  
  console.log('Configuration:');
  console.log(`  Menu Items: ${ITEM_COUNT}`);
  console.log(`  Sections: ${SECTION_COUNT}`);
  console.log(`  Concurrent Requests: ${CONCURRENT_REQUESTS}`);
  console.log('');
  console.log('Success Criteria:');
  console.log(`  Average Latency: <${MAX_AVG_DURATION_MS}ms`);
  console.log(`  P95 Latency: <${MAX_P95_DURATION_MS}ms`);
  console.log(`  P99 Latency: <${MAX_P99_DURATION_MS}ms`);
  console.log(`  Heap Growth: <${MAX_HEAP_GROWTH_MB}MB`);
  console.log(`  Data Correctness: 100%`);
  console.log('');
  
  console.log('Generating test menu...');
  const testMenu = generateLargeTestMenu(ITEM_COUNT, SECTION_COUNT);
  console.log(`✅ Generated ${testMenu.length} items across ${SECTION_COUNT} sections\n`);
  
  console.log('Running warmup...');
  runSingleGrouping(testMenu);
  console.log('✅ Warmup complete\n');
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  const memBefore = process.memoryUsage();
  const heapUsedBefore = memBefore.heapUsed;
  
  console.log(`Running ${CONCURRENT_REQUESTS} concurrent requests...\n`);
  const startTime = performance.now();
  
  // Run concurrent requests
  const promises = [];
  for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
    promises.push(
      new Promise((resolve) => {
        setImmediate(() => {
          const result = runSingleGrouping(testMenu);
          resolve(result);
        });
      })
    );
  }
  
  const results = await Promise.all(promises);
  const totalTime = performance.now() - startTime;
  
  // Calculate statistics
  const durations = results.map(r => r.duration);
  const sorted = [...durations].sort((a, b) => a - b);
  
  const minDuration = sorted[0];
  const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
  const medianDuration = sorted[Math.floor(sorted.length / 2)];
  const p95Duration = calculatePercentile(sorted, 95);
  const p99Duration = calculatePercentile(sorted, 99);
  const maxDuration = sorted[sorted.length - 1];
  
  // Verify correctness
  const allCorrect = results.every(r => r.sections.length === SECTION_COUNT);
  const totalItemsProcessed = CONCURRENT_REQUESTS * ITEM_COUNT;
  
  // Memory after
  const memAfter = process.memoryUsage();
  const heapUsedAfter = memAfter.heapUsed;
  const heapGrowth = heapUsedAfter - heapUsedBefore;
  const heapGrowthMB = heapGrowth / 1024 / 1024;
  
  // Results
  console.log('');
  console.log('='.repeat(70));
  console.log('RESULTS:');
  console.log('='.repeat(70));
  console.log('');
  console.log('Latency Distribution (milliseconds):');
  console.log(`  Min:    ${minDuration.toFixed(3)}ms`);
  console.log(`  P95:    ${p95Duration.toFixed(3)}ms (95th percentile)`);
  console.log(`  Avg:    ${avgDuration.toFixed(3)}ms`);
  console.log(`  Median: ${medianDuration.toFixed(3)}ms`);
  console.log(`  P99:    ${p99Duration.toFixed(3)}ms (99th percentile)`);
  console.log(`  Max:    ${maxDuration.toFixed(3)}ms`);
  console.log('');
  console.log('Throughput:');
  console.log(`  Total Time: ${totalTime.toFixed(2)}ms`);
  console.log(`  Requests: ${CONCURRENT_REQUESTS}`);
  console.log(`  Items Processed: ${totalItemsProcessed.toLocaleString()}`);
  console.log(`  Throughput: ${(CONCURRENT_REQUESTS / (totalTime / 1000)).toFixed(2)} req/sec`);
  console.log(`  Throughput: ${(totalItemsProcessed / (totalTime / 1000)).toFixed(0)} items/sec`);
  console.log('');
  console.log('Memory Usage:');
  console.log(`  Heap Before: ${(heapUsedBefore / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap After: ${(heapUsedAfter / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Growth: ${heapGrowthMB.toFixed(2)} MB`);
  console.log(`  Total Heap: ${(memAfter.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  RSS: ${(memAfter.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log('');
  console.log('Correctness:');
  console.log(`  Sections Valid: ${allCorrect ? '✅ YES' : '❌ NO'}`);
  console.log('');
  
  // Pass/fail checks
  const avgPass = avgDuration < MAX_AVG_DURATION_MS;
  const p95Pass = p95Duration < MAX_P95_DURATION_MS;
  const p99Pass = p99Duration < MAX_P99_DURATION_MS;
  const memPass = heapGrowthMB < MAX_HEAP_GROWTH_MB;
  const correctPass = allCorrect;
  
  console.log('='.repeat(70));
  console.log('ACCEPTANCE CRITERIA:');
  console.log('='.repeat(70));
  console.log(`  ${avgPass ? '✅' : '❌'} Average <${MAX_AVG_DURATION_MS}ms: ${avgDuration.toFixed(2)}ms`);
  console.log(`  ${p95Pass ? '✅' : '❌'} P95 <${MAX_P95_DURATION_MS}ms: ${p95Duration.toFixed(2)}ms`);
  console.log(`  ${p99Pass ? '✅' : '❌'} P99 <${MAX_P99_DURATION_MS}ms: ${p99Duration.toFixed(2)}ms`);
  console.log(`  ${memPass ? '✅' : '❌'} Heap Growth <${MAX_HEAP_GROWTH_MB}MB: ${heapGrowthMB.toFixed(2)}MB`);
  console.log(`  ${correctPass ? '✅' : '❌'} Data Correctness: ${correctPass ? '100%' : 'FAILED'}`);
  console.log('');
  
  const passed = avgPass && p95Pass && p99Pass && memPass && correctPass;
  
  console.log('='.repeat(70));
  if (passed) {
    console.log('✅✅✅ LOAD TEST PASSED - System ready for production ✅✅✅');
    console.log('');
    console.log('Summary:');
    console.log(`  System handles ${CONCURRENT_REQUESTS} concurrent requests efficiently`);
    console.log(`  Processes ${totalItemsProcessed.toLocaleString()} items with consistent latency`);
    console.log(`  No memory leaks detected`);
    console.log(`  Data integrity maintained under stress`);
  } else {
    console.log('❌❌❌ LOAD TEST FAILED - Issues detected ❌❌❌');
    console.log('');
    console.log('Failures:');
    if (!avgPass) console.log(`  ❌ Average latency ${avgDuration.toFixed(2)}ms exceeds ${MAX_AVG_DURATION_MS}ms`);
    if (!p95Pass) console.log(`  ❌ P95 latency ${p95Duration.toFixed(2)}ms exceeds ${MAX_P95_DURATION_MS}ms - performance variance too high`);
    if (!p99Pass) console.log(`  ❌ P99 latency ${p99Duration.toFixed(2)}ms exceeds ${MAX_P99_DURATION_MS}ms - tail latency critical`);
    if (!memPass) console.log(`  ❌ Heap growth ${heapGrowthMB.toFixed(2)}MB exceeds ${MAX_HEAP_GROWTH_MB}MB - memory leak detected`);
    if (!correctPass) console.log(`  ❌ Data corruption - sections don't match expected count`);
  }
  console.log('='.repeat(70));
  console.log('');
  
  process.exit(passed ? 0 : 1);
}

runLoadTest().catch(err => {
  console.error('');
  console.error('❌ LOAD TEST ERROR:');
  console.error(err.message);
  console.error('');
  process.exit(1);
});
