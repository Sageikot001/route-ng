-- Track when users last viewed announcements/resources for notification badges
CREATE TABLE IF NOT EXISTS user_content_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL,  -- 'announcements' | 'resources'
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_type)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_content_reads_user_type
  ON user_content_reads(user_id, content_type);

-- RLS policies
ALTER TABLE user_content_reads ENABLE ROW LEVEL SECURITY;

-- Users can read and update their own read timestamps
CREATE POLICY "Users can view own content reads"
  ON user_content_reads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own content reads"
  ON user_content_reads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own content reads"
  ON user_content_reads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to get unread announcements count for a user
CREATE OR REPLACE FUNCTION get_unread_announcements_count(
  p_user_id UUID,
  p_audience TEXT  -- 'ios_users' or 'managers'
)
RETURNS INTEGER AS $$
DECLARE
  last_read TIMESTAMPTZ;
  unread_count INTEGER;
BEGIN
  -- Get last read timestamp
  SELECT last_read_at INTO last_read
  FROM user_content_reads
  WHERE user_id = p_user_id AND content_type = 'announcements';

  -- If never read, count all active announcements for this audience
  IF last_read IS NULL THEN
    SELECT COUNT(*) INTO unread_count
    FROM announcements
    WHERE is_active = true
      AND (audience = 'all' OR audience = p_audience);
  ELSE
    -- Count announcements created after last read
    SELECT COUNT(*) INTO unread_count
    FROM announcements
    WHERE is_active = true
      AND (audience = 'all' OR audience = p_audience)
      AND created_at > last_read;
  END IF;

  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread resources count for a user
CREATE OR REPLACE FUNCTION get_unread_resources_count(
  p_user_id UUID,
  p_audience TEXT  -- 'partners' or 'managers'
)
RETURNS INTEGER AS $$
DECLARE
  last_read TIMESTAMPTZ;
  unread_count INTEGER;
BEGIN
  -- Get last read timestamp
  SELECT last_read_at INTO last_read
  FROM user_content_reads
  WHERE user_id = p_user_id AND content_type = 'resources';

  -- If never read, count all published resources for this audience
  IF last_read IS NULL THEN
    SELECT COUNT(*) INTO unread_count
    FROM resources
    WHERE is_published = true
      AND (target_audience = 'all' OR target_audience = p_audience);
  ELSE
    -- Count resources created after last read
    SELECT COUNT(*) INTO unread_count
    FROM resources
    WHERE is_published = true
      AND (target_audience = 'all' OR target_audience = p_audience)
      AND created_at > last_read;
  END IF;

  RETURN COALESCE(unread_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark content as read (upsert)
CREATE OR REPLACE FUNCTION mark_content_as_read(
  p_user_id UUID,
  p_content_type TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_content_reads (user_id, content_type, last_read_at)
  VALUES (p_user_id, p_content_type, NOW())
  ON CONFLICT (user_id, content_type)
  DO UPDATE SET last_read_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
