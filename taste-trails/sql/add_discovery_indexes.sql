-- ========================================
-- DISCOVERY PERFORMANCE OPTIMIZATION
-- Add indexes for lat/lng geospatial queries
-- ========================================

-- Index on latitude for bounding box queries
CREATE INDEX IF NOT EXISTS idx_restaurants_lat 
ON restaurants(lat);

-- Index on longitude for bounding box queries
CREATE INDEX IF NOT EXISTS idx_restaurants_lng 
ON restaurants(lng);

-- Composite index for flagged_closed filtering (common query pattern)
CREATE INDEX IF NOT EXISTS idx_restaurants_flagged_closed 
ON restaurants(flagged_closed) 
WHERE flagged_closed = false;

-- Index on restaurant_activity for trending queries
CREATE INDEX IF NOT EXISTS idx_restaurant_activity_lookup
ON restaurant_activity(restaurant_id, created_at DESC, type);

-- ========================================
-- EXPECTED IMPACT:
-- - 80-95% reduction in query time
-- - Sub-100ms queries for 69 rows
-- - Enables efficient bounding box filtering
-- ========================================
