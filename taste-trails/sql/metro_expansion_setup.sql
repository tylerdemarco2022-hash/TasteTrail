-- Charlotte Metro Tile Expansion: Unique Constraint
-- Prevents duplicate tiles from being inserted
-- Run this in Supabase SQL Editor

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_tile
ON discovery_tiles(center_lat, center_lng);

-- Optional: Create index on city for faster city-specific queries
CREATE INDEX IF NOT EXISTS idx_discovery_tiles_city
ON discovery_tiles(city);
