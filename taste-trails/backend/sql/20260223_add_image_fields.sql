-- Migration: add hero image to restaurants + per-dish image to menu_items
-- Date: 2026-02-23
-- Source: scraped from restaurant websites during menu extraction
-- No third-party image API required; URLs are stored as-is for now.
-- Phase 2: download to own storage bucket and replace with CDN URL.

-- ── restaurants ───────────────────────────────────────────────────────────────
-- hero_image_url: largest above-the-fold image found on the restaurant page
-- image_source  : how the image was obtained ('scraped' | 'manual' | 'cdn')

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_source   TEXT NOT NULL DEFAULT 'scraped';

-- Partial index: quickly find restaurants that already have a hero image
CREATE INDEX IF NOT EXISTS idx_restaurants_has_hero
  ON restaurants (id)
  WHERE hero_image_url IS NOT NULL;

-- ── menu_items ────────────────────────────────────────────────────────────────
-- image_url   : nearest image found in the same DOM container as the menu item
-- image_source: same enum as above
-- Note: the existing photo_url column was added manually / via upload;
--       image_url is the auto-scraped counterpart.

ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS image_url    TEXT,
  ADD COLUMN IF NOT EXISTS image_source TEXT NOT NULL DEFAULT 'scraped';

-- Partial index: quickly find items that have a scraped image
CREATE INDEX IF NOT EXISTS idx_menu_items_has_image
  ON menu_items (restaurant_id)
  WHERE image_url IS NOT NULL;
