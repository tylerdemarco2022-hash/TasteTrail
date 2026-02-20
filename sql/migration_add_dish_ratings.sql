-- migration_add_dish_ratings.sql
-- Additive: Create dish_ratings table for ratings 0.0-10.0, with created_at and composite index

CREATE TABLE IF NOT EXISTS public.dish_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dish_id uuid NOT NULL REFERENCES public.dishes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating numeric(3,1) NOT NULL CHECK (rating >= 0.0 AND rating <= 10.0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dish_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dish_ratings_dish_id_created_at
  ON public.dish_ratings(dish_id, created_at);
