import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getAllManagers, verifyManager, suspendManager, getTeamMembers, updateManagerCommissionRate } from '../../api/managers';
import { getAllUsers, isUserAvailable } from '../../api/users';
import type { ManagerProfile } from '../../types';

export default function AdminManagers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedManager, setSelectedManager] = useState<ManagerProfile | null>(null);
  const [editingCommission, setEditingCommission] = useState(false);
  const [newCommissionRate, setNewCommissionRate] = useState('');

  const { data: allManagers = [], isLoading } = useQuery({
    queryKey: ['all-managers'],
    queryFn: getAllManagers,
  });

  const { data: allBaseUsers = [] } = useQuery({
    queryKey: ['all-base-users'],
    queryFn: getAllUsers,
  });

  const { data: selectedManagerTeam = [] } = useQuery({
    queryKey: ['manager-team', selectedManager?.id],
    queryFn: () => selectedManager ? getTeamMembers(selectedManager.id) : [],
    enabled: !!selectedManager,
  });

  const verifyManagerMutation = useMutation({
    mutationFn: (profileId: string) => {
      if (!user) throw new Error('Not authenticated');
      return verifyManager(profileId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-managers'] });
      queryClient.invalidateQueries({ queryKey: ['pending-managers'] });
    },
  });

  const suspendManagerMutation = useMutation({
    mutationFn: suspendManager,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-managers'] });
    },
  });

  const updateCommissionMutation = useMutation({
    mutationFn: ({ profileId, rate }: { profileId: string; rate: number }) =>
      updateManagerCommissionRate(profileId, rate),
    onSuccess: (updatedManager) => {
      queryClient.invalidateQueries({ queryKey: ['all-managers'] });
      setSelectedManager(updatedManager);
      setEditingCommission(false);
      setNewCommissionRate('');
    },
  });

  const handleEditCommission = () => {
    if (selectedManager) {
      setNewCommissionRate((selectedManager.commission_rate * 100).toFixed(1));
      setEditingCommission(true);
    }
  };

  const handleSaveCommission = () => {
    if (selectedManager && newCommissionRate) {
      const rate = parseFloat(newCommissionRate) / 100;
      if (rate >= 0 && rate <= 1) {
        updateCommissionMutation.mutate({ profileId: selectedManager.id, rate });
      }
    }
  };

  const closeModal = () => {
    setSelectedManager(null);
    setEditingCommission(false);
    setNewCommissionRate('');
  };

  const getBaseUserForProfile = (profileUserId: string) => {
    return allBaseUsers.find(u => u.id === profileUserId);
  };

  const pendingManagers = allManagers.filter(m => m.status === 'pending');
  const verifiedManagers = allManagers.filter(m => m.status === 'verified');
  const suspendedManagers = allManagers.filter(m => m.status === 'suspended');

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Managers</h1>
        <p>Manage and verify team managers</p>
      </header>

      <div className="manager-stats">
        <div className="stat-pill">
          <span className="stat-label">Total</span>
          <span className="stat-value">{allManagers.length}</span>
        </div>
        <div className="stat-pill pending">
          <span className="stat-label">Pending</span>
          <span className="stat-value">{pendingManagers.length}</span>
        </div>
        <div className="stat-pill verified">
          <span className="stat-label">Verified</span>
          <span className="stat-value">{verifiedManagers.length}</span>
        </div>
        <div className="stat-pill suspended">
          <span className="stat-label">Suspended</span>
          <span className="stat-value">{suspendedManagers.length}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">Loading managers...</div>
      ) : allManagers.length === 0 ? (
        <div className="empty-state">
          <p>No managers registered yet.</p>
        </div>
      ) : (
        <div className="managers-grid">
          {allManagers.map(manager => {
            const baseUser = getBaseUserForProfile(manager.user_id);
            return (
              <div
                key={manager.id}
                className={`manager-card-full ${manager.status}`}
                onClick={() => setSelectedManager(manager)}
              >
                <div className="manager-card-header">
                  <div className="manager-avatar">
                    {manager.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="manager-title">
                    <h3>{manager.full_name}</h3>
                    <span className="team-name">{manager.team_name}</span>
                  </div>
                  <span className={`status-badge ${manager.status}`}>
                    {manager.status}
                  </span>
                </div>

                <div className="manager-card-body">
                  <div className="info-row">
                    <span className="info-label">Email</span>
                    <span className="info-value">{baseUser?.email || 'N/A'}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Referral Code</span>
                    <span className="info-value code">{manager.referral_code}</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Commission</span>
                    <span className="info-value">{(manager.commission_rate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Joined</span>
                    <span className="info-value">{new Date(manager.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="manager-card-actions">
                  {manager.status === 'pending' && (
                    <>
                      <button
                        className="approve-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          verifyManagerMutation.mutate(manager.id);
                        }}
                        disabled={verifyManagerMutation.isPending}
                      >
                        Verify
                      </button>
                      <button
                        className="reject-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          suspendManagerMutation.mutate(manager.id);
                        }}
                        disabled={suspendManagerMutation.isPending}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {manager.status === 'verified' && (
                    <button
                      className="suspend-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        suspendManagerMutation.mutate(manager.id);
                      }}
                      disabled={suspendManagerMutation.isPending}
                    >
                      Suspend
                    </button>
                  )}
                  {manager.status === 'suspended' && (
                    <button
                      className="approve-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        verifyManagerMutation.mutate(manager.id);
                      }}
                      disabled={verifyManagerMutation.isPending}
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Manager Detail Modal */}
      {selectedManager && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal profile-modal large" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>
              &times;
            </button>
            <div className="profile-modal-content">
              <div className="profile-header">
                <div className="profile-avatar manager">
                  {selectedManager.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-name">
                  <h3>{selectedManager.full_name}</h3>
                  <span className="profile-role">Manager</span>
                  <span className={`status-badge ${selectedManager.status}`}>
                    {selectedManager.status}
                  </span>
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Account Information</h4>
                <div className="profile-details">
                  {(() => {
                    const baseUser = getBaseUserForProfile(selectedManager.user_id);
                    return (
                      <>
                        <div className="profile-row">
                          <label>Email</label>
                          <span>{baseUser?.email || 'N/A'}</span>
                        </div>
                        <div className="profile-row">
                          <label>Username</label>
                          <span>{baseUser?.username || 'N/A'}</span>
                        </div>
                        <div className="profile-row">
                          <label>Phone</label>
                          <span>{baseUser?.phone_number || 'Not provided'}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Manager Details</h4>
                <div className="profile-details">
                  <div className="profile-row">
                    <label>Team Name</label>
                    <span>{selectedManager.team_name}</span>
                  </div>
                  <div className="profile-row">
                    <label>Referral Code</label>
                    <span className="highlight">{selectedManager.referral_code}</span>
                  </div>
                  <div className="profile-row">
                    <label>Commission Rate</label>
                    {editingCommission ? (
                      <div className="inline-edit">
                        <input
                          type="number"
                          value={newCommissionRate}
                          onChange={(e) => setNewCommissionRate(e.target.value)}
                          min="0"
                          max="100"
                          step="0.1"
                          className="inline-input"
                          placeholder="e.g. 5.0"
                        />
                        <span className="input-suffix">%</span>
                        <button
                          className="inline-save-btn"
                          onClick={handleSaveCommission}
                          disabled={updateCommissionMutation.isPending}
                        >
                          {updateCommissionMutation.isPending ? '...' : 'Save'}
                        </button>
                        <button
                          className="inline-cancel-btn"
                          onClick={() => {
                            setEditingCommission(false);
                            setNewCommissionRate('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="editable-value">
                        <span>{(selectedManager.commission_rate * 100).toFixed(1)}%</span>
                        <button className="edit-btn" onClick={handleEditCommission}>
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                  {selectedManager.verified_at && (
                    <div className="profile-row">
                      <label>Verified On</label>
                      <span>{new Date(selectedManager.verified_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Team Members ({selectedManagerTeam.length})</h4>
                {selectedManagerTeam.length === 0 ? (
                  <p className="empty-text">No team members yet</p>
                ) : (
                  <div className="team-list-compact">
                    {selectedManagerTeam.map(member => (
                      <div key={member.id} className="team-member-compact">
                        <span className={`availability-dot ${isUserAvailable(member) ? 'online' : 'offline'}`} />
                        <span className="member-name">{member.full_name}</span>
                        <span className="member-status">
                          {member.is_funded ? `Funded: N${member.funding_amount.toLocaleString()}` : 'Not Funded'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
