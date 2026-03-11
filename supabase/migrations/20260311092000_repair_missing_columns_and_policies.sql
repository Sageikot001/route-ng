-- Repair Migration: Add missing columns and policies
-- Created: 2026-03-11

-- ============================================
-- ADD MISSING COLUMNS
-- ============================================

-- Add is_active to manager_suggestions if it doesn't exist
ALTER TABLE public.manager_suggestions
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- ============================================
-- CREATE MISSING POLICIES (drop first if exists to avoid errors)
-- ============================================

-- Manager suggestions policy for iOS users
DROP POLICY IF EXISTS "iOS users can view suggestions for them" ON public.manager_suggestions;
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
DROP POLICY IF EXISTS "Anyone can view platform settings" ON public.platform_settings;
CREATE POLICY "Anyone can view platform settings"
    ON public.platform_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Only admins can update platform settings" ON public.platform_settings;
CREATE POLICY "Only admins can update platform settings"
    ON public.platform_settings FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

-- System banks policies
DROP POLICY IF EXISTS "Anyone can view active system banks" ON public.system_banks;
CREATE POLICY "Anyone can view active system banks"
    ON public.system_banks FOR SELECT
    USING (is_active = true OR get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can insert system banks" ON public.system_banks;
CREATE POLICY "Admins can insert system banks"
    ON public.system_banks FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can update system banks" ON public.system_banks;
CREATE POLICY "Admins can update system banks"
    ON public.system_banks FOR UPDATE
    USING (get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can delete system banks" ON public.system_banks;
CREATE POLICY "Admins can delete system banks"
    ON public.system_banks FOR DELETE
    USING (get_user_role(auth.uid()) = 'admin');
