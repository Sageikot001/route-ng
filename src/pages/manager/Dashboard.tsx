import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getManagerStats, getTeamMembers, getManagerInvites, createInvite } from '../../api/managers';
import { isUserAvailable } from '../../api/users';
import {
  getManagerTransactionsWithDetails,
  approveTransactionByManager,
  rejectTransactionByManager
} from '../../api/transactions';
import { getUserBanks } from '../../api/users';
import RoleSwitcher from '../../components/RoleSwitcher';
import type { TransactionWithDetails } from '../../types';

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { user, managerProfile, iosUserProfile, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'team' | 'reviews' | 'invites'>('team');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const referralLink = managerProfile?.referral_code
    ? `${window.location.origin}/register/user?ref=${managerProfile.referral_code}`
    : '';

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['manager-stats', managerProfile?.id],
    queryFn: () => managerProfile ? getManagerStats(managerProfile.id) : null,
    enabled: !!managerProfile,
  });

  const { data: teamMembers = [], isLoading: loadingTeam } = useQuery({
    queryKey: ['team-members', managerProfile?.id],
    queryFn: () => managerProfile ? getTeamMembers(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  const { data: pendingReviews = [], isLoading: loadingReviews } = useQuery({
    queryKey: ['pending-reviews', managerProfile?.id],
    queryFn: () => managerProfile
      ? getManagerTransactionsWithDetails(managerProfile.id, { status: 'pending_manager' })
      : [],
    enabled: !!managerProfile,
  });

  const { data: invites = [], isLoading: loadingInvites } = useQuery({
    queryKey: ['manager-invites', managerProfile?.id],
    queryFn: () => managerProfile ? getManagerInvites(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  // Fetch banks for selected user
  const { data: selectedUserBanks = [] } = useQuery({
    queryKey: ['user-banks', selectedTransaction?.ios_user_id],
    queryFn: () => selectedTransaction ? getUserBanks(selectedTransaction.ios_user_id) : [],
    enabled: !!selectedTransaction,
  });

  const sendInviteMutation = useMutation({
    mutationFn: (email: string) => {
      if (!managerProfile) throw new Error('No manager profile');
      return createInvite(managerProfile.id, email);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-invites'] });
      setInviteEmail('');
      setInviteError('');
    },
    onError: (error) => {
      setInviteError(error instanceof Error ? error.message : 'Failed to send invite');
    },
  });

  const approveMutation = useMutation({
    mutationFn: (transactionId: string) => {
      if (!managerProfile) throw new Error('No manager profile');
      return approveTransactionByManager(transactionId, managerProfile.user_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['manager-stats'] });
      setSelectedTransaction(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => {
      if (!managerProfile) throw new Error('No manager profile');
      return rejectTransactionByManager(transactionId, managerProfile.user_id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['manager-stats'] });
      setSelectedTransaction(null);
      setShowRejectModal(false);
      setRejectReason('');
    },
  });

  if (!user || !managerProfile) {
    return <div className="loading-container">Loading...</div>;
  }

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteEmail) {
      sendInviteMutation.mutate(inviteEmail);
    }
  };

  const handleApprove = (tx: TransactionWithDetails) => {
    if (confirm('Approve this transaction?')) {
      approveMutation.mutate(tx.id);
    }
  };

  const handleReject = () => {
    if (selectedTransaction && rejectReason.trim()) {
      rejectMutation.mutate({
        transactionId: selectedTransaction.id,
        reason: rejectReason.trim()
      });
    }
  };

  const openRejectModal = (tx: TransactionWithDetails) => {
    setSelectedTransaction(tx);
    setShowRejectModal(true);
  };

  const isPending = managerProfile.status === 'pending';

  // Calculate expected transactions for a user
  const getExpectedTransactions = (fundingAmount: number, cardAmount: number) => {
    if (!fundingAmount || !cardAmount) return 0;
    return Math.floor(fundingAmount / cardAmount);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1 className="logo-link" onClick={() => navigate('/manager/profile')}>Route.ng</h1>
          <p>Welcome, {managerProfile.full_name}</p>
          {isPending && (
            <span className="status-badge pending">Pending Verification</span>
          )}
        </div>
        <RoleSwitcher />
        <button className="logout-btn" onClick={signOut}>
          Logout
        </button>
      </header>

      {isPending && (
        <div className="warning-banner">
          <p>Your manager account is pending verification. Some features are limited until an admin verifies your account.</p>
        </div>
      )}

      {!iosUserProfile && (
        <div className="add-profile-section">
          <p>Want to participate in transactions yourself? Add an iOS User profile to your account.</p>
          <button
            className="add-profile-btn"
            onClick={() => navigate('/manager/add-user-profile')}
          >
            Add iOS User Profile
          </button>
        </div>
      )}

      <div className="stats">
        <div className="stat-card">
          <h3>Team Members</h3>
          <p className="stat-number">
            {loadingStats ? '...' : stats?.teamSize || 0}
          </p>
        </div>

        <div className="stat-card highlight">
          <h3>Pending Reviews</h3>
          <p className="stat-number">
            {loadingStats ? '...' : stats?.pendingReviews || 0}
          </p>
        </div>

        <div className="stat-card">
          <h3>Team Transactions Today</h3>
          <p className="stat-number">
            {loadingStats ? '...' : stats?.todayTeamTransactions || 0}
          </p>
        </div>

        <div className="stat-card">
          <h3>Total Commission</h3>
          <p className="stat-number">
            {loadingStats ? '...' : `N${(stats?.totalCommission || 0).toLocaleString()}`}
          </p>
        </div>
      </div>

      {managerProfile.referral_code && (
        <div className="referral-section">
          <h3>Your Referral Code</h3>
          <div className="referral-code-box">
            <span className="referral-code">{managerProfile.referral_code}</span>
            <button className="copy-btn" onClick={copyReferralLink}>
              {copiedCode ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <p className="helper-text">Share this code or link with users you want to recruit to your team.</p>
        </div>
      )}

      <div className="tabs">
        <button
          className={activeTab === 'team' ? 'active' : ''}
          onClick={() => setActiveTab('team')}
        >
          Team ({teamMembers.length})
        </button>
        <button
          className={activeTab === 'reviews' ? 'active' : ''}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews ({pendingReviews.length})
        </button>
        <button
          className={activeTab === 'invites' ? 'active' : ''}
          onClick={() => setActiveTab('invites')}
          disabled={isPending}
        >
          Invites
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'team' && (
          <div className="team-section">
            {loadingTeam ? (
              <div className="loading">Loading team...</div>
            ) : teamMembers.length === 0 ? (
              <div className="empty-state">
                <p>No team members yet. Send invites to grow your team!</p>
              </div>
            ) : (
              <div className="team-list">
                {teamMembers.map(member => {
                  const available = isUserAvailable(member);
                  return (
                  <div key={member.id} className={`team-member-card ${available ? 'member-available' : ''}`}>
                    <div className="member-availability">
                      <span className={`availability-dot ${available ? 'online' : 'offline'}`} />
                    </div>
                    <div className="member-info">
                      <h4>{member.full_name}</h4>
                      <p>{member.apple_id}</p>
                      <span className={`availability-status ${available ? 'available' : 'unavailable'}`}>
                        {available ? 'Available for work' : 'Unavailable'}
                      </span>
                    </div>
                    <div className="member-stats">
                      <span className={member.is_funded ? 'funded' : 'not-funded'}>
                        {member.is_funded
                          ? `Funded: N${member.funding_amount.toLocaleString()}`
                          : 'Not Funded'}
                      </span>
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="reviews-section">
            {loadingReviews ? (
              <div className="loading">Loading reviews...</div>
            ) : pendingReviews.length === 0 ? (
              <div className="empty-state">
                <p>No transactions pending review.</p>
              </div>
            ) : selectedTransaction ? (
              // Detailed Transaction View
              <div className="transaction-detail">
                <button
                  className="back-btn"
                  onClick={() => setSelectedTransaction(null)}
                >
                  &larr; Back to List
                </button>

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
                      <label>Funding Status</label>
                      <span className={selectedTransaction.ios_user?.is_funded ? 'funded' : 'not-funded'}>
                        {selectedTransaction.ios_user?.is_funded
                          ? `N${selectedTransaction.ios_user.funding_amount.toLocaleString()}`
                          : 'Not Funded'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <label>Expected Transactions</label>
                      <span>
                        {getExpectedTransactions(
                          selectedTransaction.ios_user?.funding_amount || 0,
                          selectedTransaction.card_amount
                        )} cards
                      </span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>Bank Information</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Bank Used</label>
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

                  {selectedUserBanks.length > 1 && (
                    <div className="other-banks">
                      <label>Other Banks on File:</label>
                      <ul>
                        {selectedUserBanks
                          .filter(b => b.id !== selectedTransaction.bank_id)
                          .map(bank => (
                            <li key={bank.id}>
                              {bank.bank_name} - {bank.account_number}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
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
                      <label>Date Submitted</label>
                      <span>{new Date(selectedTransaction.created_at).toLocaleString()}</span>
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
                    onClick={() => handleApprove(selectedTransaction)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve Transaction'}
                  </button>
                  <button
                    className="reject-btn"
                    onClick={() => openRejectModal(selectedTransaction)}
                  >
                    Reject Transaction
                  </button>
                </div>
              </div>
            ) : (
              // Transaction List
              <div className="reviews-list">
                {pendingReviews.map(tx => (
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
                          handleApprove(tx);
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="reject-btn small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRejectModal(tx);
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'invites' && !isPending && (
          <div className="invites-section">
            <form onSubmit={handleSendInvite} className="invite-form">
              <div className="form-group">
                <label htmlFor="inviteEmail">Invite a new team member</label>
                <div className="input-with-button">
                  <input
                    id="inviteEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address"
                    disabled={sendInviteMutation.isPending}
                  />
                  <button
                    type="submit"
                    disabled={!inviteEmail || sendInviteMutation.isPending}
                  >
                    {sendInviteMutation.isPending ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
                {inviteError && <p className="error-msg">{inviteError}</p>}
              </div>
            </form>

            <h3>Sent Invites</h3>
            {loadingInvites ? (
              <div className="loading">Loading invites...</div>
            ) : invites.length === 0 ? (
              <div className="empty-state">
                <p>No invites sent yet.</p>
              </div>
            ) : (
              <div className="invites-list">
                {invites.map(invite => (
                  <div key={invite.id} className="invite-item">
                    <div className="invite-details">
                      <span className="invite-email">{invite.email}</span>
                      {invite.email_sent_at && (
                        <span className="invite-sent-time">
                          Sent {new Date(invite.email_sent_at).toLocaleDateString()} at {new Date(invite.email_sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <span className={`status-badge ${invite.status}`}>
                      {invite.email_sent_at ? (invite.status === 'pending' ? 'Sent' : invite.status) : 'Sending...'}
                    </span>
                  </div>
                ))}
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
            <div className="form-group">
              <label>Reason for rejection:</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a reason..."
                rows={4}
                required
              />
            </div>
            <div className="modal-actions">
              <button
                className="reject-btn"
                onClick={handleReject}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
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

      {/* Quick Profile Link */}
      <div className="profile-quick-link manager" onClick={() => navigate('/manager/profile')}>
        <div className="profile-avatar small manager">
          {managerProfile.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="profile-quick-info">
          <span className="profile-quick-name">{managerProfile.full_name}</span>
          <span className="profile-quick-meta">{managerProfile.team_name} • {teamMembers.length} members</span>
        </div>
        <span className="profile-quick-arrow">&rarr;</span>
      </div>
    </div>
  );
}
