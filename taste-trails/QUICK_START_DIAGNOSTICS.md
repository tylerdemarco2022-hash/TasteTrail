# Quick Start: Error Rate Diagnostics & Fixes

## In 3 Terminal Windows

### Terminal 1: Start Backend
```bash
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"
set NODE_ENV=development
set ADMIN_API_KEY=test-key
node backend/server/index.js 2>&1 | tee server.log
```

Wait for:
```
[INIT] Registering menu routes...
[INIT:OK] All routes registered
Backend running on http://localhost:8081
```

### Terminal 2: Run Load Test (after 5 seconds)
```bash
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"
node backend/scripts/load-test-http.mjs 2>&1 | tee load-test.log
```

Wait for ~70 seconds. You'll see:

**Health Test (10s):**
```
HEALTH ENDPOINT STRESS TEST (Socket/Network Isolation)
═════════════════════════════════════════════════════

Health Test Results:
  Total: 500 requests
  Success: 500
  Errors: 0
  Error Rate: 0.00%
  ✓ Health endpoint requests 100% successful
```

**Main Load Test (60s):**
```
[30s/60s] 1750 requests | 58.33 req/s | 45ms avg | 0.68% errors
```

**Results:**
```
📊 LATENCY METRICS:
  Min:   15ms
  Avg:   45ms
  P50:   42ms
  P95:   85ms
  P99:   120ms
  Max:   2500ms

📈 REQUEST METRICS:
  Total:      3500
  Success:    3476
  Errors:     24
  Error Rate: 0.68%
  Req/sec:    58.33

🔴 4XX CLIENT ERRORS (Detailed Breakdown):
  HTTP 400 /api/restaurants/{id}/menu-items
    Count: 12
    Sample Response: {"error":"Menu structure validation..."}
    Sample RequestID: uuid-here

🚨 ERROR BREAKDOWN:
  timeout: 12
  5xx: 3
  connection-reset: 2
  connection-timeout: 1
  unknown: 6

RETRY PHASE:
  Retrying 16 retriable errors...
  Retry results: 14/16 succeeded
  ⚠️ 2 requests still failing

🎯 ACCEPTANCE CRITERIA:
  ✓ Average latency < 50ms ✓ (45ms)
  ✗ Error rate < 0.1% (0.68%)  ← NEEDS FIX
  ✓ P95 latency < 150ms
  ✓ P99 latency < 250ms
  ✓ Throughput > 20 req/s
```

### Terminal 3: Analyze Failures (after load test completes)
```bash
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"
node backend/scripts/diagnose-load-test.mjs
```

Expected output:
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

  ⚠️ 4xx errors detected (12): Could indicate:
     - Invalid request format
     - Missing headers
     - Schema validation failures
```

---

## What Each Error Type Means

| Error | Root Cause | Where to Check |
|-------|-----------|-----------------|
| **Timeout** (12) | Request took >5000ms | Server logs: `slow_menu_request` timing breakdown |
| **5xx** (3) | Server error/exception | Server logs: error stack trace |
| **4xx** (12) | Bad request format | Load test output: `4XX CLIENT ERRORS` section |
| **Connection-reset** (2) | Server closed connection | Network/socket issue OR server restart |
| **Connection-timeout** (1) | Couldn't establish TCP | Server not listening OR firewall |

---

## Fixing Based on Error Breakdown  

### If Mostly Timeouts (>5 errors)

**Diagnosis:**
1. Check server logs for timing breakdown:
```bash
grep "slow_menu_request\|t_integrity_db_ms\|t_menu_query_db_ms" server.log | head -5
```

2. Look for component taking >1000ms:
```
"t_cache_check_ms": 0.5,
"t_integrity_db_ms": 450,      ← If >500ms, integrity DB is problem
"t_menu_query_db_ms": 320,     ← If >500ms, menu query is problem
"t_total_ms": 1205
```

**Fix:**
- If `t_integrity_db_ms > 500ms`: Add DB index on `restaurant_id` in integrity table
- If `t_menu_query_db_ms > 500ms`: Add DB index on (`restaurant_id`, `created_at`)
- Check Supabase query logs for slow queries

### If Mostly 4xx (>5 errors)

**Diagnosis:**
Check detailed 4xx breakdown:
```
HTTP 400 /api/restaurants/{id}/menu-items
  Sample Response: {"error":"Invalid restaurant ID format"}
