-- Create follows table
-- Stores active follow relationships between users
-- This table is populated when:
-- 1. A user follows a public account (direct insert)
-- 2. A follow request to a private account is accepted (insert after acceptance)

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- The user who is following (follower)
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- The user being followed (the account being followed)
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Timestamp when the follow relationship was created
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one follow relationship per user pair
  -- Prevents duplicate follows
  UNIQUE(follower_id, following_id),
  
  -- Prevent self-follows
  CHECK (follower_id != following_id)
);

-- Indexes for fast lookups
-- Index for finding all users that a specific user is following
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);

-- Index for finding all followers of a specific user
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

-- Comments for documentation
COMMENT ON TABLE follows IS 'Stores active follow relationships between users';
COMMENT ON COLUMN follows.follower_id IS 'User who is following (the follower)';
COMMENT ON COLUMN follows.following_id IS 'User being followed (the account)';
