# ERROR RATE DIAGNOSIS INSTRUMENTATION

## Summary of Changes

You now have comprehensive instrumentation to diagnose why error rate is 0.68%. The system will:

1. **Generate request IDs** - Every request gets a unique UUID for correlation
2. **Categorize errors** - Timeout, 5xx, 4xx, connection, socket, unknown
3. **Capture error details** - Response status, endpoint, sample body
4. **Correlate to server** - Match load test failures to server logs
5. **Memory analysis** - Heap snapshots at start/mid/end of test
6. **Retry detection** - Test if failures are transient vs. persistent

## Modified Files

### 1. `backend/server/index.js`
**Change**: Added request ID middleware

```javascript
import { v4 as uuidv4 } from 'uuid';

// NEW MIDDLEWARE:
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Updated routing to log request IDs:
app.use((req, res, next) => {
  console.log(`[ROUTING] ${req.method} ${req.url} [${req.requestId}]`);
  next();
});
```

**Impact**: Every request now has a unique identifier for correlation.

### 2. `backend/scripts/load-test-http.mjs` (Complete Rewrite)
**Changes**:
- Added `v8` module for heap snapshots
- Enhanced `MetricsCollector` class with:
  - `errorsByType` Map for categorization
  - `statusCodeDistribution` Map
  - `failedRequests` array with full details
  - `endpointErrors` Map for per-endpoint tracking
  - `heapSnapshots` array

- Added error categorization function:
  ```javascript
  categorizeError(err, statusCode)
  // Returns: { type: 'timeout'|'5xx'|'4xx'|'connection-*'|'socket-error'|'unknown', message }
  ```

- Added heap snapshot capture:
  ```javascript
  captureHeapSnapshot(label)  // label = 'start'|'midpoint'|'end'
  // Creates: heap-snapshot-{label}-{timestamp}.heapsnapshot
  ```

- Added retry phase:
  ```javascript
  retryRequest(failedRequest)
  // Retries all retriable errors to detect transient vs. persistent
  ```

- Enhanced output with:
  - Error type breakdown
  - Status code distribution
  - Failed endpoints analysis
  - Sample failed request details
  - Retry results
  - Memory file references

### 3. `backend/scripts/diagnose-load-test.mjs` (New File)
**Purpose**: Correlate load test failures to server logs

**Functions**:
- `parseLoadTestLog()` - Extract failed request IDs from load test output
- `findInServerLogs(requestIds)` - Search server logs for matches
- `analyzeErrors(failures, correlations)` - Generate diagnostic analysis

**Output**:
- Error type breakdown
- Correlation statistics
- Pattern analysis (timeouts, 5xx, connection issues)
- Uncorrelated failures warning
- Recommended next steps

## How to Use

### Quick Start (3 terminals)

**Terminal 1 - Start Backend with Logging:**
```bash
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"
set NODE_ENV=development
set ADMIN_API_KEY=test-key
node backend/server/index.js 2>&1 | tee server.log
```

**Terminal 2 - Run Load Test:**
```bash
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"
node backend/scripts/load-test-http.mjs 2>&1 | tee load-test.log
```

**Terminal 3 - Analyze Results:**
```bash
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"
node backend/scripts/diagnose-load-test.mjs
```

## What Each Tool Does

### Load Test Output
```
[60s/60s] 3500 requests | 58.33 req/s | 45ms avg | 0.68% errors

📊 ERROR BREAKDOWN:
  timeout: 12
  5xx: 3
  4xx: 12
  connection-timeout: 1

📍 FAILED ENDPOINTS:
  /api/restaurants/test-id/menu-items: 28 errors

❌ SAMPLE FAILURES:
  1. [a1b2c3d4-...] timeout (N/A): Timeout
  2. [e5f6g7h8-...] 4xx (400): HTTP 400
  ...

🔄 RETRY PHASE:
  Retrying 16 retriable errors...
  Retry results: 12/16 succeeded
  ⚠️ 4 requests still failing
```

