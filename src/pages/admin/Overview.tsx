import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getAllManagers, getPendingManagerVerifications, verifyManager, suspendManager } from '../../api/managers';
import { getAllIOSUserProfiles, isUserAvailable } from '../../api/users';
import {
  rejectTransactionByAdmin,
  getManagerTransactionsWithDetails
} from '../../api/transactions';
import type { TransactionWithDetails } from '../../types';

export default function AdminOverview() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

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

  const { data: pendingTransactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['admin-pending-transactions-detailed'],
    queryFn: async () => {
      const allTxPromises = allManagers.map(m =>
        getManagerTransactionsWithDetails(m.id, { status: 'pending_admin' })
      );
      const results = await Promise.all(allTxPromises);
      return results.flat();
    },
    enabled: allManagers.length > 0,
  });

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

  const handleReject = () => {
    if (selectedTransaction && rejectReason.trim()) {
      rejectTransactionMutation.mutate({
        transactionId: selectedTransaction.id,
        reason: rejectReason.trim()
      });
    }
  };

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
    <div className="admin-page">
      <header className="page-header">
        <h1>Overview</h1>
        <p>Welcome back, {user?.username}</p>
      </header>

      <div className="stats-grid">
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

      <div className="overview-sections">
        <section className="overview-card">
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
        </section>

        <section className="overview-card">
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
        </section>
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
    </div>
  );
}
