-- ========================================
-- DISCOVERY API PERFORMANCE INDEXES
-- Execute this SQL in Supabase Dashboard
-- ========================================

-- STEP 1: Open Supabase Dashboard
-- https://supabase.com/dashboard
-- Navigate to: SQL Editor → New Query

-- STEP 2: Copy and paste ALL of the following SQL

-- Index 1: Latitude (for bounding box filtering)
CREATE INDEX IF NOT EXISTS idx_restaurants_lat 
ON restaurants(lat);

-- Index 2: Longitude (for bounding box filtering)
CREATE INDEX IF NOT EXISTS idx_restaurants_lng 
ON restaurants(lng);

-- Index 3: Flagged Closed (partial index for active restaurants only)
CREATE INDEX IF NOT EXISTS idx_restaurants_flagged_closed 
ON restaurants(flagged_closed) 
WHERE flagged_closed = false;

-- Index 4: Activity Lookup (composite index for trending queries)
CREATE INDEX IF NOT EXISTS idx_restaurant_activity_lookup 
ON restaurant_activity(restaurant_id, created_at DESC, type);

-- STEP 3: Click "RUN" button

-- STEP 4: Wait for success confirmation

-- STEP 5: Retest performance
-- Run: node test-performance.mjs
-- Expected: 400ms → ~100-150ms (60-75% improvement)

-- ========================================
-- EXPLANATION
-- ========================================

-- idx_restaurants_lat + idx_restaurants_lng:
--   Enables fast bounding box filtering with .gte()/.lte() queries
--   Target: 205ms → ~50-80ms

-- idx_restaurants_flagged_closed:
--   Partial index only on active restaurants (flagged_closed = false)
--   Reduces index size and improves query planner decisions

-- idx_restaurant_activity_lookup:
--   Composite index for trending data queries
--   Covers: restaurant_id (filter), created_at (sort), type (filter)
--   Target: 92ms → ~20-30ms

-- ========================================
-- VERIFICATION
-- ========================================

-- After running, verify indexes exist:
-- SELECT indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('restaurants', 'restaurant_activity')
-- ORDER BY indexname;
