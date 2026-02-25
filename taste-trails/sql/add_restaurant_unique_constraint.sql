-- ═══════════════════════════════════════════════════════════
-- RESTAURANTS TABLE: ADD UNIQUE CONSTRAINT
-- ═══════════════════════════════════════════════════════════
-- Purpose: Prevent duplicate restaurant entries with same name + coordinates
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ═══════════════════════════════════════════════════════════

-- Create unique index on (name, lat, lng) combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_restaurant_location
ON restaurants(name, lat, lng);

-- Verify constraint was created
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'restaurants'
AND indexname = 'idx_unique_restaurant_location';
