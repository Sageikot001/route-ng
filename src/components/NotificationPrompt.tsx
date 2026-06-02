import { useState, useEffect } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';

const PROMPT_DISMISSED_KEY = 'route_notification_prompt_dismissed';
const PROMPT_DELAY_MS = 5000; // Show after 5 seconds

export default function NotificationPrompt() {
  const { isSupported, isEnabled, permission, enableNotifications, isLoading } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    // Don't show if not supported, already enabled, or previously dismissed
    if (!isSupported || isEnabled || permission === 'denied') {
      return;
    }

    const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      // Only show again after 7 days
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, PROMPT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isSupported, isEnabled, permission]);

  const handleEnable = async () => {
    setEnabling(true);
    const success = await enableNotifications();
    setEnabling(false);

    if (success) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, new Date().toISOString());
    setShowPrompt(false);
  };

  if (!showPrompt || isLoading) return null;

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
