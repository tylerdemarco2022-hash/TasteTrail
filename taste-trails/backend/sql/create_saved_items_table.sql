-- Create saved_items table for persisting user's saved menu items
CREATE TABLE IF NOT EXISTS saved_items (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'defaultProfile',
  restaurant_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  item_rating DECIMAL(2,1),
  item_image TEXT,
  saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, restaurant_id, item_name)
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_saved_items_user_id ON saved_items(user_id);

-- Create index for restaurant lookups
CREATE INDEX IF NOT EXISTS idx_saved_items_restaurant ON saved_items(restaurant_id);
