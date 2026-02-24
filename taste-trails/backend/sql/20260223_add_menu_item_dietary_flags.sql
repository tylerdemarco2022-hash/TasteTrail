BEGIN;

ALTER TABLE IF EXISTS menu_items
  ADD COLUMN IF NOT EXISTS is_vegan BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_vegetarian BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_gluten_free BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_dairy_free BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_nut_free BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_shellfish_free BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_egg_free BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_keto BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_paleo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_halal BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_kosher BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dietary_confidence_score FLOAT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dietary_manual_override BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_menu_items_is_vegan ON menu_items (is_vegan);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_vegetarian ON menu_items (is_vegetarian);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_gluten_free ON menu_items (is_gluten_free);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_dairy_free ON menu_items (is_dairy_free);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_nut_free ON menu_items (is_nut_free);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_shellfish_free ON menu_items (is_shellfish_free);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_egg_free ON menu_items (is_egg_free);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_keto ON menu_items (is_keto);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_paleo ON menu_items (is_paleo);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_halal ON menu_items (is_halal);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_kosher ON menu_items (is_kosher);

COMMIT;
