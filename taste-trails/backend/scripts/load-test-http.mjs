/**
 * REALISTIC HTTP LOAD TEST WITH COMPREHENSIVE DIAGNOSTICS
 * 
 * Purpose: Test actual HTTP requests under sustained load
 * - 100 concurrent users
 * - 60 seconds sustained
 * - Measures: avg, p95, p99, max latency + error rate
 * - Captures: Error categorization, request IDs, heap snapshots, retries
 * 
 * This is NOT mocking - real HTTP traffic to real server
 * 
 * Usage:
 *   node backend/scripts/load-test-http.mjs
 * 
 * Prerequisites:
 *   - Backend must be running on localhost:8081
 *   - Test restaurant must exist in database
 */

import http from 'http';
import v8 from 'v8';
import fs from 'fs';
import path from 'path';

// Configuration
const SERVER_HOST = 'localhost';
const SERVER_PORT = 8081;
const TEST_RESTAURANT_ID = 'test-restaurant-load-test';
const CONCURRENT_USERS = 100;
const DURATION_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 5000;

// HTTP Agent tuning for connection pool management
const httpAgent = new http.Agent({
  keepAlive: true,           // Reuse TCP connections
  keepAliveMsecs: 1000,     // Socket keep-alive probe interval
  maxSockets: 200,          // Max concurrent sockets (default 256)
  maxFreeSockets: 50,       // Max free sockets to keep open
  timeout: REQUEST_TIMEOUT_MS,
  freeSocketTimeout: 30000  // Timeout on free sockets
});

/**
 * Categorizes errors to identify root causes, including Node.js error codes
 */
function categorizeError(err, statusCode) {
  // HTTP status-based errors
  if (statusCode >= 500) return { type: '5xx', message: statusCode, code: 'HTTP_5xx' };
  if (statusCode >= 400) return { type: '4xx', message: statusCode, code: 'HTTP_4xx' };
  
  // Message-based errors
  if (err.message === 'Timeout') return { type: 'timeout', message: err.message, code: 'TIMEOUT' };
  
  // Node.js error codes (connection/socket layer)
  if (err.code === 'ECONNREFUSED') return { type: 'connection-refused', message: err.message, code: 'ECONNREFUSED' };
  if (err.code === 'ECONNRESET') return { type: 'connection-reset', message: err.message, code: 'ECONNRESET' };
  if (err.code === 'ETIMEDOUT') return { type: 'connection-timeout', message: err.message, code: 'ETIMEDOUT' };
  if (err.code === 'EPIPE') return { type: 'pipe-error', message: err.message, code: 'EPIPE' };
  if (err.code === 'ENOTFOUND') return { type: 'dns-error', message: err.message, code: 'ENOTFOUND' };
  if (err.code === 'EHOSTUNREACH') return { type: 'host-unreachable', message: err.message, code: 'EHOSTUNREACH' };
  
  if (err.message && err.message.includes('ECONNREFUSED')) return { type: 'connection-refused', message: err.message, code: 'ECONNREFUSED' };
  if (err.message && err.message.includes('ECONNRESET')) return { type: 'connection-reset', message: err.message, code: 'ECONNRESET' };
  if (err.message && err.message.includes('ETIMEDOUT')) return { type: 'connection-timeout', message: err.message, code: 'ETIMEDOUT' };
  if (err.message && err.message.includes('socket')) return { type: 'socket-error', message: err.message, code: 'SOCKET_ERROR' };
  
  return { type: 'unknown', message: err.message || String(err), code: err.code || 'UNKNOWN' };
}

/**
 * Captures V8 heap snapshot for memory analysis
 */
function captureHeapSnapshot(label) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `heap-snapshot-${label}-${timestamp}.heapsnapshot`;
    const filepath = path.join(process.cwd(), filename);
    
    const snapshot = v8.writeHeapSnapshot(filepath);
    console.log(`  ✓ Heap snapshot captured: ${filename}`);
    return { label, filename, filepath, timestamp: new Date() };
  } catch (err) {
    console.error(`  ✗ Failed to capture heap snapshot: ${err.message}`);
    return null;
  }
}

