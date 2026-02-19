-- Create follow_requests table
-- Stores follow requests sent to private accounts (Instagram-style)
-- When a user wants to follow a private account, a request is created with status "pending"
-- The private user can then accept or decline the request

CREATE TABLE IF NOT EXISTS follow_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- The user who is requesting to follow (sender)
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- The user being requested to follow (recipient - private account owner)
  target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Request status: 'pending', 'accepted', 'declined'
  -- pending: Request sent, awaiting response
  -- accepted: Request approved, follow relationship created
  -- declined: Request rejected, no follow relationship
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one request per user pair
  -- Prevents duplicate requests from same requester to same target
  UNIQUE(requester_id, target_id)
);

-- Indexes for fast lookups
-- Index for finding all requests sent to a specific user (target viewing their incoming requests)
CREATE INDEX IF NOT EXISTS idx_follow_requests_target_id ON follow_requests(target_id);

-- Index for finding all requests sent by a specific user (requester checking their outgoing requests)
CREATE INDEX IF NOT EXISTS idx_follow_requests_requester_id ON follow_requests(requester_id);

-- Index for finding pending requests efficiently
CREATE INDEX IF NOT EXISTS idx_follow_requests_status ON follow_requests(status);

-- Comments for documentation
COMMENT ON TABLE follow_requests IS 'Stores follow requests for private accounts - Instagram-style request to follow feature';
COMMENT ON COLUMN follow_requests.requester_id IS 'User who wants to follow (sender of request)';
COMMENT ON COLUMN follow_requests.target_id IS 'User being requested to follow (private account owner)';
COMMENT ON COLUMN follow_requests.status IS 'Request status: pending (awaiting response), accepted (approved and follow created), declined (rejected)';
