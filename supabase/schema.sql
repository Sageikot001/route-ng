-- Route.ng Database Schema
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'ios_user');
CREATE TYPE manager_status AS ENUM ('pending', 'verified', 'suspended');
CREATE TYPE transaction_status AS ENUM ('pending_manager', 'pending_admin', 'verified', 'rejected');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired');
CREATE TYPE compensation_type AS ENUM ('daily_target', 'team_commission');
CREATE TYPE payout_status AS ENUM ('pending', 'approved', 'paid', 'rejected');
CREATE TYPE recipient_type AS ENUM ('ios_user', 'manager');
CREATE TYPE announcement_audience AS ENUM ('all', 'managers', 'ios_users');

-- ============================================
-- TABLES
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'ios_user',
    phone_number TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manager profiles
CREATE TABLE public.manager_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    team_name TEXT NOT NULL,
    status manager_status NOT NULL DEFAULT 'pending',
    commission_rate DECIMAL(5,4) DEFAULT 0.05, -- 5% default commission
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- iOS User profiles
CREATE TABLE public.ios_user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    apple_id TEXT NOT NULL,
    manager_id UUID NOT NULL REFERENCES public.manager_profiles(id),
    daily_transaction_target INTEGER NOT NULL DEFAULT 10,
    is_funded BOOLEAN NOT NULL DEFAULT false,
    funding_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bank accounts
CREATE TABLE public.banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ios_user_id UUID NOT NULL REFERENCES public.ios_user_profiles(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ios_user_id UUID NOT NULL REFERENCES public.ios_user_profiles(id),
    manager_id UUID NOT NULL REFERENCES public.manager_profiles(id),
    gift_card_amount DECIMAL(12,2) NOT NULL,
    proof_image_url TEXT,
    status transaction_status NOT NULL DEFAULT 'pending_manager',
    rejection_reason TEXT,
    reviewed_by_manager UUID REFERENCES public.users(id),
    manager_reviewed_at TIMESTAMPTZ,
    reviewed_by_admin UUID REFERENCES public.users(id),
    admin_reviewed_at TIMESTAMPTZ,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily transaction summaries (computed/cached)
CREATE TABLE public.daily_transaction_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ios_user_id UUID NOT NULL REFERENCES public.ios_user_profiles(id),
    manager_id UUID NOT NULL REFERENCES public.manager_profiles(id),
    date DATE NOT NULL,
    completed_transactions INTEGER NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    earned_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ios_user_id, date)
);

-- Compensation records
CREATE TABLE public.compensations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES public.users(id),
    recipient_type recipient_type NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    compensation_type compensation_type NOT NULL,
    reference_date DATE NOT NULL,
    status payout_status NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compensation settings (singleton table)
CREATE TABLE public.compensation_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensures single row
    ios_user_daily_target INTEGER NOT NULL DEFAULT 10,
    ios_user_daily_amount DECIMAL(12,2) NOT NULL DEFAULT 2500.00,
    manager_commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES public.users(id)
);

-- Initialize compensation settings
INSERT INTO public.compensation_settings (id) VALUES (1);

