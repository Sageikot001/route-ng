import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  getManagerPayouts,
  approvePayout,
  markPayoutPaid,
  rejectPayout,
  getPayoutStats,
  type PayoutStatus,
  type PayoutWithRecipient
} from '../../api/payouts';

export default function AdminPayouts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<PayoutStatus | 'all'>('pending');
  const [selectedPayout, setSelectedPayout] = useState<PayoutWithRecipient | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['manager-payouts', filter],
    queryFn: () => getManagerPayouts(filter === 'all' ? undefined : filter),
  });

  const { data: stats } = useQuery({
    queryKey: ['payout-stats-manager'],
    queryFn: () => getPayoutStats('manager'),
  });

  const approveMutation = useMutation({
    mutationFn: (payoutId: string) => {
      if (!user) throw new Error('Not authenticated');
      return approvePayout(payoutId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['payout-stats-manager'] });
      setSelectedPayout(null);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: markPayoutPaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['payout-stats-manager'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ payoutId, reason }: { payoutId: string; reason: string }) =>
      rejectPayout(payoutId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['payout-stats-manager'] });
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedPayout(null);
    },
  });

  const getStatusBadgeClass = (status: PayoutStatus) => {
    switch (status) {
      case 'pending': return 'pending';
      case 'approved': return 'approved';
      case 'paid': return 'paid';
      case 'rejected': return 'rejected';
    }
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Manager Payouts</h1>
        <p>Review and process manager commission payouts</p>
      </header>

      <div className="payout-stats">
        <div className="stat-card">
          <h3>Pending</h3>
          <p className="stat-number pending-color">{stats?.pending || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Approved</h3>
          <p className="stat-number approved-color">{stats?.approved || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Paid</h3>
          <p className="stat-number paid-color">{stats?.paid || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Total Paid</h3>
          <p className="stat-number">N{(stats?.totalPaidAmount || 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="filter-bar">
        <button
          className={filter === 'pending' ? 'filter-btn active highlight' : 'filter-btn'}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button
          className={filter === 'approved' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('approved')}
        >
          Approved
        </button>
        <button
          className={filter === 'paid' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('paid')}
        >
          Paid
        </button>
        <button
          className={filter === 'rejected' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('rejected')}
        >
          Rejected
        </button>
        <button
          className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('all')}
        >
          All
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading payouts...</div>
      ) : payouts.length === 0 ? (
        <div className="empty-state">
          <p>No payouts found.</p>
        </div>
      ) : (
        <div className="payouts-table-container">
          <table className="payouts-table">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Amount</th>
                <th>Reference Date</th>
                <th>Requested</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(payout => (
                <tr key={payout.id}>
                  <td>
                    <strong>{payout.recipient_name}</strong>
                  </td>
                  <td className="amount-cell">
                    N{payout.amount.toLocaleString()}
                  </td>
                  <td>{new Date(payout.reference_date).toLocaleDateString()}</td>
                  <td>{new Date(payout.requested_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(payout.status)}`}>
                      {payout.status}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      {payout.status === 'pending' && (
                        <>
                          <button
                            className="approve-btn small"
                            onClick={() => approveMutation.mutate(payout.id)}
                            disabled={approveMutation.isPending}
                          >
                            Approve
                          </button>
                          <button
                            className="reject-btn small"
                            onClick={() => {
                              setSelectedPayout(payout);
                              setShowRejectModal(true);
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {payout.status === 'approved' && (
                        <button
                          className="paid-btn small"
                          onClick={() => markPaidMutation.mutate(payout.id)}
                          disabled={markPaidMutation.isPending}
                        >
                          Mark Paid
                        </button>
                      )}
                      {payout.status === 'rejected' && payout.rejection_reason && (
                        <span className="rejection-note" title={payout.rejection_reason}>
                          View Reason
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPayout && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Payout</h3>
            <p>
              Rejecting payout of <strong>N{selectedPayout.amount.toLocaleString()}</strong> for{' '}
              <strong>{selectedPayout.recipient_name}</strong>
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
                onClick={() => rejectMutation.mutate({
                  payoutId: selectedPayout.id,
                  reason: rejectReason.trim()
                })}
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
    </div>
  );
}
