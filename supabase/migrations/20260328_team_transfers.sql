-- Team Transfer System Migration
-- Allows users to switch teams via referral codes with manager approval

-- 1. Transfer Requests Table
CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ios_user_id UUID NOT NULL REFERENCES ios_user_profiles(id) ON DELETE CASCADE,
    from_manager_id UUID REFERENCES manager_profiles(id), -- NULL if from House Account
    to_manager_id UUID NOT NULL REFERENCES manager_profiles(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
    request_reason TEXT,
    rejection_reason TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    responded_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Team History Table
CREATE TABLE IF NOT EXISTS team_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ios_user_id UUID NOT NULL REFERENCES ios_user_profiles(id) ON DELETE CASCADE,
    manager_id UUID REFERENCES manager_profiles(id), -- NULL for House Account
    team_name TEXT NOT NULL,
    manager_name TEXT NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ,
    transfer_request_id UUID REFERENCES transfer_requests(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Manager Notifications Table
CREATE TABLE IF NOT EXISTS manager_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES manager_profiles(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'transfer_request_incoming',
        'transfer_leaving',
        'transfer_approved',
        'transfer_rejected',
        'transfer_completed',
        'transfer_cancelled'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id UUID,
    reference_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transfer_requests_user ON transfer_requests(ios_user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_from_manager ON transfer_requests(from_manager_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_to_manager ON transfer_requests(to_manager_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_pending ON transfer_requests(ios_user_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_team_history_user ON team_history(ios_user_id);
CREATE INDEX IF NOT EXISTS idx_team_history_manager ON team_history(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_notifications_manager ON manager_notifications(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_notifications_unread ON manager_notifications(manager_id, is_read) WHERE is_read = FALSE;

-- RLS Policies for transfer_requests
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transfer requests"
    ON transfer_requests FOR SELECT
    USING (ios_user_id IN (SELECT id FROM ios_user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Managers can view requests involving their team"
    ON transfer_requests FOR SELECT
    USING (
        from_manager_id IN (SELECT id FROM manager_profiles WHERE user_id = auth.uid())
        OR to_manager_id IN (SELECT id FROM manager_profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Admins can view all transfer requests"
    ON transfer_requests FOR SELECT
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can create transfer requests"
    ON transfer_requests FOR INSERT
    WITH CHECK (ios_user_id IN (SELECT id FROM ios_user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Target managers can update transfer requests"
    ON transfer_requests FOR UPDATE
    USING (to_manager_id IN (SELECT id FROM manager_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update all transfer requests"
    ON transfer_requests FOR UPDATE
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can cancel own pending requests"
    ON transfer_requests FOR UPDATE
    USING (
        ios_user_id IN (SELECT id FROM ios_user_profiles WHERE user_id = auth.uid())
        AND status = 'pending'
    );

-- RLS Policies for team_history
ALTER TABLE team_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own team history"
    ON team_history FOR SELECT
    USING (ios_user_id IN (SELECT id FROM ios_user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Managers can view team member history"
    ON team_history FOR SELECT
    USING (manager_id IN (SELECT id FROM manager_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all team history"
    ON team_history FOR SELECT
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "System can insert team history"
    ON team_history FOR INSERT
    WITH CHECK (true);

CREATE POLICY "System can update team history"
    ON team_history FOR UPDATE
    USING (true);

-- RLS Policies for manager_notifications
ALTER TABLE manager_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view own notifications"
    ON manager_notifications FOR SELECT
    USING (manager_id IN (SELECT id FROM manager_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Managers can update own notifications"
    ON manager_notifications FOR UPDATE
    USING (manager_id IN (SELECT id FROM manager_profiles WHERE user_id = auth.uid()));

CREATE POLICY "System can insert notifications"
    ON manager_notifications FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Admins can view all notifications"
    ON manager_notifications FOR SELECT
    USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Function to check if user can transfer (once per month limit)
CREATE OR REPLACE FUNCTION can_user_transfer(user_profile_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    last_approved_transfer TIMESTAMPTZ;
BEGIN
    SELECT responded_at INTO last_approved_transfer
    FROM transfer_requests
    WHERE ios_user_id = user_profile_id
      AND status = 'approved'
    ORDER BY responded_at DESC
    LIMIT 1;

    IF last_approved_transfer IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Check if 30 days have passed since last approved transfer
    RETURN (NOW() - last_approved_transfer) > INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get days until next transfer allowed
CREATE OR REPLACE FUNCTION days_until_transfer_allowed(user_profile_id UUID)
RETURNS INTEGER AS $$
DECLARE
    last_approved_transfer TIMESTAMPTZ;
    days_remaining INTEGER;
BEGIN
    SELECT responded_at INTO last_approved_transfer
    FROM transfer_requests
    WHERE ios_user_id = user_profile_id
      AND status = 'approved'
    ORDER BY responded_at DESC
    LIMIT 1;

    IF last_approved_transfer IS NULL THEN
        RETURN 0;
    END IF;

    days_remaining := 30 - EXTRACT(DAY FROM (NOW() - last_approved_transfer))::INTEGER;

    IF days_remaining < 0 THEN
        RETURN 0;
    END IF;

    RETURN days_remaining;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count for manager
CREATE OR REPLACE FUNCTION get_manager_unread_notification_count(manager_profile_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM manager_notifications
        WHERE manager_id = manager_profile_id
          AND is_read = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending incoming transfer requests count for manager
CREATE OR REPLACE FUNCTION get_pending_transfer_requests_count(manager_profile_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM transfer_requests
        WHERE to_manager_id = manager_profile_id
          AND status = 'pending'
          AND expires_at > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at on transfer_requests
CREATE OR REPLACE FUNCTION update_transfer_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_transfer_request_updated_at
    BEFORE UPDATE ON transfer_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_transfer_request_updated_at();

-- Initialize team history for existing users (optional - run once)
-- This creates initial team history records for all existing users
INSERT INTO team_history (ios_user_id, manager_id, team_name, manager_name, joined_at)
SELECT
    iup.id,
    iup.manager_id,
    COALESCE(mp.team_name, 'Route.ng Direct'),
    COALESCE(mp.full_name, 'House Account'),
    iup.created_at
FROM ios_user_profiles iup
LEFT JOIN manager_profiles mp ON iup.manager_id = mp.id
WHERE NOT EXISTS (
    SELECT 1 FROM team_history th WHERE th.ios_user_id = iup.id
);
