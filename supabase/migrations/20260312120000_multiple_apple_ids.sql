-- Epic 2: Multiple Apple IDs Support
-- Allow users to manage multiple Apple IDs (devices) and select which one when logging transactions

-- =============================================
-- 2.1 Create user_apple_ids table
-- =============================================
CREATE TABLE IF NOT EXISTS user_apple_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  apple_id VARCHAR(255) NOT NULL,
  label VARCHAR(100), -- e.g., "iPhone 15 Pro", "iPad Air"
  is_primary BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete timestamp
);

-- Index for faster lookups
CREATE INDEX idx_user_apple_ids_user_id ON user_apple_ids(user_id);
CREATE INDEX idx_user_apple_ids_apple_id ON user_apple_ids(apple_id);

-- Unique constraint: same apple_id can't be added twice globally (across all users)
CREATE UNIQUE INDEX idx_user_apple_ids_unique_apple_id
  ON user_apple_ids(apple_id)
  WHERE deleted_at IS NULL AND is_active = TRUE;

-- =============================================
-- 2.2 Migrate existing Apple IDs
-- =============================================
-- Insert existing apple_id from ios_user_profiles into user_apple_ids
INSERT INTO user_apple_ids (user_id, apple_id, label, is_primary, is_active)
SELECT
  user_id,
  apple_id,
  'Primary Device' as label,
  TRUE as is_primary,
  TRUE as is_active
FROM ios_user_profiles
WHERE apple_id IS NOT NULL AND apple_id != ''
ON CONFLICT DO NOTHING;

-- =============================================
-- 2.7 Update transactions table
-- =============================================
-- Add apple_id_id column to transactions (nullable for backward compatibility)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS apple_id_id UUID REFERENCES user_apple_ids(id);

-- Create index for the new column
CREATE INDEX IF NOT EXISTS idx_transactions_apple_id_id ON transactions(apple_id_id);

-- Backfill existing transactions with the user's primary apple_id
UPDATE transactions t
SET apple_id_id = (
  SELECT ua.id
  FROM user_apple_ids ua
  JOIN ios_user_profiles iup ON ua.user_id = iup.user_id
  WHERE iup.id = t.ios_user_id
  AND ua.is_primary = TRUE
  LIMIT 1
)
WHERE t.apple_id_id IS NULL;

-- =============================================
-- RLS Policies for user_apple_ids
-- =============================================
ALTER TABLE user_apple_ids ENABLE ROW LEVEL SECURITY;

-- Users can view their own Apple IDs
CREATE POLICY "Users can view own apple_ids"
  ON user_apple_ids FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own Apple IDs
CREATE POLICY "Users can insert own apple_ids"
  ON user_apple_ids FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own Apple IDs
CREATE POLICY "Users can update own apple_ids"
  ON user_apple_ids FOR UPDATE
  USING (user_id = auth.uid());

-- Users can delete (soft delete) their own Apple IDs
CREATE POLICY "Users can delete own apple_ids"
  ON user_apple_ids FOR DELETE
  USING (user_id = auth.uid());

-- Admins can view all Apple IDs
CREATE POLICY "Admins can view all apple_ids"
  ON user_apple_ids FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Managers can view their team members' Apple IDs
CREATE POLICY "Managers can view team apple_ids"
  ON user_apple_ids FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ios_user_profiles iup
      JOIN manager_profiles mp ON iup.manager_id = mp.id
      WHERE iup.user_id = user_apple_ids.user_id
      AND mp.user_id = auth.uid()
    )
  );
