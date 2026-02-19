-- SQL to create a simple reviews table for Supabase/Postgres
-- Run this in your Supabase SQL editor or psql

CREATE TABLE IF NOT EXISTS reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text,
  restaurant_id text NOT NULL,
  dish text NOT NULL,
  rating numeric NOT NULL,
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Index for faster lookups by restaurant
CREATE INDEX IF NOT EXISTS idx_reviews_restaurant_id ON reviews (restaurant_id);
