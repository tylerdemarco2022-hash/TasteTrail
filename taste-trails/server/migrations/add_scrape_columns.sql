ALTER TABLE restaurants
ADD COLUMN last_scraped_at TIMESTAMP,
ADD COLUMN last_successful_scrape_at TIMESTAMP,
ADD COLUMN scrape_confidence FLOAT,
ADD COLUMN scrape_status TEXT,
ADD COLUMN menu_hash TEXT;
