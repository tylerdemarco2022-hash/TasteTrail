-- ========================================
-- GEOSPATIAL OPTIMIZATION INDEXES
-- Composite bounding box indexes for fast spatial filtering
-- ========================================

-- Composite index for standard bounding box queries
-- This allows PostgreSQL to use index for lat range AND lng range in same operation
CREATE INDEX IF NOT EXISTS idx_restaurants_geo_bbox
ON restaurants (lat, lng);

-- Partial index for active restaurants (most common case)
-- Only indexes restaurants that aren't flagged as closed
-- Reduces index size and query time for typical queries
CREATE INDEX IF NOT EXISTS idx_restaurants_active_geo
ON restaurants (lat, lng)
WHERE flagged_closed = false;

-- Trending score index for sort performance
-- Used when sort=trending parameter is provided
CREATE INDEX IF NOT EXISTS idx_restaurants_trending_score
ON restaurants (trending_score DESC);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Check if indexes were created:
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'restaurants' 
-- AND indexname LIKE 'idx_restaurants%'
-- ORDER BY indexname;

-- Analyze query plan to verify index usage:
-- EXPLAIN ANALYZE
-- SELECT id, name, cuisine, lat, lng, confidence, flagged_closed, cover_photo_url, trending_score
-- FROM restaurants
-- WHERE lat >= 34.9 AND lat <= 35.5
--   AND lng >= -81.2 AND lng <= -80.5
--   AND flagged_closed = false
-- LIMIT 100;

-- Expected output should show:
-- "Index Scan using idx_restaurants_active_geo"
-- (not Seq Scan or Bitmap Index Scan)
