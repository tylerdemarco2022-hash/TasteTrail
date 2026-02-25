-- Discovery Tiles table
CREATE TABLE IF NOT EXISTS discovery_tiles (
  id BIGSERIAL PRIMARY KEY,
  city TEXT NOT NULL,
  center_lat FLOAT NOT NULL,
  center_lng FLOAT NOT NULL,
  radius_m INT NOT NULL DEFAULT 1500,
  last_scanned_at TIMESTAMP NULL,
  priority INT NOT NULL DEFAULT 0,
  fail_count INT NOT NULL DEFAULT 0,
  next_run_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(city, center_lat, center_lng)
);

-- Restaurants table (enhanced from existing)
CREATE TABLE IF NOT EXISTS restaurants (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,                    -- "osm" | "google" | "manual"
  source_id TEXT NOT NULL,                 -- OSM node/way/relation ID or Google place_id
  name TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  cuisine TEXT,
  website TEXT,
  phone TEXT,
  address TEXT,
  confidence INT DEFAULT 0,                -- 0-5 score
  amenity TEXT,                            -- "restaurant", "cafe", etc.
  opening_hours TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(source, source_id)
);

-- Restaurant aliases for deduplication
CREATE TABLE IF NOT EXISTS restaurant_aliases (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  normalized_name TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX(normalized_name, lat, lng)
);

-- Discovery runs for logging
CREATE TABLE IF NOT EXISTS discovery_runs (
  id BIGSERIAL PRIMARY KEY,
  city TEXT,
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  tiles_processed INT DEFAULT 0,
  restaurants_discovered INT DEFAULT 0,
  restaurants_upserted INT DEFAULT 0,
  errors TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_discovery_tiles_next_run ON discovery_tiles(next_run_at, priority DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_tiles_city ON discovery_tiles(city);
CREATE INDEX IF NOT EXISTS idx_restaurants_source ON restaurants(source, source_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_location ON restaurants(lat, lng);
CREATE INDEX IF NOT EXISTS idx_restaurants_created ON restaurants(created_at DESC);
