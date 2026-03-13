-- =============================================
-- Epic 1: House Account System
-- =============================================

-- Task 1.2: Add is_house_account column to manager_profiles
ALTER TABLE manager_profiles
ADD COLUMN IF NOT EXISTS is_house_account BOOLEAN DEFAULT FALSE;

-- Create index for quick house account lookups
CREATE INDEX IF NOT EXISTS idx_manager_profiles_house_account
ON manager_profiles(is_house_account) WHERE is_house_account = TRUE;

-- Task 1.1: Create House Account Manager
-- First, we need a user record for the house account manager
-- Using a deterministic UUID so this is idempotent

DO $$
DECLARE
  house_user_id UUID := '00000000-0000-0000-0000-000000000001';
  house_manager_id UUID;
BEGIN
  -- Check if house account user already exists
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = house_user_id) THEN
    -- Create the house account user
    INSERT INTO users (id, email, username, role, is_active)
    VALUES (
      house_user_id,
      'house@route.ng',
      'Route.ng Direct',
      'manager',
      TRUE
    );
  END IF;

  -- Check if house account manager profile already exists
  IF NOT EXISTS (SELECT 1 FROM manager_profiles WHERE user_id = house_user_id) THEN
    -- Create the house account manager profile
    INSERT INTO manager_profiles (
      user_id,
      full_name,
      team_name,
      status,
      commission_rate,
      referral_code,
      is_house_account,
      verified_at
    )
    VALUES (
      house_user_id,
      'Route.ng Direct',
      'Independent Partners',
      'verified',
      0.00,  -- No commission for house account
      'ROUTENG',  -- Special referral code (optional use)
      TRUE,
      NOW()
    )
    RETURNING id INTO house_manager_id;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN manager_profiles.is_house_account IS
  'True for the default Route.ng Direct manager that independent users are assigned to';
