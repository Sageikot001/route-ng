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
