# Discovery Engine v2 Testing Guide (PHASES 8-13)

Complete testing instructions for the upgraded discovery system with performance hardening, demand-based tile boosting, dynamic confidence, trending, closure flagging, and enhanced UI.

## 📋 Pre-Testing Setup

### 1. Execute SQL Migration
```sql
-- Run the migration in Supabase SQL Editor
\i sql/discovery_engine_v2.sql
```

This will:
- Add 3 columns to `restaurants`: `scan_count`, `user_confirmations`, `flagged_closed`
- Create `restaurant_activity` table for trending tracking
- Create 4 PostgreSQL functions for calculations
- Create 4 indexes for performance optimization

### 2. Verify Backend Structure
```bash
backend/
  discovery/
    discoveryEngineUtils.js  # 9 utility functions
  routes/
    discovery.js             # Updated GET endpoint
    adminRestaurants.js      # Updated with flag-closed endpoint
```

### 3. Start Services
```bash
# Terminal 1: Start backend
node server/index.js

# Terminal 2: Start frontend  
npm run dev

# Frontend will be at http://localhost:5174
# Backend at http://localhost:8081
```

---

## 🧪 Testing Each Phase

### PHASE 8: Performance Hardening (Bounding Box Pre-filtering)

**Time Estimate:** 5 minutes  
**Goal:** Verify SQL query uses bounding box instead of full table scan

#### Test 8a: Verify Bounding Box Calculation
```bash
# This test runs in your backend environment
# Create a test file: test-bbox.js

const { calculateBoundingBox } = require('./backend/discovery/discoveryEngineUtils.js');

// Charlotte, NC center
const bbox = calculateBoundingBox(35.2271, -80.8431, 5);
console.log('Bounding Box (5 mi radius):');
console.log('  Min Lat:', bbox.minLat);  // ~35.1526
console.log('  Max Lat:', bbox.maxLat);  // ~35.3016
console.log('  Min Lng:', bbox.minLng);  // ~-80.9569
console.log('  Max Lng:', bbox.maxLng);  // ~-80.7293

// Expected: Values should be roughly ±0.04 degrees from center
```

#### Test 8b: Verify Index Performance
```sql
-- Run in Supabase SQL Editor
EXPLAIN ANALYZE
SELECT id, name, lat, lng 
FROM restaurants 
WHERE lat BETWEEN 35.1526 AND 35.3016 
  AND lng BETWEEN -80.9569 AND -80.7293
LIMIT 5;

-- Expected: Index Scan on idx_restaurants_lat_lng
-- NOT a Seq Scan (full table scan)
```

#### Test 8c: Live API Test
```bash
# Make requests and check query times
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5"

# Response should include:
# {
#   "success": true,
#   "searchCenter": { "lat": 35.2271, "lng": -80.8431 },
#   "radiusMiles": 5,
#   "count": <number>,
#   "restaurants": [...]
# }

# Validate: Response time should be <100ms (versus full table scan: 200-500ms)
```

---

### PHASE 9: Demand-Based Tile Boosting

**Time Estimate:** 10 minutes  
**Goal:** Verify that user searches increase tile priority

#### Test 9a: Check Initial Tile State
```sql
-- In Supabase
SELECT id, city, priority, next_run_at, last_run_at
FROM discovery_tiles
WHERE city = 'Charlotte'
LIMIT 1;

-- Note the initial priority (e.g., 5)
```

#### Test 9b: Make Search Request
```bash
# Make API call - this should identify the tile and boost it
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5"

# The API response includes tile info:
# "tile": { "city": "Charlotte", "priority": 5 }
```

#### Test 9c: Verify Tile Priority Increased
```sql
-- Wait 1-2 seconds, then check
SELECT id, city, priority, next_run_at
FROM discovery_tiles
WHERE city = 'Charlotte'
LIMIT 1;

-- Expected: priority should be 6 (increased by 1)
-- Expected: next_run_at may be moved earlier if it was >6 hours away
```

#### Test 9d: Repeat and Verify Max
```bash
# Make 5 more requests to same location
for i in {1..5}; do
  curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5"
  sleep 0.5
done

# Check priority again
# Expected: Not exceed 10 (max priority cap)
```

