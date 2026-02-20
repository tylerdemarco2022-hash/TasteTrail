-- migration_add_momentum_score.sql
-- Additive: Add momentum_score to menu_items and batch update with clean formula

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS momentum_score numeric(10,4) DEFAULT 0;

-- Batch update: momentum_score = (rating_count_last_7_days * 0.7) + (rating_bayesian * 0.3)
UPDATE public.menu_items
SET momentum_score = (COALESCE(rating_count_last_7_days,0) * 0.7) + (COALESCE(rating_bayesian,0) * 0.3);
