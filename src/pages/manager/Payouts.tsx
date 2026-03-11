import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTeamPayouts,
  approvePayout,
  rejectPayout,
  type PayoutStatus,
  type PayoutWithRecipient
} from '../../api/payouts';

export default function ManagerPayouts() {
  const { user, managerProfile } = useAuth();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<PayoutStatus | 'all'>('pending');
  const [selectedPayout, setSelectedPayout] = useState<PayoutWithRecipient | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['team-payouts', managerProfile?.id, filter],
    queryFn: () => managerProfile
      ? getTeamPayouts(managerProfile.id, filter === 'all' ? undefined : filter)
      : [],
    enabled: !!managerProfile,
  });

  const approveMutation = useMutation({
    mutationFn: (payoutId: string) => {
      if (!user) throw new Error('Not authenticated');
      return approvePayout(payoutId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-payouts'] });
      setSelectedPayout(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ payoutId, reason }: { payoutId: string; reason: string }) =>
      rejectPayout(payoutId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-payouts'] });
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

  const pendingCount = payouts.filter(p => p.status === 'pending').length;
  const approvedCount = payouts.filter(p => p.status === 'approved').length;
  const paidCount = payouts.filter(p => p.status === 'paid').length;

  return (
    <div className="manager-page">
      <header className="page-header">
        <h1>Team Payouts</h1>
        <p>Review and approve payout requests from your team members</p>
      </header>

      <div className="payout-summary">
        <div className="summary-item pending">
          <span className="summary-count">{pendingCount}</span>
          <span className="summary-label">Pending</span>
        </div>
        <div className="summary-item approved">
          <span className="summary-count">{approvedCount}</span>
          <span className="summary-label">Approved</span>
        </div>
        <div className="summary-item paid">
          <span className="summary-count">{paidCount}</span>
          <span className="summary-label">Paid</span>
        </div>
      </div>

      <div className="filter-bar">
        <button
          className={filter === 'pending' ? 'filter-btn active highlight' : 'filter-btn'}
          onClick={() => setFilter('pending')}
        >
          Pending ({pendingCount})
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
          <p>No payout requests from your team.</p>
        </div>
      ) : (
        <div className="payouts-list">
          {payouts.map(payout => (
            <div key={payout.id} className={`payout-card ${payout.status}`}>
              <div className="payout-card-header">
                <div className="payout-recipient">
                  <div className="recipient-avatar">
                    {payout.recipient_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="recipient-info">
                    <h4>{payout.recipient_name}</h4>
                    <span className="payout-date">
                      For: {new Date(payout.reference_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <span className={`status-badge ${getStatusBadgeClass(payout.status)}`}>
                  {payout.status}
                </span>
              </div>

              <div className="payout-card-body">
                <div className="payout-amount">
                  <span className="amount-label">Amount</span>
                  <span className="amount-value">N{payout.amount.toLocaleString()}</span>
                </div>
                <div className="payout-meta">
                  <span>Requested: {new Date(payout.requested_at).toLocaleDateString()}</span>
                  {payout.approved_at && (
                    <span>Approved: {new Date(payout.approved_at).toLocaleDateString()}</span>
                  )}
                  {payout.paid_at && (
                    <span>Paid: {new Date(payout.paid_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {payout.status === 'rejected' && payout.rejection_reason && (
                <div className="payout-rejection">
                  <strong>Rejection Reason:</strong> {payout.rejection_reason}
                </div>
              )}

              {payout.status === 'pending' && (
                <div className="payout-card-actions">
                  <button
                    className="approve-btn"
                    onClick={() => approveMutation.mutate(payout.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    className="reject-btn"
                    onClick={() => {
                      setSelectedPayout(payout);
                      setShowRejectModal(true);
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedPayout && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Payout Request</h3>
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
