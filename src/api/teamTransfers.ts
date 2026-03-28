import { supabase } from './supabase';
import type {
  TransferRequest,
  TransferRequestWithDetails,
  TeamHistoryWithDetails,
  ManagerNotification,
  TransferEligibility,
} from '../types';

// ============================================
// TRANSFER ELIGIBILITY
// ============================================

export async function checkTransferEligibility(iosUserProfileId: string): Promise<TransferEligibility> {
  // Check if user has a pending request
  const { data: pendingRequest } = await supabase
    .from('transfer_requests')
    .select('*')
    .eq('ios_user_id', iosUserProfileId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (pendingRequest) {
    return {
      canTransfer: false,
      daysUntilEligible: 0,
      hasPendingRequest: true,
      pendingRequest: pendingRequest as TransferRequest,
    };
  }

  // Check last approved transfer date (once per month limit)
  const { data: lastTransfer } = await supabase
    .from('transfer_requests')
    .select('responded_at')
    .eq('ios_user_id', iosUserProfileId)
    .eq('status', 'approved')
    .order('responded_at', { ascending: false })
    .limit(1)
    .single();

  if (lastTransfer?.responded_at) {
    const lastDate = new Date(lastTransfer.responded_at);
    const now = new Date();
    const daysSinceTransfer = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilEligible = Math.max(0, 30 - daysSinceTransfer);

    return {
      canTransfer: daysUntilEligible === 0,
      daysUntilEligible,
      hasPendingRequest: false,
      lastTransferDate: lastTransfer.responded_at,
    };
  }

  return {
    canTransfer: true,
    daysUntilEligible: 0,
    hasPendingRequest: false,
  };
}

// ============================================
// TRANSFER REQUEST OPERATIONS
// ============================================

export async function createTransferRequest(
  iosUserProfileId: string,
  referralCode: string,
  reason?: string
): Promise<{ success: boolean; error?: string; request?: TransferRequest }> {
  // Validate eligibility
  const eligibility = await checkTransferEligibility(iosUserProfileId);
  if (!eligibility.canTransfer) {
    if (eligibility.hasPendingRequest) {
      return { success: false, error: 'You already have a pending transfer request' };
    }
    return {
      success: false,
      error: `You can only transfer once per month. ${eligibility.daysUntilEligible} days remaining.`,
    };
  }

  // Get target manager by referral code
  const { data: targetManager, error: managerError } = await supabase
    .from('manager_profiles')
    .select('*')
    .eq('referral_code', referralCode.toUpperCase())
    .single();

  if (managerError || !targetManager) {
    return { success: false, error: 'Invalid referral code' };
  }

  // Check if target manager is suspended
  if (targetManager.status === 'suspended') {
    return { success: false, error: 'This manager is currently suspended and cannot accept new team members' };
  }

  // Get current user profile
  const { data: userProfile, error: profileError } = await supabase
    .from('ios_user_profiles')
    .select('*, manager:manager_profiles(*)')
    .eq('id', iosUserProfileId)
    .single();

  if (profileError || !userProfile) {
    return { success: false, error: 'User profile not found' };
  }

  // Check if trying to transfer to current manager
  if (userProfile.manager_id === targetManager.id) {
    return { success: false, error: 'You are already on this team' };
  }

  // Create transfer request
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { data: request, error: createError } = await supabase
    .from('transfer_requests')
    .insert({
      ios_user_id: iosUserProfileId,
      from_manager_id: userProfile.manager_id,
      to_manager_id: targetManager.id,
      request_reason: reason,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (createError) {
    console.error('Failed to create transfer request:', createError);
    return { success: false, error: 'Failed to create transfer request' };
  }

  // Notify target manager (incoming request)
  await createManagerNotification(
    targetManager.id,
    'transfer_request_incoming',
    'New Transfer Request',
    `${userProfile.full_name} has requested to join your team.`,
    request.id,
    'transfer_request'
  );

  // Notify current manager (member leaving) - if they have one
  if (userProfile.manager_id && !userProfile.manager?.is_house_account) {
    await createManagerNotification(
      userProfile.manager_id,
      'transfer_leaving',
      'Team Member Transfer Request',
      `${userProfile.full_name} has requested to transfer to another team.`,
      request.id,
      'transfer_request'
    );
  }

  return { success: true, request: request as TransferRequest };
}

export async function getPendingTransferRequest(iosUserProfileId: string): Promise<TransferRequestWithDetails | null> {
  const { data, error } = await supabase
    .from('transfer_requests')
    .select(`
      *,
      ios_user:ios_user_profiles(*),
      from_manager:manager_profiles!transfer_requests_from_manager_id_fkey(*),
      to_manager:manager_profiles!transfer_requests_to_manager_id_fkey(*)
    `)
    .eq('ios_user_id', iosUserProfileId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) return null;
  return data as TransferRequestWithDetails;
}

export async function cancelTransferRequest(requestId: string, userId: string): Promise<{ success: boolean; error?: string }> {
  // Verify user owns this request
  const { data: request, error: fetchError } = await supabase
    .from('transfer_requests')
    .select('*, ios_user:ios_user_profiles!inner(user_id)')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Transfer request not found' };
  }

  if (request.ios_user.user_id !== userId) {
    return { success: false, error: 'Not authorized to cancel this request' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: 'Can only cancel pending requests' };
  }

  const { error: updateError } = await supabase
    .from('transfer_requests')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('id', requestId);

  if (updateError) {
    return { success: false, error: 'Failed to cancel request' };
  }

  // Notify target manager
  await createManagerNotification(
    request.to_manager_id,
    'transfer_cancelled',
    'Transfer Request Cancelled',
    `A transfer request has been cancelled by the user.`,
    requestId,
    'transfer_request'
  );

  return { success: true };
}

// ============================================
// MANAGER OPERATIONS
// ============================================

export async function getIncomingTransferRequests(managerId: string): Promise<TransferRequestWithDetails[]> {
  const { data, error } = await supabase
    .from('transfer_requests')
    .select(`
      *,
      ios_user:ios_user_profiles(*),
      from_manager:manager_profiles!transfer_requests_from_manager_id_fkey(*),
      to_manager:manager_profiles!transfer_requests_to_manager_id_fkey(*)
    `)
    .eq('to_manager_id', managerId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('requested_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch incoming requests:', error);
    return [];
  }

  return (data || []) as TransferRequestWithDetails[];
}

export async function getOutgoingTransferRequests(managerId: string): Promise<TransferRequestWithDetails[]> {
  const { data, error } = await supabase
    .from('transfer_requests')
    .select(`
      *,
      ios_user:ios_user_profiles(*),
      from_manager:manager_profiles!transfer_requests_from_manager_id_fkey(*),
      to_manager:manager_profiles!transfer_requests_to_manager_id_fkey(*)
    `)
    .eq('from_manager_id', managerId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch outgoing requests:', error);
    return [];
  }

  return (data || []) as TransferRequestWithDetails[];
}

export async function approveTransferRequest(
  requestId: string,
  managerId: string
): Promise<{ success: boolean; error?: string }> {
  // Verify manager owns this request
  const { data: request, error: fetchError } = await supabase
    .from('transfer_requests')
    .select(`
      *,
      ios_user:ios_user_profiles(*),
      from_manager:manager_profiles!transfer_requests_from_manager_id_fkey(*),
      to_manager:manager_profiles!transfer_requests_to_manager_id_fkey(*)
    `)
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Transfer request not found' };
  }

  if (request.to_manager_id !== managerId) {
    return { success: false, error: 'Not authorized to approve this request' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: 'Request is no longer pending' };
  }

  // Get manager's user_id for responded_by
  const { data: managerProfile } = await supabase
    .from('manager_profiles')
    .select('user_id')
    .eq('id', managerId)
    .single();

  // Execute the transfer
  const result = await executeTransfer(request, managerProfile?.user_id);
  return result;
}

export async function rejectTransferRequest(
  requestId: string,
  managerId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // Verify manager owns this request
  const { data: request, error: fetchError } = await supabase
    .from('transfer_requests')
    .select('*, ios_user:ios_user_profiles(*)')
    .eq('id', requestId)
    .single();

  if (fetchError || !request) {
    return { success: false, error: 'Transfer request not found' };
  }

  if (request.to_manager_id !== managerId) {
    return { success: false, error: 'Not authorized to reject this request' };
  }

  if (request.status !== 'pending') {
    return { success: false, error: 'Request is no longer pending' };
  }

  // Get manager's user_id
  const { data: managerProfile } = await supabase
    .from('manager_profiles')
    .select('user_id')
    .eq('id', managerId)
    .single();

  // Update request status
  const { error: updateError } = await supabase
    .from('transfer_requests')
    .update({
      status: 'rejected',
      rejection_reason: reason,
      responded_at: new Date().toISOString(),
      responded_by: managerProfile?.user_id,
    })
    .eq('id', requestId);

  if (updateError) {
    return { success: false, error: 'Failed to reject request' };
  }

  // Notify old manager (if exists)
  if (request.from_manager_id) {
    await createManagerNotification(
      request.from_manager_id,
      'transfer_rejected',
      'Transfer Request Rejected',
      `${request.ios_user.full_name}'s transfer request was rejected. They remain on your team.`,
      requestId,
      'transfer_request'
    );
  }

  return { success: true };
}

// ============================================
// TRANSFER EXECUTION
// ============================================

async function executeTransfer(
  request: TransferRequestWithDetails,
  respondedBy?: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();

  // 1. Close old team history record
  if (request.from_manager_id) {
    await supabase
      .from('team_history')
      .update({ left_at: now })
      .eq('ios_user_id', request.ios_user_id)
      .eq('manager_id', request.from_manager_id)
      .is('left_at', null);
  } else {
    // Close House Account history
    await supabase
      .from('team_history')
      .update({ left_at: now })
      .eq('ios_user_id', request.ios_user_id)
      .is('manager_id', null)
      .is('left_at', null);
  }

  // 2. Create new team history record
  const newTeamName = request.to_manager?.team_name || 'Unknown Team';
  const newManagerName = request.to_manager?.full_name || 'Unknown Manager';

  await supabase.from('team_history').insert({
    ios_user_id: request.ios_user_id,
    manager_id: request.to_manager_id,
    team_name: newTeamName,
    manager_name: newManagerName,
    joined_at: now,
    transfer_request_id: request.id,
  });

  // 3. Update user's manager_id
  const { error: updateError } = await supabase
    .from('ios_user_profiles')
    .update({ manager_id: request.to_manager_id })
    .eq('id', request.ios_user_id);

  if (updateError) {
    console.error('Failed to update user manager:', updateError);
    return { success: false, error: 'Failed to complete transfer' };
  }

  // 4. Update transfer request status
  await supabase
    .from('transfer_requests')
    .update({
      status: 'approved',
      responded_at: now,
      responded_by: respondedBy,
    })
    .eq('id', request.id);

  // 5. Notify old manager about completion
  if (request.from_manager_id) {
    await createManagerNotification(
      request.from_manager_id,
      'transfer_completed',
      'Team Member Transferred',
      `${request.ios_user?.full_name} has been transferred to ${newTeamName}.`,
      request.id,
      'transfer_request'
    );
  }

  return { success: true };
}

// ============================================
// TEAM HISTORY
// ============================================

export async function getTeamHistory(iosUserProfileId: string): Promise<TeamHistoryWithDetails[]> {
  const { data, error } = await supabase
    .from('team_history')
    .select(`
      *,
      manager:manager_profiles(*)
    `)
    .eq('ios_user_id', iosUserProfileId)
    .order('joined_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch team history:', error);
    return [];
  }

  return (data || []) as TeamHistoryWithDetails[];
}

