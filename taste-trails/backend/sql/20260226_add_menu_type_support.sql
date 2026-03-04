-- Migration: Add menu_type support to menu_items
-- Date: 2026-02-26
-- Purpose: Support separate breakfast, lunch, dinner, drinks menus

-- 1. Add menu_type column with default
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS menu_type TEXT NOT NULL DEFAULT 'dinner';

-- 2. Add CHECK constraint for valid menu types
ALTER TABLE menu_items 
DROP CONSTRAINT IF EXISTS menu_items_menu_type_check;

ALTER TABLE menu_items 
ADD CONSTRAINT menu_items_menu_type_check 
CHECK (menu_type IN ('breakfast', 'lunch', 'dinner', 'drinks'));

-- 3. Add index for restaurant + menu_type queries
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_type 
ON menu_items(restaurant_id, menu_type);

-- 4. Add menu URL columns to restaurants table
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS breakfast_url TEXT,
ADD COLUMN IF NOT EXISTS lunch_url TEXT,
ADD COLUMN IF NOT EXISTS dinner_url TEXT,
ADD COLUMN IF NOT EXISTS drinks_url TEXT,
ADD COLUMN IF NOT EXISTS menu_types TEXT[] DEFAULT '{"dinner"}';

-- 5. Add index for menu URL queries
CREATE INDEX IF NOT EXISTS idx_restaurants_menu_urls
ON restaurants(id)
WHERE breakfast_url IS NOT NULL OR lunch_url IS NOT NULL OR drinks_url IS NOT NULL;

-- 6. Verify migration
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'menu_items' 
AND column_name = 'menu_type';

SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'restaurants' 
AND column_name IN ('breakfast_url', 'lunch_url', 'dinner_url', 'drinks_url', 'menu_types');
