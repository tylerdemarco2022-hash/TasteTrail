## 🎯 FINAL OPTIMIZATION: Sub-150ms Target

### Current Performance (BEFORE Indexes)
```
DB Query (restaurants):  219ms
Activity Query:          110ms
Distance Calc/Enrich:      0ms
Sorting:                   0ms
─────────────────────────────
TOTAL:                   434ms  ⚠️ Above 150ms target
```

---

## ⚡ STEP 1: Run SQL in Supabase Dashboard

**Location:** [RUN_THIS_SQL_IN_SUPABASE.sql](RUN_THIS_SQL_IN_SUPABASE.sql)

1. Open: https://supabase.com/dashboard
2. Navigate to: **SQL Editor** → **New Query**
3. Paste this SQL:

```sql
CREATE INDEX IF NOT EXISTS idx_restaurants_lat ON restaurants(lat);
CREATE INDEX IF NOT EXISTS idx_restaurants_lng ON restaurants(lng);
CREATE INDEX IF NOT EXISTS idx_restaurants_flagged_closed 
  ON restaurants(flagged_closed) WHERE flagged_closed = false;
CREATE INDEX IF NOT EXISTS idx_restaurant_activity_lookup 
  ON restaurant_activity(restaurant_id, created_at DESC, type);
```

4. Click **RUN**
5. Wait for green checkmark (success)

---

## ✅ STEP 2: Retest Performance

Run in terminal:
```bash
node test-performance.mjs
```

**Expected Results:**
```
DB Query:        219ms → ~50-80ms   (⬇️ 60-75% improvement)
Activity Query:  110ms → ~20-30ms   (⬇️ 70-80% improvement)
────────────────────────────────────────────────────
TOTAL:           434ms → ~100-150ms ✅ MEETS TARGET
```

---

## 🔧 Code Changes Applied

### 1. Non-Blocking View Logging
**File:** `server/routes/discovery.js`

Changed from blocking `for...await` loop to non-blocking `Promise.all` fire-and-forget pattern.

**Impact:** 5,178ms → 434ms (91% improvement - already applied)

### 2. Conditional Timing Response
**File:** `server/routes/discovery.js`

```javascript
// Only include timings in non-production
if (process.env.NODE_ENV !== 'production') {
  response.timings = timings;
}
```

**Impact:** Cleaner production API responses

---

## 📊 Performance Timeline

| State | Time | Status |
|-------|------|--------|
| Initial (blocking view logging) | 5,178ms | ❌ Critical |
| After async logging fix | 434ms | ⚠️ Acceptable |
| **After indexes (projected)** | **~100-150ms** | ✅ **Target Met** |

---

## 🧪 Verification Commands

### Test Single Query
```bash
node test-performance.mjs
```

### Test Multiple Query Patterns
```bash
node test-performance-comprehensive.mjs
```

### Check Server Logs
Watch console output for performance logs:
```
📊 Query Performance: 434ms (DB: 219ms, Activity: 110ms, Calc: 0ms, Sort: 0ms)
```

---

## 🎯 Success Criteria

- ✅ DB Query: < 100ms
- ✅ Activity Query: < 50ms
- ✅ Total Time: < 150ms
- ✅ Distance Calc: < 5ms
- ✅ Sorting: < 5ms

---

## 📝 Next Steps

1. **RUN SQL** in Supabase Dashboard (see above)
2. **Retest** with `node test-performance.mjs`
3. **Verify** all queries consistently under 150ms
4. **Monitor** production performance logs

---

## 🚀 Expected Final State

```
🔍 Testing Discovery API Performance...

✅ Status: 200
⏱️  Total Request Time: ~120-140ms

📊 SERVER TIMING BREAKDOWN:
=====================================
  DB Query (restaurants):  ~60ms   ✅
  Activity Query:          ~25ms   ✅
  Distance Calc/Enrich:      0ms   ✅
  Sorting:                   0ms   ✅
  TOTAL (server):          ~100ms  ✅ TARGET MET
=====================================

✅ EXCELLENT: Below 150ms target
```

---

**Status:** ⏳ **Awaiting Index Creation in Supabase**

Once SQL is executed, retest and report final numbers.
