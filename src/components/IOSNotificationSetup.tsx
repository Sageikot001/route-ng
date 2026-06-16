import { useState } from 'react';
import { isIOS, isStandalone } from '../lib/deviceDetection';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface IOSNotificationSetupProps {
  onComplete?: () => void;
  showAsModal?: boolean;
}

export default function IOSNotificationSetup({ onComplete, showAsModal = false }: IOSNotificationSetupProps) {
  const { isSupported, isEnabled, enableNotifications } = usePushNotifications();
  const [currentStep, setCurrentStep] = useState(getInitialStep());
  const [enabling, setEnabling] = useState(false);

  function getInitialStep(): number {
    if (!isIOS()) return 0;
    if (!isStandalone()) return 1; // Need to install PWA
    if (!isSupported) return 1; // Still need PWA
    if (!isEnabled) return 4; // PWA installed, need to enable notifications
    return 5; // All done
  }

  const handleEnableNotifications = async () => {
    setEnabling(true);
    const success = await enableNotifications();
    setEnabling(false);
    if (success) {
      setCurrentStep(5);
      onComplete?.();
    }
  };

  // Not iOS - show simple message
  if (!isIOS()) {
    return (
      <div className="ios-setup-container">
        <div className="setup-complete">
          <span className="setup-icon">✓</span>
          <p>Push notifications are available on this device.</p>
          {!isEnabled && (
            <button
              className="primary-btn"
              onClick={handleEnableNotifications}
              disabled={enabling}
            >
              {enabling ? 'Enabling...' : 'Enable Notifications'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Already set up
  if (isStandalone() && isEnabled) {
    return (
      <div className="ios-setup-container">
        <div className="setup-complete">
          <span className="setup-icon">✓</span>
          <h3>You're all set!</h3>
          <p>Push notifications are enabled on this device.</p>
        </div>
      </div>
    );
  }

  const content = (
    <div className="ios-setup-container">
      <div className="setup-header">
        <span className="setup-emoji">📱</span>
        <h2>Enable Push Notifications</h2>
        <p>Follow these steps to receive notifications on your iPhone</p>
      </div>

      <div className="setup-progress">
        <div className={`progress-step ${currentStep >= 1 ? 'active' : ''} ${isStandalone() ? 'completed' : ''}`}>
          <span className="step-dot">{isStandalone() ? '✓' : '1'}</span>
          <span className="step-label">Install App</span>
        </div>
        <div className="progress-line"></div>
        <div className={`progress-step ${currentStep >= 4 ? 'active' : ''} ${isEnabled ? 'completed' : ''}`}>
          <span className="step-dot">{isEnabled ? '✓' : '2'}</span>
          <span className="step-label">Enable Notifications</span>
        </div>
      </div>

      {!isStandalone() ? (
        <div className="setup-steps">
          <div className="setup-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Open in Safari</h4>
              <p>If you're using Chrome or another browser, copy this link and open it in Safari. This is required for iOS.</p>
              <button
                className="copy-link-btn"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Link copied! Open Safari and paste it.');
                }}
              >
                Copy Link
              </button>
            </div>
          </div>

          <div className="setup-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Tap the Share Button</h4>
              <p>Look for the share icon <span className="share-icon">⬆️</span> at the bottom of Safari and tap it.</p>
              <div className="step-visual">
                <div className="safari-bar">
                  <span className="share-button-visual">⬆️</span>
                </div>
              </div>
            </div>
          </div>

          <div className="setup-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Add to Home Screen</h4>
              <p>Scroll down in the share menu and tap <strong>"Add to Home Screen"</strong></p>
              <div className="menu-option-visual">
                <span className="menu-icon">➕</span>
                <span>Add to Home Screen</span>
              </div>
            </div>
          </div>

          <div className="setup-step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h4>Tap "Add"</h4>
              <p>Confirm by tapping <strong>"Add"</strong> in the top right corner. Then open Route.ng from your Home Screen.</p>
            </div>
          </div>
        </div>
      ) : !isEnabled ? (
        <div className="setup-steps">
          <div className="setup-step highlight">
            <div className="step-number">✓</div>
            <div className="step-content">
              <h4>App Installed!</h4>
              <p>Great! You've added Route.ng to your Home Screen.</p>
            </div>
          </div>

          <div className="setup-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Enable Notifications</h4>
              <p>Tap the button below to enable push notifications. When prompted by iOS, tap <strong>"Allow"</strong>.</p>
              <button
                className="primary-btn large"
                onClick={handleEnableNotifications}
                disabled={enabling}
              >
                {enabling ? 'Enabling...' : 'Enable Notifications'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="setup-complete">
          <span className="setup-icon">🎉</span>
          <h3>All Done!</h3>
          <p>You'll now receive notifications for announcements, opportunities, and more.</p>
          <button className="primary-btn" onClick={onComplete}>
            Got it
          </button>
        </div>
      )}
    </div>
  );

  if (showAsModal) {
    return (
      <div className="modal-overlay">
        <div className="modal ios-setup-modal">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
