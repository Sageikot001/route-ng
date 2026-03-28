import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveTransferRequest, rejectTransferRequest } from '../api/teamTransfers';
import type { TransferRequestWithDetails } from '../types';

interface TransferRequestsListProps {
  requests: TransferRequestWithDetails[];
  managerId: string;
  type: 'incoming' | 'outgoing';
}

export default function TransferRequestsList({
  requests,
  managerId,
  type,
}: TransferRequestsListProps) {
  const queryClient = useQueryClient();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const approveMutation = useMutation({
    mutationFn: (requestId: string) => approveTransferRequest(requestId, managerId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['incoming-transfer-requests'] });
        queryClient.invalidateQueries({ queryKey: ['outgoing-transfer-requests'] });
        queryClient.invalidateQueries({ queryKey: ['manager-team'] });
        queryClient.invalidateQueries({ queryKey: ['pending-transfer-count'] });
      } else {
        alert(result.error || 'Failed to approve transfer');
      }
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, reason }: { requestId: string; reason?: string }) =>
      rejectTransferRequest(requestId, managerId, reason),
    onSuccess: (result) => {
      if (result.success) {
        setRejectingId(null);
        setRejectionReason('');
        queryClient.invalidateQueries({ queryKey: ['incoming-transfer-requests'] });
        queryClient.invalidateQueries({ queryKey: ['pending-transfer-count'] });
      } else {
        alert(result.error || 'Failed to reject transfer');
      }
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return 'Expiring soon';
  };

  if (requests.length === 0) {
    return (
      <div className="empty-state small">
        <p>No {type} transfer requests</p>
      </div>
    );
  }

  return (
    <div className="transfer-requests-list">
      {requests.map((request) => (
        <div key={request.id} className="transfer-request-card">
          <div className="request-header">
            <div className="request-user">
              <div className="user-avatar small">
                {request.ios_user?.full_name?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="user-info">
                <h4>{request.ios_user?.full_name || 'Unknown User'}</h4>
                <p className="user-email">{request.ios_user?.apple_id}</p>
              </div>
            </div>
            <div className="request-meta">
              <span className="request-time">{formatDate(request.requested_at)}</span>
              <span className="request-expires">{getTimeRemaining(request.expires_at)}</span>
            </div>
          </div>

          {type === 'incoming' && request.from_manager && (
            <p className="request-from">
              Coming from: <strong>{request.from_manager.team_name}</strong>
            </p>
          )}

          {type === 'outgoing' && request.to_manager && (
            <p className="request-to">
              Moving to: <strong>{request.to_manager.team_name}</strong>
            </p>
          )}

          {request.request_reason && (
            <p className="request-reason">
              <em>"{request.request_reason}"</em>
            </p>
          )}

          {type === 'incoming' && (
            <div className="request-actions">
              {rejectingId === request.id ? (
                <div className="rejection-form">
                  <input
                    type="text"
                    placeholder="Reason for rejection (optional)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <div className="rejection-buttons">
                    <button
                      className="reject-btn small"
                      onClick={() =>
                        rejectMutation.mutate({
                          requestId: request.id,
                          reason: rejectionReason || undefined,
                        })
                      }
                      disabled={rejectMutation.isPending}
                    >
                      Confirm Reject
                    </button>
                    <button
                      className="secondary-btn small"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectionReason('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="approve-btn"
                    onClick={() => approveMutation.mutate(request.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    className="reject-btn"
                    onClick={() => setRejectingId(request.id)}
                    disabled={rejectMutation.isPending}
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          )}

          {type === 'outgoing' && (
            <div className="request-status-note">
              <span className="status-pending">Awaiting response from {request.to_manager?.full_name}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
