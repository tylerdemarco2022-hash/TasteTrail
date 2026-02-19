-- Ratings table (user ratings for dishes)
CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  rating numeric NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Policies for ratings table
-- Users can read all ratings (for community features)
CREATE POLICY "Anyone can view ratings" ON ratings
  FOR SELECT
  USING (true);

-- Users can insert their own ratings
CREATE POLICY "Users can insert own ratings" ON ratings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings" ON ratings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete own ratings" ON ratings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admin can update/delete any rating
CREATE POLICY "Admin can update any rating" ON ratings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete any rating" ON ratings
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ratings_user_id ON ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_dish_id ON ratings(dish_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON ratings(created_at DESC);

-- Unique constraint: one rating per user per dish per restaurant
CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_user_dish 
  ON ratings(user_id, dish_id);
