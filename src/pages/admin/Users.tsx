import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllIOSUserProfiles, updateUserFunding, isUserAvailable, getUserBanks, getAllUsers } from '../../api/users';
import { getAllManagers, getHouseAccountManager, isHouseAccount } from '../../api/managers';
import type { IOSUserProfile } from '../../types';

export default function AdminUsers() {
  const queryClient = useQueryClient();

  const [userFilter, setUserFilter] = useState<'all' | 'available' | 'funded' | 'unfunded' | 'house'>('all');
  const [fundingUser, setFundingUser] = useState<IOSUserProfile | null>(null);
  const [fundingAmount, setFundingAmount] = useState('');
  const [selectedUser, setSelectedUser] = useState<IOSUserProfile | null>(null);

  const { data: iosUsers = [], isLoading } = useQuery({
    queryKey: ['all-ios-users'],
    queryFn: getAllIOSUserProfiles,
  });

  const { data: allManagers = [] } = useQuery({
    queryKey: ['all-managers'],
    queryFn: getAllManagers,
  });

  const { data: houseAccountManager } = useQuery({
    queryKey: ['house-account-manager'],
    queryFn: getHouseAccountManager,
  });

  const { data: allBaseUsers = [] } = useQuery({
    queryKey: ['all-base-users'],
    queryFn: getAllUsers,
  });

  const { data: selectedUserBanks = [] } = useQuery({
    queryKey: ['user-banks', selectedUser?.id],
    queryFn: () => selectedUser ? getUserBanks(selectedUser.id) : [],
    enabled: !!selectedUser,
  });

  const fundUserMutation = useMutation({
    mutationFn: ({ profileId, amount }: { profileId: string; amount: number }) =>
      updateUserFunding(profileId, true, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ios-users'] });
      setFundingUser(null);
      setFundingAmount('');
    },
  });

  const unfundUserMutation = useMutation({
    mutationFn: (profileId: string) => updateUserFunding(profileId, false, 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-ios-users'] });
    },
  });

  const getBaseUserForProfile = (profileUserId: string) => {
    return allBaseUsers.find(u => u.id === profileUserId);
  };

  const getManagerForUser = (managerId: string) => {
    return allManagers.find(m => m.id === managerId);
  };

  const handleFundUser = () => {
    if (fundingUser && fundingAmount && Number(fundingAmount) > 0) {
      fundUserMutation.mutate({
        profileId: fundingUser.id,
        amount: Number(fundingAmount)
      });
    }
  };

  const filteredUsers = iosUsers.filter(u => {
    const available = isUserAvailable(u);
    const isHouseMember = houseAccountManager && u.manager_id === houseAccountManager.id;
    switch (userFilter) {
      case 'available': return available;
      case 'funded': return u.is_funded;
      case 'unfunded': return !u.is_funded;
      case 'house': return isHouseMember;
      default: return true;
    }
  });

  const availableCount = iosUsers.filter(u => isUserAvailable(u)).length;
  const fundedCount = iosUsers.filter(u => u.is_funded).length;
  const houseCount = houseAccountManager
    ? iosUsers.filter(u => u.manager_id === houseAccountManager.id).length
    : 0;

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>iOS Users</h1>
        <p>Manage user funding and view user details</p>
      </header>

      <div className="filter-bar">
        <button
          className={userFilter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setUserFilter('all')}
        >
          All ({iosUsers.length})
        </button>
        <button
          className={userFilter === 'available' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setUserFilter('available')}
        >
          Available ({availableCount})
        </button>
        <button
          className={userFilter === 'funded' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setUserFilter('funded')}
        >
          Funded ({fundedCount})
        </button>
        <button
          className={userFilter === 'unfunded' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setUserFilter('unfunded')}
        >
          Unfunded ({iosUsers.length - fundedCount})
        </button>
        <button
          className={userFilter === 'house' ? 'filter-btn active highlight' : 'filter-btn highlight'}
          onClick={() => setUserFilter('house')}
        >
          Route.ng Direct ({houseCount})
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="empty-state">
          <p>No users found matching this filter.</p>
        </div>
      ) : (
        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Apple ID</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Funding</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(iosUser => {
                const baseUser = getBaseUserForProfile(iosUser.user_id);
                const manager = getManagerForUser(iosUser.manager_id);
                const available = isUserAvailable(iosUser);

                return (
                  <tr key={iosUser.id} onClick={() => setSelectedUser(iosUser)}>
                    <td>
                      <div className="user-cell">
                        <span className={`availability-dot ${available ? 'online' : 'offline'}`} />
                        <div>
                          <strong>{iosUser.full_name}</strong>
                          <span className="user-email">{baseUser?.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>{iosUser.apple_id}</td>
                    <td>
                      {manager ? (
                        isHouseAccount(manager) ? (
                          <span className="house-badge">Route.ng Direct</span>
                        ) : (
                          manager.full_name
                        )
                      ) : (
                        'Unknown'
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${available ? 'available' : 'unavailable'}`}>
                        {available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td>
                      {iosUser.is_funded ? (
                        <span className="funding-amount">N{iosUser.funding_amount.toLocaleString()}</span>
                      ) : (
                        <span className="not-funded">Not funded</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions" onClick={(e) => e.stopPropagation()}>
                        {!iosUser.is_funded ? (
                          <button
                            className="fund-btn small"
                            onClick={() => setFundingUser(iosUser)}
                          >
                            Fund
                          </button>
                        ) : (
                          <button
                            className="unfund-btn small"
                            onClick={() => unfundUserMutation.mutate(iosUser.id)}
                            disabled={unfundUserMutation.isPending}
                          >
                            Unfund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Funding Modal */}
      {fundingUser && (
        <div className="modal-overlay" onClick={() => setFundingUser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Fund User</h3>
            <p>Funding <strong>{fundingUser.full_name}</strong></p>
            <div className="form-group">
              <label>Funding Amount (NGN):</label>
              <input
                type="number"
                value={fundingAmount}
                onChange={(e) => setFundingAmount(e.target.value)}
                placeholder="e.g., 50000"
                min="1"
              />
            </div>
            <div className="modal-actions">
              <button
                className="fund-btn"
                onClick={handleFundUser}
                disabled={!fundingAmount || Number(fundingAmount) <= 0 || fundUserMutation.isPending}
              >
                {fundUserMutation.isPending ? 'Funding...' : `Fund N${Number(fundingAmount || 0).toLocaleString()}`}
              </button>
              <button
                className="secondary-btn"
                onClick={() => {
                  setFundingUser(null);
                  setFundingAmount('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedUser(null)}>
              &times;
            </button>
            <div className="profile-modal-content">
              <div className="profile-header">
                <div className="profile-avatar">
                  {selectedUser.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-name">
                  <h3>{selectedUser.full_name}</h3>
                  <span className="profile-role">iOS User</span>
                  <span className={`availability-status ${isUserAvailable(selectedUser) ? 'available' : 'unavailable'}`}>
                    {isUserAvailable(selectedUser) ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Account Information</h4>
                <div className="profile-details">
                  {(() => {
                    const baseUser = getBaseUserForProfile(selectedUser.user_id);
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
                <h4>Apple ID & Funding</h4>
                <div className="profile-details">
                  <div className="profile-row">
                    <label>Apple ID</label>
                    <span>{selectedUser.apple_id}</span>
                  </div>
                  <div className="profile-row">
                    <label>Funding Status</label>
                    <span className={selectedUser.is_funded ? 'funded' : 'not-funded'}>
                      {selectedUser.is_funded ? `Funded: N${selectedUser.funding_amount.toLocaleString()}` : 'Not Funded'}
                    </span>
                  </div>
                  <div className="profile-row">
                    <label>Manager</label>
                    <span>
                      {(() => {
                        const manager = getManagerForUser(selectedUser.manager_id);
                        if (!manager) return 'Unknown';
                        return isHouseAccount(manager)
                          ? 'Route.ng Direct (Independent)'
                          : manager.full_name;
                      })()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Bank Accounts ({selectedUserBanks.length})</h4>
                {selectedUserBanks.length === 0 ? (
                  <p className="empty-text">No banks registered</p>
                ) : (
                  <div className="banks-list-compact">
                    {selectedUserBanks.map(bank => (
                      <div key={bank.id} className="bank-item-compact">
                        <strong>{bank.bank_name}</strong>
                        <span>{bank.account_number}</span>
                        <span>{bank.account_name}</span>
                        {bank.is_primary && <span className="primary-badge">Primary</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="profile-actions">
                {!selectedUser.is_funded ? (
                  <button
                    className="fund-btn"
                    onClick={() => {
                      setSelectedUser(null);
                      setFundingUser(selectedUser);
                    }}
                  >
                    Fund User
                  </button>
                ) : (
                  <button
                    className="unfund-btn"
                    onClick={() => {
                      unfundUserMutation.mutate(selectedUser.id);
                      setSelectedUser(null);
                    }}
                  >
                    Remove Funding
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
