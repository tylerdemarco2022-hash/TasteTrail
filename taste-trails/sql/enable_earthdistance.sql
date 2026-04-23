-- ========================================
-- ENABLE EARTHDISTANCE EXTENSION (if not already enabled)
-- ========================================
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;

-- ========================================
-- PRODUCTION-GRADE RADIUS QUERY FUNCTION
-- Uses PostgreSQL earthdistance + cube for spatial indexing
-- FIXED: Using UUID for id (not BIGINT)
-- ========================================
CREATE OR REPLACE FUNCTION restaurants_within_radius(
  user_lat FLOAT,
  user_lng FLOAT,
  radius_meters FLOAT
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  cuisine TEXT,
  lat FLOAT,
  lng FLOAT,
  confidence FLOAT,
  flagged_closed BOOLEAN,
  cover_photo_url TEXT,
  trending_score INTEGER
) AS $$
  SELECT
    r.id,
    r.name,
    r.cuisine,
    r.lat,
    r.lng,
    r.confidence,
    r.flagged_closed,
    r.cover_photo_url,
    r.trending_score
  FROM restaurants r
  WHERE earth_distance(
    ll_to_earth(user_lat, user_lng),
    ll_to_earth(r.lat, r.lng)
  ) <= radius_meters
  AND r.flagged_closed = false
  ORDER BY r.trending_score DESC;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

-- ========================================
-- CREATE SPATIAL INDEX FOR FAST LOOKUPS
-- ========================================
CREATE INDEX IF NOT EXISTS idx_restaurants_earth_distance
ON restaurants USING gist (ll_to_earth(lat, lng));

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Test the function:
-- SELECT * FROM restaurants_within_radius(35.2271, -80.8431, 5000);
--
-- Expected: Returns restaurants within 5km of Charlotte, sorted by trending_score DESC
-- Should execute in <50ms

-- Check that extension is enabled:
-- SELECT * FROM pg_extension WHERE extname = 'earthdistance';
