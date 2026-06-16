import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { isIOS, isStandalone } from '../lib/deviceDetection';
import IOSNotificationSetup from './IOSNotificationSetup';

const PROMPT_DISMISSED_KEY = 'route_notification_prompt_dismissed';
const PROMPT_DELAY_MS = 5000; // Show after 5 seconds

export default function NotificationPrompt() {
  const { user } = useAuth();
  const { isSupported, isEnabled, permission, enableNotifications, isLoading } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    // Only show for logged-in users
    if (!user) return;

    // For iOS users who haven't set up notifications
    if (isIOS()) {
      // If not in standalone mode OR notifications not enabled, show setup
      if (!isStandalone() || (!isEnabled && isSupported)) {
        const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY + '_ios');
        if (!dismissed) {
          const timer = setTimeout(() => {
            setShowPrompt(true);
          }, PROMPT_DELAY_MS);
          return () => clearTimeout(timer);
        }
      }
      return;
    }

    // For non-iOS: don't show if not supported or already enabled
    if (!isSupported || isEnabled) return;

    const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return;
    }

    if (permission === 'denied') {
      const deniedKey = PROMPT_DISMISSED_KEY + '_denied';
      const deniedAt = localStorage.getItem(deniedKey);
      if (!deniedAt) {
        localStorage.setItem(deniedKey, new Date().toISOString());
        return;
      }
      const daysSinceDenied = (Date.now() - new Date(deniedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDenied < 7) return;
    }

    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, PROMPT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [user, isSupported, isEnabled, permission]);

  const handleEnable = async () => {
    setEnabling(true);
    const success = await enableNotifications();
    setEnabling(false);
    if (success) setShowPrompt(false);
  };

  const handleDismiss = () => {
    const key = isIOS() ? PROMPT_DISMISSED_KEY + '_ios' : PROMPT_DISMISSED_KEY;
    localStorage.setItem(key, new Date().toISOString());
    setShowPrompt(false);
  };

  if (!showPrompt || isLoading) return null;

  // iOS users get the full guided setup
  if (isIOS()) {
    return (
      <div className="notification-prompt-overlay">
        <div className="modal ios-setup-modal">
          <button className="modal-close-btn" onClick={handleDismiss}>✕</button>
          <IOSNotificationSetup onComplete={handleDismiss} />
        </div>
      </div>
    );
  }

  // Non-iOS users get the simple prompt
  return (
    <div className="notification-prompt-overlay">
      <div className="notification-prompt">
        <div className="notification-prompt-icon">🔔</div>
        <h3>Stay Updated</h3>
        <p>Enable notifications to get alerts about new announcements, transaction updates, and more.</p>
        <div className="notification-prompt-actions">
          <button
            className="enable-btn"
            onClick={handleEnable}
            disabled={enabling}
          >
            {enabling ? 'Enabling...' : 'Enable Notifications'}
          </button>
          <button
            className="dismiss-btn"
            onClick={handleDismiss}
            disabled={enabling}
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
}
