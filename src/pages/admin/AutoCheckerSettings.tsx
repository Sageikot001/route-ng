import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  getEmailCheckerConfig,
  saveEmailCheckerConfig,
  updateEmailCheckerConfig,
  disconnectEmailChecker,
} from '../../api/autoChecker';

// Google OAuth Configuration
// These should be set in environment variables in production
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/admin/auto-checker/settings`;

export default function AdminAutoCheckerSettings() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [scanInterval, setScanInterval] = useState(60);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query current config
  const { data: config, isLoading } = useQuery({
    queryKey: ['email-checker-config'],
    queryFn: getEmailCheckerConfig,
  });

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      handleOAuthCallback(code);
      // Clear the code from URL
      setSearchParams({});
    }

    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(`OAuth error: ${errorParam}`);
      setSearchParams({});
    }
  }, [searchParams]);

  // Set scan interval from config
  useEffect(() => {
    if (config?.scan_interval_minutes) {
      setScanInterval(config.scan_interval_minutes);
    }
  }, [config]);

  const handleOAuthCallback = async (code: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      // Exchange code for tokens
      // This would typically be done server-side, but for demo we'll call an edge function
      const response = await fetch('/api/auth/google/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: GOOGLE_REDIRECT_URI }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens');
      }

      const tokens = await response.json();

      await saveEmailCheckerConfig({
        gmail_email: tokens.email,
        oauth_refresh_token: tokens.refresh_token,
        oauth_access_token: tokens.access_token,
        token_expires_at: tokens.expires_at,
      });

      queryClient.invalidateQueries({ queryKey: ['email-checker-config'] });
    } catch (err: any) {
      setError(err.message || 'Failed to connect Gmail');
    } finally {
      setIsConnecting(false);
    }
  };

  const updateIntervalMutation = useMutation({
    mutationFn: (interval: number) => {
      if (!config?.id) throw new Error('No config found');
      return updateEmailCheckerConfig(config.id, { scan_interval_minutes: interval });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-checker-config'] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectEmailChecker,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-checker-config'] });
    },
  });

  const handleConnectGmail = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID environment variable.');
      return;
    }

    // Build OAuth URL
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
    ];

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to disconnect Gmail? This will stop automatic scanning.')) {
      disconnectMutation.mutate();
    }
  };

  const handleUpdateInterval = () => {
    if (scanInterval >= 5 && scanInterval <= 1440) {
      updateIntervalMutation.mutate(scanInterval);
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>Auto-Checker Settings</h1>
            <p>Configure Gmail connection and scanning options</p>
          </div>
          <Link to="/admin/auto-checker" className="back-btn">
            Back to Dashboard
          </Link>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {isLoading ? (
        <div className="loading">Loading configuration...</div>
      ) : (
        <div className="settings-container">
          {/* Gmail Connection Section */}
          <section className="settings-section">
            <h2>Gmail Connection</h2>

            {config && config.is_active ? (
              <div className="connection-status connected">
                <div className="status-icon">✓</div>
                <div className="status-info">
                  <strong>Connected</strong>
                  <span className="connected-email">{config.gmail_email}</span>
                  {config.last_scan_at && (
                    <span className="last-scan">
                      Last scan: {formatDateTime(config.last_scan_at)}
                    </span>
                  )}
                </div>
                <button
                  className="disconnect-btn"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
                </button>
              </div>
            ) : (
              <div className="connection-status disconnected">
                <div className="status-icon">○</div>
                <div className="status-info">
                  <strong>Not Connected</strong>
                  <span>Connect a Gmail account to enable automatic scanning</span>
                </div>
                <button
                  className="connect-btn"
                  onClick={handleConnectGmail}
                  disabled={isConnecting}
                >
                  {isConnecting ? 'Connecting...' : 'Connect Gmail'}
                </button>
              </div>
            )}

            <div className="oauth-info">
              <h4>Required Permissions</h4>
              <ul>
                <li>Read emails to scan for gift card receipts</li>
                <li>Mark emails as read after processing</li>
                <li>Access your email address for identification</li>
              </ul>
              <p className="privacy-note">
                We only read emails related to Apple gift card receipts.
                Your data is processed securely and never shared.
              </p>
            </div>
          </section>

          {/* Scan Settings Section */}
          {config && config.is_active && (
            <section className="settings-section">
              <h2>Scan Settings</h2>

              <div className="form-group">
                <label>Scan Interval (minutes)</label>
                <div className="input-with-btn">
                  <input
                    type="number"
                    value={scanInterval}
                    onChange={(e) => setScanInterval(Number(e.target.value))}
                    min="5"
                    max="1440"
                  />
                  <button
                    className="save-btn"
                    onClick={handleUpdateInterval}
                    disabled={
                      updateIntervalMutation.isPending ||
                      scanInterval === config.scan_interval_minutes
                    }
                  >
                    {updateIntervalMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <span className="form-hint">
                  How often to check for new emails (5-1440 minutes)
                </span>
              </div>

              <div className="setting-info">
                <h4>Scheduled Scanning</h4>
                <p>
                  Automatic scanning runs every {config.scan_interval_minutes} minutes
                  to check for new gift card emails. You can also trigger a manual scan
                  from the dashboard at any time.
                </p>
              </div>
            </section>
          )}

          {/* Email Parser Settings */}
          <section className="settings-section">
            <h2>Email Parser Configuration</h2>

            <div className="parser-info">
              <h4>Supported Email Formats</h4>
              <ul>
                <li>Apple Gift Card confirmation emails</li>
                <li>Apple Store receipt emails</li>
                <li>iTunes Gift Card receipts</li>
              </ul>

              <h4>Extracted Data</h4>
              <ul>
                <li>Redemption codes (16-character alphanumeric)</li>
                <li>Gift card amounts (USD)</li>
                <li>Sender email address</li>
                <li>Timestamp of receipt</li>
              </ul>

              <h4>User Matching</h4>
              <p>
                The system automatically matches gift cards to users based on their
                registered email addresses. Unmatched cards can be manually assigned
                from the dashboard.
              </p>
            </div>
          </section>

          {/* Setup Instructions */}
          {!config?.is_active && (
            <section className="settings-section">
              <h2>Setup Instructions</h2>

              <div className="setup-steps">
                <div className="step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <strong>Create Google Cloud Project</strong>
                    <p>
                      Go to{' '}
                      <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer">
                        Google Cloud Console
                      </a>{' '}
                      and create a new project.
                    </p>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <strong>Enable Gmail API</strong>
                    <p>
                      In APIs & Services, enable the Gmail API for your project.
                    </p>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <strong>Configure OAuth Consent Screen</strong>
                    <p>
                      Set up the OAuth consent screen with your app details and add the required scopes.
                    </p>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <strong>Create OAuth Credentials</strong>
                    <p>
                      Create OAuth 2.0 Client ID credentials. Set the authorized redirect URI to:
                    </p>
                    <code className="redirect-uri">{GOOGLE_REDIRECT_URI}</code>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">5</div>
                  <div className="step-content">
                    <strong>Configure Environment Variables</strong>
                    <p>
                      Add your Client ID and Client Secret to your environment variables:
                    </p>
                    <ul>
                      <li><code>VITE_GOOGLE_CLIENT_ID</code></li>
                      <li><code>GOOGLE_CLIENT_SECRET</code> (server-side only)</li>
                    </ul>
                  </div>
                </div>
                <div className="step">
                  <div className="step-number">6</div>
                  <div className="step-content">
                    <strong>Connect Gmail</strong>
                    <p>
                      Click the "Connect Gmail" button above to authorize access.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