```

**Fix:**
Two options:
1. **Fix Load Test**: Ensure correct request format (headers, body, URL encoding)
2. **Fix Server**: Ensure error messages are clear and consistent

### If Network/Connection Errors (>5 errors)

**Diagnosis:**
1. Run health test to isolate:
```bash
# Health test in load-test output shows if network layer is OK
# If health test >5% errors: Network issue
# If health test <1% errors: Application issue (not network)
```

2. Check for "never reached server" gap:
```bash
grep "NOT in server logs" diagnose-output.txt
# If >5 uncorrelated: Network issue
# If 0 uncorrelated: Application issue
```

**Fix:**
- Increase OS limits: `ulimit -n 10000`
- Check connection pool: `netstat -an | grep ESTABLISHED | wc -l`
- Reduce concurrent users temporarily: `const CONCURRENT_USERS = 50` in load test

---

## Memory Analysis

Heap snapshots are created automatically:

```bash
# List snapshots created
ls -la heap-snapshot-*.heapsnapshot

# You'll see:
# heap-snapshot-start-2026-02-26T00-00-00...heapsnapshot
# heap-snapshot-midpoint-2026-02-26T00-00-30...heapsnapshot
# heap-snapshot-end-2026-02-26T00-01-00...heapsnapshot
```

To analyze memory:
1. Download snapshots to local machine
2. Open Chrome DevTools: `chrome://devtools`
3. Sources → Memory tab
4. Load profile (each snapshot file)
5. Compare snapshots to detect leaks

Look for:
- **Growing arrays**: Unbounded accumulation (leak)
- **Declining memory**: Healthy GC behavior
- **Periodic spikes**: Normal GC collection

---

## Iteration Process

1. **Run diagnostics** (sections above)
2. **Identify top error class** (timeout? 4xx? network?)
3. **Fix that one issue** based on guidance above
4. **Re-run load test** to verify improvement
5. **Repeat** until all criteria met

Example iteration:
```
Iteration 1:
  - Error rate: 0.68% (24 errors)
  - Top issue: 12 timeouts
  - Fix: Add DB indexes
  - Result: 0.43% error rate (15 errors) ✓ Progress!

Iteration 2:
  - Error rate: 0.43% (15 errors)
  - Top issue: 12 4xx errors
  - Fix: Correct request body format
  - Result: 0.09% error rate (3 errors) ✓ Success!
```

---

## Success Checkpoint

When you see this, you're done:

```
🎯 ACCEPTANCE CRITERIA:
  ✓ Average latency < 50ms
  ✓ P95 latency < 150ms
  ✓ P99 latency < 250ms
  ✓ Error rate < 0.1%
  ✓ Throughput > 20 req/s

═══════════════════════════════════════════════════════════
✅ LOAD TEST PASSED - READY FOR PRODUCTION
═══════════════════════════════════════════════════════════
```

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/scripts/load-test-http.mjs` | Main load test with diagnostics |
| `backend/scripts/diagnose-load-test.mjs` | Correlation analysis tool |
| `server.log` | Server logs (created when you run backend) |
| `load-test.log` | Load test output (created when you run test) |
| `heap-snapshot-*.heapsnapshot` | Memory profiles for analysis |
| `backend/server/routes/menu.js` | Menu endpoint with timing |
| `backend/utils/integrityCache.js` | Cache with circuit breaker |
| `ERROR_RATE_REDUCTION_GUIDE.md` | Detailed fix guide (this directory) |

---

## One-Liner Quick Test

```bash
# Quick 5-second health test (50 concurrent, not full 60s)
timeout 5 node backend/scripts/load-test-http.mjs 2>&1 | head -20
```

---

## Common Issues & Fixes

| Issue | Check | Fix |
|-------|-------|-----|
| "Server is not responding" | Is backend running? | Start Terminal 1 first, wait 5s |
| Health test fails >5% | `ulimit -n` | Run `ulimit -n 10000` in terminal |
| All requests timeout | Server logs empty | Backend may have crashed, check console |
| No 4xx breakdown, all network | Firewall? | Check `netstat -an \| grep 8081` |
| Heap snapshots not created | Permissions? | Check write access to current directory |

---

Generated: February 26, 2026
Last Updated: After completing targeted fixes