---

### PHASE 10: Dynamic Confidence Evolution

**Time Estimate:** 15 minutes  
**Goal:** Verify confidence score updates based on multiple factors

#### Test 10a: Understand Confidence Formula
Confidence = base_confidence ± adjustments (capped 0-5)
- **+1** for each: photo, scan, user confirmation
- **-2** for: flagged_closed
- Base: inherited from previous discovery

#### Test 10b: Check Restaurant Confidence
```sql
-- In Supabase
SELECT id, name, confidence, scan_count, user_confirmations, 
       cover_photo_url, flagged_closed
FROM restaurants
WHERE scan_count > 0
ORDER BY confidence DESC
LIMIT 5;

-- Example:
-- ID | Name | Confidence | ScanCount | Confirmations | Photo | Closed
-- 1  | Blue | 3.5        | 2         | 1             | yes   | false
-- 2  | Red  | 2.0        | 1         | 0             | no    | false
```

#### Test 10c: Manual Confidence Update (Simulation)
```sql
-- Create a test record to understand updates
INSERT INTO restaurants (name, lat, lng, confidence, scan_count, user_confirmations, cover_photo_url, flagged_closed)
VALUES ('Test Restaurant', 35.2271, -80.8431, 2.0, 0, 0, null, false);

-- Get its ID, then update counts
UPDATE restaurants 
SET scan_count = 3, user_confirmations = 2, cover_photo_url = 'test.jpg' 
WHERE name = 'Test Restaurant';

-- Recalculate confidence
SELECT
  id,
  name,
  2.0 +  -- new base
  CASE WHEN cover_photo_url IS NOT NULL THEN 1 ELSE 0 END +
  (scan_count * 0) +  -- scans are logged, not multiplied
  (user_confirmations * 0) -  -- confirmations are tracked separately
  CASE WHEN flagged_closed THEN 2 ELSE 0 END AS calculated_confidence
FROM restaurants
WHERE name = 'Test Restaurant';

-- Expected: Should look reasonable (e.g., 3.0 if photo + some activity)
```

#### Test 10d: Live Response Check
```bash
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5" \
  | jq '.restaurants[0] | {name, confidence, badge}'

# Expected response:
# {
#   "name": "Blue Bar Smokehouse",
#   "confidence": 4.5,
#   "badge": "Verified"
# }

# Confidence >= 4.0: "Verified"
# Confidence >= 3.0: "Strong Data"
# Confidence < 3.0:  "New"
```

---

### PHASE 11: Trending Layer with Activity Logging

**Time Estimate:** 20 minutes  
**Goal:** Verify activity logging and trending score calculation

#### Test 11a: Make Multiple Searches (Generate Views)
```bash
# Search from same IP (simulates same user viewing)
for i in {1..5}; do
  echo "Search $i..."
  curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=3" > /dev/null
  sleep 2  # Wait between to avoid throttle
done

# Check the response to see activity logged
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=3" | jq '.restaurants[0] | {name, views_7d, confirms_30d, trending_score}'

# Expected first restaurant:
# {
#   "name": "Blue Bar Smokehouse",
#   "views_7d": 1-3,
#   "confirms_30d": 0,
#   "trending_score": 1-3
# }
```

#### Test 11b: Check Activity Log Table
```sql
-- In Supabase
SELECT restaurant_id, type, ip_address, created_at
FROM restaurant_activity
WHERE type = 'view'
ORDER BY created_at DESC
LIMIT 10;

-- Expected:
-- - Multiple entries with type='view'
-- - created_at should be recent (last few minutes)
-- - Same ip_address for your requests
```

#### Test 11c: Verify Throttling (10-min window)
```bash
# Make 2 rapid requests to same restaurant
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=1"
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=1"

# Check activity - should only see 1 logged
SELECT COUNT(*) as view_count
FROM restaurant_activity
WHERE type = 'view'
  AND created_at > NOW() - INTERVAL '15 minutes'
  AND ip_address = 'YOUR_IP';

-- Expected: 1 (throttled, not 2)
```

