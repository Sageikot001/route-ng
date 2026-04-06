-- ============================================
-- TERMS AND CONDITIONS ACCEPTANCE TRACKING
-- ============================================

-- Add terms_accepted_at to ios_user_profiles
ALTER TABLE ios_user_profiles
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ DEFAULT NULL;

-- Add terms_accepted_at to manager_profiles
ALTER TABLE manager_profiles
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ DEFAULT NULL;

-- Add terms_version to track which version they agreed to
ALTER TABLE ios_user_profiles
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) DEFAULT NULL;

ALTER TABLE manager_profiles
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) DEFAULT NULL;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_ios_users_terms_accepted ON ios_user_profiles(terms_accepted_at);
CREATE INDEX IF NOT EXISTS idx_managers_terms_accepted ON manager_profiles(terms_accepted_at);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN ios_user_profiles.terms_accepted_at IS 'Timestamp when user accepted terms and conditions';
COMMENT ON COLUMN ios_user_profiles.terms_version IS 'Version of terms accepted (e.g., "1.0", "2.0")';
COMMENT ON COLUMN manager_profiles.terms_accepted_at IS 'Timestamp when manager accepted terms and conditions';
COMMENT ON COLUMN manager_profiles.terms_version IS 'Version of terms accepted (e.g., "1.0", "2.0")';
