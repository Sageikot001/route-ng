import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  requestNotificationPermission,
  onForegroundMessage,
  isFirebaseConfigured,
} from '../lib/firebase';
import { savePushToken, hasNotificationsEnabled, removeAllPushTokens } from '../api/notifications';

interface UsePushNotificationsResult {
  isSupported: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  permission: NotificationPermission | 'unsupported';
  enableNotifications: () => Promise<boolean>;
  disableNotifications: () => Promise<boolean>;
  showInAppNotification: (title: string, body: string) => void;
}

export function usePushNotifications(): UsePushNotificationsResult {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Check support and current state on mount
  useEffect(() => {
    const checkSupport = async () => {
      const hasNotificationAPI = 'Notification' in window;
      const hasServiceWorker = 'serviceWorker' in navigator;
      const firebaseConfigured = isFirebaseConfigured();

      const supported = hasNotificationAPI && hasServiceWorker && firebaseConfigured;

      console.log('[PushNotifications] Support check:', {
        hasNotificationAPI,
        hasServiceWorker,
        firebaseConfigured,
        supported,
        user: user?.id,
      });

      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);
      } else {
        setPermission('unsupported');
      }

      // Check if user already has notifications enabled
      if (user && supported) {
        const enabled = await hasNotificationsEnabled(user.id);
        console.log('[PushNotifications] User notifications enabled:', enabled);
        setIsEnabled(enabled);
      }

      setIsLoading(false);
    };

    checkSupport();
  }, [user]);

  // Listen for foreground messages
  useEffect(() => {
    if (!isSupported || !isEnabled) return;

    let unsubscribe: (() => void) | undefined;

    onForegroundMessage((payload) => {
      const notification = payload?.notification;
      if (notification?.title) {
        showInAppNotification(notification.title, notification.body || '');
      }
    }).then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isSupported, isEnabled]);

  // Enable notifications
  const enableNotifications = useCallback(async (): Promise<boolean> => {
    if (!user || !isSupported) return false;

    setIsLoading(true);
    try {
      const token = await requestNotificationPermission();

      if (token) {
        await savePushToken(user.id, token);
        setIsEnabled(true);
        setPermission('granted');
        return true;
      }

      setPermission(Notification.permission);
      return false;
    } catch (error) {
      console.error('Error enabling notifications:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user, isSupported]);

  // Disable notifications
  const disableNotifications = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    try {
      await removeAllPushTokens(user.id);
      setIsEnabled(false);
      return true;
    } catch (error) {
      console.error('Error disabling notifications:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Show in-app notification (for foreground messages)
  const showInAppNotification = useCallback((title: string, body: string) => {
    // For foreground messages, show a native notification if permitted
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/icon-192.png' });
    }
  }, []);

  return {
    isSupported,
    isEnabled,
    isLoading,
    permission,
    enableNotifications,
    disableNotifications,
    showInAppNotification,
  };
}

export default usePushNotifications;
