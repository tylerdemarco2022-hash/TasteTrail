# 🍽️ TasteTrails Proactive Restaurant Discovery System

## Overview

A **background job system** that proactively discovers restaurants using OpenStreetMap's Overpass API. Tiles the city, scans tiles on schedule, stores results, and prevents duplicates.

**Key Features:**
- ✅ Geographic tile-based scanning
- ✅ Automatic deduplication (names + proximity)
- ✅ Confidence scoring (0-5)
- ✅ Configurable scheduling (every 30min by default)
- ✅ Admin API endpoints
- ✅ Automatic retry on failure
- ✅ Database logging

---

## 📋 Quick Start

### 1. Set Up Database Tables

Run this SQL migration on your Supabase instance:

```bash
# Via Supabase dashboard SQL editor, paste the contents of:
sql/discovery_schema.sql
```

Or use `psql` if you have direct access:
```bash
psql -h your-host -U postgres -d your-db < sql/discovery_schema.sql
```

**Tables created:**
- `discovery_tiles` - Geographic tiles to scan
- `restaurants` - Discovered restaurants (with `source` = "osm")
- `restaurant_aliases` - Deduplication helper
- `discovery_runs` - Scan logs

### 2. Optional Environment Setup

Create or update `.env`:
```bash
ADMIN_TOKEN=your-secret-admin-token
DISCOVERY_SCHEDULE="*/30 * * * *"    # Every 30 minutes (cron format)
DISCOVERY_TILES_PER_RUN=1             # How many tiles per scan cycle
```

### 3. Start the Backend

```bash
npm run server
# or
node server/index.js
```

Check logs:
```
✅ Discovery Scheduler started
   Schedule: */30 * * * * (every 30 minutes)
   Tiles per run: 1
```

---

## 🎯 Generate Tiles (Admin API)

### Create Tiles for Charlotte, NC

```bash
curl -X POST http://localhost:8081/admin/discovery/generate-tiles \
  -H "Content-Type: application/json" \
  -H "x-admin-token: dev-token-change-me" \
  -d '{
    "city": "Charlotte, NC",
    "minLat": 35.10,
    "minLng": -80.95,
    "maxLat": 35.35,
    "maxLng": -80.70,
    "spacingKm": 2.5,
    "radiusM": 1500,
    "priority": 5
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Generated 24 tiles for Charlotte, NC",
  "tileCount": 24
}
```

**Parameters:**
- `minLat, minLng, maxLat, maxLng` - Bounding box (decimal degrees)
- `spacingKm` - Distance between tile centers (2.5km ≈ dense downtown)
- `radiusM` - Scan radius per tile (1500m = 1.5km)
- `priority` - Priority level (higher = scan sooner); 5 = scan every 7 days, <5 = every 30 days

### Charlotte, NC Bounding Box

```
     35.35° ┌──────────────────┐
            │   Charlotte      │
            │   (24 tiles)     │
     35.10° └──────────────────┘
          -80.95°           -80.70°
```

---

## ⚙️ Admin Endpoints

All require header: `x-admin-token: YOUR_TOKEN`

### 1. Generate Tiles
**POST** `/admin/discovery/generate-tiles`
```bash
curl -X POST http://localhost:8081/admin/discovery/generate-tiles \
  -H "x-admin-token: dev-token-change-me" \
  -H "Content-Type: application/json" \
  -d '{"city": "Charlotte, NC", "minLat": 35.1, "minLng": -80.95, "maxLat": 35.35, "maxLng": -80.7, "spacingKm": 2.5, "radiusM": 1500, "priority": 5}'
```

### 2. Run Scan Manually (One-Off)
**POST** `/admin/discovery/run-once`
```bash
curl -X POST http://localhost:8081/admin/discovery/run-once \
  -H "x-admin-token: dev-token-change-me" \
  -H "Content-Type: application/json" \
  -d '{"tilesCount": 1}'
```

Starts a background scan (returns immediately).

### 3. Check Status
**GET** `/admin/discovery/status`
```bash
curl http://localhost:8081/admin/discovery/status \
  -H "x-admin-token: dev-token-change-me"
```

