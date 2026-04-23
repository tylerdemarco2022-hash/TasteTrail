# LOAD TEST DIAGNOSTIC GUIDE

## Objective
Identify the root cause of the 0.68% error rate under sustained load through comprehensive instrumentation and correlation.

## Changes Made

### 1. Server-Side Request ID Logging
**File**: `backend/server/index.js`

- Added UUID generation for every incoming request
- Each request assigned unique `requestId` (X-Request-ID header)
- Request ID logged with routing information
- Request ID returned in response headers
- Enables correlation of failed requests across load test and server logs

```javascript
// Middleware automatically assigns unique ID to each request
req.requestId = uuidv4();
res.setHeader('X-Request-ID', req.requestId);
```

### 2. Enhanced Load Test with Error Categorization
**File**: `backend/scripts/load-test-http.mjs`

#### Error Categories Tracked:
- **timeout**: Request exceeded 5000ms
- **5xx**: Server errors (500-599)
- **4xx**: Client errors (400-499)
- **connection-refused**: Server not accepting connections
- **connection-reset**: Connection dropped by server
- **connection-timeout**: TCP handshake timeout
- **socket-error**: Low-level socket issues
- **unknown**: Other errors

#### Detailed Error Logging:
Each failed request records:
- Request ID (from server response header)
- Endpoint accessed
- Error type category
- HTTP status code
- Error message
- Whether the error is retriable
- Sample response body (first 200 chars)

#### Heap Snapshots:
- Captured at: start, 30 seconds (mid-test), and end
- Files: `heap-snapshot-{label}-{timestamp}.heapsnapshot`
- Analyze in Chrome DevTools to detect memory leaks
- Look for growing object counts or retained memory

#### Retry Phase:
After main load test completes:
- Retries all "retriable" failed requests (timeouts, 5xx, connection issues)
- Tests if errors are transient or persistent
- Detects connection pool exhaustion vs actual application bugs

### 3. Diagnostic Correlation Script
**File**: `backend/scripts/diagnose-load-test.mjs`

Automatically:
- Parses load test output for failed request IDs
- Searches server logs for matching request IDs
- Correlates failures to server responses
- Suggests root causes based on error patterns
- Warns if requests didn't reach the server (network issue)

## How to Run the Diagnostics

### Step 1: Start Backend with Logging
```bash
# Terminal 1
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"

# Set up development environment
set NODE_ENV=development
set ADMIN_API_KEY=test-key-for-diagnostics

# Run backend with log capture
node backend/server/index.js 2>&1 | tee server.log
```

**What to look for in server logs:**
- Request IDs in routing logs: `[ROUTING] GET /api/... [uuid-here]`
- Any integrity-related errors
- Database connection issues
- Memory warnings

### Step 2: Run Enhanced Load Test
```bash
# Terminal 2
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"

# Run load test with logging
node backend/scripts/load-test-http.mjs 2>&1 | tee load-test.log
```

**What to expect:**
- Progress updates every second
- Heap snapshot messages at 0%, 50%, and 100%
- After 60 seconds: Detailed error breakdown
- Retry phase: Tests if failed requests succeed on retry
- Exit code 0 = all criteria passed, 1 = failures detected

### Step 3: Correlate Failures to Server
```bash
# Terminal 3
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"

# Find which failed requests in load test appear in server logs
node backend/scripts/diagnose-load-test.mjs
```

**This generates:**
- Error type breakdown (timeout, 5xx, 4xx, network)
- Correlation analysis (which errors were seen on server)
- Pattern analysis with suggested causes
- Uncorrelated failures (never reached server)

## Interpreting Results

### Error Rate Analysis

**0.68% error rate = ~680 errors per 100,000 requests**

#### If errors are categorized as:

**Timeouts (5000ms+)**
- Look at: Integrity cache stats in server logs
- Check: Database query times
- Suspect: GC pauses, slow integrity validation

**5xx Server Errors**
- Look at: Error messages in server logs
- Check: Integrity validation failures
- Suspect: Database connection pool exhausted

**4xx Client Errors**
- Likely: Misconfigured requests
- Check: Request format in load test

