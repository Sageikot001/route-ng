-- Add snippet column to raw_emails to preserve Gmail preview text
-- The snippet often contains the amount in a parseable format

ALTER TABLE raw_emails ADD COLUMN IF NOT EXISTS snippet TEXT;

-- Update comment
COMMENT ON COLUMN raw_emails.snippet IS 'Gmail snippet/preview text - often contains amount';
