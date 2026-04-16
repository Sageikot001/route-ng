import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getManagerReviewedTransactions } from '../../api/transactions';
import type { TransactionStatus, TransactionWithDetails } from '../../types';

type FilterStatus = 'all' | 'pending_admin' | 'verified' | 'rejected';

export default function ManagerHistory() {
  const { managerProfile } = useAuth();
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['manager-reviewed-transactions', managerProfile?.user_id, statusFilter],
    queryFn: () => {
      if (!managerProfile) return [];
      const options = statusFilter !== 'all' ? { status: statusFilter as TransactionStatus } : undefined;
      return getManagerReviewedTransactions(managerProfile.user_id, options);
    },
    enabled: !!managerProfile,
  });

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'pending_admin':
        return <span className="status-badge pending">Awaiting Admin</span>;
      case 'verified':
        return <span className="status-badge verified">Verified</span>;
      case 'rejected':
        return <span className="status-badge rejected">Rejected</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const getOutcomeBadge = (tx: TransactionWithDetails) => {
    if (tx.status === 'pending_admin') {
      return <span className="outcome-badge pending">Pending Admin Review</span>;
    }
    if (tx.status === 'verified') {
      return <span className="outcome-badge success">Approved by Admin</span>;
    }
    if (tx.status === 'rejected') {
      // Check if rejected by manager or admin
      if (tx.reviewed_by_admin) {
        return <span className="outcome-badge rejected">Rejected by Admin</span>;
      }
      return <span className="outcome-badge rejected">You Rejected</span>;
    }
    return null;
  };

  // Count stats
  const stats = {
    total: transactions.length,
    pendingAdmin: transactions.filter(tx => tx.status === 'pending_admin').length,
    verified: transactions.filter(tx => tx.status === 'verified').length,
    rejected: transactions.filter(tx => tx.status === 'rejected').length,
  };

  return (
    <div className="manager-page">
      <header className="page-header">
        <h1>Transaction History</h1>
        <p>View all transactions you've reviewed</p>
      </header>

      {/* Stats Summary */}
      <div className="history-stats">
        <div className="history-stat" onClick={() => setStatusFilter('all')}>
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Total Reviewed</span>
        </div>
        <div className="history-stat pending" onClick={() => setStatusFilter('pending_admin')}>
          <span className="stat-number">{stats.pendingAdmin}</span>
          <span className="stat-label">Awaiting Admin</span>
        </div>
        <div className="history-stat success" onClick={() => setStatusFilter('verified')}>
          <span className="stat-number">{stats.verified}</span>
          <span className="stat-label">Verified</span>
        </div>
        <div className="history-stat rejected" onClick={() => setStatusFilter('rejected')}>
          <span className="stat-number">{stats.rejected}</span>
          <span className="stat-label">Rejected</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-tab ${statusFilter === 'pending_admin' ? 'active' : ''}`}
          onClick={() => setStatusFilter('pending_admin')}
        >
          Awaiting Admin
        </button>
        <button
          className={`filter-tab ${statusFilter === 'verified' ? 'active' : ''}`}
          onClick={() => setStatusFilter('verified')}
        >
          Verified
        </button>
        <button
          className={`filter-tab ${statusFilter === 'rejected' ? 'active' : ''}`}
          onClick={() => setStatusFilter('rejected')}
        >
          Rejected
        </button>
      </div>

      {/* Transactions List */}
      {isLoading ? (
        <div className="loading">Loading transaction history...</div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions found{statusFilter !== 'all' ? ' with this filter' : ''}.</p>
        </div>
      ) : (
        <div className="history-list">
          {transactions.map(tx => (
            <div key={tx.id} className="history-card">
              <div className="history-card-left">
                {tx.proof_image_url ? (
                  <img
                    src={tx.proof_image_url}
                    alt="Proof"
                    className="history-thumbnail"
                    onClick={() => setLightboxImage(tx.proof_image_url!)}
                  />
                ) : (
                  <div className="no-image-placeholder">No img</div>
                )}
              </div>

              <div className="history-card-content">
                <div className="history-card-header">
                  <h4>{tx.ios_user?.full_name || 'Unknown User'}</h4>
                  {getStatusBadge(tx.status)}
                </div>
                <div className="history-card-details">
                  <span className="history-amount">N{tx.gift_card_amount.toLocaleString()}</span>
                  <span className="history-cards">{tx.receipt_count} card{tx.receipt_count !== 1 ? 's' : ''}</span>
                </div>
                <div className="history-card-dates">
                  <span className="history-date">
                    Logged: {new Date(tx.transaction_date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className="history-date">
                    Reviewed: {new Date(tx.manager_reviewed_at!).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {tx.admin_reviewed_at && (
                    <span className="history-date">
                      Admin: {new Date(tx.admin_reviewed_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className="history-card-outcome">
                  {getOutcomeBadge(tx)}
                  {tx.rejection_reason && (
                    <span className="rejection-reason">Reason: {tx.rejection_reason}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
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