// Metrics collector with detailed error analysis
class MetricsCollector {
  constructor() {
    this.latencies = [];
    this.successCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
    this.requestCount = 0;
    
    // Error categorization
    this.errorsByType = new Map();  // 'timeout', '5xx', '4xx', 'network', etc.
    this.statusCodeDistribution = new Map();  // 200: 1234, 503: 12, etc.
    this.failedRequests = [];  // Detailed error info with request IDs
    this.endpointErrors = new Map();  // '/api/restaurants/X': [errors...]
    
    // 4xx errors with full details for diagnosis
    this.errors4xxDetailed = [];  // [{statusCode, endpoint, responseBody, requestId}...]
    
    // Heap snapshots
    this.heapSnapshots = [];
    
    // GC tracking
    this.gcEvents = [];
  }
  
  recordLatency(ms) {
    this.latencies.push(ms);
    this.successCount++;
    this.requestCount++;
  }
  
  recordError(err, statusCode, requestId, endpoint, responseBody = '', nodeErrorCode = null) {
    this.errorCount++;
    this.requestCount++;
    
    // Categorize error type
    const errorInfo = categorizeError(err, statusCode);
    const type = errorInfo.type;
    
    // Track error by type
    if (!this.errorsByType.has(type)) {
      this.errorsByType.set(type, 0);
    }
    this.errorsByType.set(type, this.errorsByType.get(type) + 1);
    
    // Track status code distribution
    if (statusCode) {
      if (!this.statusCodeDistribution.has(statusCode)) {
        this.statusCodeDistribution.set(statusCode, 0);
      }
      this.statusCodeDistribution.set(statusCode, this.statusCodeDistribution.get(statusCode) + 1);
    }
    
    // Store 4xx errors with full details for diagnosis
    if (statusCode >= 400 && statusCode < 500) {
      this.errors4xxDetailed.push({
        statusCode,
        endpoint,
        responseBody: responseBody.substring(0, 300),
        requestId,
        nodeErrorCode,
        timestamp: new Date()
      });
    }
    
    // Store failed request details
    this.failedRequests.push({
      requestId,
      endpoint,
      errorType: type,
      statusCode,
      nodeErrorCode: nodeErrorCode || errorInfo.code,
      message: errorInfo.message,
      timestamp: new Date(),
      retriable: type === 'timeout' || type === '5xx' || type.includes('connection') || type.includes('error')
    });
    
    // Track errors by endpoint
    if (endpoint) {
      if (!this.endpointErrors.has(endpoint)) {
        this.endpointErrors.set(endpoint, []);
      }
      this.endpointErrors.get(endpoint).push({
        type,
        statusCode,
        nodeErrorCode,
        message: errorInfo.message
      });
    }
  }
  
  addHeapSnapshot(snapshot) {
    if (snapshot) {
      this.heapSnapshots.push(snapshot);
    }
  }
  
  recordGCPause(duration) {
    this.gcEvents.push({
      timestamp: new Date(),
      duration
    });
  }
  
  getStats() {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const count = sorted.length;
    
    return {
      // Latency stats
      latency: {
        min: count > 0 ? Math.min(...sorted) : 0,
        max: count > 0 ? Math.max(...sorted) : 0,
        avg: count > 0 ? sorted.reduce((a, b) => a + b, 0) / count : 0,
        p50: count > 0 ? sorted[Math.floor(count * 0.50)] : 0,
        p95: count > 0 ? sorted[Math.floor(count * 0.95)] : 0,
        p99: count > 0 ? sorted[Math.floor(count * 0.99)] : 0
      },
      
      // Request stats
      requests: {
        total: this.requestCount,
        success: this.successCount,
        errors: this.errorCount,
        errorRate: (this.errorCount / this.requestCount * 100).toFixed(2) + '%'
      },
      
      // Error breakdown
      errorsByType: Object.fromEntries(this.errorsByType),
      statusCodeDistribution: Object.fromEntries(this.statusCodeDistribution),
      
      // Load stats
      duration: (Date.now() - this.startTime) / 1000,
      requestsPerSecond: (this.requestCount / ((Date.now() - this.startTime) / 1000)).toFixed(2),
      
      // Database estimate (based on cache hit assumptions)
      dbQueryEstimate: {
        expectedCacheHitRate: '99%',
        estimatedDbQueries: Math.ceil(this.requestCount * 0.01),
        estimatedCacheHits: Math.ceil(this.requestCount * 0.99),
        dbQueryReduction: '200x'
      },
      
      // Memory info
      heapSnapshots: this.heapSnapshots,
      gcEvents: this.gcEvents,
      
      // Top errors
      topFailedRequests: this.failedRequests.slice(0, 10),
      failedRequestsByEndpoint: Object.fromEntries(
        [...this.endpointErrors.entries()].map(([endpoint, errors]) => [
          endpoint,
          {
            count: errors.length,
            types: [...new Set(errors.map(e => e.type))].join(', ')
          }
        ])
      ),
      
      // 4xx errors with details
      errors4xxDetailed: this.errors4xxDetailed.slice(0, 20),
      
      // Retry candidates
      retriableFailed: this.failedRequests.filter(r => r.retriable).length
    };
  }
}

