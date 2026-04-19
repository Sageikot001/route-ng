import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  getManagerTransactionsWithDetails,
  approveTransactionByManager,
  rejectTransactionByManager
} from '../../api/transactions';
import { getUserBanks } from '../../api/users';
import type { TransactionWithDetails } from '../../types';

export default function ManagerReviews() {
  const { managerProfile } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data: pendingReviews = [], isLoading } = useQuery({
    queryKey: ['pending-reviews', managerProfile?.id],
    queryFn: () => managerProfile
      ? getManagerTransactionsWithDetails(managerProfile.id, { status: 'pending_manager' })
      : [],
    enabled: !!managerProfile,
  });

  const { data: selectedUserBanks = [] } = useQuery({
    queryKey: ['user-banks', selectedTransaction?.ios_user_id],
    queryFn: () => selectedTransaction ? getUserBanks(selectedTransaction.ios_user_id) : [],
    enabled: !!selectedTransaction,
  });

  const approveMutation = useMutation({
    mutationFn: (transactionId: string) => {
      if (!managerProfile) throw new Error('No manager profile');
      console.log('Approving transaction:', transactionId, 'by manager user_id:', managerProfile.user_id);
      return approveTransactionByManager(transactionId, managerProfile.user_id);
    },
    onSuccess: (data) => {
      console.log('Transaction approved successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['manager-stats'] });
      setSelectedTransaction(null);
    },
    onError: (error) => {
      console.error('Failed to approve transaction:', error);
      alert('Failed to approve transaction: ' + (error instanceof Error ? error.message : 'Unknown error'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => {
      if (!managerProfile) throw new Error('No manager profile');
      console.log('Rejecting transaction:', transactionId, 'reason:', reason);
      return rejectTransactionByManager(transactionId, managerProfile.user_id, reason);
    },
    onSuccess: (data) => {
      console.log('Transaction rejected successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['manager-stats'] });
      setSelectedTransaction(null);
      setShowRejectModal(false);
      setRejectReason('');
    },
    onError: (error) => {
      console.error('Failed to reject transaction:', error);
      alert('Failed to reject transaction: ' + (error instanceof Error ? error.message : 'Unknown error'));
    },
  });

  const handleApprove = (tx: TransactionWithDetails) => {
    console.log('handleApprove called for transaction:', tx.id);
    const confirmed = window.confirm('Approve this transaction?');
    console.log('User confirmed:', confirmed);
    if (confirmed) {
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

  const getExpectedTransactions = (fundingAmount: number, cardAmount: number) => {
    if (!fundingAmount || !cardAmount) return 0;
    return Math.floor(fundingAmount / cardAmount);
  };

  return (
    <div className="manager-page">
      <header className="page-header">
        <h1>Transaction Reviews</h1>
        <p>{pendingReviews.length} pending review{pendingReviews.length !== 1 ? 's' : ''}</p>
      </header>

      {isLoading ? (
        <div className="loading">Loading reviews...</div>
      ) : pendingReviews.length === 0 ? (
        <div className="empty-state">
          <p>No transactions pending review.</p>
          <p>Check back later for new submissions from your team.</p>
        </div>
      ) : selectedTransaction ? (
        <div className="transaction-detail-view">
          <button className="back-btn" onClick={() => setSelectedTransaction(null)}>
            &larr; Back to List
          </button>

          <div className="detail-card">
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

          <div className="detail-card">
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
                      <li key={bank.id}>{bank.bank_name} - {bank.account_number}</li>
                    ))}
                </ul>
              </div>
            )}
          </div>

          <div className="detail-card">
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
              {selectedTransaction.bank_charge_amount != null && (
                <div className="detail-item">
                  <label>Bank Charge Per Card</label>
                  <span>N{selectedTransaction.bank_charge_amount.toLocaleString()}</span>
                </div>
              )}
              <div className="detail-item highlight">
                <label>Total Amount</label>
                <span>N{selectedTransaction.gift_card_amount.toLocaleString()}</span>
              </div>
              <div className="detail-item">
                <label>Recipient Address</label>
                <span>{selectedTransaction.recipient_address || 'Not provided'}</span>
              </div>
              <div className="detail-item highlight">
                <label>Transaction Date</label>
                <span>{selectedTransaction.transaction_date}</span>
              </div>
              <div className="detail-item">
                <label>Submitted</label>
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
            <div className="detail-card">
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

          <div className="review-actions-bar">
            <button
              className="approve-btn large"
              onClick={() => handleApprove(selectedTransaction)}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Transaction'}
            </button>
            <button
              className="reject-btn large"
              onClick={() => setShowRejectModal(true)}
            >
              Reject Transaction
            </button>
          </div>
        </div>
      ) : (
        <div className="reviews-grid">
          {pendingReviews.map(tx => (
            <div
              key={tx.id}
              className="review-card-full"
              onClick={() => setSelectedTransaction(tx)}
            >
              {tx.proof_image_url && (
                <img
                  src={tx.proof_image_url}
                  alt="Proof"
                  className="review-thumbnail-large"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxImage(tx.proof_image_url!);
                  }}
                />
              )}
              <div className="review-card-content">
                <div className="review-user-info">
                  <h4>{tx.ios_user?.full_name || 'Unknown User'}</h4>
                  <span className="review-apple-id">{tx.ios_user?.apple_id}</span>
                </div>
                <div className="review-transaction-info">
                  <span className="review-amount">N{tx.gift_card_amount.toLocaleString()}</span>
                  <span className="review-cards">{tx.receipt_count} card{tx.receipt_count !== 1 ? 's' : ''}</span>
                  <span className="review-date">For: {tx.transaction_date}</span>
                </div>
              </div>
              <div className="review-card-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="approve-btn"
                  onClick={() => handleApprove(tx)}
                  disabled={approveMutation.isPending}
                >
                  Approve
                </button>
                <button
                  className="reject-btn"
                  onClick={() => {
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
          <button className="lightbox-close" onClick={() => setLightboxImage(null)}>&times;</button>
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
