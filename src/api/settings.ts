import { supabase } from './supabase';

export interface PlatformSettings {
  id: number;
  min_daily_transactions: number;
  max_daily_transactions: number;
  earnings_per_card: number;
  manager_commission_rate: number;
  max_banks_per_user: number;
  min_funding_amount: number;
  max_funding_amount: number;
  maintenance_mode: boolean;
  registration_open: boolean;
  updated_at: string;
  updated_by?: string;
}

export const DEFAULT_SETTINGS: PlatformSettings = {
  id: 1,
  min_daily_transactions: 5,
  max_daily_transactions: 10,
  earnings_per_card: 250,
  manager_commission_rate: 0.05,
  max_banks_per_user: 5,
  min_funding_amount: 10000,
  max_funding_amount: 500000,
  maintenance_mode: false,
  registration_open: true,
  updated_at: new Date().toISOString(),
};

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .single();

  if (error) {
    // Table doesn't exist or no row - return defaults
    if (error.code === 'PGRST116' || error.code === '42P01') {
      return DEFAULT_SETTINGS;
    }
    throw error;
  }
  return data;
}

export async function updatePlatformSettings(
  settings: Partial<PlatformSettings>,
  userId: string
): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .upsert({
      id: 1,
      ...settings,
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // If commission rate was updated, apply it to all managers
  if (settings.manager_commission_rate !== undefined) {
    console.log('Updating all manager commission rates to:', settings.manager_commission_rate);
    const { data: updatedManagers, error: updateError } = await supabase
      .from('manager_profiles')
      .update({ commission_rate: settings.manager_commission_rate })
      .not('id', 'is', null) // Filter to match all rows (Supabase requires a filter)
      .select();

    if (updateError) {
      console.error('Failed to update manager commission rates:', updateError);
      // Don't throw - settings were saved, this is a secondary update
    } else {
      console.log('Updated managers:', updatedManagers?.length || 0);
    }
  }

  return data;
}
