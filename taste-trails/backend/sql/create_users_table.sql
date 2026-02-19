-- Users table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  credibility_score float DEFAULT 1.0 NOT NULL,
  trust_multiplier float DEFAULT 1.0 NOT NULL,
  bot_score float DEFAULT 0.0 NOT NULL,
  cluster_id int,
  ratings_count int DEFAULT 0 NOT NULL,
  last_rating_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policies for users table
-- Users can read all users (for community features)
CREATE POLICY "Users can view all users" ON users
  FOR SELECT
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE
  USING (auth.uid() = id);

-- Admin can update any user
CREATE POLICY "Admin can update any user" ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
