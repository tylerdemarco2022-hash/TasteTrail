-- Create users table in public schema used by the app
BEGIN;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  user_code text UNIQUE,
  role text DEFAULT 'user' NOT NULL,
    credibility_score float DEFAULT 1.0 NOT NULL,
    trust_multiplier float DEFAULT 1.0 NOT NULL,
    bot_score float DEFAULT 0.0 NOT NULL,
    cluster_id int,
    ratings_count int DEFAULT 0 NOT NULL,
    last_rating_at timestamptz,
  is_private boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_name_idx ON public.users (name);
CREATE INDEX IF NOT EXISTS users_code_idx ON public.users (user_code);

COMMIT;
