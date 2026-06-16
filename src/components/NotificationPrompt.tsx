import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { isIOSSafari, isIOS, isStandalone } from '../lib/deviceDetection';

const PROMPT_DISMISSED_KEY = 'route_notification_prompt_dismissed';
const PROMPT_DELAY_MS = 5000; // Show after 5 seconds

export default function NotificationPrompt() {
  const { user } = useAuth();
  const { isSupported, isEnabled, permission, enableNotifications, isLoading } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Check if we need to show iOS installation guide (only for authenticated users)
  useEffect(() => {
    if (!user) return; // Only show for logged-in users

    if (isIOSSafari()) {
      const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY + '_ios');
      if (!dismissed) {
        const timer = setTimeout(() => {
          setShowIOSGuide(true);
        }, PROMPT_DELAY_MS);
        return () => clearTimeout(timer);
      }
    }
  }, [user]);

  useEffect(() => {
    console.log('[NotificationPrompt] State:', { user: user?.id, isSupported, isEnabled, permission, isLoading, isIOS: isIOS(), isStandalone: isStandalone() });

    // Only show for logged-in users
    if (!user) {
      return;
    }

    // Don't show regular prompt if on iOS Safari (show iOS guide instead)
    if (isIOSSafari()) {
      return;
    }

    // Don't show if not supported or already enabled
    if (!isSupported || isEnabled) {
      console.log('[NotificationPrompt] Not showing - isSupported:', isSupported, 'isEnabled:', isEnabled);
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

    // Treat denied permission like dismissal - check again after 7 days
    if (permission === 'denied') {
      const deniedKey = PROMPT_DISMISSED_KEY + '_denied';
      const deniedAt = localStorage.getItem(deniedKey);
      if (!deniedAt) {
        localStorage.setItem(deniedKey, new Date().toISOString());
        return;
      }
      const daysSinceDenied = (Date.now() - new Date(deniedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDenied < 7) {
        return;
      }
    }

    // Show prompt after delay
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, PROMPT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [user, isSupported, isEnabled, permission]);

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

  const handleDismissIOSGuide = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY + '_ios', new Date().toISOString());
    setShowIOSGuide(false);
  };

  // Show iOS installation guide
  if (showIOSGuide) {
    return (
      <div className="notification-prompt-overlay">
        <div className="notification-prompt ios-guide">
          <div className="notification-prompt-icon">📱</div>
          <h3>Install Route.ng App</h3>
          <p>To receive push notifications on your iPhone, install this app to your Home Screen:</p>

          <div className="ios-steps">
            <div className="ios-step">
              <span className="step-number">1</span>
              <span className="step-text">Open this page in <strong>Safari</strong> (if using Chrome/other browser)</span>
            </div>
            <div className="ios-step">
              <span className="step-number">2</span>
              <span className="step-text">Tap the <strong>Share</strong> button <span className="ios-icon">⬆️</span> at the bottom</span>
            </div>
            <div className="ios-step">
              <span className="step-number">3</span>
              <span className="step-text">Scroll down and tap <strong>"Add to Home Screen"</strong></span>
            </div>
            <div className="ios-step">
              <span className="step-number">4</span>
              <span className="step-text">Tap <strong>"Add"</strong> in the top right corner</span>
            </div>
            <div className="ios-step">
              <span className="step-number">5</span>
              <span className="step-text">Open <strong>Route.ng</strong> from your Home Screen</span>
            </div>
            <div className="ios-step">
              <span className="step-number">6</span>
              <span className="step-text">You'll then be prompted to enable notifications</span>
            </div>
          </div>

          <div className="notification-prompt-actions">
            <button
              className="dismiss-btn"
              onClick={handleDismissIOSGuide}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    );
  }

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
