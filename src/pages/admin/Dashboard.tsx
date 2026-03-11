import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getAllManagers, getPendingManagerVerifications, verifyManager, suspendManager, getTeamMembers } from '../../api/managers';
import { getAllIOSUserProfiles, updateUserFunding, isUserAvailable, getAllAdmins, createAdmin, getUserBanks, getAllUsers } from '../../api/users';
import {
  verifyTransactionByAdmin,
  rejectTransactionByAdmin,
  getManagerTransactionsWithDetails
} from '../../api/transactions';
import { getSystemBanks, addSystemBank, toggleSystemBankStatus, deleteSystemBank } from '../../api/systemBanks';
import type { TransactionWithDetails, IOSUserProfile, ManagerProfile } from '../../types';

export default function AdminDashboard() {
  useNavigate(); // Keep router context active
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'managers' | 'users' | 'transactions' | 'banks' | 'admins'>('overview');

  // New admin form
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [fundingUser, setFundingUser] = useState<IOSUserProfile | null>(null);
  const [fundingAmount, setFundingAmount] = useState('');
  const [userFilter, setUserFilter] = useState<'all' | 'available' | 'funded' | 'unfunded'>('all');

  // Profile viewing state
  const [selectedUserProfile, setSelectedUserProfile] = useState<IOSUserProfile | null>(null);
  const [selectedManagerProfile, setSelectedManagerProfile] = useState<ManagerProfile | null>(null);

  // Bank management state
  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [bankError, setBankError] = useState('');

  const { data: allAdmins = [] } = useQuery({
    queryKey: ['all-admins'],
    queryFn: getAllAdmins,
  });

  // System banks query
  const { data: systemBanks = [], isLoading: loadingSystemBanks } = useQuery({
    queryKey: ['system-banks-admin'],
    queryFn: () => getSystemBanks(true), // Include inactive banks for admin
  });

  // System bank mutations
  const addBankMutation = useMutation({
    mutationFn: (name: string) => addSystemBank(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-banks-admin'] });
      queryClient.invalidateQueries({ queryKey: ['system-banks'] });
      setShowAddBank(false);
      setNewBankName('');
      setBankError('');
    },
    onError: (error) => {
      setBankError(error instanceof Error ? error.message : 'Failed to add bank');
    },
  });

  const toggleBankMutation = useMutation({
    mutationFn: ({ bankId, isActive }: { bankId: string; isActive: boolean }) =>
      toggleSystemBankStatus(bankId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-banks-admin'] });
      queryClient.invalidateQueries({ queryKey: ['system-banks'] });
    },
  });

  const deleteBankMutation = useMutation({
    mutationFn: (bankId: string) => deleteSystemBank(bankId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-banks-admin'] });
      queryClient.invalidateQueries({ queryKey: ['system-banks'] });
    },
  });

  const { data: allManagers = [] } = useQuery({
    queryKey: ['all-managers'],
    queryFn: getAllManagers,
  });

  const { data: pendingManagers = [], isLoading: loadingPendingManagers } = useQuery({
    queryKey: ['pending-managers'],
    queryFn: getPendingManagerVerifications,
  });

  const { data: iosUsers = [] } = useQuery({
    queryKey: ['all-ios-users'],
    queryFn: getAllIOSUserProfiles,
  });

  // Get all transactions pending admin verification with full details
  const { data: pendingTransactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['admin-pending-transactions-detailed'],
    queryFn: async () => {
      // Get transactions with details from all managers
      const allTxPromises = allManagers.map(m =>
        getManagerTransactionsWithDetails(m.id, { status: 'pending_admin' })
      );
      const results = await Promise.all(allTxPromises);
      return results.flat();
    },
    enabled: allManagers.length > 0,
  });

  // Get all base users for profile lookup
  const { data: allBaseUsers = [] } = useQuery({
    queryKey: ['all-base-users'],
    queryFn: getAllUsers,
  });

  // Get banks for selected user profile
  const { data: selectedUserBanks = [] } = useQuery({
    queryKey: ['user-banks', selectedUserProfile?.id],
    queryFn: () => selectedUserProfile ? getUserBanks(selectedUserProfile.id) : [],
    enabled: !!selectedUserProfile,
  });

  // Get team members for selected manager profile
  const { data: selectedManagerTeam = [] } = useQuery({
    queryKey: ['manager-team', selectedManagerProfile?.id],
    queryFn: () => selectedManagerProfile ? getTeamMembers(selectedManagerProfile.id) : [],
    enabled: !!selectedManagerProfile,
  });

  // Helper to find base user for a profile
  const getBaseUserForProfile = (profileUserId: string) => {
    return allBaseUsers.find(u => u.id === profileUserId);
  };

  // Helper to find manager for an iOS user
  const getManagerForUser = (managerId: string) => {
    return allManagers.find(m => m.id === managerId);
  };

  const verifyManagerMutation = useMutation({
    mutationFn: (profileId: string) => {
      if (!user) throw new Error('Not authenticated');
      return verifyManager(profileId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-managers'] });
      queryClient.invalidateQueries({ queryKey: ['all-managers'] });
    },
  });

  const suspendManagerMutation = useMutation({
    mutationFn: suspendManager,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-managers'] });
    },
  });

  const verifyTransactionMutation = useMutation({
    mutationFn: (transactionId: string) => {
      if (!user) throw new Error('Not authenticated');
      return verifyTransactionByAdmin(transactionId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-transactions-detailed'] });
      setSelectedTransaction(null);
    },
  });

  const rejectTransactionMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => {
      if (!user) throw new Error('Not authenticated');
      return rejectTransactionByAdmin(transactionId, user.id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-transactions-detailed'] });
      setSelectedTransaction(null);
      setShowRejectModal(false);
      setRejectReason('');
    },
  });

  const fundUserMutation = useMutation({
    mutationFn: ({ profileId, amount }: { profileId: string; amount: number }) =>
      updateUserFunding(profileId, true, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ios-users'] });
      setFundingUser(null);
      setFundingAmount('');
    },
  });

  const unfundUserMutation = useMutation({
    mutationFn: (profileId: string) => updateUserFunding(profileId, false, 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ios-users'] });
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: (data: { email: string; username: string; password: string }) =>
      createAdmin(data.email, data.username, data.password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-admins'] });
      setNewAdminEmail('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      setShowCreateAdmin(false);
    },
  });

  if (!user) {
    return <div className="loading-container">Loading...</div>;
  }

  const handleReject = () => {
    if (selectedTransaction && rejectReason.trim()) {
      rejectTransactionMutation.mutate({
        transactionId: selectedTransaction.id,
        reason: rejectReason.trim()
      });
    }
  };

  const handleFundUser = () => {
    if (fundingUser && fundingAmount && Number(fundingAmount) > 0) {
      fundUserMutation.mutate({
        profileId: fundingUser.id,
        amount: Number(fundingAmount)
      });
    }
  };

  // Filter users based on selection
  const filteredUsers = iosUsers.filter(u => {
    const available = isUserAvailable(u);
    switch (userFilter) {
      case 'available': return available;
      case 'funded': return u.is_funded;
      case 'unfunded': return !u.is_funded;
      default: return true;
    }
  });

  const availableCount = iosUsers.filter(u => isUserAvailable(u)).length;
  const fundedCount = iosUsers.filter(u => u.is_funded).length;

  const stats = {
    totalManagers: allManagers.length,
    pendingManagerVerifications: pendingManagers.length,
    pendingTransactionReviews: pendingTransactions.length,
    totalIOSUsers: iosUsers.length,
    availableUsers: availableCount,
    fundedUsers: fundedCount,
  };

  return (
    <div className="dashboard admin-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Route.ng Admin</h1>
          <p>Welcome, {user.username}</p>
        </div>
        <button className="logout-btn" onClick={signOut}>
          Logout
        </button>
      </header>

      <div className="stats">
        <div className="stat-card">
          <h3>Total Managers</h3>
          <p className="stat-number">{stats.totalManagers}</p>
        </div>

        <div className="stat-card highlight">
          <h3>Pending Verifications</h3>
          <p className="stat-number">{stats.pendingManagerVerifications}</p>
        </div>

        <div className="stat-card highlight">
          <h3>Pending Transactions</h3>
          <p className="stat-number">{stats.pendingTransactionReviews}</p>
        </div>

        <div className="stat-card">
          <h3>iOS Users</h3>
          <p className="stat-number">{stats.totalIOSUsers}</p>
        </div>

        <div className="stat-card">
          <h3>Available Now</h3>
          <p className="stat-number available-count">{stats.availableUsers}</p>
        </div>

        <div className="stat-card">
          <h3>Funded Users</h3>
          <p className="stat-number">{stats.fundedUsers}</p>
        </div>
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={activeTab === 'managers' ? 'active' : ''}
          onClick={() => setActiveTab('managers')}
        >
          Managers ({allManagers.length})
        </button>
        <button
          className={activeTab === 'users' ? 'active' : ''}
          onClick={() => setActiveTab('users')}
        >
          iOS Users ({iosUsers.length})
        </button>
        <button
          className={activeTab === 'transactions' ? 'active' : ''}
          onClick={() => setActiveTab('transactions')}
        >
          Transactions ({pendingTransactions.length})
        </button>
        <button
          className={activeTab === 'admins' ? 'active' : ''}
          onClick={() => setActiveTab('admins')}
        >
          Admins ({allAdmins.length})
        </button>
        <button
          className={activeTab === 'banks' ? 'active' : ''}
          onClick={() => setActiveTab('banks')}
        >
          Banks ({systemBanks.filter(b => b.is_active).length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h2>Pending Manager Verifications</h2>
            {loadingPendingManagers ? (
              <div className="loading">Loading...</div>
            ) : pendingManagers.length === 0 ? (
              <div className="empty-state">
                <p>No pending manager verifications.</p>
              </div>
            ) : (
              <div className="pending-list">
                {pendingManagers.map(manager => (
                  <div key={manager.id} className="pending-card">
                    <div className="pending-info">
                      <h4>{manager.full_name}</h4>
                      <p>Team: {manager.team_name}</p>
                      <p className="date">
                        Applied: {new Date(manager.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="pending-actions">
                      <button
                        className="approve-btn"
                        onClick={() => verifyManagerMutation.mutate(manager.id)}
                        disabled={verifyManagerMutation.isPending}
                      >
                        Verify
                      </button>
                      <button
                        className="reject-btn"
                        onClick={() => suspendManagerMutation.mutate(manager.id)}
                        disabled={suspendManagerMutation.isPending}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h2>Pending Transaction Verifications</h2>
            {loadingTransactions ? (
              <div className="loading">Loading...</div>
            ) : pendingTransactions.length === 0 ? (
              <div className="empty-state">
                <p>No pending transactions to verify.</p>
              </div>
            ) : (
              <div className="reviews-list">
                {pendingTransactions.slice(0, 5).map(tx => (
                  <div
                    key={tx.id}
                    className="review-card clickable"
                    onClick={() => setSelectedTransaction(tx)}
                  >
                    {tx.proof_image_url && (
                      <img
                        src={tx.proof_image_url}
                        alt="Proof"
                        className="review-thumbnail"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxImage(tx.proof_image_url!);
                        }}
                      />
                    )}
                    <div className="review-info">
                      <div className="review-user">
                        <strong>{tx.ios_user?.full_name || 'Unknown User'}</strong>
                      </div>
                      <div className="review-details">
                        <span className="review-amount">
                          N{tx.gift_card_amount.toLocaleString()}
                        </span>
                        <span className="review-cards">
                          {tx.receipt_count} card{tx.receipt_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <span className="status-badge pending_admin">Manager Approved</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'managers' && (
          <div className="managers-section">
            <h2>All Managers</h2>
            {allManagers.length === 0 ? (
              <div className="empty-state">
                <p>No managers registered yet.</p>
              </div>
            ) : (
              <div className="managers-list">
                {allManagers.map(manager => {
                  const baseUser = getBaseUserForProfile(manager.user_id);
                  return (
                    <div key={manager.id} className="manager-card clickable">
                      <div
                        className="manager-info"
                        onClick={() => setSelectedManagerProfile(manager)}
                        style={{ cursor: 'pointer', flex: 1 }}
                      >
                        <h4>{manager.full_name}</h4>
                        <p>Team: {manager.team_name}</p>
                        {baseUser && <p>Email: {baseUser.email}</p>}
                        <p>Commission: {(manager.commission_rate * 100).toFixed(1)}%</p>
                        <p>Referral Code: <strong>{manager.referral_code}</strong></p>
                      </div>
                      <div className="manager-actions">
                        <button
                          className="view-profile-btn small"
                          onClick={() => setSelectedManagerProfile(manager)}
                        >
                          View Profile
                        </button>
                        <div className="manager-status">
                          <span className={`status-badge ${manager.status}`}>
                            {manager.status}
                          </span>
                          {manager.status === 'pending' && (
                            <button
                              className="approve-btn small"
                              onClick={(e) => {
                                e.stopPropagation();
                                verifyManagerMutation.mutate(manager.id);
                              }}
                            >
                              Verify
                            </button>
                          )}
                          {manager.status === 'verified' && (
                            <button
                              className="reject-btn small"
                              onClick={(e) => {
                                e.stopPropagation();
                                suspendManagerMutation.mutate(manager.id);
                              }}
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-section">
            <div className="section-header">
              <h2>iOS Users</h2>
              <div className="filter-buttons">
                <button
                  className={userFilter === 'all' ? 'active' : ''}
                  onClick={() => setUserFilter('all')}
                >
                  All ({iosUsers.length})
                </button>
                <button
                  className={userFilter === 'available' ? 'active' : ''}
                  onClick={() => setUserFilter('available')}
                >
                  Available ({availableCount})
                </button>
                <button
                  className={userFilter === 'funded' ? 'active' : ''}
                  onClick={() => setUserFilter('funded')}
                >
                  Funded ({fundedCount})
                </button>
                <button
                  className={userFilter === 'unfunded' ? 'active' : ''}
                  onClick={() => setUserFilter('unfunded')}
                >
                  Unfunded ({iosUsers.length - fundedCount})
                </button>
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="empty-state">
                <p>No users match this filter.</p>
              </div>
            ) : (
              <div className="users-list">
                {filteredUsers.map(iosUser => {
                  const available = isUserAvailable(iosUser);
                  const userManager = getManagerForUser(iosUser.manager_id);
                  return (
                    <div key={iosUser.id} className={`user-card clickable ${available ? 'user-available' : ''}`}>
                      <div className="user-availability-indicator">
                        <span className={`availability-dot ${available ? 'online' : 'offline'}`} />
                      </div>
                      <div
                        className="user-info"
                        onClick={() => setSelectedUserProfile(iosUser)}
                        style={{ cursor: 'pointer', flex: 1 }}
                      >
                        <h4>{iosUser.full_name}</h4>
                        <p>Apple ID: {iosUser.apple_id}</p>
                        {userManager && (
                          <p className="user-manager">Manager: {userManager.full_name}</p>
                        )}
                        <span className={`availability-status ${available ? 'available' : 'unavailable'}`}>
                          {available ? 'Available for work' : 'Unavailable'}
                        </span>
                      </div>
                      <div className="user-actions">
                        <button
                          className="view-profile-btn small"
                          onClick={() => setSelectedUserProfile(iosUser)}
                        >
                          View Profile
                        </button>
                        {iosUser.is_funded ? (
                          <div className="funded-info">
                            <span className="funded">
                              Funded: N{iosUser.funding_amount.toLocaleString()}
                            </span>
                            <button
                              className="unfund-btn small"
                              onClick={(e) => {
                                e.stopPropagation();
                                unfundUserMutation.mutate(iosUser.id);
                              }}
                              disabled={unfundUserMutation.isPending}
                            >
                              Remove Funding
                            </button>
                          </div>
                        ) : (
                          <button
                            className="fund-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFundingUser(iosUser);
                            }}
                            disabled={!available}
                            title={!available ? 'User must be available to receive funding' : ''}
                          >
                            Fund User
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'transactions' && (
          <div className="transactions-section">
            {selectedTransaction ? (
              // Detailed Transaction View
              <div className="transaction-detail">
                <button
                  className="back-btn"
                  onClick={() => setSelectedTransaction(null)}
                >
                  &larr; Back to List
                </button>

                <div className="admin-review-badge">
                  Manager has approved this transaction. Final verification required.
                </div>

                <div className="detail-section">
                  <h3>User Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Full Name</label>
                      <span>{selectedTransaction.ios_user?.full_name || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Apple ID</label>
                      <span>{selectedTransaction.ios_user?.apple_id || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Funding Amount</label>
                      <span>
                        {selectedTransaction.ios_user?.is_funded
                          ? `N${selectedTransaction.ios_user.funding_amount.toLocaleString()}`
                          : 'Not Funded'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Bank Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Bank Name</label>
                      <span>{selectedTransaction.bank?.bank_name || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Account Number</label>
                      <span>{selectedTransaction.bank?.account_number || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Account Name</label>
                      <span>{selectedTransaction.bank?.account_name || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Transaction Details</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Number of Cards</label>
                      <span>{selectedTransaction.receipt_count}</span>
                    </div>
                    <div className="detail-item">
                      <label>Amount Per Card</label>
                      <span>N{selectedTransaction.card_amount.toLocaleString()}</span>
                    </div>
                    <div className="detail-item highlight">
                      <label>Total Amount</label>
                      <span>N{selectedTransaction.gift_card_amount.toLocaleString()}</span>
                    </div>
                    <div className="detail-item">
                      <label>Recipient Address</label>
                      <span>{selectedTransaction.recipient_address || 'Not provided'}</span>
                    </div>
                    <div className="detail-item">
                      <label>Manager Approved</label>
                      <span>{selectedTransaction.manager_reviewed_at
                        ? new Date(selectedTransaction.manager_reviewed_at).toLocaleString()
                        : 'N/A'}</span>
                    </div>
                  </div>

                  {selectedTransaction.shortfall_reason && (
                    <div className="shortfall-note">
                      <label>Shortfall Explanation:</label>
                      <p>{selectedTransaction.shortfall_reason}</p>
                    </div>
                  )}
                </div>

                {selectedTransaction.proof_image_url && (
                  <div className="detail-section">
                    <h3>Proof Screenshot</h3>
                    <p className="helper-text">Click image to view full size</p>
                    <img
                      src={selectedTransaction.proof_image_url}
                      alt="Transaction proof"
                      className="proof-image clickable"
                      onClick={() => setLightboxImage(selectedTransaction.proof_image_url!)}
                    />
                  </div>
                )}

                <div className="review-actions-large">
                  <button
                    className="approve-btn"
                    onClick={() => verifyTransactionMutation.mutate(selectedTransaction.id)}
                    disabled={verifyTransactionMutation.isPending}
                  >
                    {verifyTransactionMutation.isPending ? 'Verifying...' : 'Verify Transaction'}
                  </button>
                  <button
                    className="reject-btn"
                    onClick={() => setShowRejectModal(true)}
                  >
                    Reject Transaction
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2>Pending Admin Verification</h2>
                <p className="subtitle">These transactions have been approved by managers and need final verification.</p>

                {loadingTransactions ? (
                  <div className="loading">Loading...</div>
                ) : pendingTransactions.length === 0 ? (
                  <div className="empty-state">
                    <p>No transactions pending verification.</p>
                  </div>
                ) : (
                  <div className="reviews-list">
                    {pendingTransactions.map(tx => (
                      <div
                        key={tx.id}
                        className="review-card clickable"
                        onClick={() => setSelectedTransaction(tx)}
                      >
                        {tx.proof_image_url && (
                          <img
                            src={tx.proof_image_url}
                            alt="Proof"
                            className="review-thumbnail"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxImage(tx.proof_image_url!);
                            }}
                          />
                        )}
                        <div className="review-info">
                          <div className="review-user">
                            <strong>{tx.ios_user?.full_name || 'Unknown User'}</strong>
                            <span className="review-meta">{tx.ios_user?.apple_id}</span>
                          </div>
                          <div className="review-details">
                            <span className="review-amount">
                              N{tx.gift_card_amount.toLocaleString()}
                            </span>
                            <span className="review-cards">
                              {tx.receipt_count} card{tx.receipt_count !== 1 ? 's' : ''}
                            </span>
                            <span className="review-date">
                              {new Date(tx.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="review-actions">
                          <button
                            className="approve-btn small"
                            onClick={(e) => {
                              e.stopPropagation();
                              verifyTransactionMutation.mutate(tx.id);
                            }}
                          >
                            Verify
                          </button>
                          <button
                            className="reject-btn small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTransaction(tx);
                              setShowRejectModal(true);
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'admins' && (
          <div className="admins-section">
            <div className="section-header">
              <h2>System Administrators</h2>
              <button
                className="add-admin-btn"
                onClick={() => setShowCreateAdmin(true)}
              >
                + Add Admin
              </button>
            </div>

            {allAdmins.length === 0 ? (
              <div className="empty-state">
                <p>No administrators found.</p>
              </div>
            ) : (
              <div className="admins-list">
                {allAdmins.map(admin => (
                  <div key={admin.id} className="admin-card">
                    <div className="admin-info">
                      <h4>{admin.username}</h4>
                      <p>{admin.email}</p>
                      <span className="admin-joined">
                        Joined: {new Date(admin.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="admin-status">
                      <span className={`status-badge ${admin.is_active ? 'active' : 'inactive'}`}>
                        {admin.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create Admin Modal */}
            {showCreateAdmin && (
              <div className="modal-overlay" onClick={() => setShowCreateAdmin(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h3>Create New Administrator</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    createAdminMutation.mutate({
                      email: newAdminEmail,
                      username: newAdminUsername,
                      password: newAdminPassword,
                    });
                  }}>
                    <div className="form-group">
                      <label>Email</label>
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="admin@route.ng"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Username</label>
                      <input
                        type="text"
                        value={newAdminUsername}
                        onChange={(e) => setNewAdminUsername(e.target.value)}
                        placeholder="adminuser"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Password</label>
                      <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="Secure password"
                        required
                        minLength={8}
                      />
                    </div>
                    {createAdminMutation.isError && (
                      <p className="error-msg">
                        {createAdminMutation.error instanceof Error
                          ? createAdminMutation.error.message
                          : 'Failed to create admin'}
                      </p>
                    )}
                    <div className="modal-actions">
                      <button
                        type="submit"
                        className="approve-btn"
                        disabled={createAdminMutation.isPending}
                      >
                        {createAdminMutation.isPending ? 'Creating...' : 'Create Admin'}
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          setShowCreateAdmin(false);
                          setNewAdminEmail('');
                          setNewAdminUsername('');
                          setNewAdminPassword('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'banks' && (
          <div className="banks-section">
            <div className="section-header">
              <h2>System Banks</h2>
              <button
                className="add-bank-btn"
                onClick={() => setShowAddBank(true)}
              >
                + Add Bank
              </button>
            </div>

            <p className="section-description">
              Manage the list of banks available across the platform. Users can only select from active banks when registering or adding bank accounts.
            </p>

            {loadingSystemBanks ? (
              <div className="loading">Loading banks...</div>
            ) : systemBanks.length === 0 ? (
              <div className="empty-state">
                <p>No banks configured yet. Add banks to enable user registration.</p>
              </div>
            ) : (
              <div className="system-banks-list">
                {systemBanks.map(bank => (
                  <div key={bank.id} className={`system-bank-card ${!bank.is_active ? 'inactive' : ''}`}>
                    <div className="bank-info">
                      <h4>{bank.name}</h4>
                      <span className={`status-badge ${bank.is_active ? 'active' : 'inactive'}`}>
                        {bank.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="bank-actions">
                      <button
                        className={bank.is_active ? 'deactivate-btn small' : 'activate-btn small'}
                        onClick={() => toggleBankMutation.mutate({
                          bankId: bank.id,
                          isActive: !bank.is_active
                        })}
                        disabled={toggleBankMutation.isPending}
                      >
                        {bank.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="delete-btn small"
                        onClick={() => {
                          if (window.confirm(`Delete "${bank.name}"? This cannot be undone.`)) {
                            deleteBankMutation.mutate(bank.id);
                          }
                        }}
                        disabled={deleteBankMutation.isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Bank Modal */}
            {showAddBank && (
              <div className="modal-overlay" onClick={() => setShowAddBank(false)}>
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <h3>Add New Bank</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (newBankName.trim()) {
                      addBankMutation.mutate(newBankName.trim());
                    }
                  }}>
                    <div className="form-group">
                      <label>Bank Name</label>
                      <input
                        type="text"
                        value={newBankName}
                        onChange={(e) => setNewBankName(e.target.value)}
                        placeholder="e.g., Zenith Bank"
                        required
                      />
                    </div>
                    {bankError && <p className="error-msg">{bankError}</p>}
                    <div className="modal-actions">
                      <button
                        type="submit"
                        className="approve-btn"
                        disabled={addBankMutation.isPending || !newBankName.trim()}
                      >
                        {addBankMutation.isPending ? 'Adding...' : 'Add Bank'}
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          setShowAddBank(false);
                          setNewBankName('');
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
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedTransaction && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Transaction</h3>
            <p>
              Rejecting transaction from <strong>{selectedTransaction.ios_user?.full_name}</strong> for{' '}
              <strong>N{selectedTransaction.gift_card_amount.toLocaleString()}</strong>
            </p>
            <div className="warning-banner">
              <p>This rejection will be flagged against both the user and their manager.</p>
            </div>
            <div className="form-group">
              <label>Reason for rejection:</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a detailed reason..."
                rows={4}
                required
              />
            </div>
            <div className="modal-actions">
              <button
                className="reject-btn"
                onClick={handleReject}
                disabled={!rejectReason.trim() || rejectTransactionMutation.isPending}
              >
                {rejectTransactionMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Funding Modal */}
      {fundingUser && (
        <div className="modal-overlay" onClick={() => setFundingUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Fund User</h3>
            <p>
              Funding <strong>{fundingUser.full_name}</strong>
            </p>
            <div className="form-group">
              <label>Funding Amount (NGN):</label>
              <input
                type="number"
                value={fundingAmount}
                onChange={(e) => setFundingAmount(e.target.value)}
                placeholder="e.g., 50000"
                min="1"
              />
            </div>
            <div className="modal-actions">
              <button
                className="fund-btn"
                onClick={handleFundUser}
                disabled={!fundingAmount || Number(fundingAmount) <= 0 || fundUserMutation.isPending}
              >
                {fundUserMutation.isPending ? 'Funding...' : `Fund N${Number(fundingAmount || 0).toLocaleString()}`}
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  setFundingUser(null);
                  setFundingAmount('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <button className="lightbox-close" onClick={() => setLightboxImage(null)}>
            &times;
          </button>
          <img
            src={lightboxImage}
            alt="Full size proof"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* iOS User Profile Modal */}
      {selectedUserProfile && (
        <div className="modal-overlay" onClick={() => setSelectedUserProfile(null)}>
          <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedUserProfile(null)}>
              &times;
            </button>
            <div className="profile-modal-content">
              <div className="profile-header">
                <div className="profile-avatar">
                  {selectedUserProfile.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-name">
                  <h3>{selectedUserProfile.full_name}</h3>
                  <span className="profile-role">iOS User</span>
                  <span className={`availability-status ${isUserAvailable(selectedUserProfile) ? 'available' : 'unavailable'}`}>
                    {isUserAvailable(selectedUserProfile) ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Account Information</h4>
                <div className="profile-details">
                  {(() => {
                    const baseUser = getBaseUserForProfile(selectedUserProfile.user_id);
                    return (
                      <>
                        <div className="profile-row">
                          <label>Email</label>
                          <span>{baseUser?.email || 'N/A'}</span>
                        </div>
                        <div className="profile-row">
                          <label>Username</label>
                          <span>{baseUser?.username || 'N/A'}</span>
                        </div>
                        <div className="profile-row">
                          <label>Phone</label>
                          <span>{baseUser?.phone_number || 'Not provided'}</span>
                        </div>
                        <div className="profile-row">
                          <label>Member Since</label>
                          <span>{baseUser ? new Date(baseUser.created_at).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </>
                    );
                  })()}
                  <div className="profile-row">
                    <label>Apple ID</label>
                    <span>{selectedUserProfile.apple_id}</span>
                  </div>
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Manager</h4>
                <div className="profile-details">
                  {(() => {
                    const manager = getManagerForUser(selectedUserProfile.manager_id);
                    return (
                      <>
                        <div className="profile-row">
                          <label>Manager Name</label>
                          <span>{manager?.full_name || 'N/A'}</span>
                        </div>
                        <div className="profile-row">
                          <label>Team</label>
                          <span>{manager?.team_name || 'N/A'}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Funding Status</h4>
                <div className="profile-details">
                  <div className="profile-row">
                    <label>Status</label>
                    <span className={selectedUserProfile.is_funded ? 'funded' : 'not-funded'}>
                      {selectedUserProfile.is_funded ? 'Funded' : 'Not Funded'}
                    </span>
                  </div>
                  {selectedUserProfile.is_funded && (
                    <div className="profile-row">
                      <label>Amount</label>
                      <span>N{selectedUserProfile.funding_amount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="profile-row">
                    <label>Daily Target</label>
                    <span>{selectedUserProfile.daily_transaction_target} transactions</span>
                  </div>
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Bank Accounts ({selectedUserBanks.length})</h4>
                {selectedUserBanks.length === 0 ? (
                  <p className="empty-text">No bank accounts on file</p>
                ) : (
                  <div className="banks-list-compact">
                    {selectedUserBanks.map(bank => (
                      <div key={bank.id} className="bank-item-compact">
                        <span className="bank-name">{bank.bank_name}</span>
                        <span className="bank-account">{bank.account_number}</span>
                        <span className="bank-holder">{bank.account_name}</span>
                        {bank.is_primary && <span className="primary-badge">Primary</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="profile-actions">
                {!selectedUserProfile.is_funded && isUserAvailable(selectedUserProfile) && (
                  <button
                    className="fund-btn"
                    onClick={() => {
                      setFundingUser(selectedUserProfile);
                      setSelectedUserProfile(null);
                    }}
                  >
                    Fund This User
                  </button>
                )}
                {selectedUserProfile.is_funded && (
                  <button
                    className="unfund-btn"
                    onClick={() => {
                      unfundUserMutation.mutate(selectedUserProfile.id);
                      setSelectedUserProfile(null);
                    }}
                  >
                    Remove Funding
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manager Profile Modal */}
      {selectedManagerProfile && (
        <div className="modal-overlay" onClick={() => setSelectedManagerProfile(null)}>
          <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedManagerProfile(null)}>
              &times;
            </button>
            <div className="profile-modal-content">
              <div className="profile-header">
                <div className="profile-avatar manager">
                  {selectedManagerProfile.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-name">
                  <h3>{selectedManagerProfile.full_name}</h3>
                  <span className="profile-role">Manager</span>
                  <span className={`status-badge ${selectedManagerProfile.status}`}>
                    {selectedManagerProfile.status}
                  </span>
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Account Information</h4>
                <div className="profile-details">
                  {(() => {
                    const baseUser = getBaseUserForProfile(selectedManagerProfile.user_id);
                    return (
                      <>
                        <div className="profile-row">
                          <label>Email</label>
                          <span>{baseUser?.email || 'N/A'}</span>
                        </div>
                        <div className="profile-row">
                          <label>Username</label>
                          <span>{baseUser?.username || 'N/A'}</span>
                        </div>
                        <div className="profile-row">
                          <label>Phone</label>
                          <span>{baseUser?.phone_number || 'Not provided'}</span>
                        </div>
                        <div className="profile-row">
                          <label>Member Since</label>
                          <span>{baseUser ? new Date(baseUser.created_at).toLocaleDateString() : 'N/A'}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Manager Details</h4>
                <div className="profile-details">
                  <div className="profile-row">
                    <label>Team Name</label>
                    <span>{selectedManagerProfile.team_name}</span>
                  </div>
                  <div className="profile-row">
                    <label>Referral Code</label>
                    <span className="highlight">{selectedManagerProfile.referral_code}</span>
                  </div>
                  <div className="profile-row">
                    <label>Commission Rate</label>
                    <span>{(selectedManagerProfile.commission_rate * 100).toFixed(1)}%</span>
                  </div>
                  {selectedManagerProfile.verified_at && (
                    <div className="profile-row">
                      <label>Verified On</label>
                      <span>{new Date(selectedManagerProfile.verified_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Team Members ({selectedManagerTeam.length})</h4>
                {selectedManagerTeam.length === 0 ? (
                  <p className="empty-text">No team members yet</p>
                ) : (
                  <div className="team-list-compact">
                    {selectedManagerTeam.map(member => (
                      <div
                        key={member.id}
                        className="team-member-compact"
                        onClick={() => {
                          setSelectedManagerProfile(null);
                          setSelectedUserProfile(member);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className={`availability-dot ${isUserAvailable(member) ? 'online' : 'offline'}`} />
                        <span className="member-name">{member.full_name}</span>
                        <span className="member-status">
                          {member.is_funded ? `Funded: N${member.funding_amount.toLocaleString()}` : 'Not Funded'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="profile-actions">
                {selectedManagerProfile.status === 'pending' && (
                  <button
                    className="approve-btn"
                    onClick={() => {
                      verifyManagerMutation.mutate(selectedManagerProfile.id);
                      setSelectedManagerProfile(null);
                    }}
                  >
                    Verify Manager
                  </button>
                )}
                {selectedManagerProfile.status === 'verified' && (
                  <button
                    className="reject-btn"
                    onClick={() => {
                      suspendManagerMutation.mutate(selectedManagerProfile.id);
                      setSelectedManagerProfile(null);
                    }}
                  >
                    Suspend Manager
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