// ============================================
// NOTIFICATIONS
// ============================================

async function createManagerNotification(
  managerId: string,
  type: string,
  title: string,
  message: string,
  referenceId?: string,
  referenceType?: string
): Promise<void> {
  await supabase.from('manager_notifications').insert({
    manager_id: managerId,
    notification_type: type,
    title,
    message,
    reference_id: referenceId,
    reference_type: referenceType,
  });
}

export async function getManagerNotifications(managerId: string): Promise<ManagerNotification[]> {
  const { data, error } = await supabase
    .from('manager_notifications')
    .select('*')
    .eq('manager_id', managerId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }

  return (data || []) as ManagerNotification[];
}

export async function getUnreadNotificationCount(managerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('manager_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('manager_id', managerId)
    .eq('is_read', false);

  if (error) return 0;
  return count || 0;
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  await supabase
    .from('manager_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
}

export async function markAllNotificationsAsRead(managerId: string): Promise<void> {
  await supabase
    .from('manager_notifications')
    .update({ is_read: true })
    .eq('manager_id', managerId)
    .eq('is_read', false);
}

// ============================================
// ADMIN OPERATIONS
// ============================================

export async function getAllTransferRequests(filters?: {
  status?: string;
  limit?: number;
}): Promise<TransferRequestWithDetails[]> {
  let query = supabase
    .from('transfer_requests')
    .select(`
      *,
      ios_user:ios_user_profiles(*),
      from_manager:manager_profiles!transfer_requests_from_manager_id_fkey(*),
      to_manager:manager_profiles!transfer_requests_to_manager_id_fkey(*)
    `)
    .order('requested_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch all transfer requests:', error);
    return [];
  }

  return (data || []) as TransferRequestWithDetails[];
}

export async function getUserTeamHistory(iosUserProfileId: string): Promise<TeamHistoryWithDetails[]> {
  return getTeamHistory(iosUserProfileId);
}

export async function getPendingTransferRequestsCount(managerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('transfer_requests')
    .select('*', { count: 'exact', head: true })
    .eq('to_manager_id', managerId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());

  if (error) return 0;
  return count || 0;
}
