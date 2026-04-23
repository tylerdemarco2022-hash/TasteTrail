-- Menu Persistence Schema Migration
-- Adds staleness tracking, versioning, deduplication constraints, and relaxes NOT NULL requirements

-- 1. Add tracking columns to restaurant_menus
ALTER TABLE restaurant_menus
  ADD COLUMN IF NOT EXISTS last_scraped_at timestamptz,
  ADD COLUMN IF NOT EXISTS menu_version integer NOT NULL DEFAULT 1;

-- 2. Relax source_url to allow NULL (filesystem cache saves have no source URL)
ALTER TABLE restaurant_menus ALTER COLUMN source_url DROP NOT NULL;

-- 3. Drop the menu_json_not_empty CHECK constraint (we save flat arrays, not {categories:[...]})
ALTER TABLE restaurant_menus DROP CONSTRAINT IF EXISTS menu_json_not_empty;

-- 4. Relax validation_passed to allow NULL (server-owned saves don't always set this)
ALTER TABLE restaurant_menus ALTER COLUMN validation_passed DROP NOT NULL;

-- 5. Give item_count a default so upserts don't require it explicitly
ALTER TABLE restaurant_menus ALTER COLUMN item_count SET DEFAULT 0;
ALTER TABLE restaurant_menus ALTER COLUMN item_count DROP NOT NULL;

-- 6. Deduplicate menu_items before adding unique constraint
--    Keep the row with the most ratings (or oldest if tied) for each (restaurant_id, name)
DELETE FROM menu_items a
  USING menu_items b
  WHERE a.restaurant_id = b.restaurant_id
    AND lower(trim(a.name)) = lower(trim(b.name))
    AND a.id <> b.id
    AND (
      COALESCE(a.rating_count, 0) < COALESCE(b.rating_count, 0)
      OR (COALESCE(a.rating_count, 0) = COALESCE(b.rating_count, 0) AND a.created_at > b.created_at)
    );

-- 7. Add unique constraint on menu_items(restaurant_id, name) for DB-level dedup
ALTER TABLE menu_items
  ADD CONSTRAINT menu_items_restaurant_name_unique UNIQUE (restaurant_id, name);

-- 8. Add index on restaurant_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menus_restaurant_id ON restaurant_menus(restaurant_id);