#### Test 11d: Verify Trending Score Calculation
```sql
-- For a restaurant with activity
SELECT
  id,
  name,
  (SELECT COUNT(*) FROM restaurant_activity 
   WHERE restaurant_id = restaurants.id 
   AND type = 'view' 
   AND created_at > NOW() - INTERVAL '7 days') as views_7d,
  (SELECT COUNT(*) FROM restaurant_activity 
   WHERE restaurant_id = restaurants.id 
   AND type IN ('confirm', 'flag_closed')
   AND created_at > NOW() - INTERVAL '30 days') as confirms_30d
FROM restaurants
LIMIT 3;

-- Then verify: trending_score = (views_7d * 1) + (confirms_30d * 3)
-- Example: views=5, confirms=2 -> score = 5 + 6 = 11
```

#### Test 11e: Check Trending Badge Display
```bash
# Make many views to same restaurants to get trending badge
# (Each view counts, but throttled to 1 per 10 mins per restaurant per IP)

# Simulate 10+ views by using different IPs or waiting 10+ mins between views
# After 20+ total views, trending_badge should appear

curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=3" \
  | jq '.restaurants[] | select(.trending_badge) | {name, trending_badge, trending_score}'

# Expected (once views>20):
# {
#   "name": "Blue Bar Smokehouse",
#   "trending_badge": "🔥 Trending",
#   "trending_score": 22
# }
```

---

### PHASE 12: Closure Flagging Endpoint

**Time Estimate:** 10 minutes  
**Goal:** Verify closure reporting and confidence impact

#### Test 12a: Find a Target Restaurant
```bash
# Get first restaurant from search
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5" \
  | jq '.restaurants[0] | {id, name, confidence, flagged_closed}'

# Expected: 
# { "id": "blue-bar-123", "name": "Blue Bar Smokehouse", "confidence": 4.5, "flagged_closed": false }
```

#### Test 12b: Make Flag-Closed Request
```bash
# POST to the admin endpoint
curl -X POST "http://localhost:8081/api/admin/restaurants/blue-bar-123/flag-closed" \
  -H "Content-Type: application/json"

# Expected response:
# {
#   "success": true,
#   "restaurantId": "blue-bar-123",
#   "flagged_closed": true,
#   "updated_confidence": 2.5,
#   "message": "Thank you for reporting..."
# }
```

#### Test 12c: Verify Database Update
```sql
-- In Supabase
SELECT id, name, flagged_closed, confidence
FROM restaurants
WHERE id = 'blue-bar-123';

-- Expected:
-- id | name                   | flagged_closed | confidence
-- 123| Blue Bar Smokehouse    | true           | 2.5
```

#### Test 12d: Verify Activity Logged
```sql
-- Check activity table
SELECT restaurant_id, type, created_at
FROM restaurant_activity
WHERE restaurant_id = 'blue-bar-123'
  AND type = 'flag_closed'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: Entry with type='flag_closed' from your IP
```

#### Test 12e: Verify UI Reflects Status
```bash
# Make another search - flagged restaurant should appear muted
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5" \
  | jq '.restaurants[] | select(.id == "blue-bar-123") | {name, flagged_closed, confidence}'

# Expected:
# {
#   "name": "Blue Bar Smokehouse",
#   "flagged_closed": true,
#   "confidence": 2.5
# }
```

#### Test 12f: Show Flagged Restaurants (Optional)
```bash
# By default, closed restaurants are filtered out
# To see them, use include_closed=true

curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5&include_closed=true" \
  | jq '.restaurants[] | select(.flagged_closed) | {name, flagged_closed}'

# Expected: Blue Bar Smokehouse shows with flagged_closed=true
```

---

### PHASE 13: UI Updates (Trending & Closure Display + Sort Options)

**Time Estimate:** 15 minutes  
**Goal:** Verify UI displays trending badges, closure warnings, and sort toggle works

#### Test 13a: Test Sort Toggle (By Distance)
```bash
# Open http://localhost:5174 in browser

# 1. Click "📍 By Distance" button (should be highlighted)
# 2. Enter location: lat=35.2271, lng=-80.8431
# 3. Click Search
# 4. Verify results sorted by distance (ascending)
#    - First result: closest
#    - Last result: farthest
# 5. Stats show "Sort: 📍 Distance"
```

