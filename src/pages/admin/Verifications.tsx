import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPendingVerifications,
  approveVerification,
  rejectVerification,
  getVerificationStats,
} from '../../api/verification';
import type { IOSUserProfile } from '../../types';

const ID_TYPE_LABELS: Record<string, string> = {
  nin: 'National ID (NIN)',
  voters_card: "Voter's Card",
  drivers_license: "Driver's License",
  passport: 'International Passport',
};

export default function AdminVerifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedUser, setSelectedUser] = useState<IOSUserProfile | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data: pendingVerifications = [], isLoading } = useQuery({
    queryKey: ['pending-verifications'],
    queryFn: getPendingVerifications,
  });

  const { data: stats } = useQuery({
    queryKey: ['verification-stats'],
    queryFn: getVerificationStats,
  });

  const approveMutation = useMutation({
    mutationFn: (profileId: string) => {
      if (!user) throw new Error('No user');
      return approveVerification(profileId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['verification-stats'] });
      setSelectedUser(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ profileId, reason }: { profileId: string; reason: string }) => {
      if (!user) throw new Error('No user');
      return rejectVerification(profileId, user.id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-verifications'] });
      queryClient.invalidateQueries({ queryKey: ['verification-stats'] });
      setSelectedUser(null);
      setShowRejectModal(false);
      setRejectReason('');
    },
  });

  const handleApprove = (profile: IOSUserProfile) => {
    if (window.confirm(`Approve verification for ${profile.full_name}?`)) {
      approveMutation.mutate(profile.id);
    }
  };

  const handleReject = () => {
    if (selectedUser && rejectReason.trim()) {
      rejectMutation.mutate({
        profileId: selectedUser.id,
        reason: rejectReason.trim(),
      });
    }
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Identity Verifications</h1>
        <p>{pendingVerifications.length} pending verification{pendingVerifications.length !== 1 ? 's' : ''}</p>
      </header>

      {/* Stats Overview */}
      {stats && (
        <div className="verification-stats">
          <div className="stat-card pending">
            <span className="stat-number">{stats.pending}</span>
            <span className="stat-label">Pending</span>
          </div>
          <div className="stat-card verified">
            <span className="stat-number">{stats.verified}</span>
            <span className="stat-label">Verified</span>
          </div>
          <div className="stat-card rejected">
            <span className="stat-number">{stats.rejected}</span>
            <span className="stat-label">Rejected</span>
          </div>
          <div className="stat-card unverified">
            <span className="stat-number">{stats.unverified}</span>
            <span className="stat-label">Unverified</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="loading">Loading verifications...</div>
      ) : pendingVerifications.length === 0 ? (
        <div className="empty-state">
          <p>No pending verifications.</p>
          <p>All user verification requests have been processed.</p>
        </div>
      ) : selectedUser ? (
        <div className="verification-detail-view">
          <button className="back-btn" onClick={() => setSelectedUser(null)}>
            &larr; Back to List
          </button>

          <div className="detail-card">
            <h3>User Information</h3>
            <div className="detail-grid">
              <div className="detail-item">
                <label>Full Name</label>
                <span>{selectedUser.full_name}</span>
              </div>
              <div className="detail-item">
                <label>Apple ID</label>
                <span>{selectedUser.apple_id}</span>
              </div>
              <div className="detail-item">
                <label>Submitted</label>
                <span>
                  {selectedUser.verification_submitted_at
                    ? new Date(selectedUser.verification_submitted_at).toLocaleString()
                    : 'N/A'}
                </span>
              </div>
              <div className="detail-item">
                <label>Member Since</label>
                <span>{new Date(selectedUser.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="detail-card">
            <h3>Verification Details</h3>
            <div className="detail-grid">
              <div className="detail-item highlight">
                <label>BVN</label>
                <span className="bvn-display">{selectedUser.bvn}</span>
              </div>
              <div className="detail-item">
                <label>ID Type</label>
                <span>{selectedUser.id_type ? ID_TYPE_LABELS[selectedUser.id_type] : 'N/A'}</span>
              </div>
              <div className="detail-item">
                <label>ID Number</label>
                <span>{selectedUser.id_number || 'N/A'}</span>
              </div>
            </div>
          </div>

          {selectedUser.id_image_url && (
            <div className="detail-card">
              <h3>ID Document</h3>
              <p className="helper-text">Click image to view full size</p>
              <img
                src={selectedUser.id_image_url}
                alt="ID Document"
                className="id-document-image clickable"
                onClick={() => setLightboxImage(selectedUser.id_image_url!)}
              />
            </div>
          )}

          {selectedUser.profile_image_url && (
            <div className="detail-card">
              <h3>Profile Photo</h3>
              <img
                src={selectedUser.profile_image_url}
                alt="Profile"
                className="profile-photo-preview clickable"
                onClick={() => setLightboxImage(selectedUser.profile_image_url!)}
              />
            </div>
          )}

          <div className="review-actions-bar">
            <button
              className="approve-btn large"
              onClick={() => handleApprove(selectedUser)}
              disabled={approveMutation.isPending}
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve Verification'}
            </button>
            <button
              className="reject-btn large"
              onClick={() => setShowRejectModal(true)}
            >
              Reject Verification
            </button>
          </div>
        </div>
      ) : (
        <div className="verifications-list">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>BVN</th>
                <th>ID Type</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingVerifications.map((profile) => (
                <tr key={profile.id}>
                  <td>
                    <div className="user-cell">
                      <div className="user-avatar small">
                        {profile.profile_image_url ? (
                          <img src={profile.profile_image_url} alt="" />
                        ) : (
                          profile.full_name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <strong>{profile.full_name}</strong>
                        <span className="user-email">{profile.apple_id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="bvn-cell">{profile.bvn}</td>
                  <td>{profile.id_type ? ID_TYPE_LABELS[profile.id_type] : 'N/A'}</td>
                  <td>
                    {profile.verification_submitted_at
                      ? new Date(profile.verification_submitted_at).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="view-btn"
                        onClick={() => setSelectedUser(profile)}
                      >
                        Review
                      </button>
                      <button
                        className="approve-btn small"
                        onClick={() => handleApprove(profile)}
                        disabled={approveMutation.isPending}
                      >
                        Approve
                      </button>
                      <button
                        className="reject-btn small"
                        onClick={() => {
                          setSelectedUser(profile);
                          setShowRejectModal(true);
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Verification</h3>
            <p>
              Rejecting verification for <strong>{selectedUser.full_name}</strong>
            </p>
            <div className="form-group">
              <label>Reason for rejection:</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a clear reason..."
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
            alt="Full size"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
