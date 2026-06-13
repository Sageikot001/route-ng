import { supabase } from '../api/supabase';

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

interface SendResult {
  success: number;
  failed: number;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Call the Edge Function to send notifications
async function callNotificationFunction(params: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  targetType: 'all' | 'role' | 'users';
  targetRole?: 'ios_user' | 'manager' | 'admin';
  targetUserIds?: string[];
}): Promise<SendResult> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Notification function error:', error);
      return { success: 0, failed: 0 };
    }

    return await response.json();
  } catch (err) {
    console.error('Error calling notification function:', err);
    return { success: 0, failed: 0 };
  }
}

// Send notification to specific user IDs
export async function sendNotificationToUsers(
  userIds: string[],
  notification: NotificationPayload
): Promise<SendResult> {
  return callNotificationFunction({
    ...notification,
    targetType: 'users',
    targetUserIds: userIds,
  });
}

// Send notification to all users with a specific role
export async function sendNotificationToRole(
  role: 'ios_user' | 'manager' | 'admin',
  notification: NotificationPayload
): Promise<SendResult> {
  return callNotificationFunction({
    ...notification,
    targetType: 'role',
    targetRole: role,
  });
}

// Send notification to all users
export async function sendNotificationToAll(
  notification: NotificationPayload
): Promise<SendResult> {
  return callNotificationFunction({
    ...notification,
    targetType: 'all',
  });
}

// Send notification to a manager when team member joins
export async function notifyManagerOfNewMember(
  managerId: string,
  memberName: string
): Promise<void> {
  // Get manager's user_id from manager_profiles
  const { data: manager, error } = await supabase
    .from('manager_profiles')
    .select('user_id, full_name')
    .eq('id', managerId)
    .single();

  if (error || !manager) {
    console.error('Could not find manager:', managerId);
    return;
  }

  await sendNotificationToUsers([manager.user_id], {
    title: 'New Team Member',
    body: `${memberName} has joined your team!`,
    url: '/manager/team',
    tag: 'new-member',
  });
}
