-- Transaction Opportunities System
-- Admins post available transaction opportunities, users toggle availability to participate

-- Active transaction opportunities posted by admin
CREATE TABLE transaction_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Opportunity details
  title VARCHAR(255) NOT NULL DEFAULT 'Gift Card Transaction',
  recipient_email VARCHAR(255) NOT NULL,      -- Email address to send to
  amount DECIMAL(10,2) NOT NULL,              -- Amount per transaction (NGN)

  -- Expected range per Apple ID per day
  min_transactions_per_day INTEGER NOT NULL DEFAULT 1,
  max_transactions_per_day INTEGER NOT NULL DEFAULT 5,

  -- Availability
  total_slots INTEGER,                         -- NULL = unlimited
  filled_slots INTEGER DEFAULT 0,              -- How many users have opted in

  -- Status
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,                      -- When this opportunity expires

  -- Instructions/notes
  instructions TEXT,

  -- Tracking
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User availability for opportunities
CREATE TABLE user_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES ios_user_profiles(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES transaction_opportunities(id) ON DELETE CASCADE,

  -- Availability status
  is_available BOOLEAN DEFAULT true,
  available_from TIMESTAMPTZ DEFAULT NOW(),
  available_until TIMESTAMPTZ,                 -- NULL = indefinitely until toggled off

  -- Which Apple IDs are committed
  committed_apple_ids UUID[],                  -- References to user_apple_ids
  expected_transactions INTEGER,               -- How many they expect to do

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One entry per user per opportunity
  UNIQUE(user_id, opportunity_id)
);

-- Indexes
CREATE INDEX idx_opportunities_active ON transaction_opportunities(is_active);
CREATE INDEX idx_opportunities_expires ON transaction_opportunities(expires_at);
CREATE INDEX idx_user_availability_user ON user_availability(user_id);
CREATE INDEX idx_user_availability_opportunity ON user_availability(opportunity_id);
CREATE INDEX idx_user_availability_available ON user_availability(is_available);

-- Enable RLS
ALTER TABLE transaction_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_availability ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transaction_opportunities

-- Admins can do everything
CREATE POLICY "Admins full access to opportunities"
  ON transaction_opportunities FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Managers can view active opportunities
CREATE POLICY "Managers can view active opportunities"
  ON transaction_opportunities FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'manager'
    )
  );

-- iOS users can view active opportunities
CREATE POLICY "iOS users can view active opportunities"
  ON transaction_opportunities FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'ios_user'
    )
  );

-- RLS Policies for user_availability

-- Admins can view all availability
CREATE POLICY "Admins can view all availability"
  ON user_availability FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Managers can view their team's availability
CREATE POLICY "Managers can view team availability"
  ON user_availability FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ios_user_profiles iup
      JOIN manager_profiles mp ON iup.manager_id = mp.id
      WHERE iup.id = user_availability.user_id
      AND mp.user_id = auth.uid()
    )
  );

-- iOS users can manage their own availability
CREATE POLICY "iOS users can view own availability"
  ON user_availability FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ios_user_profiles
      WHERE ios_user_profiles.id = user_availability.user_id
      AND ios_user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "iOS users can insert own availability"
  ON user_availability FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ios_user_profiles
      WHERE ios_user_profiles.id = user_availability.user_id
      AND ios_user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "iOS users can update own availability"
  ON user_availability FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ios_user_profiles
      WHERE ios_user_profiles.id = user_availability.user_id
      AND ios_user_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "iOS users can delete own availability"
  ON user_availability FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ios_user_profiles
      WHERE ios_user_profiles.id = user_availability.user_id
      AND ios_user_profiles.user_id = auth.uid()
    )
  );

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_opportunities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_opportunities_updated_at
  BEFORE UPDATE ON transaction_opportunities
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

CREATE TRIGGER trigger_update_user_availability_updated_at
  BEFORE UPDATE ON user_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunities_updated_at();

-- Function to increment/decrement filled slots
CREATE OR REPLACE FUNCTION update_opportunity_slots()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_available = true THEN
    UPDATE transaction_opportunities
    SET filled_slots = COALESCE(filled_slots, 0) + 1
    WHERE id = NEW.opportunity_id;
  ELSIF TG_OP = 'DELETE' AND OLD.is_available = true THEN
    UPDATE transaction_opportunities
    SET filled_slots = GREATEST(COALESCE(filled_slots, 0) - 1, 0)
    WHERE id = OLD.opportunity_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_available = false AND NEW.is_available = true THEN
      UPDATE transaction_opportunities
      SET filled_slots = COALESCE(filled_slots, 0) + 1
      WHERE id = NEW.opportunity_id;
    ELSIF OLD.is_available = true AND NEW.is_available = false THEN
      UPDATE transaction_opportunities
      SET filled_slots = GREATEST(COALESCE(filled_slots, 0) - 1, 0)
      WHERE id = NEW.opportunity_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_opportunity_slots
  AFTER INSERT OR UPDATE OR DELETE ON user_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_opportunity_slots();
