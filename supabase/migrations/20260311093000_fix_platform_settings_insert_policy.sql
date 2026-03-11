-- Fix: Add INSERT policy for platform_settings
-- The upsert operation needs INSERT permission when the row doesn't exist

-- Drop and recreate to ensure clean state
DROP POLICY IF EXISTS "Admins can insert platform settings" ON public.platform_settings;
CREATE POLICY "Admins can insert platform settings"
    ON public.platform_settings FOR INSERT
    WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Also add ALL policy for admins to simplify
DROP POLICY IF EXISTS "Admins can manage platform settings" ON public.platform_settings;
CREATE POLICY "Admins can manage platform settings"
    ON public.platform_settings FOR ALL
    USING (get_user_role(auth.uid()) = 'admin')
    WITH CHECK (get_user_role(auth.uid()) = 'admin');