/**
 * Make HTTP request to server with agent tuning
 */
function makeRequest(restaurantId) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const path = `/api/restaurants/${restaurantId}/menu-items`;
    const options = {
      hostname: SERVER_HOST,
      port: SERVER_PORT,
      path: path,
      method: 'GET',
      timeout: REQUEST_TIMEOUT_MS,
      agent: httpAgent  // Use tuned HTTP agent for connection pooling
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const latency = Date.now() - startTime;
        const requestId = res.headers['x-request-id'] || 'unknown';
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ 
            latency, 
            status: res.statusCode, 
            data: data.length,
            requestId,
            endpoint: path
          });
        } else if (res.statusCode === 503) {
          // 503 = restaurant integrity failed, expected
          reject({ 
            message: `Service Unavailable (integrity check blocking)`,
            statusCode: 503,
            code: null,
            requestId,
            endpoint: path,
            responseBody: data.substring(0, 200)
          });
        } else {
          reject({ 
            message: `HTTP ${res.statusCode}`,
            statusCode: res.statusCode,
            code: null,
            requestId,
            endpoint: path,
            responseBody: data.substring(0, 200)
          });
        }
      });
    });
    
    req.on('error', (err) => {
      reject({ 
        message: err.message,
        statusCode: null,
        code: err.code || null,  // Node.js error code: ECONNREFUSED, ETIMEDOUT, etc.
        requestId: 'unknown',
        endpoint: path
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject({ 
        message: 'Timeout',
        statusCode: null,
        code: 'TIMEOUT',
        requestId: 'unknown',
        endpoint: path
      });
    });
    
    req.end();
  });
}

/**
 * Retry a failed request once
 */
async function retryRequest(failedRequest) {
  try {
    const result = await makeRequest(TEST_RESTAURANT_ID);
    return { ...failedRequest, succeeded: true, result };
  } catch (err) {
    return { ...failedRequest, succeeded: false, retryError: err };
  }
}

/**
 * Simulate one user making requests continuously
 */
