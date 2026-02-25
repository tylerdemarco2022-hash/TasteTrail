-- ========================================
-- ADD TRENDING COLUMNS TO RESTAURANTS TABLE
-- Pre-compute trending metrics for performance
-- ========================================

-- Add views_7d column (views in last 7 days)
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS views_7d INTEGER DEFAULT 0;

-- Add confirms_30d column (confirmations in last 30 days)
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS confirms_30d INTEGER DEFAULT 0;

-- Add trending_score column (pre-computed)
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS trending_score INTEGER DEFAULT 0;

-- Add index for trending sort
CREATE INDEX IF NOT EXISTS idx_restaurants_trending_score
ON restaurants(trending_score DESC);

-- ========================================
-- RPC FUNCTIONS FOR ATOMIC INCREMENTS
-- ========================================

-- Increment views_7d and recalculate trending_score
CREATE OR REPLACE FUNCTION increment_views(restaurant_id_param BIGINT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE restaurants
  SET 
    views_7d = COALESCE(views_7d, 0) + 1,
    trending_score = (COALESCE(views_7d, 0) + 1) + (COALESCE(confirms_30d, 0) * 3)
  WHERE id = restaurant_id_param;
END;
$$;

-- Increment confirms_30d and recalculate trending_score
CREATE OR REPLACE FUNCTION increment_confirms(restaurant_id_param BIGINT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE restaurants
  SET 
    confirms_30d = COALESCE(confirms_30d, 0) + 1,
    trending_score = COALESCE(views_7d, 0) + ((COALESCE(confirms_30d, 0) + 1) * 3)
  WHERE id = restaurant_id_param;
END;
$$;

-- ========================================
-- INITIALIZE DATA FROM EXISTING ACTIVITY
-- ========================================

-- This computes initial values based on restaurant_activity history
UPDATE restaurants r
SET 
  views_7d = COALESCE((
    SELECT COUNT(*) 
    FROM restaurant_activity a
    WHERE a.restaurant_id = r.id 
    AND a.type = 'view'
    AND a.created_at >= NOW() - INTERVAL '7 days'
  ), 0),
  confirms_30d = COALESCE((
    SELECT COUNT(*) 
    FROM restaurant_activity a
    WHERE a.restaurant_id = r.id 
    AND a.type IN ('confirm', 'flag_closed')
    AND a.created_at >= NOW() - INTERVAL '30 days'
  ), 0);

-- Compute initial trending scores
UPDATE restaurants
SET trending_score = (views_7d * 1) + (confirms_30d * 3);

-- ========================================
-- VERIFICATION
-- ========================================
-- SELECT id, name, views_7d, confirms_30d, trending_score 
-- FROM restaurants 
-- ORDER BY trending_score DESC 
-- LIMIT 10;
