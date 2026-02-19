-- Restaurants table (menu cache)
CREATE TABLE IF NOT EXISTS restaurants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  cuisine_type TEXT,
  menu JSONB NOT NULL DEFAULT '[]'::jsonb,
  yelp_id TEXT,
  google_place_id TEXT,
  rating NUMERIC(3,2),
  price_level INTEGER CHECK (price_level BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

-- Policies for restaurants table
-- Anyone can read restaurants and menus
CREATE POLICY "Anyone can view restaurants" ON restaurants
  FOR SELECT
  USING (true);

-- Only admin can insert/update restaurants
CREATE POLICY "Admin can insert restaurants" ON restaurants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update restaurants" ON restaurants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete restaurants" ON restaurants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON restaurants(name);
CREATE INDEX IF NOT EXISTS idx_restaurants_yelp_id ON restaurants(yelp_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_google_place_id ON restaurants(google_place_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_menu ON restaurants USING GIN (menu);
