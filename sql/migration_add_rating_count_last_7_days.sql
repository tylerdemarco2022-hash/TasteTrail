-- migration_add_rating_count_last_7_days.sql
-- Additive: Add rating_count_last_7_days to menu_items for trending

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS rating_count_last_7_days integer DEFAULT 0;

-- Batch update: count ratings in last 7 days for each dish
UPDATE public.menu_items mi
SET rating_count_last_7_days = sub.cnt
FROM (
  SELECT dish_id, COUNT(*) AS cnt
  FROM public.dish_ratings
  WHERE created_at >= NOW() - INTERVAL '7 days'
  GROUP BY dish_id
) sub
WHERE mi.id = sub.dish_id;
