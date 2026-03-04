/**
 * LOAD TEST DIAGNOSTIC CORRELATOR
 * 
 * Purpose: Correlate load test failures to server logs using request IDs
 * 
 * Usage:
 *   1. Run the load test: node backend/scripts/load-test-http.mjs 2>&1 | tee load-test.log
 *   2. Check server logs for errors: tail -f server.log or check console output
 *   3. Run this script: node backend/scripts/diagnose-load-test.mjs
 * 
 * This script will:
 *   - Parse load test output for error request IDs
 *   - Search server logs for matching request IDs
 *   - Correlate failure patterns
 *   - Suggest root causes
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const LOAD_TEST_LOG = 'load-test.log';
const SERVER_LOG = 'server.log';

/**
 * Extract request IDs from load test output
 */
async function parseLoadTestLog() {
  if (!fs.existsSync(LOAD_TEST_LOG)) {
    console.error(`❌ Load test log not found: ${LOAD_TEST_LOG}`);
    console.error(`   Run: node backend/scripts/load-test-http.mjs 2>&1 | tee load-test.log`);
    return null;
  }

  const content = fs.readFileSync(LOAD_TEST_LOG, 'utf-8');
  
  // Extract failed request details
  const failedRegex = /\[([a-f0-9-]+)\] (\w+) \((\d+|N\/A)\): (.+)/g;
  const failedRequests = new Map();
  
  let match;
  while ((match = failedRegex.exec(content)) !== null) {
    const [_, requestId, errorType, statusCode, message] = match;
    failedRequests.set(requestId, {
      errorType,
      statusCode: statusCode === 'N/A' ? null : parseInt(statusCode),
      message,
      timestamp: new Date()
    });
  }
  
  return { 
    failedRequests, 
    logContent: content,
    totalLoadTestErrors: failedRequests.size
  };
}

/**
 * Search server logs for request IDs
 */
async function findInServerLogs(requestIds) {
  if (!fs.existsSync(SERVER_LOG)) {
    console.warn(`⚠️  Server log not found: ${SERVER_LOG}`);
    console.warn(`   Make sure to capture server output: node backend/server/index.js > server.log 2>&1`);
    return new Map();
  }

  const correlations = new Map();
  const fileStream = fs.createReadStream(SERVER_LOG);
  
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    for (const requestId of requestIds) {
      if (line.includes(requestId)) {
        if (!correlations.has(requestId)) {
          correlations.set(requestId, []);
        }
        correlations.get(requestId).push(line);
      }
    }
  }

  return correlations;
}

/**
 * Diagnose error patterns
 */
