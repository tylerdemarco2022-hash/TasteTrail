-- QUICK SETUP: Run this in Supabase SQL Editor
-- This creates the users table with the user_code column included

BEGIN;

-- Create users table
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

-- Create helpful indexes
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_name_idx ON public.users (name);
CREATE INDEX IF NOT EXISTS users_code_idx ON public.users (user_code);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all public profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.users
  FOR SELECT
  USING (is_private = false OR auth.uid() = id);

-- Policy: Users can read their own profile even if private
CREATE POLICY "Users can view own profile"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy: System can insert new users (for signups)
CREATE POLICY "Enable insert for service role"
  ON public.users
  FOR INSERT
  WITH CHECK (true);

COMMIT;

-- Verify the table was created
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;
