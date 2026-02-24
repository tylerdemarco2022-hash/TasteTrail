-- Migration: Add Google OAuth columns to users table
-- Run this in Supabase SQL Editor if your users table already exists

BEGIN;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS google_id text UNIQUE,
ADD COLUMN IF NOT EXISTS auth_provider text DEFAULT 'local' NOT NULL,
ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE INDEX IF NOT EXISTS users_google_id_idx ON public.users (google_id);

COMMIT;