function analyzeErrors(failedRequests, serverCorrelations) {
  console.log('\n' + '═'.repeat(70));
  console.log('DIAGNOSTIC ANALYSIS');
  console.log('═'.repeat(70));
  
  // Error type breakdown
  console.log('\n📊 ERROR TYPE BREAKDOWN:');
  const errorTypes = {};
  for (const [_, info] of failedRequests) {
    const type = info.errorType;
    errorTypes[type] = (errorTypes[type] || 0) + 1;
  }
  
  Object.entries(errorTypes)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
     });
  
  // Correlation analysis
  console.log('\n🔗 SERVER LOG CORRELATION:');
  let correlatedCount = 0;
  let uncorrelatedCount = 0;
  
  for (const [requestId, info] of failedRequests) {
    if (serverCorrelations.has(requestId)) {
      correlatedCount++;
    } else {
      uncorrelatedCount++;
    }
  }
  
  if (correlatedCount === 0 && uncorrelatedCount > 0) {
    console.warn(`  ⚠️  ${uncorrelatedCount} failed requests NOT FOUND in server logs`);
    console.warn('     This might indicate:');
    console.warn('     1. Server logs are not being captured');
    console.warn('     2. Server crashed/restarted during test');
    console.warn('     3. Requests never reached the server (network issue)');
  } else {
    console.log(`  ✓ ${correlatedCount}/${failedRequests.size} failed requests found in server logs`);
    console.log(`  ⚠️  ${uncorrelatedCount}/${failedRequests.size} failed requests NOT in server logs`);
  }
  
  // Show uncorrelated requests (potential issue)
  if (uncorrelatedCount > 0) {
    console.log('\n⚠️  UNCORRELATED FAILURES (likely connection/network issues):');
    let shown = 0;
    for (const [requestId, info] of failedRequests) {
      if (!serverCorrelations.has(requestId) && shown < 5) {
        console.log(`  - [${requestId}] ${info.errorType}: ${info.message}`);
        shown++;
      }
    }
  }
  
  // Show server log matches
  if (serverCorrelations.size > 0) {
    console.log('\n📋 SERVER RESPONSE FOR FAILURES:');
    let shown = 0;
    for (const [requestId, logs] of serverCorrelations) {
      if (shown < 5) {
        console.log(`  [${requestId}]:`);
        logs.slice(0, 2).forEach(log => {
          const truncated = log.substring(0, 100);
          console.log(`    > ${truncated}...`);
        });
        shown++;
      }
    }
  }
  
  // Pattern analysis
  console.log('\n🔍 PATTERN ANALYSIS:');
  
  // Check for timeout pattern
  const timeoutErrors = Array.from(failedRequests.values())
    .filter(e => e.errorType === 'timeout').length;
  if (timeoutErrors > 0) {
    console.log(`  ⚠️  Timeouts detected (${timeoutErrors}): Could indicate:`);
    console.log('     - Database queries taking >5000ms');
    console.log('     - Integrity checks blocking requests');
    console.log('     - Memory pressure/GC pauses');
  }
  
  // Check for 5xx pattern
  const serverErrors = Array.from(failedRequests.values())
    .filter(e => e.statusCode >= 500).length;
  if (serverErrors > 0) {
    console.log(`  ⚠️  Server errors detected (${serverErrors}): Could indicate:`);
    console.log('     - Integrity validation failures');
    console.log('     - Database connection pool exhausted');
    console.log('     - Unhandled exceptions in request handlers');
  }
  
  // Check for connection pattern
  const connErrors = Array.from(failedRequests.values())
    .filter(e => e.errorType.includes('connection')).length;
  if (connErrors > 0) {
    console.log(`  ⚠️  Connection errors detected (${connErrors}): Could indicate:`);
    console.log('     - Server connection pool issues');
    console.log('     - Network stack saturation');
    console.log('     - OS-level resource limits (ulimit)');
  }
}

/**
 * Main diagnostics
 */
async function runDiagnostics() {
  console.log('═'.repeat(70));
  console.log('LOAD TEST DIAGNOSTIC CORRELATOR');
  console.log('═'.repeat(70));
  
  // Parse load test log
  console.log('\n📖 Parsing load test log...');
  const loadTestData = await parseLoadTestLog();
  if (!loadTestData) {
    process.exit(1);
  }
  
  console.log(`  Found ${loadTestData.totalLoadTestErrors} failed requests`);
  
  // Search server logs
  console.log('\n🔍 Searching server logs for correlation...');
  const serverCorrelations = await findInServerLogs([...loadTestData.failedRequests.keys()]);
  console.log(`  Found ${serverCorrelations.size} matches in server logs`);
  
  // Analyze
  analyzeErrors(loadTestData.failedRequests, serverCorrelations);
  
  // Recommendations
  console.log('\n' + '═'.repeat(70));
  console.log('RECOMMENDED NEXT STEPS:');
  console.log('═'.repeat(70));
  console.log(`
1. CAPTURE NEW LOGS:
   Terminal 1:
   $ NODE_ENV=development node backend/server/index.js 2>&1 | tee server.log

   Terminal 2:
   $ node backend/scripts/load-test-http.mjs 2>&1 | tee load-test.log

   Terminal 3:
   $ node backend/scripts/diagnose-load-test.mjs

2. ANALYZE HEAP SNAPSHOTS:
   - Look for heap-snapshot-*.heapsnapshot files
   - Open in Chrome DevTools (chrome://devtools)
   - Analyze memory growth during test
   - Check for memory leaks

3. REVIEW REQUEST ID LOGS:
   - Search server logs for all instances of failed request IDs
   - Look for SQL query timing
   - Check for error messages before timeout

4. VERIFY CACHE BEHAVIOR:
   - Check integrityCache stats in server logs
   - Confirm cache hits are working (should be 99%)
   - Look for cache stampede patterns

5. STRESS TEST DATABASE:
   - Check PostgreSQL connection count during test
   - Look for slow query logs
   - Verify indexes are being used
  `);
  
  console.log('═'.repeat(70));
}

runDiagnostics().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});
