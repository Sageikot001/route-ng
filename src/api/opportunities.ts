import { supabase } from './supabase';
import { sendNotificationToUsers } from '../lib/sendNotification';
import type {
  TransactionOpportunity,
  UserAvailability,
  UserAvailabilityWithDetails,
} from '../types';

// ============================================
// ADMIN: MANAGE OPPORTUNITIES
// ============================================

export async function createOpportunity(data: {
  title?: string;
  recipient_email: string;
  amount: number;
  min_transactions_per_day: number;
  max_transactions_per_day: number;
  total_slots?: number;
  expires_at?: string;
  instructions?: string;
  created_by: string;
}): Promise<TransactionOpportunity> {
  const { data: opportunity, error } = await supabase
    .from('transaction_opportunities')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return opportunity;
}

export async function updateOpportunity(
  id: string,
  data: Partial<Omit<TransactionOpportunity, 'id' | 'created_at' | 'updated_at'>>
): Promise<TransactionOpportunity> {
  const { data: opportunity, error } = await supabase
    .from('transaction_opportunities')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return opportunity;
}

export async function deleteOpportunity(id: string): Promise<void> {
  const { error } = await supabase
    .from('transaction_opportunities')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getAllOpportunities(options?: {
  activeOnly?: boolean;
}): Promise<TransactionOpportunity[]> {
  let query = supabase
    .from('transaction_opportunities')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function getOpportunityById(id: string): Promise<TransactionOpportunity | null> {
  const { data, error } = await supabase
    .from('transaction_opportunities')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ============================================
// ADMIN/MANAGER: VIEW AVAILABILITY
// ============================================

export async function getAvailabilityForOpportunity(
  opportunityId: string
): Promise<UserAvailabilityWithDetails[]> {
  const { data, error } = await supabase
    .from('user_availability')
    .select(`
      *,
      user:ios_user_profiles(id, full_name, apple_id, user_id, users:users(email))
    `)
    .eq('opportunity_id', opportunityId)
    .eq('is_available', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as UserAvailabilityWithDetails[];
}

export async function getAllAvailableUsers(): Promise<UserAvailabilityWithDetails[]> {
  const { data, error } = await supabase
    .from('user_availability')
    .select(`
      *,
      user:ios_user_profiles(id, full_name, apple_id, user_id, users:users(email)),
      opportunity:transaction_opportunities(id, title, recipient_email, amount)
    `)
    .eq('is_available', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as UserAvailabilityWithDetails[];
}

// ============================================
// IOS USER: MANAGE OWN AVAILABILITY
// ============================================

export async function getActiveOpportunities(): Promise<TransactionOpportunity[]> {
  const { data, error } = await supabase
    .from('transaction_opportunities')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching opportunities:', error);
    if (error.code === '42P01') {
      console.warn('transaction_opportunities table does not exist');
      return [];
    }
    console.error('Error details:', { code: error.code, message: error.message, details: error.details });
    return [];
  }

  console.log('Fetched opportunities:', data?.length, data);

  // Filter expired opportunities (only if expires_at is set and in the past)
  const now = new Date();
  const filtered = (data || []).filter(opp => {
    if (!opp.expires_at) return true; // No expiry = always show
    const expiresAt = new Date(opp.expires_at);
    const isValid = expiresAt > now;
    console.log('Checking expiry:', opp.title, opp.expires_at, 'valid:', isValid);
    return isValid;
  });

  console.log('After filter:', filtered.length);
  return filtered;
}

export async function getUserAvailability(
  userId: string
): Promise<UserAvailabilityWithDetails[]> {
  const { data, error } = await supabase
    .from('user_availability')
    .select(`
      *,
      opportunity:transaction_opportunities(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as UserAvailabilityWithDetails[];
}

export async function toggleAvailability(
  userId: string,
  opportunityId: string,
  isAvailable: boolean,
  options?: {
    committedAppleIds?: string[];
    expectedTransactions?: number;
    availableUntil?: string;
  }
): Promise<UserAvailability> {
  // Check if record exists
  const { data: existing } = await supabase
    .from('user_availability')
    .select('id, is_available')
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId)
    .single();

  const wasAvailable = existing?.is_available || false;
  let result: UserAvailability;

  if (existing) {
    // Update existing
    const { data, error } = await supabase
      .from('user_availability')
      .update({
        is_available: isAvailable,
        committed_apple_ids: options?.committedAppleIds,
        expected_transactions: options?.expectedTransactions,
        available_until: options?.availableUntil,
        available_from: isAvailable ? new Date().toISOString() : undefined,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    result = data;
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('user_availability')
      .insert({
        user_id: userId,
        opportunity_id: opportunityId,
        is_available: isAvailable,
        committed_apple_ids: options?.committedAppleIds,
        expected_transactions: options?.expectedTransactions,
        available_until: options?.availableUntil,
      })
      .select()
      .single();

    if (error) throw error;
    result = data;
  }

  // Notify manager if user just became available (wasn't before, is now)
  if (isAvailable && !wasAvailable) {
    try {
      // Get user profile with manager info
      const { data: userProfile } = await supabase
        .from('ios_user_profiles')
        .select('full_name, manager_id')
        .eq('user_id', userId)
        .single();

      if (userProfile?.manager_id) {
        // Get manager details
        const { data: manager } = await supabase
          .from('manager_profiles')
          .select('user_id, is_house_account')
          .eq('id', userProfile.manager_id)
          .single();

        // Get opportunity details
        const { data: opportunity } = await supabase
          .from('transaction_opportunities')
          .select('title, amount')
          .eq('id', opportunityId)
          .single();

        // Notify manager if not a house account
        if (manager && !manager.is_house_account && manager.user_id) {
          await sendNotificationToUsers([manager.user_id], {
            title: 'Team Member Available',
            body: `${userProfile.full_name} is now available for "${opportunity?.title || 'an opportunity'}" (₦${opportunity?.amount?.toLocaleString() || '0'})`,
            url: '/manager/team',
            tag: 'user-available',
          });
        }
      }
    } catch (notifyError) {
      console.error('Failed to notify manager of availability:', notifyError);
    }
  }

  return result;
}

export async function setUnavailable(userId: string, opportunityId: string): Promise<void> {
  const { error } = await supabase
    .from('user_availability')
    .update({ is_available: false })
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId);

  if (error) throw error;
}

export async function setAllUnavailable(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_availability')
    .update({ is_available: false })
    .eq('user_id', userId);

  if (error) throw error;
}

// ============================================
// STATS
// ============================================

export async function getOpportunityStats(): Promise<{
  activeOpportunities: number;
  totalAvailableUsers: number;
  totalExpectedTransactions: number;
}> {
  const now = new Date().toISOString();

  // Count active opportunities
  const { count: activeOpportunities } = await supabase
    .from('transaction_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  // Count available users and sum expected transactions
  const { data: availabilityData } = await supabase
    .from('user_availability')
    .select('expected_transactions')
    .eq('is_available', true);

  const totalAvailableUsers = availabilityData?.length || 0;
  const totalExpectedTransactions = availabilityData?.reduce(
    (sum, a) => sum + (a.expected_transactions || 0),
    0
  ) || 0;

  return {
    activeOpportunities: activeOpportunities || 0,
    totalAvailableUsers,
    totalExpectedTransactions,
  };
}
