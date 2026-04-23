-- PHASE 8: Performance Hardening - Critical Indexes
CREATE INDEX IF NOT EXISTS idx_restaurants_lat_lng ON public.restaurants(lat, lng);

-- PHASE 10: Dynamic Confidence Evolution - Column Additions
ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS scan_count INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS user_confirmations INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS flagged_closed BOOLEAN DEFAULT false;

-- PHASE 11: Trending Layer - Activity Tracking Table
CREATE TABLE IF NOT EXISTS public.restaurant_activity (
  id BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('view', 'save', 'confirm', 'flag_closed')),
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for trending calculations
CREATE INDEX IF NOT EXISTS idx_restaurant_activity_restaurant_id_type ON public.restaurant_activity(restaurant_id, type);
CREATE INDEX IF NOT EXISTS idx_restaurant_activity_created_at ON public.restaurant_activity(created_at);
CREATE INDEX IF NOT EXISTS idx_restaurant_activity_ip_restaurant ON public.restaurant_activity(ip_address, restaurant_id);

-- Function to count views in last 7 days
CREATE OR REPLACE FUNCTION views_last_7_days(restaurant_id BIGINT)
RETURNS INT AS $$
  SELECT COALESCE(COUNT(*), 0) FROM public.restaurant_activity 
  WHERE restaurant_id = $1 
    AND type = 'view' 
    AND created_at > NOW() - INTERVAL '7 days'
$$ LANGUAGE SQL;

-- Function to count confirmations in last 30 days
CREATE OR REPLACE FUNCTION confirms_last_30_days(restaurant_id BIGINT)
RETURNS INT AS $$
  SELECT COALESCE(COUNT(*), 0) FROM public.restaurant_activity 
  WHERE restaurant_id = $1 
    AND type IN ('confirm', 'flag_closed')
    AND created_at > NOW() - INTERVAL '30 days'
$$ LANGUAGE SQL;

-- Function to calculate trending score
CREATE OR REPLACE FUNCTION calculate_trending_score(restaurant_id BIGINT)
RETURNS DECIMAL AS $$
  SELECT (views_last_7_days($1) * 1.0) + (confirms_last_30_days($1) * 3.0)
$$ LANGUAGE SQL;

-- Function to calculate dynamic confidence
CREATE OR REPLACE FUNCTION calculate_dynamic_confidence(
  base_score INT,
  scan_count INT,
  has_photo BOOLEAN,
  user_confirmations INT,
  is_flagged_closed BOOLEAN
)
RETURNS INT AS $$
DECLARE
  score INT;
BEGIN
  score := base_score;
  
  -- Boost for multiple scans (confirms data accuracy)
  IF scan_count > 1 THEN
    score := score + 1;
  END IF;
  
  -- Boost for photo evidence
  IF has_photo THEN
    score := score + 1;
  END IF;
  
  -- Boost for user confirmations
  IF user_confirmations > 0 THEN
    score := score + 1;
  END IF;
  
  -- Heavy penalty for flagged closed
  IF is_flagged_closed THEN
    score := score - 2;
  END IF;
  
  -- Cap between 0 and 5
  RETURN GREATEST(0, LEAST(5, score));
END;
$$ LANGUAGE plpgsql;
