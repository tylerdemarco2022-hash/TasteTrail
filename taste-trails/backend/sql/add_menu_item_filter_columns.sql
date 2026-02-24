-- Add columns for Quick Filter Chips feature
-- Adds order_count, tags array, and is_new flag to menu_items table

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS order_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;

-- Create indexes for better filter performance
CREATE INDEX IF NOT EXISTS idx_menu_items_order_count ON menu_items (order_count DESC);
CREATE INDEX IF NOT EXISTS idx_menu_items_tags ON menu_items USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_new ON menu_items (is_new) WHERE is_new = true;
CREATE INDEX IF NOT EXISTS idx_menu_items_price ON menu_items (price);

-- Add helpful comment
COMMENT ON COLUMN menu_items.order_count IS 'Number of times this item has been ordered';
COMMENT ON COLUMN menu_items.tags IS 'Array of tags like ["spicy", "healthy", "popular"]';
COMMENT ON COLUMN menu_items.is_new IS 'Whether this item is newly added to menu';
