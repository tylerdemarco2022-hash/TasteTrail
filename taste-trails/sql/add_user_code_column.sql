-- Migration: Add user_code column to existing users table
-- Run this in Supabase SQL Editor if your users table already exists

BEGIN;

-- Add user_code column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS user_code text UNIQUE;

-- Create index for faster searches
CREATE INDEX IF NOT EXISTS users_code_idx ON public.users (user_code);

-- Generate unique 5-digit codes for existing users
DO $$
DECLARE
  user_record RECORD;
  new_code text;
  code_exists boolean;
BEGIN
  FOR user_record IN SELECT id FROM public.users WHERE user_code IS NULL
  LOOP
    -- Generate a unique code
    LOOP
      new_code := LPAD(FLOOR(RANDOM() * 90000 + 10000)::text, 5, '0');
      SELECT EXISTS(SELECT 1 FROM public.users WHERE user_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    
    -- Assign the code
    UPDATE public.users SET user_code = new_code WHERE id = user_record.id;
  END LOOP;
END $$;

COMMIT;
