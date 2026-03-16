-- Add scan period fields to email_checker_config (IF NOT EXISTS for safety)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'email_checker_config' AND column_name = 'scan_from_date') THEN
    ALTER TABLE email_checker_config ADD COLUMN scan_from_date DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'email_checker_config' AND column_name = 'scan_to_date') THEN
    ALTER TABLE email_checker_config ADD COLUMN scan_to_date DATE;
  END IF;
END $$;

-- Allow service role to access user_apple_ids for auto-checker matching
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_apple_ids'
    AND policyname = 'Service role full access to user_apple_ids'
  ) THEN
    CREATE POLICY "Service role full access to user_apple_ids"
      ON user_apple_ids FOR SELECT
      TO service_role
      USING (true);
  END IF;
END $$;
