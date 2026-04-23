-- Make old integer columns nullable so UUID-based inserts work
-- Run this once in the Supabase SQL editor

ALTER TABLE dish_ratings
  ALTER COLUMN menu_item_id DROP NOT NULL;

ALTER TABLE dish_ratings
  ALTER COLUMN restaurant_id DROP NOT NULL;
