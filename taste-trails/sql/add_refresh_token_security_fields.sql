-- Migration: Harden refresh_tokens table with reuse detection fields
-- Run this in Supabase SQL Editor if refresh_tokens already exists

BEGIN;

ALTER TABLE public.refresh_tokens
ADD COLUMN IF NOT EXISTS last_used_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS revoked_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON public.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);

COMMIT;
