-- KYC Verification System Migration
-- Adds verification fields to ios_user_profiles for identity verification

-- Add verification status enum type
DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('unverified', 'pending', 'verified', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add ID type enum
DO $$ BEGIN
  CREATE TYPE id_type AS ENUM ('nin', 'voters_card', 'drivers_license', 'passport');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add verification columns to ios_user_profiles
ALTER TABLE ios_user_profiles
ADD COLUMN IF NOT EXISTS profile_image_url TEXT,
ADD COLUMN IF NOT EXISTS verification_status verification_status DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS bvn VARCHAR(11),
ADD COLUMN IF NOT EXISTS id_type id_type,
ADD COLUMN IF NOT EXISTS id_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS id_image_url TEXT,
ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS verification_reviewed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS verification_rejection_reason TEXT;

-- Set existing users as verified (grandfathered in)
UPDATE ios_user_profiles
SET verification_status = 'verified'
WHERE verification_status IS NULL OR verification_status = 'unverified';

-- After updating existing users, set default for new users
ALTER TABLE ios_user_profiles
ALTER COLUMN verification_status SET DEFAULT 'unverified';

-- Create storage bucket for profile images if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for ID documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('id-documents', 'id-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for profile-images bucket
CREATE POLICY "Users can upload their own profile image"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own profile image"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Profile images are publicly viewable"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- RLS policies for id-documents bucket (more restrictive)
CREATE POLICY "Users can upload their own ID documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'id-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own ID documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'id-documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all ID documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'id-documents' AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Index for quick lookup of pending verifications
CREATE INDEX IF NOT EXISTS idx_ios_user_profiles_verification_status
ON ios_user_profiles(verification_status)
WHERE verification_status = 'pending';

-- Add comment for documentation
COMMENT ON COLUMN ios_user_profiles.verification_status IS 'KYC verification status: unverified (new users), pending (submitted), verified (approved), rejected';
COMMENT ON COLUMN ios_user_profiles.bvn IS 'Bank Verification Number (11 digits)';
COMMENT ON COLUMN ios_user_profiles.id_type IS 'Type of government ID submitted';
COMMENT ON COLUMN ios_user_profiles.id_number IS 'Government ID number';
