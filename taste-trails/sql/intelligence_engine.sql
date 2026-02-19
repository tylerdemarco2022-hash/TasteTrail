-- TasteTrails Intelligence Engine (backend-only scoring)

-- Users: hidden trust + bot system
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS credibility_score float DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS trust_multiplier float DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS bot_score float DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS cluster_id int,
  ADD COLUMN IF NOT EXISTS ratings_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_rating_at timestamptz;

UPDATE public.users
SET credibility_score = 1.0
WHERE credibility_score IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_credibility_score_range'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_credibility_score_range
      CHECK (credibility_score >= 0.2 AND credibility_score <= 3.0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_trust_multiplier_range'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_trust_multiplier_range
      CHECK (trust_multiplier >= 0.5 AND trust_multiplier <= 1.5);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_bot_score_range'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_bot_score_range
      CHECK (bot_score >= 0.0 AND bot_score <= 1.0);
  END IF;
END $$;

-- Dishes: computed stats + emoji signals
ALTER TABLE public.dishes
  ADD COLUMN IF NOT EXISTS rating_weighted float,
  ADD COLUMN IF NOT EXISTS rating_bayesian float,
  ADD COLUMN IF NOT EXISTS rating_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volatility_stddev float,
  ADD COLUMN IF NOT EXISTS emoji_tags text[],
  ADD COLUMN IF NOT EXISTS confidence_score float,
  ADD COLUMN IF NOT EXISTS last_computed_at timestamptz;

-- Ratings: one rating per user per dish
CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating numeric NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, dish_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_user_created_at
  ON public.ratings(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ratings_dish_id
  ON public.ratings(dish_id);

-- Global stats
CREATE TABLE IF NOT EXISTS public.global_stats (
  key text PRIMARY KEY,
  value_float float,
  value_int int,
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.global_stats (key, value_int)
VALUES ('bayes_m', 10)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.global_stats (key, value_float)
VALUES ('global_mean_rating', NULL)
ON CONFLICT (key) DO NOTHING;

-- Cluster stats per dish
CREATE TABLE IF NOT EXISTS public.dish_cluster_stats (
  cluster_id int NOT NULL,
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  rating_weighted float,
  rating_count int DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (cluster_id, dish_id)
);

-- Effective-weighted stats for a dish
CREATE OR REPLACE FUNCTION public.get_effective_dish_stats(dish_id uuid)
RETURNS TABLE(weighted_average numeric, rating_count int, volatility_stddev numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    SUM(r.rating * GREATEST(u.credibility_score * u.trust_multiplier * (1 - u.bot_score), 0.01))::numeric
      / NULLIF(SUM(GREATEST(u.credibility_score * u.trust_multiplier * (1 - u.bot_score), 0.01)), 0)::numeric
      AS weighted_average,
    COUNT(*)::int AS rating_count,
    STDDEV_POP(r.rating)::numeric AS volatility_stddev
  FROM public.ratings r
  JOIN public.users u ON r.user_id = u.id
  WHERE r.dish_id = dish_id;
$$;

-- Global weighted mean
CREATE OR REPLACE FUNCTION public.get_global_weighted_mean()
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT
    SUM(r.rating * GREATEST(u.credibility_score * u.trust_multiplier * (1 - u.bot_score), 0.01))::numeric
      / NULLIF(SUM(GREATEST(u.credibility_score * u.trust_multiplier * (1 - u.bot_score), 0.01)), 0)::numeric
  FROM public.ratings r
  JOIN public.users u ON r.user_id = u.id;
$$;

-- Best dish for a restaurant based on bayesian rating
CREATE OR REPLACE FUNCTION public.best_dish_for_restaurant(rest_id uuid)
RETURNS TABLE(dish_id uuid, rating_bayesian float, rating_count int, emoji_tags text[])
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.id AS dish_id,
    d.rating_bayesian,
    d.rating_count,
    d.emoji_tags
  FROM public.dishes d
  WHERE d.restaurant_id = rest_id
    AND d.rating_count >= 5
  ORDER BY d.rating_bayesian DESC NULLS LAST
  LIMIT 1;
$$;

-- Cluster dish stats for nightly clustering
CREATE OR REPLACE FUNCTION public.get_cluster_dish_stats(target_cluster int)
RETURNS TABLE(dish_id uuid, rating_weighted numeric, rating_count int)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.dish_id,
    SUM(r.rating * GREATEST(u.credibility_score * u.trust_multiplier * (1 - u.bot_score), 0.01))::numeric
      / NULLIF(SUM(GREATEST(u.credibility_score * u.trust_multiplier * (1 - u.bot_score), 0.01)), 0)::numeric
      AS rating_weighted,
    COUNT(*)::int AS rating_count
  FROM public.ratings r
  JOIN public.users u ON r.user_id = u.id
  WHERE u.cluster_id = target_cluster
  GROUP BY r.dish_id;
$$;

-- Top restaurants for clustering
CREATE OR REPLACE FUNCTION public.get_top_restaurants_by_ratings(limit_n int)
RETURNS TABLE(restaurant_id uuid, rating_count int)
LANGUAGE sql
STABLE
AS $$
  SELECT
    d.restaurant_id,
    COUNT(*)::int AS rating_count
  FROM public.ratings r
  JOIN public.dishes d ON r.dish_id = d.id
  GROUP BY d.restaurant_id
  ORDER BY COUNT(*) DESC
  LIMIT limit_n;
$$;

-- User rating averages for selected restaurants
CREATE OR REPLACE FUNCTION public.get_user_restaurant_averages(target_restaurants uuid[])
RETURNS TABLE(user_id uuid, restaurant_id uuid, avg_rating numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.user_id,
    d.restaurant_id,
    AVG(r.rating)::numeric AS avg_rating
  FROM public.ratings r
  JOIN public.dishes d ON r.dish_id = d.id
  WHERE d.restaurant_id = ANY(target_restaurants)
  GROUP BY r.user_id, d.restaurant_id;
$$;
