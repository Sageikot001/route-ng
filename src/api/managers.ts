import { supabase } from './supabase';
import type { ManagerProfile, IOSUserProfile, Invite } from '../types';

// Get manager profile by ID
export async function getManagerById(managerId: string): Promise<ManagerProfile | null> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .select('*')
    .eq('id', managerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows found
    throw error;
  }
  return data;
}

// Get manager's team members
export async function getTeamMembers(managerId: string): Promise<IOSUserProfile[]> {
  const { data, error } = await supabase
    .from('ios_user_profiles')
    .select('*')
    .eq('manager_id', managerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get manager's invites
export async function getManagerInvites(managerId: string): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('manager_id', managerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Create an invite
export async function createInvite(managerId: string, email: string): Promise<Invite> {
  const { data, error } = await supabase
    .from('invites')
    .insert({
      manager_id: managerId,
      email,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Cancel/delete an invite
export async function cancelInvite(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('invites')
    .delete()
    .eq('id', inviteId);

  if (error) throw error;
}

// Update manager profile
export async function updateManagerProfile(
  profileId: string,
  updates: Partial<Pick<ManagerProfile, 'full_name' | 'team_name'>>
): Promise<ManagerProfile> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get manager stats
export async function getManagerStats(managerId: string) {
  const today = new Date().toISOString().split('T')[0];

  // Get team count
  const { count: teamSize, error: teamError } = await supabase
    .from('ios_user_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('manager_id', managerId);

  if (teamError) throw teamError;

  // Get pending reviews
  const { count: pendingReviews, error: reviewError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('manager_id', managerId)
    .eq('status', 'pending_manager');

  if (reviewError) throw reviewError;

  // Get today's team transactions (verified)
  const { count: todayTeamTransactions, error: txError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('manager_id', managerId)
    .eq('transaction_date', today)
    .eq('status', 'verified');

  if (txError) throw txError;

  // Get total commission (sum of compensations)
  const { data: commissions, error: commError } = await supabase
    .from('compensations')
    .select('amount')
    .eq('recipient_type', 'manager')
    .eq('compensation_type', 'team_commission');

  if (commError) throw commError;

  const totalCommission = commissions?.reduce((sum, c) => sum + c.amount, 0) || 0;

  return {
    teamSize: teamSize || 0,
    pendingReviews: pendingReviews || 0,
    todayTeamTransactions: todayTeamTransactions || 0,
    totalCommission,
  };
}

// Get all managers (for admin)
export async function getAllManagers(): Promise<ManagerProfile[]> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get pending manager verifications (for admin)
export async function getPendingManagerVerifications(): Promise<ManagerProfile[]> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

// Verify manager (admin action)
export async function verifyManager(
  profileId: string,
  adminId: string
): Promise<ManagerProfile> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: adminId,
    })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Suspend manager (admin action)
export async function suspendManager(profileId: string): Promise<ManagerProfile> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .update({ status: 'suspended' })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update manager commission rate (admin action)
export async function updateManagerCommissionRate(
  profileId: string,
  commissionRate: number
): Promise<ManagerProfile> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .update({ commission_rate: commissionRate })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// HOUSE ACCOUNT FUNCTIONS
// ============================================

// Get the House Account manager (Route.ng Direct)
export async function getHouseAccountManager(): Promise<ManagerProfile | null> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .select('*')
    .eq('is_house_account', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // No rows found
    console.error('Error fetching house account manager:', error);
    return null;
  }
  return data;
}

// Check if a manager is the House Account
export function isHouseAccount(manager: ManagerProfile | null): boolean {
  return manager?.is_house_account === true;
}

// Get all managers excluding house account (for dropdowns, etc.)
export async function getVerifiedManagersExcludingHouse(): Promise<ManagerProfile[]> {
  const { data, error } = await supabase
    .from('manager_profiles')
    .select('*')
    .eq('status', 'verified')
    .eq('is_house_account', false)
    .order('full_name');

  if (error) {
    console.error('Error fetching managers:', error);
    return [];
  }
  return data || [];
}
