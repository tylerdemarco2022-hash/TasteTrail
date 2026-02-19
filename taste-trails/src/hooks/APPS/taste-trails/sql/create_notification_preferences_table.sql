-- Create notification_preferences table
-- Stores user notification settings for push alerts, emails, sounds, and specific alert types

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Main notification toggles
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  
  -- Specific alert types stored as JSONB for flexibility
  alerts JSONB DEFAULT '{
    "newRatings": true,
    "followRequests": true,
    "trendingRestaurants": true,
    "dishMilestones": true,
    "adminBroadcasts": true
  }'::jsonb,
  
  -- Notification frequency: 'instant', 'daily', or 'weekly'
  frequency VARCHAR(20) DEFAULT 'instant',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- Comments for documentation
COMMENT ON TABLE notification_preferences IS 'Stores user notification preferences for push alerts, email alerts, sound settings, and specific alert types';
COMMENT ON COLUMN notification_preferences.push_enabled IS 'Whether push notifications are enabled for this user';
COMMENT ON COLUMN notification_preferences.email_enabled IS 'Whether email alerts are enabled for this user';
COMMENT ON COLUMN notification_preferences.sound_enabled IS 'Whether notification sounds are enabled';
COMMENT ON COLUMN notification_preferences.alerts IS 'JSON object containing individual alert type preferences';
COMMENT ON COLUMN notification_preferences.frequency IS 'How often to send non-urgent notifications: instant, daily, or weekly';
