-- Add section_name column to menu_items table
-- This stores the ACTUAL section header from the restaurant's menu
-- Migration: 20260226_add_section_name_to_menu_items.sql

-- Add section_name column with proper defaults
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS section_name TEXT NOT NULL DEFAULT 'Uncategorized';

-- Add constraint to prevent empty strings (only allow meaningful values)
-- This ensures section_name cannot be '', must have actual content
ALTER TABLE menu_items
  ADD CONSTRAINT section_name_not_empty CHECK (length(trim(section_name)) > 0);

-- Add index for fast filtering by section
CREATE INDEX IF NOT EXISTS idx_menu_items_section_name ON menu_items(section_name);

-- Add index for restaurant + section lookups (performance critical)
CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_section ON menu_items(restaurant_id, section_name);

-- Add comment to document purpose
COMMENT ON COLUMN menu_items.section_name IS 'Exact section header from restaurant menu (e.g., "Raw", "Small Plates", "From The Grill"). Preserves original casing and spelling. No automatic classification. Cannot be empty string due to constraint.';
