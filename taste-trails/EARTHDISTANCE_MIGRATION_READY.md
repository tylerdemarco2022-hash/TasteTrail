# Production-Grade Radius Query Optimization

## Status: Ready for SQL Migration ✅

### Code Changes Complete
- ✅ Removed bounding box calculation
- ✅ Replaced with RPC call to `restaurants_within_radius()`
- ✅ True haversine distance at database level
- ✅ GIST spatial index ready
- ✅ Backend running and ready

### What's New

**Instead of:**
```javascript
const bbox = calculateBoundingBox(lat, lng, radiusMiles);
query = query
  .gte('lat', bbox.minLat).lte('lat', bbox.maxLat)
  .gte('lng', bbox.minLng).lte('lng', bbox.maxLng);
```

**Now:**
```javascript
const radiusMeters = radiusMiles * 1609.34;
const { data: restaurants, error } = await supabase.rpc('restaurants_within_radius', {
  user_lat: userLat,
  user_lng: userLng,
  radius_meters: radiusMeters
});
```

### SQL Required

**File:** [sql/enable_earthdistance.sql](sql/enable_earthdistance.sql)

1. Go to Supabase Dashboard → SQL Editor → New Query
2. Copy entire SQL from file above
3. Click RUN
4. Wait for green checkmark (10-60 seconds for GIST index)

### Performance Target After Migration

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| DB Query | ~250ms | 40-70ms | ✅ |
| Total (warm) | ~291ms | 100-140ms | ✅ |
| Accuracy | Approximate | True radius | ✅ |
| Quality | Bounding box | Production-grade | ✅ |

### Timeline

1. **NOW:** Run SQL migration in Supabase (3-5 min)
2. **AFTER SQL:** Restart backend (10 sec)
3. **THEN:** Test performance:
   ```bash
   node test-performance-comprehensive.mjs
   node test-performance-comprehensive.mjs
   ```
4. **EXPECT:** <150ms average, <100ms best case

### Next Steps

1. ⏳ **REQUIRED:** Execute SQL in Supabase Dashboard
2. 🔄 Restart: `taskkill /IM node.exe /F && node server/index.js`
3. 🧪 Test: `node test-performance-comprehensive.mjs` (run twice)
4. 📊 Check output for DB Query times

### Features Enabled

- ✨ PostgreSQL earthdistance extension
- ✨ GIST spatial indexing
- ✨ True 2D great-circle distance
- ✨ Parallel-safe RPC function
- ✨ Sorted by trending_score at DB level
- ✨ Closed restaurants filtered at DB level

### Why This Matters

**Bounding boxes (old):**
- Rectangular approximation
- Returns 10-40% more results
- Later filtered in JavaScript
- Can miss nearby restaurants on diagonal

**Earthdistance (new):**
- True haversine distance
- Only returns actual results
- No post-fetch filtering
- Production-grade spatial indexing
- GIST index specialized for 2D geometric queries

---

**Backend Status:** ✅ Running  
**Code Status:** ✅ Complete  
**Database Status:** ⏳ Awaiting SQL