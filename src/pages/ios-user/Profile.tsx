import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getUserBanks, addBank, deleteBank, setPrimaryBank } from '../../api/users';
import { getManagerById, isHouseAccount } from '../../api/managers';
import { getSystemBanks } from '../../api/systemBanks';
import {
  getUserAppleIds,
  addAppleId,
  updateAppleIdLabel,
  setPrimaryAppleId,
  deleteAppleId
} from '../../api/appleIds';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import type { UserAppleId } from '../../types';

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

  // Apple ID management state
  const [showAddAppleId, setShowAddAppleId] = useState(false);
  const [newAppleIdEmail, setNewAppleIdEmail] = useState('');
  const [newAppleIdLabel, setNewAppleIdLabel] = useState('');
  const [appleIdError, setAppleIdError] = useState('');
  const [editingAppleId, setEditingAppleId] = useState<UserAppleId | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deletingAppleId, setDeletingAppleId] = useState<UserAppleId | null>(null);

  const { data: banks = [], isLoading: loadingBanks } = useQuery({
    queryKey: ['user-banks', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserBanks(iosUserProfile.id) : [],
    enabled: !!iosUserProfile,
  });

  // Apple IDs query
  const { data: appleIds = [], isLoading: loadingAppleIds } = useQuery({
    queryKey: ['user-apple-ids', user?.id],
    queryFn: () => user ? getUserAppleIds(user.id) : [],
    enabled: !!user,
  });

  const { data: managerProfile } = useQuery({
    queryKey: ['user-manager', iosUserProfile?.manager_id],
    queryFn: () => iosUserProfile?.manager_id ? getManagerById(iosUserProfile.manager_id) : null,
    enabled: !!iosUserProfile?.manager_id,
  });

  const isHouseMember = isHouseAccount(managerProfile ?? null);

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

  // Apple ID mutations
  const addAppleIdMutation = useMutation({
    mutationFn: ({ appleId, label }: { appleId: string; label?: string }) => {
      if (!user) throw new Error('No user');
      return addAppleId(user.id, appleId, label);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-apple-ids'] });
      setShowAddAppleId(false);
      setNewAppleIdEmail('');
      setNewAppleIdLabel('');
      setAppleIdError('');
    },
    onError: (error) => {
      setAppleIdError(error instanceof Error ? error.message : 'Failed to add Apple ID');
    },
  });

  const updateAppleIdLabelMutation = useMutation({
    mutationFn: ({ appleIdId, label }: { appleIdId: string; label: string }) =>
      updateAppleIdLabel(appleIdId, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-apple-ids'] });
      setEditingAppleId(null);
      setEditLabel('');
    },
  });

  const setPrimaryAppleIdMutation = useMutation({
    mutationFn: (appleIdId: string) => {
      if (!user) throw new Error('No user');
      return setPrimaryAppleId(user.id, appleIdId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-apple-ids'] });
    },
  });

  const deleteAppleIdMutation = useMutation({
    mutationFn: (appleIdId: string) => deleteAppleId(appleIdId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-apple-ids'] });
      setDeletingAppleId(null);
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

  const handleAddAppleId = (e: React.FormEvent) => {
    e.preventDefault();
    setAppleIdError('');

    if (!newAppleIdEmail.trim()) {
      setAppleIdError('Apple ID email is required');
      return;
    }

    // Basic email validation
    if (!newAppleIdEmail.includes('@')) {
      setAppleIdError('Please enter a valid Apple ID email');
      return;
    }

    addAppleIdMutation.mutate({
      appleId: newAppleIdEmail.trim(),
      label: newAppleIdLabel.trim() || undefined,
    });
  };

  const handleUpdateLabel = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAppleId) {
      updateAppleIdLabelMutation.mutate({
        appleIdId: editingAppleId.id,
        label: editLabel.trim(),
      });
    }
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

          {/* Funding Status */}
          <div className="profile-card">
            <h2>Funding Status</h2>
            <div className="profile-details">
              <div className="profile-row">
                <label>Status</label>
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

          {/* Manager/Team Information */}
          <div className="profile-card">
            <h2>{isHouseMember ? 'My Team' : 'My Manager'}</h2>
            <div className="profile-details">
              {isHouseMember ? (
                <>
                  <div className="profile-row">
                    <label>Team</label>
                    <span>Route.ng Direct</span>
                  </div>
                  <div className="profile-row">
                    <label>Status</label>
                    <span className="status-badge verified">Independent Partner</span>
                  </div>
                  <div className="profile-row">
                    <label>Type</label>
                    <span>Self-managed account</span>
                  </div>
                </>
              ) : managerProfile ? (
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

        {/* Apple IDs Section */}
        <div className="profile-card full-width">
          <div className="card-header with-action">
            <div>
              <h2>Apple IDs ({appleIds.length})</h2>
              <p className="card-subtitle">Manage your Apple IDs for logging transactions.</p>
            </div>
            <button className="add-bank-btn" onClick={() => setShowAddAppleId(true)}>
              + Add Apple ID
            </button>
          </div>

          {loadingAppleIds ? (
            <div className="loading">Loading Apple IDs...</div>
          ) : appleIds.length === 0 ? (
            <div className="empty-state">
              <p>No Apple IDs registered yet. Add an Apple ID to start logging transactions.</p>
              <button className="primary-btn" onClick={() => setShowAddAppleId(true)}>
                Add Your First Apple ID
              </button>
            </div>
          ) : (
            <div className="apple-ids-grid">
              {appleIds.map((appleId, index) => (
                <div key={appleId.id} className={`apple-id-card ${appleId.is_primary ? 'primary' : ''}`}>
                  {appleId.is_primary && <span className="primary-label">Primary</span>}
                  <div className="apple-id-icon">
                    {index + 1}
                  </div>
                  <div className="apple-id-details">
                    <h4>{appleId.apple_id}</h4>
                    <p className="apple-id-label">{appleId.label || 'No label'}</p>
                  </div>
                  <div className="apple-id-actions">
                    <div className="apple-id-buttons">
                      <button
                        className="edit-btn"
                        onClick={() => {
                          setEditingAppleId(appleId);
                          setEditLabel(appleId.label || '');
                        }}
                        title="Edit label"
                      >
                        Edit
                      </button>
                      {!appleId.is_primary && (
                        <button
                          className="set-primary-btn"
                          onClick={() => setPrimaryAppleIdMutation.mutate(appleId.id)}
                          disabled={setPrimaryAppleIdMutation.isPending}
                          title="Set as primary"
                        >
                          Set Primary
                        </button>
                      )}
                      {appleIds.length > 1 && (
                        <button
                          className="delete-bank-btn"
                          onClick={() => setDeletingAppleId(appleId)}
                          disabled={deleteAppleIdMutation.isPending}
                          title="Remove Apple ID"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                <h4>{isHouseMember ? 'Joined as Independent' : 'Joined Team'}</h4>
                <p>{isHouseMember
                  ? 'Route.ng Direct - Independent Partner'
                  : managerProfile
                    ? `Team: ${managerProfile.team_name}`
                    : 'Pending manager assignment'}</p>
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

      {/* Add Apple ID Modal */}
      {showAddAppleId && (
        <div className="modal-overlay" onClick={() => setShowAddAppleId(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Apple ID</h3>
            <p className="modal-subtitle">Add another Apple ID to use for transactions.</p>

            <form onSubmit={handleAddAppleId}>
              <div className="form-group">
                <label htmlFor="appleIdEmail">Apple ID Email</label>
                <input
                  id="appleIdEmail"
                  type="email"
                  value={newAppleIdEmail}
                  onChange={(e) => setNewAppleIdEmail(e.target.value)}
                  placeholder="example@icloud.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="appleIdLabel">Label (optional)</label>
                <input
                  id="appleIdLabel"
                  type="text"
                  value={newAppleIdLabel}
                  onChange={(e) => setNewAppleIdLabel(e.target.value)}
                  placeholder="e.g., iPhone 15 Pro, iPad Air"
                />
              </div>

              {appleIdError && <p className="error-msg">{appleIdError}</p>}

              <div className="modal-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={addAppleIdMutation.isPending}
                >
                  {addAppleIdMutation.isPending ? 'Adding...' : 'Add Apple ID'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowAddAppleId(false);
                    setAppleIdError('');
                    setNewAppleIdEmail('');
                    setNewAppleIdLabel('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Apple ID Label Modal */}
      {editingAppleId && (
        <div className="modal-overlay" onClick={() => setEditingAppleId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Apple ID Label</h3>
            <p className="modal-subtitle">Update the label for {editingAppleId.apple_id}</p>

            <form onSubmit={handleUpdateLabel}>
              <div className="form-group">
                <label htmlFor="editLabel">Label</label>
                <input
                  id="editLabel"
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  placeholder="e.g., iPhone 15 Pro, iPad Air"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={updateAppleIdLabelMutation.isPending}
                >
                  {updateAppleIdLabelMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setEditingAppleId(null);
                    setEditLabel('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Apple ID Confirmation Modal */}
      {deletingAppleId && (
        <div className="modal-overlay" onClick={() => setDeletingAppleId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Remove Apple ID?</h3>
            <p>Are you sure you want to remove <strong>{deletingAppleId.apple_id}</strong>?</p>

            {deletingAppleId.is_primary && (
              <div className="warning-banner">
                <p>This is your primary Apple ID. Another Apple ID will become primary.</p>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="reject-btn"
                onClick={() => deleteAppleIdMutation.mutate(deletingAppleId.id)}
                disabled={deleteAppleIdMutation.isPending}
              >
                {deleteAppleIdMutation.isPending ? 'Removing...' : 'Yes, Remove'}
              </button>
              <button
                className="secondary-btn"
                onClick={() => setDeletingAppleId(null)}
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
