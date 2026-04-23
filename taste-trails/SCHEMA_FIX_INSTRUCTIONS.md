========================
STEP 1 — DATABASE SCHEMA VERIFICATION RESULTS
========================

✓ Table "restaurants" exists
✓ Verified columns present:
  - id, name, address, city, state
  - website, lat, lng, place_id, created_at
  - dinner_url, lunch_url, drinks_url, pdf_url
  - menu_confidence, menu_status, menu_last_checked, menu_error
  - crawl_ms, candidate_count, cuisine
  - confidence ✓ (needed)
  - scan_count ✓ (needed)
  - user_confirmations ✓ (needed)
  - flagged_closed ✓ (needed)

✗ MISSING COLUMN:
  - cover_photo_url (required for full functionality)

========================
STEP 2 — ADD MISSING COLUMN
========================

OPTION A: Via Supabase Console (Recommended - 2 minutes)
--------------------------------------------------

1. Go to: https://supabase.com/dashboard
2. Select your project: [YOUR PROJECT NAME]
3. Click "SQL Editor" in left sidebar
4. Click "+ New Query"
5. Paste this SQL:

-----BEGIN SQL-----
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS cover_photo_url TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_restaurants_cover_photo_null 
ON public.restaurants(cover_photo_url) WHERE cover_photo_url IS NULL;
-----END SQL-----

6. Click "RUN" (green button, top right)
7. Wait for success message (green checkmark)


OPTION B: Via Backend Script (Automated)
------------------------------------------

If you have Supabase admin RPC functions set up, run:
  node add-columns.mjs

(This will add the column programmatically)


========================
STEP 3 — DISCOVERY ENDPOINT UPDATED
========================

Query updated to SELECT all required columns:
  - id ✓
  - name ✓
  - cuisine ✓
  - lat, lng ✓
  - confidence ✓
  - scan_count ✓
  - user_confirmations ✓
  - cover_photo_url ✓ (once column added)
  - flagged_closed ✓

File: server/routes/discovery.js (line 77)
Status: READY - waiting for column to exist

========================
STEP 4 — VALIDATION CHECKLIST
========================

After adding the column via SQL:

RESTART: Kill and restart the backend
  taskkill /IM node.exe /F
  npm run dev
  (or node server/index.js)

TEST: Call the API endpoint
  GET /api/restaurants?lat=35.2271&lng=-80.8431&radius=5

VERIFY RESPONSE:
  ✓ Status: 200 (not 500)
  ✓ Should see "success": true
  ✓ Should have "count": 0 or > 0
  ✓ Should have "restaurants": []
  ✓ Each restaurant should have:
    - distance (calculated)
    - badge (confidence-based)
    - confidence (dynamic score)
    - cover_photo_url (null or URL)
    - NO error message

========================
EXPECTED RESPONSE AFTER FIX
========================

{
  "success": true,
  "searchCenter": { "lat": 35.2271, "lng": -80.8431 },
  "radiusMiles": 5,
  "count": 0,
  "restaurants": [],
  "sortBy": "distance"
}

(First call will have 0 results until restaurants are added
 to the database at those coordinates)

========================
NEXT: Full schema alignment
========================

Once column is added and API works:

1. Confirm all 9 fields returned
2. Verify no undefined fields
3. Test with actual restaurant data
4. Continue to Phase 9+

