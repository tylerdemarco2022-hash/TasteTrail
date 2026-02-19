-- Create follows and follow_requests tables
BEGIN;

-- Follows table: tracks who follows whom
CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(follower_id, following_id)
);

-- Follow requests table: for private accounts
CREATE TABLE IF NOT EXISTS public.follow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(requester_id, target_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS follows_follower_idx ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id);
CREATE INDEX IF NOT EXISTS follow_requests_requester_idx ON public.follow_requests (requester_id);
CREATE INDEX IF NOT EXISTS follow_requests_target_idx ON public.follow_requests (target_id);
CREATE INDEX IF NOT EXISTS follow_requests_status_idx ON public.follow_requests (status);

-- Enable RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

-- Follows policies
CREATE POLICY "Users can view all follows"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own follows"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

-- Follow requests policies
CREATE POLICY "Users can view requests involving them"
  ON public.follow_requests FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "Users can create follow requests"
  ON public.follow_requests FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Target users can update their requests"
  ON public.follow_requests FOR UPDATE
  USING (auth.uid() = target_id);

CREATE POLICY "Users can delete their own requests"
  ON public.follow_requests FOR DELETE
  USING (auth.uid() = requester_id);

COMMIT;