-- Invites
CREATE TABLE public.invites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES public.manager_profiles(id),
    email TEXT NOT NULL,
    invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    status invite_status NOT NULL DEFAULT 'pending',
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payouts (payout request workflow)
CREATE TABLE public.payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL, -- ios_user_profile.id or manager_profile.id
    recipient_type recipient_type NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reference_date DATE NOT NULL, -- Which day this payout is for
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
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    audience announcement_audience NOT NULL DEFAULT 'all',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team Announcements (Manager to team)
CREATE TABLE public.team_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES public.manager_profiles(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Manager Suggestions (Manager to user)
CREATE TABLE public.manager_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES public.manager_profiles(id),
    ios_user_id UUID REFERENCES public.ios_user_profiles(id), -- NULL means for entire team
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform Settings (Admin configurable)
CREATE TABLE public.platform_settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton
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

-- Initialize platform settings
INSERT INTO public.platform_settings (id) VALUES (1);

-- System Banks (Admin managed list of allowed banks)
CREATE TABLE public.system_banks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    code TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_manager_profiles_status ON public.manager_profiles(status);
CREATE INDEX idx_ios_user_profiles_manager ON public.ios_user_profiles(manager_id);
CREATE INDEX idx_transactions_ios_user ON public.transactions(ios_user_id);
CREATE INDEX idx_transactions_manager ON public.transactions(manager_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX idx_daily_summaries_user_date ON public.daily_transaction_summaries(ios_user_id, date);
CREATE INDEX idx_invites_manager ON public.invites(manager_id);
CREATE INDEX idx_invites_code ON public.invites(invite_code);
CREATE INDEX idx_payouts_recipient ON public.payouts(recipient_id, recipient_type);
CREATE INDEX idx_payouts_status ON public.payouts(status);
CREATE INDEX idx_payouts_reference_date ON public.payouts(reference_date);
CREATE INDEX idx_announcements_audience ON public.announcements(audience);
CREATE INDEX idx_announcements_active ON public.announcements(is_active);
CREATE INDEX idx_team_announcements_manager ON public.team_announcements(manager_id);
CREATE INDEX idx_suggestions_manager ON public.manager_suggestions(manager_id);
CREATE INDEX idx_suggestions_user ON public.manager_suggestions(ios_user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, username, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'ios_user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
DECLARE
    user_role user_role;
BEGIN
    SELECT role INTO user_role FROM public.users WHERE id = user_id;
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamps
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manager_profiles_updated_at
    BEFORE UPDATE ON public.manager_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ios_user_profiles_updated_at
    BEFORE UPDATE ON public.ios_user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_banks_updated_at
    BEFORE UPDATE ON public.banks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_summaries_updated_at
    BEFORE UPDATE ON public.daily_transaction_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
    BEFORE UPDATE ON public.payouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON public.announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_announcements_updated_at
    BEFORE UPDATE ON public.team_announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_settings_updated_at
    BEFORE UPDATE ON public.platform_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create user record on auth signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ios_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_transaction_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compensation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_banks ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
    ON public.users FOR SELECT
    USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Users can insert own profile"
    ON public.users FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Admins can update any user"
    ON public.users FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

-- Manager profiles policies
CREATE POLICY "Anyone can view verified managers"
    ON public.manager_profiles FOR SELECT
    USING (status = 'verified');

CREATE POLICY "Managers can view own profile"
    ON public.manager_profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Admins can view all manager profiles"
    ON public.manager_profiles FOR SELECT
    USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Managers can insert own profile"
    ON public.manager_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers can update own profile"
    ON public.manager_profiles FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Admins can update any manager profile"
    ON public.manager_profiles FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

-- iOS User profiles policies
CREATE POLICY "iOS users can view own profile"
    ON public.ios_user_profiles FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Managers can view their team members"
    ON public.ios_user_profiles FOR SELECT
    USING (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all iOS user profiles"
    ON public.ios_user_profiles FOR SELECT
    USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "iOS users can insert own profile"
    ON public.ios_user_profiles FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "iOS users can update own profile"
    ON public.ios_user_profiles FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Admins can update any iOS user profile"
    ON public.ios_user_profiles FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

-- Banks policies
CREATE POLICY "iOS users can view own banks"
    ON public.banks FOR SELECT
    USING (
        ios_user_id IN (
            SELECT id FROM public.ios_user_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all banks"
    ON public.banks FOR SELECT
    USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "iOS users can manage own banks"
    ON public.banks FOR ALL
    USING (
        ios_user_id IN (
            SELECT id FROM public.ios_user_profiles WHERE user_id = auth.uid()
        )
    );

-- Transactions policies
CREATE POLICY "iOS users can view own transactions"
    ON public.transactions FOR SELECT
    USING (
        ios_user_id IN (
            SELECT id FROM public.ios_user_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can view team transactions"
    ON public.transactions FOR SELECT
    USING (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all transactions"
    ON public.transactions FOR SELECT
    USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "iOS users can insert transactions"
    ON public.transactions FOR INSERT
    WITH CHECK (
        ios_user_id IN (
            SELECT id FROM public.ios_user_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Managers can update team transactions"
    ON public.transactions FOR UPDATE
    USING (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update any transaction"
    ON public.transactions FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

-- Invites policies
CREATE POLICY "Managers can view own invites"
    ON public.invites FOR SELECT
    USING (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Anyone can view invite by code"
    ON public.invites FOR SELECT
    USING (true); -- Invite validation happens in app logic

CREATE POLICY "Managers can create invites"
    ON public.invites FOR INSERT
    WITH CHECK (
        manager_id IN (
            SELECT id FROM public.manager_profiles WHERE user_id = auth.uid()
        )
    );

-- Compensation settings policies
CREATE POLICY "Anyone can view compensation settings"
    ON public.compensation_settings FOR SELECT
    USING (true);

CREATE POLICY "Only admins can update compensation settings"
    ON public.compensation_settings FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

-- Compensations policies
CREATE POLICY "Users can view own compensations"
    ON public.compensations FOR SELECT
    USING (recipient_id = auth.uid());

CREATE POLICY "Admins can view all compensations"
    ON public.compensations FOR SELECT
    USING (get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Only admins can manage compensations"
    ON public.compensations FOR ALL
    USING (get_user_role(auth.uid()) = 'admin');

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

CREATE POLICY "Admins can manage announcements"
    ON public.announcements FOR ALL
    USING (get_user_role(auth.uid()) = 'admin');

-- Team announcements policies
CREATE POLICY "Managers can view and manage own team announcements"
    ON public.team_announcements FOR ALL
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
CREATE POLICY "Managers can manage own suggestions"
    ON public.manager_suggestions FOR ALL
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

CREATE POLICY "Only admins can manage system banks"
    ON public.system_banks FOR ALL
    USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- STORAGE BUCKET
-- ============================================

-- Create storage bucket for transaction proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-proofs', 'transaction-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "iOS users can upload proofs"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'transaction-proofs' AND
        auth.uid() IS NOT NULL
    );

CREATE POLICY "Users can view own proofs"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'transaction-proofs' AND
        (auth.uid()::text = (storage.foldername(name))[1])
    );

CREATE POLICY "Managers and admins can view proofs"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'transaction-proofs' AND
        (
            get_user_role(auth.uid()) = 'admin' OR
            get_user_role(auth.uid()) = 'manager'
        )
    );
