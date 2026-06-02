-- Push Notifications Migration
-- Stores FCM tokens for sending push notifications

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fcm_token)
);

-- Index for quick lookups by user
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
ON push_subscriptions(user_id);

-- Index for token lookups (for cleanup of invalid tokens)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_fcm_token
ON push_subscriptions(fcm_token);

-- RLS policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own push tokens
CREATE POLICY "Users can insert own push tokens"
ON push_subscriptions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Users can view their own push tokens
CREATE POLICY "Users can view own push tokens"
ON push_subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Users can delete their own push tokens
CREATE POLICY "Users can delete own push tokens"
ON push_subscriptions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Users can update their own push tokens
CREATE POLICY "Users can update own push tokens"
ON push_subscriptions FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Admins can view all push tokens (for sending notifications)
CREATE POLICY "Admins can view all push tokens"
ON push_subscriptions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Comment for documentation
COMMENT ON TABLE push_subscriptions IS 'Stores FCM push notification tokens for users';
COMMENT ON COLUMN push_subscriptions.fcm_token IS 'Firebase Cloud Messaging token';
COMMENT ON COLUMN push_subscriptions.device_info IS 'User agent or device identifier';
