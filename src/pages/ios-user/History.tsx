import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getUserTransactionsWithAppleId } from '../../api/transactions';

export default function IOSUserHistory() {
  const { iosUserProfile } = useAuth();
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending' | 'rejected'>('all');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['user-transactions-with-apple-id', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserTransactionsWithAppleId(iosUserProfile.id) : [],
    enabled: !!iosUserProfile,
  });

  const filteredTransactions = transactions.filter(tx => {
    switch (filter) {
      case 'verified': return tx.status === 'verified';
      case 'pending': return tx.status === 'pending_manager' || tx.status === 'pending_admin';
      case 'rejected': return tx.status === 'rejected';
      default: return true;
    }
  });

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'verified': return 'Verified';
      case 'pending_manager': return 'Pending Manager';
      case 'pending_admin': return 'Pending Admin';
      case 'rejected': return 'Rejected';
      default: return status;
    }
  };

  const verifiedCount = transactions.filter(tx => tx.status === 'verified').length;
  const pendingCount = transactions.filter(tx =>
    tx.status === 'pending_manager' || tx.status === 'pending_admin'
  ).length;
  const rejectedCount = transactions.filter(tx => tx.status === 'rejected').length;

  return (
    <div className="ios-user-page">
      <header className="page-header">
        <h1>Transaction History</h1>
        <p>View all your submitted transactions</p>
      </header>

      <div className="filter-bar">
        <button
          className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('all')}
        >
          All ({transactions.length})
        </button>
        <button
          className={filter === 'verified' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('verified')}
        >
          Verified ({verifiedCount})
        </button>
        <button
          className={filter === 'pending' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('pending')}
        >
          Pending ({pendingCount})
        </button>
        <button
          className={filter === 'rejected' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('rejected')}
        >
          Rejected ({rejectedCount})
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading transactions...</div>
      ) : filteredTransactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions found.</p>
        </div>
      ) : (
        <div className="history-list">
          {filteredTransactions.map(tx => (
            <div key={tx.id} className={`history-card ${tx.status}`}>
              <div className="history-card-main">
                {tx.proof_image_url && (
                  <img
                    src={tx.proof_image_url}
                    alt="Proof"
                    className="history-thumbnail"
                    onClick={() => setLightboxImage(tx.proof_image_url!)}
                  />
                )}
                <div className="history-info">
                  <div className="history-amount">N{tx.gift_card_amount.toLocaleString()}</div>
                  <div className="history-details">
                    <span>{tx.receipt_count} card{tx.receipt_count !== 1 ? 's' : ''}</span>
                    <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                  </div>
                  {tx.apple_id && (
                    <div className="history-apple-id">
                      <span className="apple-id-tag">
                        {tx.apple_id.label || tx.apple_id.apple_id}
                      </span>
                    </div>
                  )}
                </div>
                <span className={`status-badge ${tx.status}`}>
                  {getStatusLabel(tx.status)}
                </span>
              </div>

              {tx.status === 'rejected' && tx.rejection_reason && (
                <div className="rejection-reason">
                  <strong>Reason:</strong> {tx.rejection_reason}
                </div>
              )}
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
