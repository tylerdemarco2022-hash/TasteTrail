-- PHASE 1: Restaurant Cover Photos

-- Add cover_photo_url column to restaurants table
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

-- Create restaurant_photos table for future photo management
CREATE TABLE IF NOT EXISTS public.restaurant_photos (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  uploaded_by TEXT,
  type VARCHAR(50) DEFAULT 'cover' CHECK (type IN ('cover', 'interior', 'menu')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(restaurant_id, type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_restaurant_photos_restaurant_id ON public.restaurant_photos(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_photos_type ON public.restaurant_photos(type);
CREATE INDEX IF NOT EXISTS idx_restaurant_photos_created_at ON public.restaurant_photos(created_at);

-- Create index for finding restaurants missing photos
CREATE INDEX IF NOT EXISTS idx_restaurants_cover_photo_null ON public.restaurants(cover_photo_url) WHERE cover_photo_url IS NULL;
