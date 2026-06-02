import { supabase } from './supabase';

export type ContentType = 'announcements' | 'resources';

export interface NotificationCounts {
  announcements: number;
  resources: number;
}

/**
 * Get unread counts for announcements and resources
 */
export async function getUnreadCounts(
  userId: string,
  audience: 'ios_users' | 'managers'
): Promise<NotificationCounts> {
  const resourceAudience = audience === 'ios_users' ? 'partners' : 'managers';

  try {
    // Get both counts in parallel
    const [announcementsResult, resourcesResult] = await Promise.all([
      supabase.rpc('get_unread_announcements_count', {
        p_user_id: userId,
        p_audience: audience,
      }),
      supabase.rpc('get_unread_resources_count', {
        p_user_id: userId,
        p_audience: resourceAudience,
      }),
    ]);

    return {
      announcements: announcementsResult.data ?? 0,
      resources: resourcesResult.data ?? 0,
    };
  } catch (error) {
    // If functions don't exist yet (migration not run), return 0s
    console.warn('Notification count functions not available:', error);
    return { announcements: 0, resources: 0 };
  }
}

/**
 * Mark a content type as read for the current user
 */
export async function markAsRead(
  userId: string,
  contentType: ContentType
): Promise<void> {
  try {
    await supabase.rpc('mark_content_as_read', {
      p_user_id: userId,
      p_content_type: contentType,
    });
  } catch (error) {
    // Silently fail if migration not run yet
    console.warn('Mark as read not available:', error);
  }
}

/**
 * Get last read timestamp for a content type
 */
export async function getLastReadAt(
  userId: string,
  contentType: ContentType
): Promise<Date | null> {
  const { data, error } = await supabase
    .from('user_content_reads')
    .select('last_read_at')
    .eq('user_id', userId)
    .eq('content_type', contentType)
    .maybeSingle();

  if (error || !data) return null;
  return new Date(data.last_read_at);
}

// ============================================
// PUSH NOTIFICATIONS (FCM)
// ============================================

export interface PushSubscription {
  id: string;
  user_id: string;
  fcm_token: string;
  device_info?: string;
  created_at: string;
  updated_at: string;
}

// Save or update FCM token for a user
export async function savePushToken(
  userId: string,
  fcmToken: string,
  deviceInfo?: string
): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        fcm_token: fcmToken,
        device_info: deviceInfo || navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,fcm_token',
      }
    );

  if (error) {
    console.error('Error saving push token:', error);
    throw error;
  }
}

// Remove FCM token (when user logs out or disables notifications)
export async function removePushToken(userId: string, fcmToken: string): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('fcm_token', fcmToken);

  if (error) {
    console.error('Error removing push token:', error);
    throw error;
  }
}

// Get all push tokens (admin - for sending to everyone)
export async function getAllPushTokens(): Promise<PushSubscription[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (error) throw error;
  return data || [];
}

// Get push tokens by user IDs
export async function getPushTokensByUserIds(userIds: string[]): Promise<PushSubscription[]> {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds);

  if (error) throw error;
  return data || [];
}

// Check if user has notifications enabled
export async function hasNotificationsEnabled(userId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('push_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) return false;
  return (count || 0) > 0;
}
