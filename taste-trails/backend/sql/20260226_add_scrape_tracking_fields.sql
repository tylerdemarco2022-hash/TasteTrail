-- Migration: Add scrape tracking fields to restaurants table
-- Tracks: last_scraped_at, last_successful_scrape_at, scrape_confidence, scrape_status, menu_hash

-- Add columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'last_scraped_at') THEN
    ALTER TABLE restaurants ADD COLUMN last_scraped_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'last_successful_scrape_at') THEN
    ALTER TABLE restaurants ADD COLUMN last_successful_scrape_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'scrape_confidence') THEN
    ALTER TABLE restaurants ADD COLUMN scrape_confidence FLOAT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'scrape_status') THEN
    ALTER TABLE restaurants ADD COLUMN scrape_status TEXT DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'menu_hash') THEN
    ALTER TABLE restaurants ADD COLUMN menu_hash TEXT;
  END IF;
END $$;

-- Add check constraint for scrape_status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_scrape_status_check') THEN
    ALTER TABLE restaurants ADD CONSTRAINT restaurants_scrape_status_check
      CHECK (scrape_status IN ('pending', 'in_progress', 'success', 'failed', 'error', 'suspicious', 'image_menu'));
  END IF;
END $$;

-- Index for the cron scheduler query (find restaurants needing refresh)
CREATE INDEX IF NOT EXISTS idx_restaurants_scrape_refresh
  ON restaurants (last_scraped_at, scrape_confidence)
  WHERE scrape_status != 'in_progress';
