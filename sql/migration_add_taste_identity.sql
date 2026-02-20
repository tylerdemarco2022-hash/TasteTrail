-- migration_add_taste_identity.sql
-- Additive: Add taste_identity table for user taste profiles

CREATE TABLE IF NOT EXISTS public.taste_identity (
  user_id uuid PRIMARY KEY REFERENCES public.users(id),
  taste_vector jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- taste_vector stores a JSON object with cuisine, flavor, and dish-type preferences, e.g.:
-- {"cuisine": {"italian": 0.8, "mexican": 0.2}, "flavor": {"spicy": 0.7, "sweet": 0.1}, "dish_type": {"pizza": 0.9, "taco": 0.3}}

CREATE INDEX IF NOT EXISTS taste_identity_updated_at_idx ON public.taste_identity(updated_at);