#### Test 13b: Test Sort Toggle (By Trending)
```bash
# In same search results:

# 1. Click "🔥 By Trending" button
# 2. Click Search again (without changing location)
# 3. Verify results re-sorted by trending_score (descending)
#    - First result: highest trending_score
# 4. Stats show "Sort: 🔥 Trending"
# 5. Restaurants with trending badge appear first
```

#### Test 13c: Test Trending Badge Display
```bash
# In the restaurant cards:

# 1. Look for cards with 🔥 Trending badge
#    - Should appear in red box above confidence badge
#    - Only show if trending_score >= 20
# 2. Hover over cards - should see details
# 3. Badge text: "🔥 Trending"
```

#### Test 13d: Test Closure Warning Display
```bash
# For flagged restaurants:

# 1. Search with include_closed=true parameter or manually search
# 2. Look for cards with "⚠️ Reported Closed" banner
#    - Should appear as red bar at bottom of photo
#    - Card should appear slightly faded (opacity-75)
# 3. Click on card - name visible
```

#### Test 13e: Test Confidence Badge Colors
```bash
# Verify badge colors by confidence score:

# Search and look at badges:
# - Green "Verified": confidence >= 4.0
# - Blue "Strong Data": confidence >= 3.0 AND < 4.0
# - Yellow "New": confidence < 3.0

# Example from UI:
# if (confidence >= 4) badge = 'Verified' -> green
# if (confidence >= 3) badge = 'Strong Data' -> blue
# else badge = 'New' -> yellow
```

#### Test 13f: Test Stats Display
```bash
# After search, verify stats row shows:

# 4 statistics displayed:
# 1. Found: <total_count> (orange)
# 2. Radius: <miles> mi (blue)
# 3. Closest: <distance> mi (green)
# 4. Sort: 📍 Distance or 🔥 Trending (purple)

# All should dynamically update based on sort selection
```

---

## 📊 Integration Test (All Phases Together)

**Time Estimate:** 30 minutes  
**Scenario:** Complete user flow from search to trending discovery

### Steps:

1. **Initial Search**
   ```bash
   # Open http://localhost:5174
   # Click "Use My Current Location"
   # Set radius to 10 miles
   # Click Search (distance sort)
   ```

2. **View Results** (PHASES 8, 10, 13)
   - Verify fast results (<100ms)
   - Check confidence badges (green/blue/yellow)
   - Note sort shows "📍 Distance"
   - Restaurant cards display properly

3. **Trigger Trending** (PHASE 11)
   - Make 5 more searches (multiple views)
   - Each view logs activity
   - Trending scores accumulate

4. **Switch Sort** (PHASE 13)
   - Click "🔥 By Trending" button
   - Click Search
   - Results reorder by trending_score
   - Stats show new sort mode

5. **Flag Closure** (PHASE 12)
   - Find a restaurant
   - Call POST /api/admin/restaurants/{id}/flag-closed
   - Make new search with include_closed=true
   - Verify "⚠️ Reported Closed" appears

6. **Verify Demand Boosting** (PHASE 9)
   ```sql
   SELECT city, priority FROM discovery_tiles ORDER BY priority DESC LIMIT 1;
   -- Your search city should have high priority
   ```

---

## 🔍 Debugging Tips

### Issue: "No restaurants found" after SQL migration
- **Check:** `SELECT COUNT(*) FROM restaurants LIMIT 1;`
- **Fix:** Ensure restaurants table has data before running migration
- **Verify:** New columns (scan_count, user_confirmations, flagged_closed) exist

### Issue: Activity not logging
- **Check:** `SELECT COUNT(*) FROM restaurant_activity;`
- **Debug:** Add `console.log()` in `logActivity()` function
- **Verify:** IP address is being captured (check logs for userIp)
- **Test:** `shouldLogView()` throttle logic (10-min window)

### Issue: Trending score always 0
- **Check:** `SELECT * FROM restaurant_activity LIMIT 5;`
- **Verify:** Activity entries exist and have type='view' or type='confirm'
- **Test:** Calculate manually: `(views_7d * 1) + (confirms_30d * 3)`

