import { supabase } from './supabase';
import type { Transaction, TransactionStatus, TransactionWithDetails } from '../types';

// Create a new transaction
export async function createTransaction(data: {
  ios_user_id: string;
  manager_id: string;
  bank_id?: string;
  apple_id_id?: string;
  card_amount: number;
  receipt_count: number;
  gift_card_amount: number;
  recipient_address?: string;
  shortfall_reason?: string;
  proof_image_url?: string;
}): Promise<Transaction> {
  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return transaction;
}

// Update an existing transaction (only if still pending)
export async function updateTransaction(
  transactionId: string,
  data: {
    bank_id?: string;
    card_amount?: number;
    receipt_count?: number;
    gift_card_amount?: number;
    recipient_address?: string;
    shortfall_reason?: string;
    proof_image_url?: string;
  }
): Promise<Transaction> {
  const { data: transaction, error } = await supabase
    .from('transactions')
    .update(data)
    .eq('id', transactionId)
    .eq('status', 'pending_manager') // Only allow editing if not yet reviewed
    .select()
    .single();

  if (error) throw error;
  return transaction;
}

// Delete a transaction (only if still pending)
export async function deleteTransaction(transactionId: string): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('status', 'pending_manager'); // Only allow deletion if not yet reviewed

  if (error) throw error;
}

// Get transactions for iOS user
export async function getIOSUserTransactions(
  iosUserProfileId: string,
  options?: {
    date?: string;
    status?: TransactionStatus;
    limit?: number;
  }
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('ios_user_id', iosUserProfileId)
    .order('created_at', { ascending: false });

  if (options?.date) {
    query = query.eq('transaction_date', options.date);
  }
  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Alias for backward compatibility
export const getUserTransactions = getIOSUserTransactions;

// Get transactions for manager review
export async function getManagerTransactions(
  managerId: string,
  options?: {
    status?: TransactionStatus;
    date?: string;
    limit?: number;
  }
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('manager_id', managerId)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.date) {
    query = query.eq('transaction_date', options.date);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Get transactions with full user and bank details for manager review
export async function getManagerTransactionsWithDetails(
  managerId: string,
  options?: {
    status?: TransactionStatus;
    date?: string;
    limit?: number;
  }
): Promise<TransactionWithDetails[]> {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      ios_user:ios_user_profiles(*),
      bank:banks(*)
    `)
    .eq('manager_id', managerId)
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.date) {
    query = query.eq('transaction_date', options.date);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Get all transactions for admin
export async function getAllTransactions(options?: {
  status?: TransactionStatus;
  date?: string;
  limit?: number;
}): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.date) {
    query = query.eq('transaction_date', options.date);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Manager approves transaction
export async function approveTransactionByManager(
  transactionId: string,
  managerUserId: string  // This should be the user_id, not manager_profiles.id
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      status: 'pending_admin',
      reviewed_by_manager: managerUserId,
      manager_reviewed_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Manager rejects transaction
export async function rejectTransactionByManager(
  transactionId: string,
  managerUserId: string,  // This should be the user_id, not manager_profiles.id
  reason: string
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      status: 'rejected',
      reviewed_by_manager: managerUserId,
      manager_reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', transactionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Admin verifies transaction
export async function verifyTransactionByAdmin(
  transactionId: string,
  adminId: string
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      status: 'verified',
      reviewed_by_admin: adminId,
      admin_reviewed_at: new Date().toISOString(),
    })
    .eq('id', transactionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Admin rejects transaction
export async function rejectTransactionByAdmin(
  transactionId: string,
  adminId: string,
  reason: string
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({
      status: 'rejected',
      reviewed_by_admin: adminId,
      admin_reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', transactionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get transactions reviewed by a manager (for history view)
export async function getManagerReviewedTransactions(
  managerUserId: string,
  options?: {
    status?: TransactionStatus;
    limit?: number;
  }
): Promise<TransactionWithDetails[]> {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      ios_user:ios_user_profiles(*),
      bank:banks(*)
    `)
    .eq('reviewed_by_manager', managerUserId)
    .order('manager_reviewed_at', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Upload proof image
export async function uploadProofImage(
  userId: string,
  file: File
): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('transaction-proofs')
    .upload(fileName, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('transaction-proofs')
    .getPublicUrl(data.path);

  return publicUrl;
}

// Get proof image URL
export async function getProofImageUrl(path: string): Promise<string> {
  const { data: { publicUrl } } = supabase.storage
    .from('transaction-proofs')
    .getPublicUrl(path);

  return publicUrl;
}
