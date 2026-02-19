-- Credibility + weighted ratings setup for TasteTrails

-- 1) Credibility score on users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS credibility_score float DEFAULT 1.0;

UPDATE public.users
SET credibility_score = 1.0
WHERE credibility_score IS NULL;

-- 2) Weighted average for a dish (menu item)
ALTER TABLE public.dish_ratings
  ALTER COLUMN rating TYPE numeric
  USING rating::numeric;

CREATE OR REPLACE FUNCTION public.get_weighted_average(dish_id uuid)
RETURNS TABLE(weighted_average numeric, rating_count int)
LANGUAGE sql
STABLE
AS $$
  SELECT
    SUM(r.rating * u.credibility_score)::numeric / NULLIF(SUM(u.credibility_score), 0)::numeric AS weighted_average,
    COUNT(*)::int AS rating_count
  FROM public.dish_ratings r
  JOIN public.users u ON r.user_id = u.id
  WHERE r.menu_item_id = dish_id;
$$;

-- 3) Best dish for a restaurant, weighted by credibility
CREATE OR REPLACE FUNCTION public.best_dish_for_restaurant(rest_id uuid)
RETURNS TABLE(menu_item_id uuid, weighted_average numeric, rating_count int)
LANGUAGE sql
STABLE
AS $$
  SELECT
    r.menu_item_id,
    SUM(r.rating * u.credibility_score)::numeric / NULLIF(SUM(u.credibility_score), 0)::numeric AS weighted_average,
    COUNT(*)::int AS rating_count
  FROM public.dish_ratings r
  JOIN public.users u ON r.user_id = u.id
  WHERE r.restaurant_id = rest_id
  GROUP BY r.menu_item_id
  HAVING COUNT(*) >= 5
  ORDER BY weighted_average DESC
  LIMIT 1;
$$;