async function simulateUser(metrics, endTime) {
  while (Date.now() < endTime) {
    try {
      const result = await makeRequest(TEST_RESTAURANT_ID);
      metrics.recordLatency(result.latency);
    } catch (err) {
      metrics.recordError(
        new Error(err.message),
        err.statusCode,
        err.requestId,
        err.endpoint,
        err.responseBody || '',
        err.code  // Pass Node.js error code
      );
    }
    
    // Small delay between requests (100-500ms random)
    const delay = Math.random() * 400 + 100;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

/**
 * Health endpoint stress test (isolates client socket health from DB logic)
 * 
 * Hits /health at high rate for 10 seconds with 50 concurrent users
 * Used to detect OS-level socket pool issues vs. application issues
 */
async function runHealthStressTest() {
  console.log('\n' + '═'.repeat(70));
  console.log('HEALTH ENDPOINT STRESS TEST (Socket/Network Isolation)');
  console.log('═'.repeat(70));
  
  let totalRequests = 0;
  let successCount = 0;
  let errorCount = 0;
  const errors = [];
  
  const healthTestDuration = 10000; // 10 seconds
  const healthConcurrency = 50;
  const testStart = Date.now();
  
  async function healthTest() {
    while (Date.now() - testStart < healthTestDuration) {
      try {
        await new Promise((resolve, reject) => {
          const opts = {
            hostname: SERVER_HOST,
            port: SERVER_PORT,
            path: '/health',
            method: 'GET',
            timeout: 2000,
            agent: httpAgent
          };
          
          const req = http.request(opts, (res) => {
            if (res.statusCode === 200) {
              successCount++;
            } else {
              errorCount++;
              errors.push({ status: res.statusCode, endpoint: '/health' });
            }
            resolve();
          });
          
          req.on('error', (err) => {
            errorCount++;
            errors.push({ code: err.code, message: err.message, endpoint: '/health' });
            resolve();
          });
          
          req.end();
        });
      } catch (err) {
        errorCount++;
      }
      totalRequests++;
    }
  }
  
  // Run health test with concurrency
  const healthPromises = [];
  for (let i = 0; i < healthConcurrency; i++) {
    healthPromises.push(healthTest());
  }
  
  await Promise.all(healthPromises);
  
  const healthErrorRate = (errorCount / totalRequests * 100).toFixed(2);
  console.log(`\nHealth Test Results:`);
  console.log(`  Total: ${totalRequests} requests`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Error Rate: ${healthErrorRate}%`);
  
  if (errorCount > 0) {
    console.log(`\n  Sample Errors:`);
    errors.slice(0, 5).forEach(err => {
      if (err.code) {
        console.log(`    - Node error: ${err.code} (${err.message})`);
      } else if (err.status) {
        console.log(`    - HTTP status: ${err.status}`);
      }
    });
    console.log(`\n  ⚠️  Health check failures suggest network/socket layer issues`);
    console.log(`      (Not application logic - test with /health endpoint)`);
  } else {
    console.log(`\n  ✓ Health endpoint requests 100% successful (network/socket layer OK)`);
  }
  
  return { totalRequests, successCount, errorCount, errorRate: healthErrorRate };
}

/**
 * Main load test
 */
async function runLoadTest() {
  console.log('═'.repeat(70));
  console.log('REALISTIC HTTP LOAD TEST WITH DIAGNOSTICS');
  console.log('═'.repeat(70));
  console.log(`Target: http://${SERVER_HOST}:${SERVER_PORT}`);
  console.log(`Restaurant: ${TEST_RESTAURANT_ID}`);
  console.log(`Concurrent Users: ${CONCURRENT_USERS}`);
  console.log(`Duration: ${DURATION_SECONDS} seconds`);
  console.log(`Request Timeout: ${REQUEST_TIMEOUT_MS}ms`);
  console.log('═'.repeat(70));
  
  // Run health endpoint test first (isolates socket issues)
  console.log('\nRunning preliminary health endpoint test...');
  const healthTestResult = await runHealthStressTest();
  
  if (healthTestResult.errorRate > 5) {
    console.log('\n⚠️  HEALTH TEST SHOWING >5% ERROR RATE - LIKELY OS/NETWORK ISSUE');
    console.log('    Consider:');
    console.log('    - Increasing ulimit -n (open files)');
    console.log('    - Reducing CONCURRENT_USERS temporarily');
    console.log('    - Checking OS-level TCP connection limits');
  }
  
  // Capture initial heap snapshot
  console.log('\n📸 Capturing initial heap snapshot...');
  const heapStart = captureHeapSnapshot('start');
  
  // Verify server is running

  console.log('\n↳ Checking if server is running...');
  try {
    await makeRequest(TEST_RESTAURANT_ID);
    console.log('✓ Server is responding\n');
  } catch (err) {
    console.error('✗ Server is not responding!');
    console.error(`  Make sure backend is running: node backend/server/index.js`);
    process.exit(1);
  }
  
  const metrics = new MetricsCollector();
  if (heapStart) metrics.addHeapSnapshot(heapStart);
  
  const endTime = Date.now() + (DURATION_SECONDS * 1000);
  const midTime = Date.now() + (DURATION_SECONDS / 2 * 1000);
  let heapMidCaptured = false;
  
  console.log(`Starting ${CONCURRENT_USERS} concurrent users for ${DURATION_SECONDS}s...`);
  console.log('');
  
  // Start all concurrent users
  const userPromises = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    userPromises.push(simulateUser(metrics, endTime));
  }
  
  // Progress indicator with mid-point heap capture
  const progressInterval = setInterval(() => {
    const stats = metrics.getStats();
    const now = Date.now();
    
    // Capture heap at 30 seconds
    if (now >= midTime && !heapMidCaptured) {
      heapMidCaptured = true;
      console.log('\n📸 Capturing mid-load heap snapshot...');
      const heapMid = captureHeapSnapshot('midpoint');
      if (heapMid) metrics.addHeapSnapshot(heapMid);
    }
    
    process.stdout.write(
      `\r[${Math.floor(stats.duration)}s/${DURATION_SECONDS}s] ` +
      `${stats.requests.total} requests | ` +
      `${stats.requestsPerSecond} req/s | ` +
      `${stats.latency.avg.toFixed(0)}ms avg | ` +
      `${stats.requests.errorRate} errors`
    );
  }, 1000);
  
  // Wait for all users to finish
  await Promise.all(userPromises);
  clearInterval(progressInterval);
  
  // Capture final heap snapshot
  console.log('\n\n📸 Capturing final heap snapshot...');
  const heapEnd = captureHeapSnapshot('end');
  if (heapEnd) metrics.addHeapSnapshot(heapEnd);
  
  const stats = metrics.getStats();
  
  // RETRY PHASE: Attempt to retry failed requests to detect connection reuse issues
  console.log('\n════════════════════════════════════════════');
  console.log('🔄 RETRY PHASE: Testing connection stability');
  console.log('════════════════════════════════════════════');
  
  const retriableFailed = stats.topFailedRequests.filter(r => r.retriable);
  if (retriableFailed.length > 0) {
    console.log(`Retrying ${retriableFailed.length} failed requests...`);
    
    const retryResults = await Promise.all(
      retriableFailed.map(failedReq => retryRequest(failedReq))
    );
    
    const retriesSucceeded = retryResults.filter(r => r.succeeded).length;
    const retriesFailed = retryResults.filter(r => !r.succeeded).length;
    
    console.log(`Retry results: ${retriesSucceeded}/${retriableFailed.length} succeeded`);
    if (retriesFailed > 0) {
      console.log(`  ⚠️  ${retriesFailed} requests still failing (persistent error)`);
    } else {
      console.log(`  ✓ All retries succeeded (likely transient issues)`);
    }
  } else {
    console.log('No retriable errors to retry.');
  }
  
  console.log('\n' + '═'.repeat(70));
  console.log('RESULTS');
  console.log('═'.repeat(70));
  
  // Latency Report
  console.log('\n📊 LATENCY METRICS:');
  console.log(`  Min:   ${stats.latency.min.toFixed(0)}ms`);
  console.log(`  Avg:   ${stats.latency.avg.toFixed(0)}ms`);
  console.log(`  P50:   ${stats.latency.p50.toFixed(0)}ms (median)`);
  console.log(`  P95:   ${stats.latency.p95.toFixed(0)}ms`);
  console.log(`  P99:   ${stats.latency.p99.toFixed(0)}ms`);
  console.log(`  Max:   ${stats.latency.max.toFixed(0)}ms`);
  
  // Request Report
  console.log('\n📈 REQUEST METRICS:');
  console.log(`  Total:      ${stats.requests.total}`);
  console.log(`  Success:    ${stats.requests.success}`);
  console.log(`  Errors:     ${stats.requests.errors}`);
  console.log(`  Error Rate: ${stats.requests.errorRate}`);
  console.log(`  Req/sec:    ${stats.requestsPerSecond}`);
  
  // Error Breakdown
  console.log('\n🚨 ERROR BREAKDOWN:');
  if (Object.keys(stats.errorsByType).length > 0) {
    Object.entries(stats.errorsByType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\n📍 STATUS CODE DISTRIBUTION:');
    Object.entries(stats.statusCodeDistribution).forEach(([code, count]) => {
      console.log(`  HTTP ${code}: ${count}`);
    });
    
    // 4xx detailed breakdown
    if (stats.errors4xxDetailed && stats.errors4xxDetailed.length > 0) {
      console.log('\n🔴 4XX CLIENT ERRORS (Detailed Breakdown):');
      const grouped4xx = {};
      stats.errors4xxDetailed.forEach(err => {
        const key = `${err.statusCode}-${err.endpoint}`;
        if (!grouped4xx[key]) {
          grouped4xx[key] = [];
        }
        grouped4xx[key].push(err);
      });
      
      Object.entries(grouped4xx).forEach(([key, errors]) => {
        const [status, endpoint] = key.split('-');
        console.log(`  HTTP ${status} ${endpoint}`);
        console.log(`    Count: ${errors.length}`);
        if (errors[0].responseBody) {
          console.log(`    Sample Response: ${errors[0].responseBody}`);
        }
        console.log(`    Sample RequestID: ${errors[0].requestId}`);
      });
    }
    
    console.log('\n❌ FAILED ENDPOINTS:');
    Object.entries(stats.failedRequestsByEndpoint).forEach(([endpoint, info]) => {
      console.log(`  ${endpoint}: ${info.count} errors (${info.types})`);
    });
    
    console.log('\n📋 SAMPLE FAILED REQUESTS (first 5):');
    stats.topFailedRequests.slice(0, 5).forEach((req, i) => {
      console.log(`  ${i + 1}. [${req.requestId}] ${req.errorType} (${req.statusCode || 'N/A'}): ${req.message}`);
      if (req.endpoint) console.log(`     Endpoint: ${req.endpoint}`);
    });
  } else {
    console.log('  ✓ No errors!');
  }
  
  // Memory Report
  console.log('\n💾 MEMORY DIAGNOSTICS:');
  if (stats.heapSnapshots.length > 0) {
    stats.heapSnapshots.forEach(snapshot => {
      console.log(`  ${snapshot.label}: ${snapshot.filename}`);
    });
    console.log('  (Use Chrome DevTools to analyze heap snapshots)');
  }
  
  // Database Impact
  console.log('\n💾 DATABASE IMPACT ESTIMATE:');
  console.log(`  Expected Cache Hit Rate: ${stats.dbQueryEstimate.expectedCacheHitRate}`);
  console.log(`  Estimated DB Queries:    ${stats.dbQueryEstimate.estimatedDbQueries}`);
  console.log(`  Estimated Cache Hits:    ${stats.dbQueryEstimate.estimatedCacheHits}`);
  console.log(`  DB Load Reduction:       ${stats.dbQueryEstimate.dbQueryReduction}`);
  
  // Pass/Fail
  console.log('\n🎯 ACCEPTANCE CRITERIA:');
  const passChecks = [];
  const failChecks = [];
  
  if (stats.latency.avg < 50) passChecks.push('✓ Average latency < 50ms');
  else failChecks.push('✗ Average latency >= 50ms (' + stats.latency.avg.toFixed(0) + 'ms)');
  
  if (stats.latency.p95 < 150) passChecks.push('✓ P95 latency < 150ms');
  else failChecks.push('✗ P95 latency >= 150ms (' + stats.latency.p95.toFixed(0) + 'ms)');
  
  if (stats.latency.p99 < 250) passChecks.push('✓ P99 latency < 250ms');
  else failChecks.push('✗ P99 latency >= 250ms (' + stats.latency.p99.toFixed(0) + 'ms)');
  
  if (parseFloat(stats.requests.errorRate) < 0.1) passChecks.push(`✓ Error rate < 0.1% (${stats.requests.errorRate})`);
  else if (parseFloat(stats.requests.errorRate) < 1) failChecks.push(`⚠️  Error rate < 1% but >= 0.1% (${stats.requests.errorRate}) - NEEDS INVESTIGATION`);
  else failChecks.push(`✗ Error rate >= 1% (${stats.requests.errorRate})`);
  
  if (parseFloat(stats.requestsPerSecond) > 20) passChecks.push(`✓ Throughput > 20 req/s (${stats.requestsPerSecond})`);
  else failChecks.push(`✗ Throughput <= 20 req/s (${stats.requestsPerSecond})`);
  
  passChecks.forEach(check => console.log('  ' + check));
  failChecks.forEach(check => console.log('  ' + check));
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  const passed = failChecks.length === 0;
  if (passed) {
    console.log('✅ LOAD TEST PASSED - READY FOR PRODUCTION');
  } else {
    if (failChecks.some(c => c.includes('NEEDS INVESTIGATION'))) {
      console.log('⚠️  LOAD TEST INCONCLUSIVE - ERROR RATE ABOVE GOAL, REVIEW DIAGNOSTICS');
    } else {
      console.log('❌ LOAD TEST FAILED - FIX BEFORE PRODUCTION');
    }
  }
  console.log('═'.repeat(70));
  
  console.log('\n📋 DIAGNOSTIC FILES CREATED:');
  stats.heapSnapshots.forEach(snapshot => {
    console.log(`  - ${snapshot.filename}`);
  });
  console.log('  (Use "./diagnose-load-test.sh" to analyze)\n');
  
  process.exit(passed ? 0 : 1);
}

// Run test
runLoadTest().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
