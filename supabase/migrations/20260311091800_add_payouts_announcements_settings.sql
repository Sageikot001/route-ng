-- Migration: Add Payouts, Announcements, Suggestions, and Platform Settings
-- Created: 2026-03-11

-- ============================================
-- UPDATE EXISTING ENUMS
-- ============================================

-- Add new values to payout_status enum
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE payout_status ADD VALUE IF NOT EXISTS 'rejected';

-- Create announcement_audience enum
DO $$ BEGIN
    CREATE TYPE announcement_audience AS ENUM ('all', 'managers', 'ios_users');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- NEW TABLES
-- ============================================

-- Payouts (payout request workflow)
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL,
    recipient_type recipient_type NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference_date DATE NOT NULL,
    status payout_status NOT NULL DEFAULT 'pending',
    rejection_reason TEXT,
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(recipient_id, recipient_type, reference_date)
);

-- System Announcements (Admin broadcasts)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    audience announcement_audience NOT NULL DEFAULT 'all',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team Announcements (Manager to team)
CREATE TABLE IF NOT EXISTS public.team_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES public.manager_profiles(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manager Suggestions (Manager to user)
CREATE TABLE IF NOT EXISTS public.manager_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES public.manager_profiles(id),
    ios_user_id UUID REFERENCES public.ios_user_profiles(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform Settings (Admin configurable)
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    min_daily_transactions INTEGER NOT NULL DEFAULT 5,
    max_daily_transactions INTEGER NOT NULL DEFAULT 20,
    ios_user_daily_payout DECIMAL(12,2) NOT NULL DEFAULT 2500.00,
    manager_commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    max_banks_per_user INTEGER NOT NULL DEFAULT 5,
    min_funding_amount DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
    max_funding_amount DECIMAL(12,2) NOT NULL DEFAULT 500000.00,
    maintenance_mode BOOLEAN NOT NULL DEFAULT false,
    registration_open BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- Initialize platform settings (only if empty)
INSERT INTO public.platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- System Banks (Admin managed list of allowed banks)
CREATE TABLE IF NOT EXISTS public.system_banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_payouts_recipient ON public.payouts(recipient_id, recipient_type);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_reference_date ON public.payouts(reference_date);
CREATE INDEX IF NOT EXISTS idx_announcements_audience ON public.announcements(audience);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON public.announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_team_announcements_manager ON public.team_announcements(manager_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_manager ON public.manager_suggestions(manager_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_user ON public.manager_suggestions(ios_user_id);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE OR REPLACE TRIGGER update_payouts_updated_at
    BEFORE UPDATE ON public.payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_team_announcements_updated_at
    BEFORE UPDATE ON public.team_announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_platform_settings_updated_at
    BEFORE UPDATE ON public.platform_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_banks ENABLE ROW LEVEL SECURITY;

-- Payouts policies
CREATE POLICY "iOS users can view own payouts"
    ON public.payouts FOR SELECT
    USING (
        recipient_type = 'ios_user' AND
        recipient_id IN (
            SELECT id FROM public.ios_user_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can view own payouts"
    ON public.payouts FOR SELECT
    USING (
        recipient_type = 'manager' AND
        recipient_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can view team payouts"
    ON public.payouts FOR SELECT
    USING (
        recipient_type = 'ios_user' AND
        recipient_id IN (
            SELECT iup.id FROM public.ios_user_profiles iup
            JOIN public.manager_profiles mp ON iup.manager_id = mp.id
            WHERE mp.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all payouts"
    ON public.payouts FOR SELECT
    USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "iOS users can request payouts"
    ON public.payouts FOR INSERT
    WITH CHECK (
        recipient_type = 'ios_user' AND
        recipient_id IN (
            SELECT id FROM public.ios_user_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can request payouts"
    ON public.payouts FOR INSERT
    WITH CHECK (
        recipient_type = 'manager' AND
        recipient_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can update team payouts"
    ON public.payouts FOR UPDATE
    USING (
        recipient_type = 'ios_user' AND
        recipient_id IN (
            SELECT iup.id FROM public.ios_user_profiles iup
            JOIN public.manager_profiles mp ON iup.manager_id = mp.id
            WHERE mp.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update any payout"
    ON public.payouts FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

-- Announcements policies
CREATE POLICY "Anyone can view active announcements for their role"
    ON public.announcements FOR SELECT
    USING (
        is_active = true AND (
            audience = 'all' OR
            (audience = 'managers' AND get_user_role(auth.uid()) IN ('manager', 'admin')) OR
            (audience = 'ios_users' AND get_user_role(auth.uid()) IN ('ios_user', 'admin'))
        )
    );

CREATE POLICY "Admins can view all announcements"
    ON public.announcements FOR SELECT
    USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can insert announcements"
    ON public.announcements FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update announcements"
    ON public.announcements FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete announcements"
    ON public.announcements FOR DELETE
    USING (get_user_role(auth.uid()) = 'admin');

-- Team announcements policies
CREATE POLICY "Managers can view own team announcements"
    ON public.team_announcements FOR SELECT
    USING (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can insert team announcements"
    ON public.team_announcements FOR INSERT
    WITH CHECK (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can update team announcements"
    ON public.team_announcements FOR UPDATE
    USING (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can delete team announcements"
    ON public.team_announcements FOR DELETE
    USING (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "iOS users can view their team announcements"
    ON public.team_announcements FOR SELECT
    USING (
        manager_id IN (
            SELECT manager_id FROM public.ios_user_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all team announcements"
    ON public.team_announcements FOR SELECT
    USING (get_user_role(auth.uid()) = 'admin');

-- Manager suggestions policies
CREATE POLICY "Managers can view own suggestions"
    ON public.manager_suggestions FOR SELECT
    USING (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can insert suggestions"
    ON public.manager_suggestions FOR INSERT
    WITH CHECK (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can update suggestions"
    ON public.manager_suggestions FOR UPDATE
    USING (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can delete suggestions"
    ON public.manager_suggestions FOR DELETE
    USING (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "iOS users can view suggestions for them"
    ON public.manager_suggestions FOR SELECT
    USING (
        is_active = true AND
        manager_id IN (
            SELECT manager_id FROM public.ios_user_profiles WHERE user_id = auth.uid()
        ) AND
        (ios_user_id IS NULL OR ios_user_id IN (
            SELECT id FROM public.ios_user_profiles WHERE user_id = auth.uid()
        ))
    );

-- Platform settings policies
CREATE POLICY "Anyone can view platform settings"
    ON public.platform_settings FOR SELECT
    USING (true);

CREATE POLICY "Only admins can update platform settings"
    ON public.platform_settings FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

-- System banks policies
CREATE POLICY "Anyone can view active system banks"
    ON public.system_banks FOR SELECT
    USING (is_active = true OR get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can insert system banks"
    ON public.system_banks FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update system banks"
    ON public.system_banks FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete system banks"
    ON public.system_banks FOR DELETE
    USING (get_user_role(auth.uid()) = 'admin');
