import { supabase } from './supabase';

export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'rejected';
export type RecipientType = 'ios_user' | 'manager';

export interface Payout {
  id: string;
  recipient_id: string;
  recipient_type: RecipientType;
  amount: number;
  reference_date: string;
  status: PayoutStatus;
  requested_at: string;
  approved_by?: string;
  approved_at?: string;
  paid_at?: string;
  rejection_reason?: string;
  notes?: string;
}

export interface PayoutWithRecipient extends Payout {
  recipient_name: string;
  recipient_email?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
}

// Get all payouts for admin (managers' payouts)
export async function getManagerPayouts(status?: PayoutStatus): Promise<PayoutWithRecipient[]> {
  let query = supabase
    .from('payouts')
    .select(`
      *,
      manager_profiles!recipient_id (
        full_name,
        user_id
      )
    `)
    .eq('recipient_type', 'manager')
    .order('requested_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return (data || []).map(p => ({
    ...p,
    recipient_name: p.manager_profiles?.full_name || 'Unknown',
  }));
}

// Get user payouts for a manager to approve
export async function getTeamPayouts(managerId: string, status?: PayoutStatus): Promise<PayoutWithRecipient[]> {
  // First get team member IDs
  const { data: teamMembers } = await supabase
    .from('ios_user_profiles')
    .select('id, full_name, user_id')
    .eq('manager_id', managerId);

  if (!teamMembers || teamMembers.length === 0) return [];

  const teamIds = teamMembers.map(m => m.id);

  let query = supabase
    .from('payouts')
    .select('*')
    .eq('recipient_type', 'ios_user')
    .in('recipient_id', teamIds)
    .order('requested_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  // Map recipient names
  const memberMap = new Map(teamMembers.map(m => [m.id, m]));

  return (data || []).map(p => ({
    ...p,
    recipient_name: memberMap.get(p.recipient_id)?.full_name || 'Unknown',
  }));
}

// Get payouts for a specific user
export async function getUserPayouts(userId: string): Promise<Payout[]> {
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('recipient_id', userId)
    .eq('recipient_type', 'ios_user')
    .order('requested_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }

  return data || [];
}

// Request a payout (user requests)
export async function requestPayout(
  recipientId: string,
  recipientType: RecipientType,
  amount: number,
  referenceDate: string
): Promise<Payout> {
  const { data, error } = await supabase
    .from('payouts')
    .insert({
      recipient_id: recipientId,
      recipient_type: recipientType,
      amount,
      reference_date: referenceDate,
      status: 'pending',
      requested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Approve a payout (manager approves user, admin approves manager)
export async function approvePayout(payoutId: string, approverId: string): Promise<Payout> {
  const { data, error } = await supabase
    .from('payouts')
    .update({
      status: 'approved',
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq('id', payoutId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Mark payout as paid
export async function markPayoutPaid(payoutId: string): Promise<Payout> {
  const { data, error } = await supabase
    .from('payouts')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', payoutId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Reject a payout
export async function rejectPayout(payoutId: string, reason: string): Promise<Payout> {
  const { data, error } = await supabase
    .from('payouts')
    .update({
      status: 'rejected',
      rejection_reason: reason,
    })
    .eq('id', payoutId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Calculate pending earnings for a user (transactions verified but not yet paid)
export async function calculatePendingEarnings(
  userId: string,
  dailyTarget: number,
  dailyPayout: number
): Promise<{ totalPending: number; days: { date: string; amount: number }[] }> {
  // Get all verified transactions
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('transaction_date')
    .eq('ios_user_id', userId)
    .eq('status', 'verified');

  if (error || !transactions) {
    return { totalPending: 0, days: [] };
  }

  // Get already paid/approved payouts
  const { data: payouts } = await supabase
    .from('payouts')
    .select('reference_date')
    .eq('recipient_id', userId)
    .in('status', ['approved', 'paid']);

  const paidDates = new Set((payouts || []).map(p => p.reference_date));

  // Group transactions by date
  const byDate: Record<string, number> = {};
  transactions.forEach(tx => {
    const date = tx.transaction_date.split('T')[0];
    byDate[date] = (byDate[date] || 0) + 1;
  });

  // Calculate earnings for days meeting target (excluding already paid)
  const days: { date: string; amount: number }[] = [];
  let totalPending = 0;

  Object.entries(byDate).forEach(([date, count]) => {
    if (count >= dailyTarget && !paidDates.has(date)) {
      days.push({ date, amount: dailyPayout });
      totalPending += dailyPayout;
    }
  });

  return { totalPending, days };
}

// Get payout statistics
export async function getPayoutStats(recipientType: RecipientType): Promise<{
  pending: number;
  approved: number;
  paid: number;
  totalPaidAmount: number;
}> {
  const { data, error } = await supabase
    .from('payouts')
    .select('status, amount')
    .eq('recipient_type', recipientType);

  if (error || !data) {
    return { pending: 0, approved: 0, paid: 0, totalPaidAmount: 0 };
  }

  const stats = {
    pending: 0,
    approved: 0,
    paid: 0,
    totalPaidAmount: 0,
  };

  data.forEach(p => {
    if (p.status === 'pending') stats.pending++;
    if (p.status === 'approved') stats.approved++;
    if (p.status === 'paid') {
      stats.paid++;
      stats.totalPaidAmount += p.amount;
    }
  });

  return stats;
}
