-- Add UUID columns to dish_ratings to support UUID-based menu_items
-- Run this once in the Supabase SQL editor

ALTER TABLE dish_ratings
  ADD COLUMN IF NOT EXISTS menu_item_uuid uuid REFERENCES menu_items(id) ON DELETE CASCADE;

ALTER TABLE dish_ratings
  ADD COLUMN IF NOT EXISTS restaurant_uuid uuid REFERENCES restaurants(id) ON DELETE CASCADE;
