import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getUnreadCounts, markAsRead } from '../api/notifications';
import type { ContentType } from '../api/notifications';

export function useNotificationCounts() {
  const { user, iosUserProfile, managerProfile } = useAuth();
  const queryClient = useQueryClient();

  // Determine audience based on user role
  const audience = managerProfile ? 'managers' : 'ios_users';
  const isEnabled = !!user && (!!iosUserProfile || !!managerProfile);

  const { data: counts = { announcements: 0, resources: 0 }, isLoading } = useQuery({
    queryKey: ['notification-counts', user?.id, audience],
    queryFn: () => getUnreadCounts(user!.id, audience),
    enabled: isEnabled,
    // Refetch every 5 minutes to catch new content
    refetchInterval: 5 * 60 * 1000,
    // Also refetch when window regains focus
    refetchOnWindowFocus: true,
    // Don't show stale data while refetching
    staleTime: 60 * 1000,
  });

  const markContentAsRead = useCallback(async (contentType: ContentType) => {
    if (!user) return;

    await markAsRead(user.id, contentType);

    // Invalidate the counts query to refetch
    queryClient.invalidateQueries({ queryKey: ['notification-counts'] });
  }, [user, queryClient]);

  const totalUnread = counts.announcements + counts.resources;

  return {
    counts,
    totalUnread,
    isLoading,
    markContentAsRead,
  };
}

// Individual hooks for specific sections if needed
export function useAnnouncementCount() {
  const { counts } = useNotificationCounts();
  return counts.announcements;
}

export function useResourceCount() {
  const { counts } = useNotificationCounts();
  return counts.resources;
}
