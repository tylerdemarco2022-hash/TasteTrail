-- Add is_private column if it doesn't exist
BEGIN;

-- Add column if missing
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false NOT NULL;

COMMIT;
