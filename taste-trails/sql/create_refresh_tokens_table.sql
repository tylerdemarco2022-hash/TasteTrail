-- Create refresh_tokens table for both Supabase and development use
-- This table stores hashed refresh tokens to validate token rotations

CREATE TABLE IF NOT EXISTS public.refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NULL,
  revoked_at TIMESTAMPTZ NULL,
  ip_address TEXT,
  user_agent TEXT
);

-- Create index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON public.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON public.refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON public.refresh_tokens(token_hash);

-- Add failed_login_attempts tracking to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL;

-- Enable RLS on refresh_tokens
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Refresh token policies
CREATE POLICY "Users can view their own refresh tokens"
  ON public.refresh_tokens
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own refresh tokens"
  ON public.refresh_tokens
  FOR DELETE
  USING (user_id = auth.uid());

-- Service role can manage all refresh tokens (for password reset, logout all, etc)
CREATE POLICY "Service role can manage refresh tokens"
  ON public.refresh_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
