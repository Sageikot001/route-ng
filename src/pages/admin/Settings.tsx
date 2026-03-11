import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPlatformSettings,
  updatePlatformSettings,
  DEFAULT_SETTINGS,
  type PlatformSettings
} from '../../api/settings';

export default function AdminSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: settings, isLoading, error: loadError } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: getPlatformSettings,
  });

  const [formData, setFormData] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<PlatformSettings>) => {
      if (!user) throw new Error('Not authenticated');
      console.log('Saving settings:', data);
      return updatePlatformSettings(data, user.id);
    },
    onSuccess: (savedData) => {
      console.log('Settings saved successfully:', savedData);
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      // Also refresh managers list since commission rate may have changed
      queryClient.invalidateQueries({ queryKey: ['all-managers'] });
      setHasChanges(false);
      setSaveSuccess(true);
      setSaveError(null);
    },
    onError: (error) => {
      console.error('Failed to save settings:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save settings');
      setSaveSuccess(false);
    },
  });

  const handleChange = (field: keyof PlatformSettings, value: number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleSave = () => {
    console.log('Attempting to save:', formData);
    updateMutation.mutate(formData);
  };

  const handleReset = () => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="admin-page">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Platform Settings</h1>
        <p>Configure system-wide settings and limits</p>
      </header>

      <div className="settings-container">
        {/* Transaction Settings */}
        <section className="settings-section">
          <h2>Transaction Settings</h2>
          <p className="section-description">Configure daily transaction requirements</p>

          <div className="settings-grid">
            <div className="setting-item">
              <label>Minimum Daily Transactions</label>
              <input
                type="number"
                value={formData.min_daily_transactions}
                onChange={(e) => handleChange('min_daily_transactions', parseInt(e.target.value) || 0)}
                min="1"
              />
              <span className="setting-help">Minimum transactions required per bank per day</span>
            </div>

            <div className="setting-item">
              <label>Maximum Daily Transactions</label>
              <input
                type="number"
                value={formData.max_daily_transactions}
                onChange={(e) => handleChange('max_daily_transactions', parseInt(e.target.value) || 0)}
                min="1"
              />
              <span className="setting-help">Maximum transactions allowed per bank per day</span>
            </div>
          </div>
        </section>

        {/* Compensation Settings */}
        <section className="settings-section">
          <h2>Compensation Settings</h2>
          <p className="section-description">Configure payout amounts and rates</p>

          <div className="settings-grid">
            <div className="setting-item">
              <label>Earnings Per Gift Card (NGN)</label>
              <input
                type="number"
                value={formData.earnings_per_card}
                onChange={(e) => handleChange('earnings_per_card', parseInt(e.target.value) || 0)}
                min="0"
              />
              <span className="setting-help">
                Amount paid per approved gift card. Daily potential: N{(formData.earnings_per_card * formData.min_daily_transactions).toLocaleString()} - N{(formData.earnings_per_card * formData.max_daily_transactions).toLocaleString()}
              </span>
            </div>

            <div className="setting-item">
              <label>Manager Commission Rate (%)</label>
              <input
                type="number"
                value={(formData.manager_commission_rate * 100).toFixed(1)}
                onChange={(e) => handleChange('manager_commission_rate', (parseFloat(e.target.value) || 0) / 100)}
                min="0"
                max="100"
                step="0.1"
              />
              <span className="setting-help">Percentage of team earnings paid to managers</span>
            </div>
          </div>
        </section>

        {/* Limits */}
        <section className="settings-section">
          <h2>User Limits</h2>
          <p className="section-description">Configure user account limits</p>

          <div className="settings-grid">
            <div className="setting-item">
              <label>Max Banks Per User</label>
              <input
                type="number"
                value={formData.max_banks_per_user}
                onChange={(e) => handleChange('max_banks_per_user', parseInt(e.target.value) || 1)}
                min="1"
                max="20"
              />
              <span className="setting-help">Maximum number of bank accounts a user can register</span>
            </div>

            <div className="setting-item">
              <label>Minimum Funding Amount (NGN)</label>
              <input
                type="number"
                value={formData.min_funding_amount}
                onChange={(e) => handleChange('min_funding_amount', parseInt(e.target.value) || 0)}
                min="0"
              />
              <span className="setting-help">Minimum amount that can be funded to a user</span>
            </div>

            <div className="setting-item">
              <label>Maximum Funding Amount (NGN)</label>
              <input
                type="number"
                value={formData.max_funding_amount}
                onChange={(e) => handleChange('max_funding_amount', parseInt(e.target.value) || 0)}
                min="0"
              />
              <span className="setting-help">Maximum amount that can be funded to a user</span>
            </div>
          </div>
        </section>

        {/* Platform Controls */}
        <section className="settings-section">
          <h2>Platform Controls</h2>
          <p className="section-description">Control platform availability</p>

          <div className="settings-toggles">
            <div className="toggle-item">
              <div className="toggle-info">
                <label>Maintenance Mode</label>
                <span className="toggle-description">
                  Temporarily disable all transactions while maintenance is ongoing
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={formData.maintenance_mode}
                  onChange={(e) => handleChange('maintenance_mode', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <label>Registration Open</label>
                <span className="toggle-description">
                  Allow new users and managers to register on the platform
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={formData.registration_open}
                  onChange={(e) => handleChange('registration_open', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </section>

        {/* Save Bar */}
        {hasChanges && (
          <div className="settings-save-bar">
            <span>You have unsaved changes</span>
            <div className="save-actions">
              <button className="secondary-btn" onClick={handleReset}>
                Reset
              </button>
              <button
                className="primary-btn"
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}

        {saveError && (
          <div className="error-banner">
            <strong>Error:</strong> {saveError}
          </div>
        )}

        {loadError && (
          <div className="error-banner">
            <strong>Load Error:</strong> {loadError instanceof Error ? loadError.message : 'Failed to load settings'}
          </div>
        )}

        {saveSuccess && (
          <div className="success-banner">
            ✓ Settings saved successfully!
          </div>
        )}
      </div>
    </div>
  );
}