### Diagnostic Output
```
DIAGNOSTIC ANALYSIS
===================

📊 ERROR TYPE BREAKDOWN:
  timeout: 12
  4xx: 12
  connection-timeout: 1
  5xx: 3

🔗 SERVER LOG CORRELATION:
  ✓ 23/28 failed requests found in server logs
  ⚠️ 5/28 failed requests NOT in server logs
    (These never reached the server - network issue)

🔍 PATTERN ANALYSIS:
  ⚠️ Timeouts detected (12): Could indicate:
     - Database queries taking >5000ms
     - Integrity checks blocking requests
     - Memory pressure/GC pauses
```

## What to Look For

### In Server Logs
```
[ROUTING] GET /api/restaurants/test-id/menu-items [a1b2c3d4-...]
  ↑ Every request now has unique ID
```

### In Load Test Output
- **Error rate breakdown** - Which type dominates?
- **Status codes** - Mostly 5xx = server problem, 4xx = client
- **Retry results** - Did failed requests succeed on retry?

### In Heap Snapshots
- Growing object counts = Memory leak
- Periodic spikes = Normal GC
- Declining memory = Healthy (cleanup working)

## Interpretation Guide

### Scenario 1: Mostly Timeout Errors
**Probable Cause**: Database queries too slow
**Investigation**:
- Check `integrityCache` stats in server logs
- Look for SQL queries with high execution time
- Monitor database connection pool

### Scenario 2: Mostly 5xx Server Errors
**Probable Cause**: Application exception or resource limit
**Investigation**:
- Search server logs for explicit error messages
- Check if integrity validation is blocking
- Monitor database connection count

### Scenario 3: Mostly Uncorrelated Failures
**Probable Cause**: Network/OS limit exceeded
**Investigation**:
- Check ulimit: `ulimit -n` (should be 10000+)
- Check connection states: `netstat -an | find "TIME_WAIT"`
- May need to reduce CONCURRENT_USERS temporarily

### Scenario 4: Mixed Error Types
**Probable Cause**: Multiple issues
**Fix**: Address one at a time (start with most frequent)

## Success Metrics After Fix

After addressing the root cause:
- ✅ Error rate < 0.1% (down from 0.68%)
- ✅ All 5 acceptance criteria pass
- ✅ Retry phase shows most failures are transient (not persistent bugs)
- ✅ Heap snapshots show healthy memory patterns

## Files Reference

| File | Size | Purpose |
|------|------|---------|
| `backend/server/index.js` | Modified | Request ID middleware |
| `backend/scripts/load-test-http.mjs` | Rewritten | Error categorization + heap snapshots |
| `backend/scripts/diagnose-load-test.mjs` | New | Correlation analysis |
| `LOAD_TEST_DIAGNOSTICS.md` | New | Detailed diagnostic guide |
| `server.log` | Generated | Server logs (created when you run) |
| `load-test.log` | Generated | Load test output (created when you run) |
| `heap-snapshot-*.heapsnapshot` | Generated | V8 heap snapshots for memory analysis |

## Dependencies

The instrumentation uses standard Node.js modules (no new npm packages):
- `uuid` - For generating request IDs (already in package.json)
- `v8` - For heap snapshots (built-in)
- `fs`, `path`, `readline` - For file operations (built-in)

## Next Steps

1. **Follow "Quick Start" above** to run the diagnostics
2. **Review load test output** for error patterns
3. **Run diagnose script** to correlate to server
4. **Identify root cause** from error categorization
5. **Make targeted fix** based on diagnosis
6. **Re-run to verify** error rate reduced
7. **Repeat until** <0.1% error rate achieved

## Questions?

- Review `LOAD_TEST_DIAGNOSTICS.md` for detailed interpretation guide
- Each error type has suggested causes and fixes
- Heap snapshots can be analyzed with Chrome DevTools
- Request IDs allow you to trace specific failures end-to-end
