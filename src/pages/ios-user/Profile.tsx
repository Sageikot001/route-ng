import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getUserBanks, addBank, deleteBank, setPrimaryBank } from '../../api/users';
import { getManagerById } from '../../api/managers';
import { getSystemBanks } from '../../api/systemBanks';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';

export default function IOSUserProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, iosUserProfile, signOut } = useAuth();
  const { earningsPerCard, minDailyTransactions, maxDailyTransactions, minDailyEarnings, maxDailyEarnings } = usePlatformSettings();

  // Add bank modal state
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [bankError, setBankError] = useState('');

  // Delete confirmation state
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);

  const { data: banks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['user-banks', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserBanks(iosUserProfile.id) : [],
    enabled: !!iosUserProfile,
  });

  const { data: managerProfile } = useQuery({
    queryKey: ['user-manager', iosUserProfile?.manager_id],
    queryFn: () => iosUserProfile?.manager_id ? getManagerById(iosUserProfile.manager_id) : null,
    enabled: !!iosUserProfile?.manager_id,
  });

  // Get available system banks for dropdown
  const { data: systemBanks = [] } = useQuery({
    queryKey: ['system-banks'],
    queryFn: () => getSystemBanks(false),
  });

  // Add bank mutation
  const addBankMutation = useMutation({
    mutationFn: (bankData: { bank_name: string; account_number: string; account_name: string }) => {
      if (!iosUserProfile) throw new Error('No profile');
      return addBank(iosUserProfile.id, bankData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-banks'] });
      setShowAddBank(false);
      setNewBankName('');
      setNewAccountNumber('');
      setNewAccountName('');
      setBankError('');
    },
    onError: (error) => {
      setBankError(error instanceof Error ? error.message : 'Failed to add bank');
    },
  });

  // Delete bank mutation
  const deleteBankMutation = useMutation({
    mutationFn: (bankId: string) => deleteBank(bankId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-banks'] });
      setDeletingBankId(null);
    },
  });

  // Set primary bank mutation
  const setPrimaryMutation = useMutation({
    mutationFn: (bankId: string) => {
      if (!iosUserProfile) throw new Error('No profile');
      return setPrimaryBank(iosUserProfile.id, bankId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-banks'] });
    },
  });

  if (!user || !iosUserProfile) {
    return <div className="loading-container">Loading...</div>;
  }

  const handleAddBank = (e: React.FormEvent) => {
    e.preventDefault();
    setBankError('');

    if (!newBankName.trim() || !newAccountNumber.trim() || !newAccountName.trim()) {
      setBankError('All fields are required');
      return;
    }

    addBankMutation.mutate({
      bank_name: newBankName.trim(),
      account_number: newAccountNumber.trim(),
      account_name: newAccountName.trim(),
    });
  };

  const handleDeleteBank = (bankId: string) => {
    deleteBankMutation.mutate(bankId);
  };

  // Daily target range is set by platform settings (not per-bank anymore)

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <button className="back-btn" onClick={() => navigate('/ios-user/dashboard')}>
          &larr; Back to Dashboard
        </button>
        <button className="logout-btn" onClick={signOut}>
          Logout
        </button>
      </header>

      <div className="profile-page-content">
        <div className="profile-hero">
          <div className="profile-avatar large">
            {iosUserProfile.full_name.charAt(0).toUpperCase()}
          </div>
          <h1>{iosUserProfile.full_name}</h1>
          <span className="profile-role-badge">iOS User</span>
        </div>

        <div className="profile-grid">
          {/* Account Information */}
          <div className="profile-card">
            <h2>Account Information</h2>
            <div className="profile-details">
              <div className="profile-row">
                <label>Email</label>
                <span>{user.email}</span>
              </div>
              <div className="profile-row">
                <label>Username</label>
                <span>{user.username}</span>
              </div>
              {user.phone_number && (
                <div className="profile-row">
                  <label>Phone Number</label>
                  <span>{user.phone_number}</span>
                </div>
              )}
              <div className="profile-row">
                <label>Member Since</label>
                <span>{new Date(user.created_at).toLocaleDateString('en-NG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div className="profile-row">
                <label>Account Status</label>
                <span className={`status-badge ${user.is_active ? 'verified' : 'suspended'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Apple ID Information */}
          <div className="profile-card">
            <h2>Apple ID Details</h2>
            <div className="profile-details">
              <div className="profile-row">
                <label>Apple ID Email</label>
                <span>{iosUserProfile.apple_id}</span>
              </div>
              <div className="profile-row">
                <label>Funding Status</label>
                <span className={iosUserProfile.is_funded ? 'funded' : 'not-funded'}>
                  {iosUserProfile.is_funded ? 'Funded' : 'Not Funded'}
                </span>
              </div>
              {iosUserProfile.is_funded && (
                <div className="profile-row">
                  <label>Current Funding</label>
                  <span className="highlight-amount">N{iosUserProfile.funding_amount.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Manager Information */}
          <div className="profile-card">
            <h2>My Manager</h2>
            <div className="profile-details">
              {managerProfile ? (
                <>
                  <div className="profile-row">
                    <label>Manager Name</label>
                    <span>{managerProfile.full_name}</span>
                  </div>
                  <div className="profile-row">
                    <label>Team Name</label>
                    <span>{managerProfile.team_name}</span>
                  </div>
                  <div className="profile-row">
                    <label>Manager Status</label>
                    <span className={`status-badge ${managerProfile.status}`}>
                      {managerProfile.status}
                    </span>
                  </div>
                </>
              ) : (
                <p className="empty-text">No manager assigned</p>
              )}
            </div>
          </div>

          {/* Earnings Info */}
          <div className="profile-card highlight-card">
            <h2>Earnings</h2>
            <div className="target-display">
              <div className="target-number">N{earningsPerCard.toLocaleString()}</div>
              <div className="target-label">per approved card</div>
            </div>
            <div className="target-breakdown">
              <p>Daily target: <strong>{minDailyTransactions}-{maxDailyTransactions} cards</strong></p>
            </div>
            <div className="target-info">
              <p>Potential daily earnings: N{minDailyEarnings.toLocaleString()}-N{maxDailyEarnings.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Bank Accounts Section */}
        <div className="profile-card full-width">
          <div className="card-header with-action">
            <div>
              <h2>Bank Accounts ({banks.length})</h2>
              <p className="card-subtitle">Your registered bank accounts for receiving funds.</p>
            </div>
            <button className="add-bank-btn" onClick={() => setShowAddBank(true)}>
              + Add Bank
            </button>
          </div>

          {loadingBanks ? (
            <div className="loading">Loading banks...</div>
          ) : banks.length === 0 ? (
            <div className="empty-state">
              <p>No bank accounts registered yet. Add a bank to start receiving funds.</p>
              <button className="primary-btn" onClick={() => setShowAddBank(true)}>
                Add Your First Bank
              </button>
            </div>
          ) : (
            <div className="banks-grid">
              {banks.map((bank, index) => (
                <div key={bank.id} className={`bank-card ${bank.is_primary ? 'primary' : ''}`}>
                  {bank.is_primary && <span className="primary-label">Primary</span>}
                  <div className="bank-icon">
                    {index + 1}
                  </div>
                  <div className="bank-details">
                    <h4>{bank.bank_name}</h4>
                    <p className="account-number">{bank.account_number}</p>
                    <p className="account-name">{bank.account_name}</p>
                  </div>
                  <div className="bank-actions">
                    <div className="bank-buttons">
                      {!bank.is_primary && (
                        <button
                          className="set-primary-btn"
                          onClick={() => setPrimaryMutation.mutate(bank.id)}
                          disabled={setPrimaryMutation.isPending}
                          title="Set as primary"
                        >
                          Set Primary
                        </button>
                      )}
                      <button
                        className="delete-bank-btn"
                        onClick={() => setDeletingBankId(bank.id)}
                        disabled={deleteBankMutation.isPending}
                        title="Delete bank"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registration Summary */}
        <div className="profile-card full-width">
          <h2>Registration Summary</h2>
          <div className="registration-timeline">
            <div className="timeline-item completed">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Account Created</h4>
                <p>{new Date(user.created_at).toLocaleDateString('en-NG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
              </div>
            </div>
            <div className="timeline-item completed">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Profile Completed</h4>
                <p>Apple ID: {iosUserProfile.apple_id}</p>
              </div>
            </div>
            <div className={`timeline-item ${banks.length > 0 ? 'completed' : 'pending'}`}>
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Banks Registered</h4>
                <p>{banks.length > 0 ? `${banks.length} bank account${banks.length !== 1 ? 's' : ''} added` : 'Add a bank account'}</p>
              </div>
            </div>
            <div className={`timeline-item ${managerProfile ? 'completed' : 'pending'}`}>
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Joined Team</h4>
                <p>{managerProfile ? `Team: ${managerProfile.team_name}` : 'Pending manager assignment'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Bank Modal */}
      {showAddBank && (
        <div className="modal-overlay" onClick={() => setShowAddBank(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Bank Account</h3>
            <p className="modal-subtitle">Add a bank account to receive funding for gift card purchases.</p>

            <form onSubmit={handleAddBank}>
              <div className="form-group">
                <label htmlFor="bankName">Bank Name</label>
                <select
                  id="bankName"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  required
                >
                  <option value="">Select a bank</option>
                  {systemBanks.map(bank => (
                    <option key={bank.id} value={bank.name}>{bank.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="accountNumber">Account Number</label>
                <input
                  id="accountNumber"
                  type="text"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  placeholder="10-digit account number"
                  maxLength={10}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="accountName">Account Name</label>
                <input
                  id="accountName"
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Name on the account"
                  required
                />
              </div>

              {bankError && <p className="error-msg">{bankError}</p>}

              <div className="modal-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={addBankMutation.isPending}
                >
                  {addBankMutation.isPending ? 'Adding...' : 'Add Bank'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowAddBank(false);
                    setBankError('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBankId && (
        <div className="modal-overlay" onClick={() => setDeletingBankId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Bank Account?</h3>
            <p>Are you sure you want to remove this bank account?</p>

            {banks.length === 1 && (
              <div className="warning-banner">
                <p>This is your only bank account. You need at least one bank to receive funds.</p>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="reject-btn"
                onClick={() => handleDeleteBank(deletingBankId)}
                disabled={deleteBankMutation.isPending}
              >
                {deleteBankMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                className="secondary-btn"
                onClick={() => setDeletingBankId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
