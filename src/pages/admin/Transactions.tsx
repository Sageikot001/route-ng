import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getAllManagers } from '../../api/managers';
import {
  verifyTransactionByAdmin,
  rejectTransactionByAdmin,
  getManagerTransactionsWithDetails
} from '../../api/transactions';
import type { TransactionWithDetails, TransactionStatus } from '../../types';

type FilterStatus = 'pending_admin' | 'verified' | 'rejected' | 'all';

export default function AdminTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('pending_admin');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data: allManagers = [] } = useQuery({
    queryKey: ['all-managers'],
    queryFn: getAllManagers,
  });

  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['admin-all-transactions', statusFilter],
    queryFn: async () => {
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      const allTxPromises = allManagers.map(m =>
        getManagerTransactionsWithDetails(m.id, { status: statusParam })
      );
      const results = await Promise.all(allTxPromises);
      return results.flat().sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: allManagers.length > 0,
  });

  const verifyMutation = useMutation({
    mutationFn: (transactionId: string) => {
      if (!user) throw new Error('Not authenticated');
      return verifyTransactionByAdmin(transactionId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-transactions-detailed'] });
      setSelectedTransaction(null);
    },
    onError: (error) => {
      console.error('Failed to verify:', error);
      alert('Failed to verify transaction');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => {
      if (!user) throw new Error('Not authenticated');
      return rejectTransactionByAdmin(transactionId, user.id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-transactions-detailed'] });
      setSelectedTransaction(null);
      setShowRejectModal(false);
      setRejectReason('');
    },
    onError: (error) => {
      console.error('Failed to reject:', error);
      alert('Failed to reject transaction');
    },
  });

  const handleReject = () => {
    if (selectedTransaction && rejectReason.trim()) {
      rejectMutation.mutate({
        transactionId: selectedTransaction.id,
        reason: rejectReason.trim()
      });
    }
  };

  // Stats
  const stats = {
    pending: allTransactions.filter(t => t.status === 'pending_admin').length,
    verified: allTransactions.filter(t => t.status === 'verified').length,
    rejected: allTransactions.filter(t => t.status === 'rejected').length,
    total: allTransactions.length,
  };

  const getStatusBadge = (status: TransactionStatus) => {
    const classes: Record<string, string> = {
      verified: 'status-badge verified',
      rejected: 'status-badge rejected',
      pending_admin: 'status-badge pending',
      pending_manager: 'status-badge pending-manager',
    };
    const labels: Record<string, string> = {
      verified: 'Verified',
      rejected: 'Rejected',
      pending_admin: 'Pending',
      pending_manager: 'With Manager',
    };
    return <span className={classes[status] || 'status-badge'}>{labels[status] || status}</span>;
  };

  // Group transactions by date
  const groupedTransactions = allTransactions.reduce((groups, tx) => {
    const date = new Date(tx.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
    return groups;
  }, {} as Record<string, TransactionWithDetails[]>);

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Transactions</h1>
        <p>Review and verify team transactions</p>
      </header>

      {/* Stats Cards */}
      <div className="admin-tx-stats">
        <div
          className={`tx-stat-card ${statusFilter === 'pending_admin' ? 'active' : ''} pending`}
          onClick={() => setStatusFilter('pending_admin')}
        >
          <div className="tx-stat-icon">⏳</div>
          <div className="tx-stat-info">
            <span className="tx-stat-number">{stats.pending}</span>
            <span className="tx-stat-label">Pending Review</span>
          </div>
        </div>
        <div
          className={`tx-stat-card ${statusFilter === 'verified' ? 'active' : ''} verified`}
          onClick={() => setStatusFilter('verified')}
        >
          <div className="tx-stat-icon">✓</div>
          <div className="tx-stat-info">
            <span className="tx-stat-number">{stats.verified}</span>
            <span className="tx-stat-label">Verified</span>
          </div>
        </div>
        <div
          className={`tx-stat-card ${statusFilter === 'rejected' ? 'active' : ''} rejected`}
          onClick={() => setStatusFilter('rejected')}
        >
          <div className="tx-stat-icon">✕</div>
          <div className="tx-stat-info">
            <span className="tx-stat-number">{stats.rejected}</span>
            <span className="tx-stat-label">Rejected</span>
          </div>
        </div>
        <div
          className={`tx-stat-card ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <div className="tx-stat-icon">📋</div>
          <div className="tx-stat-info">
            <span className="tx-stat-number">{stats.total}</span>
            <span className="tx-stat-label">All Transactions</span>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {isLoading ? (
        <div className="loading">Loading transactions...</div>
      ) : allTransactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions found{statusFilter !== 'all' ? ' with this status' : ''}.</p>
        </div>
      ) : (
        <div className="admin-tx-list">
          {Object.entries(groupedTransactions).map(([date, transactions]) => (
            <div key={date} className="tx-date-group">
              <div className="tx-date-header">
                <span className="tx-date">{date}</span>
                <span className="tx-count">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="tx-table">
                <div className="tx-table-header">
                  <div className="tx-col proof">Proof</div>
                  <div className="tx-col user">User</div>
                  <div className="tx-col amount">Amount</div>
                  <div className="tx-col cards">Cards</div>
                  <div className="tx-col status">Status</div>
                  <div className="tx-col actions">Actions</div>
                </div>

                {transactions.map(tx => (
                  <div key={tx.id} className="tx-table-row" onClick={() => setSelectedTransaction(tx)}>
                    <div className="tx-col proof">
                      {tx.proof_image_url ? (
                        <img
                          src={tx.proof_image_url}
                          alt="Proof"
                          className="tx-proof-thumb"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage(tx.proof_image_url!);
                          }}
                        />
                      ) : (
                        <div className="no-proof">No image</div>
                      )}
                    </div>
                    <div className="tx-col user">
                      <span className="tx-user-name">{tx.ios_user?.full_name || 'Unknown'}</span>
                      <span className="tx-user-email">{tx.ios_user?.apple_id}</span>
                    </div>
                    <div className="tx-col amount">
                      <span className="tx-amount-value">₦{tx.gift_card_amount.toLocaleString()}</span>
                    </div>
                    <div className="tx-col cards">
                      <span>{tx.receipt_count}</span>
                    </div>
                    <div className="tx-col status">
                      {getStatusBadge(tx.status)}
                    </div>
                    <div className="tx-col actions" onClick={(e) => e.stopPropagation()}>
                      {tx.status === 'pending_admin' && (
                        <>
                          <button
                            className="tx-action-btn verify"
                            onClick={() => verifyMutation.mutate(tx.id)}
                            disabled={verifyMutation.isPending}
                            title="Verify"
                          >
                            ✓
                          </button>
                          <button
                            className="tx-action-btn reject"
                            onClick={() => {
                              setSelectedTransaction(tx);
                              setShowRejectModal(true);
                            }}
                            title="Reject"
                          >
                            ✕
                          </button>
                        </>
                      )}
                      {tx.status === 'rejected' && (
                        <span className="tx-rejection-hint" title={tx.rejection_reason}>
                          ⚠️
                        </span>
                      )}
                      <button
                        className="tx-action-btn view"
                        onClick={() => setSelectedTransaction(tx)}
                        title="View Details"
                      >
                        👁
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && !showRejectModal && (
        <div className="modal-overlay" onClick={() => setSelectedTransaction(null)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedTransaction(null)}>
              &times;
            </button>

            <div className="tx-modal-header">
              <h3>Transaction Details</h3>
              {getStatusBadge(selectedTransaction.status)}
            </div>

            <div className="tx-modal-content">
              <div className="tx-modal-left">
                {selectedTransaction.proof_image_url ? (
                  <img
                    src={selectedTransaction.proof_image_url}
                    alt="Transaction Proof"
                    className="tx-modal-proof"
                    onClick={() => setLightboxImage(selectedTransaction.proof_image_url!)}
                  />
                ) : (
                  <div className="tx-modal-no-proof">No proof image</div>
                )}
              </div>

              <div className="tx-modal-right">
                <div className="tx-modal-section">
                  <h4>User Information</h4>
                  <div className="tx-modal-grid">
                    <div className="tx-modal-item">
                      <label>Name</label>
                      <span>{selectedTransaction.ios_user?.full_name}</span>
                    </div>
                    <div className="tx-modal-item">
                      <label>Apple ID</label>
                      <span>{selectedTransaction.ios_user?.apple_id}</span>
                    </div>
                  </div>
                </div>

                <div className="tx-modal-section">
                  <h4>Transaction Details</h4>
                  <div className="tx-modal-grid">
                    <div className="tx-modal-item highlight">
                      <label>Total Amount</label>
                      <span className="large">₦{selectedTransaction.gift_card_amount.toLocaleString()}</span>
                    </div>
                    <div className="tx-modal-item">
                      <label>Per Card</label>
                      <span>₦{selectedTransaction.card_amount.toLocaleString()}</span>
                    </div>
                    <div className="tx-modal-item">
                      <label>Card Count</label>
                      <span>{selectedTransaction.receipt_count}</span>
                    </div>
                    <div className="tx-modal-item">
                      <label>Submitted</label>
                      <span>{new Date(selectedTransaction.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {selectedTransaction.recipient_address && (
                  <div className="tx-modal-section">
                    <h4>Recipient</h4>
                    <p className="tx-recipient">{selectedTransaction.recipient_address}</p>
                  </div>
                )}

                {selectedTransaction.rejection_reason && (
                  <div className="tx-modal-section rejection">
                    <h4>Rejection Reason</h4>
                    <p>{selectedTransaction.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>

            {selectedTransaction.status === 'pending_admin' && (
              <div className="tx-modal-actions">
                <button
                  className="btn-verify"
                  onClick={() => verifyMutation.mutate(selectedTransaction.id)}
                  disabled={verifyMutation.isPending}
                >
                  {verifyMutation.isPending ? 'Verifying...' : '✓ Verify Transaction'}
                </button>
                <button
                  className="btn-reject"
                  onClick={() => setShowRejectModal(true)}
                >
                  ✕ Reject Transaction
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedTransaction && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Transaction</h3>
            <p>
              Rejecting transaction from <strong>{selectedTransaction.ios_user?.full_name}</strong> for{' '}
              <strong>₦{selectedTransaction.gift_card_amount.toLocaleString()}</strong>
            </p>
            <div className="warning-banner">
              <p>⚠️ This rejection will be flagged against both the user and their manager.</p>
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
                className="btn-reject"
                onClick={handleReject}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                className="btn-secondary"
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
