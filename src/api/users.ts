import { supabase } from './supabase';
import type { User, IOSUserProfile, Bank } from '../types';

// Get iOS user's banks
export async function getUserBanks(iosUserProfileId: string): Promise<Bank[]> {
  const { data, error } = await supabase
    .from('banks')
    .select('*')
    .eq('ios_user_id', iosUserProfileId)
    .order('is_primary', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Add a bank
export async function addBank(
  iosUserProfileId: string,
  bankData: Pick<Bank, 'bank_name' | 'account_number' | 'account_name'>
): Promise<Bank> {
  const { data, error } = await supabase
    .from('banks')
    .insert({
      ios_user_id: iosUserProfileId,
      ...bankData,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update a bank
export async function updateBank(
  bankId: string,
  updates: Partial<Pick<Bank, 'bank_name' | 'account_number' | 'account_name' | 'is_primary'>>
): Promise<Bank> {
  const { data, error } = await supabase
    .from('banks')
    .update(updates)
    .eq('id', bankId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a bank
export async function deleteBank(bankId: string): Promise<void> {
  const { error } = await supabase
    .from('banks')
    .delete()
    .eq('id', bankId);

  if (error) throw error;
}

// Set bank as primary
export async function setPrimaryBank(iosUserProfileId: string, bankId: string): Promise<void> {
  // First, unset all banks as primary
  const { error: unsetError } = await supabase
    .from('banks')
    .update({ is_primary: false })
    .eq('ios_user_id', iosUserProfileId);

  if (unsetError) throw unsetError;

  // Then set the selected bank as primary
  const { error: setError } = await supabase
    .from('banks')
    .update({ is_primary: true })
    .eq('id', bankId);

  if (setError) throw setError;
}

// Update iOS user profile
export async function updateIOSUserProfile(
  profileId: string,
  updates: Partial<Pick<IOSUserProfile, 'full_name' | 'apple_id'>>
): Promise<IOSUserProfile> {
  const { data, error } = await supabase
    .from('ios_user_profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Toggle work availability (stays available for 12 hours then auto-resets)
export async function toggleWorkAvailability(
  profileId: string,
  isAvailable: boolean
): Promise<IOSUserProfile> {
  const updates: Record<string, unknown> = {
    is_available: isAvailable,
  };

  if (isAvailable) {
    // Set expiry to 12 hours from now
    const availableUntil = new Date();
    availableUntil.setHours(availableUntil.getHours() + 12);
    updates.available_until = availableUntil.toISOString();
  } else {
    updates.available_until = null;
  }

  const { data, error } = await supabase
    .from('ios_user_profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update last seen timestamp
export async function updateLastSeen(profileId: string): Promise<void> {
  const { error } = await supabase
    .from('ios_user_profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', profileId);

  if (error) throw error;
}

// Check if user is currently available (considering expiry)
export function isUserAvailable(profile: IOSUserProfile): boolean {
  if (!profile.is_available) return false;
  if (!profile.available_until) return false;
  return new Date(profile.available_until) > new Date();
}

// Get iOS user stats
export async function getIOSUserStats(iosUserProfileId: string) {
  const today = new Date().toISOString().split('T')[0];

  // Get today's verified transactions
  const { count: todayTransactions, error: txError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('ios_user_id', iosUserProfileId)
    .eq('transaction_date', today)
    .eq('status', 'verified');

  if (txError) throw txError;

  // Get compensation settings
  const { data: settings, error: settingsError } = await supabase
    .from('compensation_settings')
    .select('ios_user_daily_target')
    .single();

  if (settingsError) throw settingsError;

  // Get total earnings
  const { data: compensations, error: compError } = await supabase
    .from('compensations')
    .select('amount, status')
    .eq('recipient_type', 'ios_user');

  if (compError) throw compError;

  const totalEarnings = compensations?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const pendingPayout = compensations
    ?.filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0) || 0;

  return {
    todayTransactions: todayTransactions || 0,
    todayTarget: settings?.ios_user_daily_target || 10,
    totalEarnings,
    pendingPayout,
  };
}

// Get all users (for admin)
export async function getAllUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get all iOS user profiles (for admin)
export async function getAllIOSUserProfiles(): Promise<IOSUserProfile[]> {
  const { data, error } = await supabase
    .from('ios_user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Update user active status (admin)
export async function updateUserActiveStatus(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ is_active: isActive })
    .eq('id', userId);

  if (error) throw error;
}

// Update iOS user funding (admin)
export async function updateUserFunding(
  profileId: string,
  isFunded: boolean,
  fundingAmount: number
): Promise<IOSUserProfile> {
  const { data, error } = await supabase
    .from('ios_user_profiles')
    .update({
      is_funded: isFunded,
      funding_amount: fundingAmount,
    })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get all admins (for admin panel)
export async function getAllAdmins(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'admin')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Create a new admin user
export async function createAdmin(
  email: string,
  username: string,
  password: string
): Promise<User> {
  // First create the auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;
  if (!authData.user) throw new Error('Failed to create auth user');

  // Then create the user record with admin role
  const { data, error } = await supabase
    .from('users')
    .insert({
      id: authData.user.id,
      email,
      username,
      role: 'admin',
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// TERMS AND CONDITIONS
// ============================================

const CURRENT_TERMS_VERSION = '1.0';

// Accept terms for iOS user
export async function acceptTermsIOSUser(profileId: string): Promise<void> {
  console.log('acceptTermsIOSUser called with profileId:', profileId);

  const { data, error } = await supabase
    .from('ios_user_profiles')
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: CURRENT_TERMS_VERSION,
    })
    .eq('id', profileId)
    .select();

  console.log('acceptTermsIOSUser result:', { data, error });

  if (error) {
    console.error('acceptTermsIOSUser error:', error);
    throw new Error(`Failed to accept terms: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.error('acceptTermsIOSUser: No rows updated');
    throw new Error('Failed to update terms acceptance. Please try again.');
  }
}

// Accept terms for manager
export async function acceptTermsManager(profileId: string): Promise<void> {
  console.log('acceptTermsManager called with profileId:', profileId);

  const { data, error } = await supabase
    .from('manager_profiles')
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: CURRENT_TERMS_VERSION,
    })
    .eq('id', profileId)
    .select();

  console.log('acceptTermsManager result:', { data, error });

  if (error) {
    console.error('acceptTermsManager error:', error);
    throw new Error(`Failed to accept terms: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.error('acceptTermsManager: No rows updated');
    throw new Error('Failed to update terms acceptance. Please try again.');
  }
}

// Check if user needs to accept terms
export function needsTermsAcceptance(
  termsAcceptedAt: string | null | undefined,
  termsVersion: string | null | undefined
): boolean {
  // If never accepted, needs to accept
  if (!termsAcceptedAt) return true;

  // If accepted an older version, needs to accept new version
  if (termsVersion !== CURRENT_TERMS_VERSION) return true;

  return false;
}

// Get current terms version
export function getCurrentTermsVersion(): string {
  return CURRENT_TERMS_VERSION;
}
