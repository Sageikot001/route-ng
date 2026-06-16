import { supabase } from './supabase';
import { sendNotificationToUsers } from '../lib/sendNotification';
import type { Transaction, TransactionStatus, TransactionWithDetails } from '../types';

// Create a new transaction
export async function createTransaction(data: {
  ios_user_id: string;
  manager_id: string;
  bank_id?: string;
  apple_id_id?: string;
  card_amount: number;
  bank_charge_amount?: number;
  receipt_count: number;
  gift_card_amount: number;
  recipient_address?: string;
  shortfall_reason?: string;
  proof_image_url?: string;
  transaction_date?: string;
}): Promise<Transaction> {
  // Remove bank_charge_amount if it's undefined to avoid column errors on older schemas
  const insertData = { ...data };
  if (insertData.bank_charge_amount === undefined) {
    delete insertData.bank_charge_amount;
  }

  console.log('Creating transaction with data:', {
    receipt_count: insertData.receipt_count,
    card_amount: insertData.card_amount,
    gift_card_amount: insertData.gift_card_amount,
    transaction_date: insertData.transaction_date,
  });

  const { data: transaction, error } = await supabase
    .from('transactions')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('Transaction creation error:', error, 'Data:', insertData);
    throw new Error(error.message || 'Failed to create transaction');
  }

  // Notify the manager about the new transaction
  try {
    // Get user details
    const { data: userProfile } = await supabase
      .from('ios_user_profiles')
      .select('full_name')
      .eq('id', data.ios_user_id)
      .single();

    // Get manager's user_id
    const { data: managerProfile } = await supabase
      .from('manager_profiles')
      .select('user_id, is_house_account')
      .eq('id', data.manager_id)
      .single();

    // Get bank name if bank_id is provided
    let bankName = 'Unknown Bank';
    if (data.bank_id) {
      const { data: bank } = await supabase
        .from('banks')
        .select('bank_name')
        .eq('id', data.bank_id)
        .single();
      if (bank) bankName = bank.bank_name;
    }

    // Only notify if not house account (house account has no real manager)
    if (managerProfile && !managerProfile.is_house_account && managerProfile.user_id) {
      const totalExpense = data.gift_card_amount + (data.bank_charge_amount || 0);

      await sendNotificationToUsers([managerProfile.user_id], {
        title: 'New Transaction Logged',
        body: `${userProfile?.full_name || 'A team member'} logged ${data.receipt_count} card(s) via ${bankName}. Amount: ₦${data.gift_card_amount.toLocaleString()}${data.bank_charge_amount ? ` + ₦${data.bank_charge_amount.toLocaleString()} charges` : ''}. Total: ₦${totalExpense.toLocaleString()}`,
        url: '/manager/transactions',
        tag: 'transaction-logged',
      });
    }
  } catch (notifyError) {
    // Don't fail the transaction if notification fails
    console.error('Failed to notify manager:', notifyError);
  }

  return transaction;
}

// Update an existing transaction (only if still pending)
export async function updateTransaction(
  transactionId: string,
  data: {
    bank_id?: string;
    apple_id_id?: string;
    card_amount?: number;
    bank_charge_amount?: number;
    receipt_count?: number;
    gift_card_amount?: number;
    recipient_address?: string;
    shortfall_reason?: string;
    proof_image_url?: string;
  }
): Promise<Transaction> {
  // Remove bank_charge_amount if it's undefined to avoid column errors on older schemas
  const updateData = { ...data };
  if (updateData.bank_charge_amount === undefined) {
    delete updateData.bank_charge_amount;
  }

  const { data: transaction, error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', transactionId)
    .eq('status', 'pending_manager') // Only allow editing if not yet reviewed
    .select()
    .single();

  if (error) {
    console.error('Transaction update error:', error);
    throw new Error(error.message || 'Failed to update transaction');
  }
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

// Get transactions with Apple ID details for iOS user
export async function getUserTransactionsWithAppleId(
  iosUserProfileId: string,
  options?: {
    date?: string;
    status?: TransactionStatus;
    limit?: number;
  }
): Promise<TransactionWithDetails[]> {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      apple_id:user_apple_ids(id, apple_id, label, is_primary)
    `)
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
  return (data || []) as TransactionWithDetails[];
}

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
  const fileExt = file.name.split('.').pop() || 'jpg';
  const fileName = `${userId}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('transaction-proofs')
    .upload(fileName, file);

  if (error) {
    console.error('Image upload error:', error);
    throw new Error(error.message || 'Failed to upload image');
  }

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
