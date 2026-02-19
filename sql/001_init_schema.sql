-- 001_init_schema.sql
-- Initialize restaurants, categories, and dishes schema for Supabase

-- Ensure pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Restaurants
CREATE TABLE IF NOT EXISTS public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  website text,
  latitude numeric,
  longitude numeric,
  menu_hash text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_name text NOT NULL
);

-- Dishes
CREATE TABLE IF NOT EXISTS public.dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  dish_name text NOT NULL,
  description text,
  price text,
  cuisine_tag text,
  dietary_tags jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dishes_dish_name ON public.dishes(dish_name);
CREATE INDEX IF NOT EXISTS idx_dishes_restaurant_id ON public.dishes(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_name ON public.restaurants(name);

-- Optional: improve ILIKE performance by a functional lower() index
-- CREATE INDEX IF NOT EXISTS idx_dishes_dish_name_lower ON public.dishes (lower(dish_name));

-- End of migration
