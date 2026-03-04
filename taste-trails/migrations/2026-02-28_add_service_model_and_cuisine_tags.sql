-- Migration: Add service_model and cuisine_tags to restaurants, remove restaurant_type

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS service_model text CHECK (service_model IN ('fast_casual', 'casual_dining', 'fine_dining', 'bar_grill'));

ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS cuisine_tags text[] DEFAULT ARRAY[]::text[];

-- Remove or deprecate old restaurant_type column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='restaurants' AND column_name='restaurant_type'
  ) THEN
    ALTER TABLE restaurants RENAME COLUMN restaurant_type TO restaurant_type_deprecated;
  END IF;
END$$;