**Response:**
```json
{
  "scheduler": {
    "isRunning": false,
    "lastRunStats": {
      "tiles_processed": 2,
      "restaurants_discovered": 47,
      "restaurants_upserted": 42,
      "errors": []
    }
  },
  "pendingTiles": [
    {"id": 1, "city": "Charlotte, NC", "center_lat": 35.225, "center_lng": -80.843, "fail_count": 0, "next_run_at": "2026-02-25T..."}
  ],
  "statistics": {
    "totalRestaurants": 250,
    "osmRestaurants": 142,
    "cities": {"Charlotte, NC": 24}
  }
}
```

### 4. List Tiles
**GET** `/admin/discovery/tiles?city=Charlotte,NC`
```bash
curl "http://localhost:8081/admin/discovery/tiles?city=Charlotte,NC" \
  -H "x-admin-token: dev-token-change-me"
```

### 5. View Discovered Restaurants
**GET** `/admin/discovery/restaurants?source=osm&limit=20`
```bash
curl "http://localhost:8081/admin/discovery/restaurants?source=osm&limit=20" \
  -H "x-admin-token: dev-token-change-me"
```

---

## 🚀 Running the Discovery System

### Automatic (Scheduler)

The scheduler runs automatically every 30 minutes. Check the backend logs:

```
============================================================
🔄 Discovery Scan Cycle Started
============================================================
📋 Processing 1 tiles...

🚀 Scanning tile [1]: (35.225, -80.843)
🔍 Overpass query (35.2271, -80.8431) radius 1500m [attempt 1]
✅ Overpass: found 47 elements
   Parsed: 47 restaurants
   Deduped batch: 47 -> 45
   ✅ Upserted: 42 restaurants
📊 Discovery run logged

============================================================
✅ Discovery Scan Cycle Complete
   Tiles processed: 1
   Restaurants discovered: 47
   Restaurants upserted: 42
   Duration: 3.2s
============================================================
```

### Manual Trigger (One-Off)

```bash
# Trigger scan manually
curl -X POST http://localhost:8081/admin/discovery/run-once \
  -H "x-admin-token: dev-token-change-me" \
  -d '{"tilesCount": 2}'

# Check status
curl http://localhost:8081/admin/discovery/status \
  -H "x-admin-token: dev-token-change-me" | jq
```

---

## 📊 Test Results: First 2 Tiles

After running:
```bash
curl -X POST http://localhost:8081/admin/discovery/run-once \
  -H "x-admin-token: dev-token-change-me" \
  -d '{"tilesCount": 2}'
```

**Expected Results:**
```
============================================================
✅ Discovery Scan Cycle Complete
   Tiles processed: 2
   Restaurants discovered: 94        # ~47 per tile
   Restaurants upserted: 85          # After dedupe
   Duration: 6.8s
   Errors: 0
============================================================
```

**Check results:**
```bash
curl "http://localhost:8081/admin/discovery/restaurants?source=osm" \
  -H "x-admin-token: dev-token-change-me" | jq '.count'
# Returns: 85 (or current count)
```

---

## 🔧 Architecture

```
backend/discovery/
├── overpassClient.js       # Overpass API queries + retries
├── normalize.js            # Name/cuisine normalization
├── confidence.js           # 0-5 scoring
├── dedupe.js               # Duplicate detection + Haversine distance
├── tilePicker.js           # Select next tiles, update schedules
├── scanner.js              # Core scan pipeline
├── scheduler.js            # node-cron scheduling (every 30min)
└── adminDiscoveryRoutes.js # Admin API endpoints
```

**Flow:**

```
Scheduler (every 30 min)
  ↓
pickNextTiles() → Tile [lat, lng, radius]
  ↓
queryOverpass() → Raw OSM elements
  ↓
parseElements() → {name, lat, lng, cuisine, ...}
  ↓
dedupeWithinBatch() → Remove local duplicates
  ↓
computeConfidence() → Score 0-5
  ↓
isDuplicate() → Check DB for near-duplicates
  ↓
upsert restaurants → INSERT/UPDATE on (source, source_id)
  ↓
updateTileAfterScan() → schedule next run (7/30 days)
  ↓
logDiscoveryRun() → Record stats
```

---

## ⚙️ Configuration

### Environment Variables

```bash
# .env
ADMIN_TOKEN=your-secret-token-here
DISCOVERY_SCHEDULE="*/30 * * * *"    # Every 30 minutes
DISCOVERY_TILES_PER_RUN=1             # Tiles per cycle
```

### Cron Schedules

```
"*/30 * * * *"   = Every 30 minutes
"0 * * * *"      = Hourly
"0 2 * * *"      = Daily at 2 AM
"0 2 * * 0"      = Weekly (Sundays)
```

