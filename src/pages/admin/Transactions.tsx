import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getAllManagers } from '../../api/managers';
import {
  verifyTransactionByAdmin,
  rejectTransactionByAdmin,
  getManagerTransactionsWithDetails
} from '../../api/transactions';
import type { TransactionWithDetails } from '../../types';

export default function AdminTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<'pending_admin' | 'verified' | 'rejected' | 'all'>('pending_admin');
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

  const verifyTransactionMutation = useMutation({
    mutationFn: (transactionId: string) => {
      if (!user) throw new Error('Not authenticated');
      return verifyTransactionByAdmin(transactionId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-transactions'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-all-transactions'] });
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

  const pendingCount = allTransactions.filter(t => t.status === 'pending_admin').length;
  const verifiedCount = allTransactions.filter(t => t.status === 'verified').length;
  const rejectedCount = allTransactions.filter(t => t.status === 'rejected').length;

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'verified': return 'verified';
      case 'rejected': return 'rejected';
      case 'pending_admin': return 'pending_admin';
      case 'pending_manager': return 'pending_manager';
      default: return '';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'verified': return 'Verified';
      case 'rejected': return 'Rejected';
      case 'pending_admin': return 'Pending Admin';
      case 'pending_manager': return 'Pending Manager';
      default: return status;
    }
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Transactions</h1>
        <p>Review and verify transactions</p>
      </header>

      <div className="filter-bar">
        <button
          className={statusFilter === 'pending_admin' ? 'filter-btn active highlight' : 'filter-btn'}
          onClick={() => setStatusFilter('pending_admin')}
        >
          Pending Review ({pendingCount})
        </button>
        <button
          className={statusFilter === 'verified' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('verified')}
        >
          Verified ({verifiedCount})
        </button>
        <button
          className={statusFilter === 'rejected' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('rejected')}
        >
          Rejected ({rejectedCount})
        </button>
        <button
          className={statusFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setStatusFilter('all')}
        >
          All
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading transactions...</div>
      ) : allTransactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions found.</p>
        </div>
      ) : (
        <div className="transactions-grid">
          {allTransactions.map(tx => (
            <div
              key={tx.id}
              className="transaction-card"
              onClick={() => setSelectedTransaction(tx)}
            >
              <div className="transaction-card-header">
                {tx.proof_image_url && (
                  <img
                    src={tx.proof_image_url}
                    alt="Proof"
                    className="transaction-thumbnail"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxImage(tx.proof_image_url!);
                    }}
                  />
                )}
                <div className="transaction-info">
                  <h4>{tx.ios_user?.full_name || 'Unknown User'}</h4>
                  <span className="transaction-apple-id">{tx.ios_user?.apple_id}</span>
                </div>
                <span className={`status-badge ${getStatusBadgeClass(tx.status)}`}>
                  {getStatusLabel(tx.status)}
                </span>
              </div>

              <div className="transaction-card-body">
                <div className="transaction-amount">
                  <span className="amount-label">Gift Card Amount</span>
                  <span className="amount-value">N{tx.gift_card_amount.toLocaleString()}</span>
                </div>
                <div className="transaction-details">
                  <span>{tx.receipt_count} card{tx.receipt_count !== 1 ? 's' : ''}</span>
                  <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {tx.status === 'pending_admin' && (
                <div className="transaction-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="approve-btn small"
                    onClick={() => verifyTransactionMutation.mutate(tx.id)}
                    disabled={verifyTransactionMutation.isPending}
                  >
                    Verify
                  </button>
                  <button
                    className="reject-btn small"
                    onClick={() => {
                      setSelectedTransaction(tx);
                      setShowRejectModal(true);
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}

              {tx.status === 'rejected' && tx.rejection_reason && (
                <div className="rejection-reason">
                  <strong>Reason:</strong> {tx.rejection_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && !showRejectModal && (
        <div className="modal-overlay" onClick={() => setSelectedTransaction(null)}>
          <div className="modal transaction-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedTransaction(null)}>
              &times;
            </button>
            <h3>Transaction Details</h3>

            {selectedTransaction.proof_image_url && (
              <div className="transaction-proof-large">
                <img
                  src={selectedTransaction.proof_image_url}
                  alt="Transaction Proof"
                  onClick={() => setLightboxImage(selectedTransaction.proof_image_url!)}
                />
              </div>
            )}

            <div className="transaction-detail-grid">
              <div className="detail-item">
                <label>User</label>
                <span>{selectedTransaction.ios_user?.full_name}</span>
              </div>
              <div className="detail-item">
                <label>Apple ID</label>
                <span>{selectedTransaction.ios_user?.apple_id}</span>
              </div>
              <div className="detail-item">
                <label>Gift Card Amount</label>
                <span className="highlight">N{selectedTransaction.gift_card_amount.toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <label>Card Amount</label>
                <span>N{selectedTransaction.card_amount.toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <label>Receipt Count</label>
                <span>{selectedTransaction.receipt_count}</span>
              </div>
              <div className="detail-item">
                <label>Status</label>
                <span className={`status-badge ${getStatusBadgeClass(selectedTransaction.status)}`}>
                  {getStatusLabel(selectedTransaction.status)}
                </span>
              </div>
              <div className="detail-item">
                <label>Date</label>
                <span>{new Date(selectedTransaction.created_at).toLocaleString()}</span>
              </div>
              {selectedTransaction.recipient_address && (
                <div className="detail-item full-width">
                  <label>Recipient Address</label>
                  <span className="address">{selectedTransaction.recipient_address}</span>
                </div>
              )}
              {selectedTransaction.rejection_reason && (
                <div className="detail-item full-width">
                  <label>Rejection Reason</label>
                  <span className="rejection">{selectedTransaction.rejection_reason}</span>
                </div>
              )}
            </div>

            {selectedTransaction.status === 'pending_admin' && (
              <div className="modal-actions">
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
                  Reject
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