**Connection Errors (not appearing in server logs)**
- Suspect: OS resource limits (connection pool, file descriptors)
- Check: `ulimit -n` (open files limit)
- Check: `netstat -an | grep ESTABLISHED | wc -l`

### Request ID Correlation

#### Perfect Scenario (all correlations found):
- Every failed request in load test has matching log in server
- Suggests issue is in application logic, not network

#### Correlation Gap (uncorrelated failures):
- Load test shows error, but not in server logs
- Could mean:
  - Request never reached server (network issue)
  - Server crashed/restarted during test
  - Server logs truncated
- Fix: Ensure proper logging setup, check network stack

## Memory Analysis

### Using Heap Snapshots

1. Copy heap snapshot files to local machine
2. Open Chrome DevTools: `chrome://devtools`
3. Sources → Memory → Load profile
4. Compare snapshots:
   - `heap-snapshot-start-*.heapsnapshot`: Baseline
   - `heap-snapshot-midpoint-*.heapsnapshot`: After 30s of load
   - `heap-snapshot-end-*.heapsnapshot`: After 60s of load

**Look for:**
- Growing array sizes (unbounded accumulation)
- Increasing object counts (memory leak pattern)
- Temporary spikes (GC pauses before collection)

## Common Issues & Fixes

### Issue: "Timeout" errors appearing
**Diagnosis:**
- Check if heap snapshots show increasing memory
- Server logs: Search for slow query warnings
- Check integrity cache stats: Should be 99%+ hit rate

**Fixes:**
- Increase request timeout (currently 5000ms)
- Optimize integrity validation
- Add database query timeout
- Increase heap size: `node --max-old-space-size=2048`

### Issue: "5xx Server Errors" at high concurrency
**Diagnosis:**
- Search server logs for error messages with matching request IDs
- Check DATABASE connection pool (default ~10 in node-postgres)
- Look for "too many connections" errors

**Fixes:**
- Increase database connection pool size
- Add connection request timeout  
- Implement request queuing

### Issue: "Connection Refused" errors
**Diagnosis:**
- Server likely not listening or crashed
- Check if `node backend/server/index.js` is actually running
- Server validation may have failed at startup

**Fixes:**
- Verify server starts without errors
- Check environment variables are set
- Run server separately to see initialization logs

### Issue: No correlation found (requests don't reach server)
**Diagnosis:**
- Network layer issue or firewall
- OS file descriptor limit exceeded: `ulimit -n`
- TCP connection queue full

**Fixes:**
```bash
# Increase open files limit (macOS/Linux)
ulimit -n 10000

# Windows: Check connection states
netstat -an | find "ESTABLISHED"

# Reduce CONCURRENT_USERS in load test (temporary)
# Change CONCURRENT_USERS from 100 to 50 in load-test-http.mjs
```

## Iteration Process

1. **Run diagnostics** (following instructions above)
2. **Review error categories** - which type dominates?
3. **Check correlation** - do failures appear in server?
4. **Analyze patterns** - is it memory, database, or network?
5. **Make targeted fix** based on diagnosis
6. **Re-run to verify** improvement
7. **Repeat until** <0.1% error rate achieved

## Key Files for Investigation

| File | Purpose |
|------|---------|
| `server.log` | Server startup, routing, errors with request IDs |
| `load-test.log` | Load test output, error breakdown |
| `heap-snapshot-*.heapsnapshot` | Memory profiles at different time points |
| `backend/utils/integrityCache.js` | Cache hit rate, promise deduping |
| `backend/server/index.js` | Request ID middleware, error handling |

## Success Criteria

✅ Error rate < 0.1% (currently 0.68%)
✅ All failed requests correlated to server (or identified as network issue)
✅ No memory leaks in heap snapshots
✅ Cache hit rate >= 99%
✅ P99 latency < 250ms
✅ Retry phase shows transient nature of failures (if retries succeed)

## Next: Root Cause

After running these diagnostics, the error breakdown will tell us:

- **Mostly timeouts?** → Database/cache issue
- **Mostly 5xx errors?** → Application bug or resource limit
- **Mostly uncorrelated?** → Network/OS limit issue
- **Mixed?** → Multiple issues, fix one at a time

Then we can make targeted fixes with confidence.