### Tile Grid Density

```
spacingKm=1.0   → Hyper-dense (1km grid, 625 tiles for Charlotte)
spacingKm=2.5   → Dense downtown (recommended for cities, ~300 tiles)
spacingKm=5.0   → Suburban (~75 tiles)
spacingKm=10.0  → Rural (~19 tiles)
```

---

## 🛑 Failure Handling

**Automatic Retry Logic:**

1. **Overpass API Failure** → 2 retries (1s, 3s backoff)
2. **Tile Scan Failure** → next_run_at += 6 hours, fail_count++
3. **Tile Success** → next_run_at += 7/30 days (based on priority)

**Disable Job on High Failure:**
```javascript
// In scheduler.js - add this check:
if (tile.fail_count > 5) {
  console.warn(`Tile ${tile.id} disabled (too many failures)`)
  continue  // Skip it
}
```

---

## 🔐 Security

**Admin Token:**
- Set `ADMIN_TOKEN` in `.env`
- All `/admin/discovery/*` endpoints require `x-admin-token` header
- Default (development): `dev-token-change-me`

**Change in Production:**
```bash
# Generate secure token
openssl rand -base64 32
# Output: AbCd1234567890+/XyZaBcDeFgHiJkL=

# Set in .env
ADMIN_TOKEN=AbCd1234567890+/XyZaBcDeFgHiJkL=
```

---

## 📈 Scaling

### Single Server (Current)
- 1 tile per 30 minutes
- ~50 restaurants per tile
- ~1,500 restaurants per city per month
- Overpass rate: ~50 requests/month (very safe)

### Multi-Server (Future)
- Use Redis for cache + state
- Distribute tile queue
- Concurrency = 5-10 tiles/cycle

### PostGIS Enhancement (Future)
```sql
-- Get restaurants within radius
SELECT *, ST_Distance(location, ST_SetSRID(ST_MakePoint(-80.843, 35.227), 4326)) as dist
FROM restaurants
WHERE source = 'osm'
ORDER BY dist
LIMIT 20;
```

---

## 🆘 Troubleshooting

### "Overpass query failed" Error

**Cause:** Overpass API overloaded or down  
**Fix:** Wait 5 min, manual retry, or check https://overpass-api.de/api/status

### No Restaurants Discovered

**Cause:** Location has little OSM data  
**Fix:** Increase `radiusM` or use Google Source API (future)

### Tiles Never Scan

**Cause:** Scheduler not started  
**Fix:** Check backend logs for "Discovery Scheduler started"

### Duplicates Not Removed

**Cause:** Database dedupe check failing  
**Fix:** Check DB connection, run `SELECT COUNT(*) FROM restaurants WHERE source='osm'`

---

## 📝 SQL Queries for Analysis

### Count by City
```sql
SELECT city, COUNT(*) as tile_count, COUNT(DISTINCT COALESCE(last_scanned_at, 'never')) as scanned
FROM discovery_tiles
GROUP BY city;
```

### Restaurant Distribution
```sql
SELECT source, COUNT(*) as count, AVG(confidence) as avg_confidence
FROM restaurants
GROUP BY source;
```

### Oldest Unscanned Tiles
```sql
SELECT id, city, center_lat, center_lng, last_scanned_at
FROM discovery_tiles
WHERE last_scanned_at IS NULL OR last_scanned_at < NOW() - INTERVAL '30 days'
ORDER BY last_scanned_at
LIMIT 10;
```

---

## ✅ Checklist

- [ ] Run `sql/discovery_schema.sql` on Supabase
- [ ] Set `.env` with `ADMIN_TOKEN`
- [ ] `npm install node-cron p-limit`
- [ ] Start backend: `npm run server`
- [ ] Generate tiles: POST `/admin/discovery/generate-tiles`
- [ ] Trigger scan: POST `/admin/discovery/run-once`
- [ ] Check status: GET `/admin/discovery/status`
- [ ] Query results: GET `/api/restaurants` or `/admin/discovery/restaurants`

---

## 🎉 Success!

Your TasteTrails discovery system is live!

- **Scheduler:** Every 30 minutes
- **Coverage:** Charlotte, NC (24 tiles, ~1.2k restaurants/month)
- **Database:** Automatic dedup + confidence scoring
- **Admin:** Full control over scheduling + stats

For questions or issues, check the backend logs in your server terminal.
