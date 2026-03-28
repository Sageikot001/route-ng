import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getTeamMembers } from '../../api/managers';
import { isUserAvailable, getUserBanks } from '../../api/users';
import { getIncomingTransferRequests, getOutgoingTransferRequests } from '../../api/teamTransfers';
import TransferRequestsList from '../../components/TransferRequestsList';
import type { IOSUserProfile } from '../../types';

export default function ManagerTeam() {
  const { managerProfile } = useAuth();
  const [selectedMember, setSelectedMember] = useState<IOSUserProfile | null>(null);
  const [filter, setFilter] = useState<'all' | 'available' | 'funded'>('all');
  const [showTransferRequests, setShowTransferRequests] = useState(true);

  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team-members', managerProfile?.id],
    queryFn: () => managerProfile ? getTeamMembers(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  const { data: selectedMemberBanks = [] } = useQuery({
    queryKey: ['user-banks', selectedMember?.id],
    queryFn: () => selectedMember ? getUserBanks(selectedMember.id) : [],
    enabled: !!selectedMember,
  });

  const { data: incomingRequests = [] } = useQuery({
    queryKey: ['incoming-transfer-requests', managerProfile?.id],
    queryFn: () => managerProfile ? getIncomingTransferRequests(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  const { data: outgoingRequests = [] } = useQuery({
    queryKey: ['outgoing-transfer-requests', managerProfile?.id],
    queryFn: () => managerProfile ? getOutgoingTransferRequests(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  const filteredMembers = teamMembers.filter(member => {
    const available = isUserAvailable(member);
    switch (filter) {
      case 'available': return available;
      case 'funded': return member.is_funded;
      default: return true;
    }
  });

  const availableCount = teamMembers.filter(m => isUserAvailable(m)).length;
  const fundedCount = teamMembers.filter(m => m.is_funded).length;

  return (
    <div className="manager-page">
      <header className="page-header">
        <h1>My Team</h1>
        <p>Manage your team members</p>
      </header>

      {/* Transfer Requests Section */}
      {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
        <div className="transfer-requests-section">
          <div className="section-header-row">
            <h3>
              Transfer Requests
              {incomingRequests.length > 0 && (
                <span className="badge">{incomingRequests.length}</span>
              )}
            </h3>
            <button
              className="toggle-btn"
              onClick={() => setShowTransferRequests(!showTransferRequests)}
            >
              {showTransferRequests ? 'Hide' : 'Show'}
            </button>
          </div>

          {showTransferRequests && (
            <div className="transfer-requests-content">
              {incomingRequests.length > 0 && (
                <div className="transfer-requests-group">
                  <h4>Incoming Requests ({incomingRequests.length})</h4>
                  <p className="transfer-help-text">
                    Users requesting to join your team
                  </p>
                  <TransferRequestsList
                    requests={incomingRequests}
                    managerId={managerProfile?.id || ''}
                    type="incoming"
                  />
                </div>
              )}

              {outgoingRequests.length > 0 && (
                <div className="transfer-requests-group">
                  <h4>Leaving Requests ({outgoingRequests.length})</h4>
                  <p className="transfer-help-text">
                    Your team members requesting to leave
                  </p>
                  <TransferRequestsList
                    requests={outgoingRequests}
                    managerId={managerProfile?.id || ''}
                    type="outgoing"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="filter-bar">
        <button
          className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('all')}
        >
          All ({teamMembers.length})
        </button>
        <button
          className={filter === 'available' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('available')}
        >
          Available ({availableCount})
        </button>
        <button
          className={filter === 'funded' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('funded')}
        >
          Funded ({fundedCount})
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading team...</div>
      ) : teamMembers.length === 0 ? (
        <div className="empty-state">
          <p>No team members yet.</p>
          <p>Share your referral code or send invites to grow your team!</p>
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="empty-state">
          <p>No members match this filter.</p>
        </div>
      ) : (
        <div className="team-grid">
          {filteredMembers.map(member => {
            const available = isUserAvailable(member);
            return (
              <div
                key={member.id}
                className={`team-card ${available ? 'available' : ''}`}
                onClick={() => setSelectedMember(member)}
              >
                <div className="team-card-header">
                  <div className="member-avatar">
                    {member.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="member-title">
                    <h4>{member.full_name}</h4>
                    <span className="member-apple-id">{member.apple_id}</span>
                  </div>
                  <span className={`availability-indicator ${available ? 'online' : 'offline'}`} />
                </div>

                <div className="team-card-body">
                  <div className="member-stat">
                    <span className="label">Status</span>
                    <span className={`value ${available ? 'available' : 'unavailable'}`}>
                      {available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                  <div className="member-stat">
                    <span className="label">Funding</span>
                    <span className={`value ${member.is_funded ? 'funded' : ''}`}>
                      {member.is_funded
                        ? `N${member.funding_amount.toLocaleString()}`
                        : 'Not funded'}
                    </span>
                  </div>
                  <div className="member-stat">
                    <span className="label">Daily Target</span>
                    <span className="value">{member.daily_transaction_target} tx</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Member Detail Modal */}
      {selectedMember && (
        <div className="modal-overlay" onClick={() => setSelectedMember(null)}>
          <div className="modal profile-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedMember(null)}>
              &times;
            </button>
            <div className="profile-modal-content">
              <div className="profile-header">
                <div className="profile-avatar">
                  {selectedMember.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="profile-name">
                  <h3>{selectedMember.full_name}</h3>
                  <span className="profile-role">iOS User</span>
                  <span className={`availability-status ${isUserAvailable(selectedMember) ? 'available' : 'unavailable'}`}>
                    {isUserAvailable(selectedMember) ? 'Available' : 'Unavailable'}
                  </span>
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Account Details</h4>
                <div className="profile-details">
                  <div className="profile-row">
                    <label>Apple ID</label>
                    <span>{selectedMember.apple_id}</span>
                  </div>
                  <div className="profile-row">
                    <label>Daily Target</label>
                    <span>{selectedMember.daily_transaction_target} transactions</span>
                  </div>
                  <div className="profile-row">
                    <label>Funding Status</label>
                    <span className={selectedMember.is_funded ? 'funded' : 'not-funded'}>
                      {selectedMember.is_funded
                        ? `Funded: N${selectedMember.funding_amount.toLocaleString()}`
                        : 'Not Funded'}
                    </span>
                  </div>
                  <div className="profile-row">
                    <label>Last Seen</label>
                    <span>
                      {selectedMember.last_seen_at
                        ? new Date(selectedMember.last_seen_at).toLocaleString()
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="profile-section-group">
                <h4>Bank Accounts ({selectedMemberBanks.length})</h4>
                {selectedMemberBanks.length === 0 ? (
                  <p className="empty-text">No banks registered</p>
                ) : (
                  <div className="banks-list-compact">
                    {selectedMemberBanks.map(bank => (
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
