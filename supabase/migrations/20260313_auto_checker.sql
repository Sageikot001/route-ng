-- Auto-Checker Gift Card Receipt System
-- Automated verification of forwarded Apple gift card emails

-- Store Gmail OAuth credentials & config
CREATE TABLE email_checker_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_email VARCHAR(255) NOT NULL,
  oauth_refresh_token TEXT,          -- Should be encrypted in production
  oauth_access_token TEXT,           -- Should be encrypted in production
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_scan_at TIMESTAMPTZ,
  scan_interval_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw emails fetched from Gmail
CREATE TABLE raw_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(255) UNIQUE NOT NULL,  -- Gmail message ID
  from_email VARCHAR(255) NOT NULL,         -- Sender (user who forwarded)
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT false,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parsed gift card data extracted from emails
CREATE TABLE parsed_gift_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_email_id UUID REFERENCES raw_emails(id) ON DELETE SET NULL,
  sender_email VARCHAR(255) NOT NULL,       -- User who sent the email
  redemption_code VARCHAR(50),              -- Gift card code
  amount DECIMAL(10,2),                     -- Gift card value
  currency VARCHAR(10) DEFAULT 'USD',
  card_index INTEGER DEFAULT 1,             -- If multiple cards in one email
  matched_user_id UUID REFERENCES ios_user_profiles(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scan operation logs
CREATE TABLE email_scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  emails_fetched INTEGER DEFAULT 0,
  emails_parsed INTEGER DEFAULT 0,
  cards_found INTEGER DEFAULT 0,
  errors TEXT[],
  triggered_by VARCHAR(50) DEFAULT 'manual'  -- 'manual' | 'scheduled'
);

-- Indexes for performance
CREATE INDEX idx_raw_emails_from_email ON raw_emails(from_email);
CREATE INDEX idx_raw_emails_received_at ON raw_emails(received_at);
CREATE INDEX idx_raw_emails_processed ON raw_emails(processed);
CREATE INDEX idx_parsed_gift_cards_sender ON parsed_gift_cards(sender_email);
CREATE INDEX idx_parsed_gift_cards_received_at ON parsed_gift_cards(received_at);
CREATE INDEX idx_parsed_gift_cards_matched_user ON parsed_gift_cards(matched_user_id);
CREATE INDEX idx_email_scan_logs_started_at ON email_scan_logs(started_at);

-- Enable RLS on all tables
ALTER TABLE email_checker_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE parsed_gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_scan_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin-only access for all auto-checker tables

-- email_checker_config policies
CREATE POLICY "Admins can view email config"
  ON email_checker_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert email config"
  ON email_checker_config FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update email config"
  ON email_checker_config FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete email config"
  ON email_checker_config FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- raw_emails policies
CREATE POLICY "Admins can view raw emails"
  ON raw_emails FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert raw emails"
  ON raw_emails FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update raw emails"
  ON raw_emails FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- parsed_gift_cards policies
CREATE POLICY "Admins can view parsed gift cards"
  ON parsed_gift_cards FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert parsed gift cards"
  ON parsed_gift_cards FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update parsed gift cards"
  ON parsed_gift_cards FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- email_scan_logs policies
CREATE POLICY "Admins can view scan logs"
  ON email_scan_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert scan logs"
  ON email_scan_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update scan logs"
  ON email_scan_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Service role bypass for edge functions
CREATE POLICY "Service role full access to email_checker_config"
  ON email_checker_config FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to raw_emails"
  ON raw_emails FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to parsed_gift_cards"
  ON parsed_gift_cards FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access to email_scan_logs"
  ON email_scan_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Updated_at trigger for email_checker_config
CREATE OR REPLACE FUNCTION update_email_checker_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_checker_config_updated_at
  BEFORE UPDATE ON email_checker_config
  FOR EACH ROW
  EXECUTE FUNCTION update_email_checker_config_updated_at();