### Issue: Confidence not updating
- **Check:** `calculateDynamicConfidence()` function logic
- **Verify:** Parameters passed: (base, scanCount, hasPhoto, confirmations, flaggedClosed)
- **Test:** Manually run: `SELECT calculateDynamicConfidence(3.0, 1, true, 0, false);`

### Issue: Tile priority not increasing
- **Check:** `SELECT * FROM discovery_tiles LIMIT 1;`
- **Verify:** `identifyTile()` function finds your tile
- **Debug:** Add logs in `boostTilePriority()` to see if it's called
- **Test:** Manually: `UPDATE discovery_tiles SET priority = priority + 1 WHERE id = 'tile-id';`

### Issue: Sort toggle not working
- **Check:** Browser console for fetch errors
- **Verify:** Sort parameter in URL: `?sort=trending` or `?sort=distance`
- **Test:** Curl: `curl "...?sort=trending"` should change order

---

## ✅ Validation Checklist

- [ ] PHASE 8: Bounding box pre-filtering working (<100ms response)
- [ ] PHASE 9: Tile priority increases with searches
- [ ] PHASE 10: Confidence badge colors correct (3-tier system)
- [ ] PHASE 11: Activity logging working, throttle prevents spam
- [ ] PHASE 12: Flag-closed endpoint reduces confidence by ~2
- [ ] PHASE 13: UI shows trending badge (🔥) and closure warning (⚠️)
- [ ] PHASE 13: Sort toggle switches between distance and trending
- [ ] PHASE 13: Stats row displays all 4 fields
- [ ] Integration: Full user flow works end-to-end

---

## 📚 API Reference (Updated)

### GET /api/restaurants
```bash
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5&sort=distance"
```

**Query Parameters:**
- `lat` (required): User latitude
- `lng` (required): User longitude  
- `radius` (optional): Search radius in miles, default 5
- `sort` (optional): "distance" | "trending", default "distance"
- `include_closed` (optional): "true" to show flagged-closed restaurants

**Response:**
```json
{
  "success": true,
  "searchCenter": { "lat": 35.2271, "lng": -80.8431 },
  "radiusMiles": 5,
  "sortBy": "distance",
  "count": 12,
  "tile": { "city": "Charlotte", "priority": 6 },
  "restaurants": [
    {
      "id": "123",
      "name": "Blue Bar Smokehouse",
      "cuisine": "BBQ",
      "cover_photo_url": "...",
      "distance": 0.5,
      "badge": "Verified",
      "confidence": 4.5,
      "trending_score": 15.0,
      "trending_badge": null,
      "flagged_closed": false,
      "views_7d": 2,
      "confirms_30d": 1
    }
  ]
}
```

### POST /api/admin/restaurants/:id/flag-closed
```bash
curl -X POST "http://localhost:8081/api/admin/restaurants/123/flag-closed"
```

**Response:**
```json
{
  "success": true,
  "restaurantId": "123",
  "flagged_closed": true,
  "updated_confidence": 2.5,
  "message": "Thank you for reporting. This restaurant may be closed."
}
```

---

## 🚀 Performance Metrics

Post-implementation, you should see:

| Metric | Phase | Before | After | Test |
|--------|-------|--------|-------|------|
| Full table scans | 8 | Yes | No | EXPLAIN ANALYZE |
| Response time | 8 | 200-500ms | <100ms | curl + time |
| Tile accuracy | 9 | N/A | 100% | DB check |
| Confidence range | 10 | 0-5 | 0-5 | SELECT confidence |
| Activity logged | 11 | 0 | Per-view | SELECT COUNT(*) from restaurant_activity |
| Closure impact | 12 | None | -2 conf | Before/after confidence |
| Sort options | 13 | 1 | 2 | UI buttons |

---

## 📞 Support

If issues arise:
1. Check logs: `tail -f server.err` + `tail -f vite.err`
2. Verify SQL functions: `SELECT * FROM pg_proc WHERE proname LIKE 'calculate%';`
3. Test utilities: Create a `test-utils.js` and import functions directly
4. Check browser console in DevTools for frontend errors
