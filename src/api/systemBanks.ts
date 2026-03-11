import { supabase } from './supabase';
import type { SystemBank } from '../types';

// Get all system banks (active only by default)
export async function getSystemBanks(includeInactive = false): Promise<SystemBank[]> {
  let query = supabase
    .from('system_banks')
    .select('*')
    .order('name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    // If table doesn't exist yet, return default banks
    if (error.code === '42P01') {
      return getDefaultBanks();
    }
    throw error;
  }

  return data || [];
}

// Get active bank names only (for dropdowns)
export async function getActiveBankNames(): Promise<string[]> {
  const banks = await getSystemBanks(false);
  return banks.map(b => b.name);
}

// Add a new system bank (admin only)
export async function addSystemBank(name: string): Promise<SystemBank> {
  const { data, error } = await supabase
    .from('system_banks')
    .insert({ name, is_active: true })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update system bank (admin only)
export async function updateSystemBank(
  bankId: string,
  updates: Partial<Pick<SystemBank, 'name' | 'is_active'>>
): Promise<SystemBank> {
  const { data, error } = await supabase
    .from('system_banks')
    .update(updates)
    .eq('id', bankId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Toggle bank active status (admin only)
export async function toggleSystemBankStatus(bankId: string, isActive: boolean): Promise<SystemBank> {
  return updateSystemBank(bankId, { is_active: isActive });
}

// Delete system bank (admin only) - prefer deactivating instead
export async function deleteSystemBank(bankId: string): Promise<void> {
  const { error } = await supabase
    .from('system_banks')
    .delete()
    .eq('id', bankId);

  if (error) throw error;
}

// Default banks (fallback if table doesn't exist)
function getDefaultBanks(): SystemBank[] {
  const defaultBankNames = [
    'Zenith Bank',
    'UBA',
    'GTBank',
    'Chipper',
    'First Bank',
    'Access Bank',
    'Kuda',
    'Opay',
    'PalmPay',
    'Moniepoint',
  ];

  return defaultBankNames.map((name, index) => ({
    id: `default-${index}`,
    name,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
}

// Seed default banks (admin only - run once)
export async function seedDefaultBanks(): Promise<void> {
  const defaultBankNames = [
    'Zenith Bank',
    'UBA',
    'GTBank',
    'Chipper',
    'First Bank',
    'Access Bank',
    'Kuda',
    'Opay',
    'PalmPay',
    'Moniepoint',
  ];

  const { error } = await supabase
    .from('system_banks')
    .upsert(
      defaultBankNames.map(name => ({ name, is_active: true })),
      { onConflict: 'name' }
    );

  if (error) throw error;
}
