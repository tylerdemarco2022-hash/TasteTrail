# TasteTrails Quick Start Guide

## Setup (5 minutes)

### 1. Run SQL Migration
Go to Supabase console → SQL Editor → Run this:
```sql
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

CREATE TABLE IF NOT EXISTS public.restaurant_photos (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  uploaded_by TEXT,
  type VARCHAR(50) DEFAULT 'cover' CHECK (type IN ('cover', 'interior', 'menu')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(restaurant_id, type)
);

CREATE INDEX idx_restaurant_photos_restaurant_id ON public.restaurant_photos(restaurant_id);
CREATE INDEX idx_restaurant_photos_type ON public.restaurant_photos(type);
CREATE INDEX idx_restaurant_photos_created_at ON public.restaurant_photos(created_at);
CREATE INDEX idx_restaurants_cover_photo_null ON public.restaurants(cover_photo_url) WHERE cover_photo_url IS NULL;
```

### 2. Create Storage Bucket
Supabase → Storage → Create new bucket → Name: `restaurant-covers` → Public

### 3. Restart Backend
```powershell
taskkill /IM node.exe /F
Start-Sleep 2
cd "c:\Users\tyler\OneDrive\Documents\Apps new\APPS\taste-trails"
node server/index.js
```

### 4. Start Frontend
```powershell
npm run dev
```

---

## Testing URLs

### Frontend (Restaurant Discovery)
```
http://localhost:5174
```
📍 **RestaurantFinder component** - Geolocation-based discovery with cover photos

### Admin Endpoints (curl or Postman)

**1. Check Scheduler Status**
```bash
curl -X GET http://localhost:8081/admin/discovery/status \
  -H "x-admin-token: dev-token-change-me"
```

**2. Find Restaurants Missing Photos**
```bash
curl -X GET http://localhost:8081/admin/restaurants/missing-photos \
  -H "x-admin-token: dev-token-change-me"
```

**3. Upload a Cover Photo**
```bash
curl -X POST http://localhost:8081/admin/restaurants/1/cover-photo \
  -H "x-admin-token: dev-token-change-me" \
  -F "photo=@C:\path\to\restaurant.jpg"
```

**4. Search Nearby Restaurants**
```bash
curl "http://localhost:8081/api/restaurants?lat=35.2271&lng=-80.8431&radius=5"
```

**5. Reset Failure Counter**
```bash
curl -X POST http://localhost:8081/admin/discovery/reset-failures \
  -H "x-admin-token: dev-token-change-me"
```

---

## Expected Results

### Location Search
```json
{
  "success": true,
  "searchCenter": { "lat": 35.2271, "lng": -80.8431 },
  "radiusMiles": 5,
  "count": 12,
  "restaurants": [
    {
      "id": 1,
      "name": "Restaurant Name",
      "cuisine": "Italian",
      "cover_photo_url": "https://...",
      "address": "123 Main St",
      "confidence": 4,
      "distance": 0.42,
      "badge": "Verified"
    }
  ]
}
```

### Upload Response
```json
{
  "success": true,
  "restaurantId": 1,
  "restaurantName": "Restaurant Name",
  "photoUrl": "https://storage.supabase.com/...",
  "fileSize": 45320
}
```

### Missing Photos
```json
{
  "success": true,
  "count": 12,
  "restaurants": [...]
}
```

---

## Key Features Verified

- ✅ Cover photos upload and display
- ✅ Lazy image loading
- ✅ Distance calculation (Haversine)
- ✅ Badges show correctly
- ✅ No star ratings (confidence badges instead)
- ✅ Scheduler runs every 6 hours
- ✅ Failure guard pauses after 3 failures
- ✅ Mobile responsive design
- ✅ No external APIs required

---

## File Summary

### New Files
- `sql/add_cover_photo.sql` - Database migration
- `server/routes/adminRestaurants.js` - Photo upload endpoints
- `src/components/RestaurantCard.jsx` - Card display component
- `src/components/RestaurantFinder.jsx` - Main discovery interface
- `TASTETRAILS_COMMUNITY_EDITION.md` - Full documentation

### Modified Files
- `server/index.js` - Added admin routes
- `server/routes/discovery.js` - Location-aware search
- `backend/discovery/scheduler.js` - Failure guard
- `backend/discovery/adminDiscoveryRoutes.js` - Reset endpoint
- `package.json` - Added sharp, multer

---

## Next: Seed Data (Optional)

If you have restaurants but no photos:

```bash
# Get list of restaurants needing photos
curl -X GET http://localhost:8081/admin/restaurants/missing-photos \
  -H "x-admin-token: dev-token-change-me" > missing.json

# Upload photos for each restaurant
# (Use admin UI or batch script)
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing required parameters: lat and lng" | Use ?lat=35.2271&lng=-80.8431 in URL |
| 500 error on photo upload | Check sharp installed: `npm install sharp` |
| No photos displayed | Check bucket is public in Supabase |
| Scheduler paused | Run reset-failures endpoint |
| "Cannot find table" | Run SQL migration in Supabase |

---

## Environment Check

```powershell
# Verify Node version
node --version
# Should be >= 18

# Verify npm packages
npm list sharp multer node-cron
# Should be installed

# Verify backend running
$ProgressPreference = 'SilentlyContinue'
(Invoke-WebRequest -Uri "http://localhost:8081/api/health" -UseBasicParsing).Content
# Should return: {"status":"ok"...}

# Verify frontend running
(Invoke-WebRequest -Uri "http://localhost:5174" -UseBasicParsing).StatusCode
# Should return: 200
```

---

## Final Checklist

- [ ] SQL migration executed
- [ ] Supabase Storage bucket created
- [ ] Dependencies installed: `npm install`
- [ ] Backend started and running
- [ ] Frontend started and running
- [ ] Can navigate to http://localhost:5174
- [ ] Location search returns restaurants
- [ ] Cover photos upload and display
- [ ] Badges show correctly
- [ ] Scheduler shows in status (no errors)
- [ ] No console errors

**You're done! 🎉**
