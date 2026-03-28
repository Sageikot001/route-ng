import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTransferRequest } from '../api/teamTransfers';

interface TransferRequestModalProps {
  iosUserProfileId: string;
  currentTeamName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TransferRequestModal({
  iosUserProfileId,
  currentTeamName,
  onClose,
  onSuccess,
}: TransferRequestModalProps) {
  const queryClient = useQueryClient();
  const [referralCode, setReferralCode] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const transferMutation = useMutation({
    mutationFn: () => createTransferRequest(iosUserProfileId, referralCode, reason || undefined),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['transfer-eligibility'] });
        queryClient.invalidateQueries({ queryKey: ['pending-transfer-request'] });
        onSuccess();
      } else {
        setError(result.error || 'Failed to create transfer request');
      }
    },
    onError: () => {
      setError('An unexpected error occurred');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!referralCode.trim()) {
      setError('Please enter a referral code');
      return;
    }

    transferMutation.mutate();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>

        <h3>Request Team Transfer</h3>

        {currentTeamName && (
          <p className="modal-subtitle">
            You are currently on: <strong>{currentTeamName}</strong>
          </p>
        )}

        <div className="info-box">
          <p>Enter the referral code of the manager whose team you want to join.</p>
          <ul>
            <li>Your new manager must approve your request</li>
            <li>Request expires after 7 days if not responded to</li>
            <li>You can only transfer once per month</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="referralCode">Manager's Referral Code</label>
            <input
              id="referralCode"
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="Enter referral code"
              maxLength={10}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="reason">Reason for Transfer (Optional)</label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why do you want to join this team?"
              rows={3}
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <div className="modal-actions">
            <button
              type="submit"
              className="primary-btn"
              disabled={transferMutation.isPending}
            >
              {transferMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </button>
            <button type="button" className="secondary-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
