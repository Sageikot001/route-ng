import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getTeamMembers, getManagerStats } from '../../api/managers';

export default function ManagerProfile() {
  const navigate = useNavigate();
  const { user, managerProfile, signOut } = useAuth();

  const { data: teamMembers = [], isLoading: loadingTeam } = useQuery({
    queryKey: ['team-members', managerProfile?.id],
    queryFn: () => managerProfile ? getTeamMembers(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  const { data: stats } = useQuery({
    queryKey: ['manager-stats', managerProfile?.id],
    queryFn: () => managerProfile ? getManagerStats(managerProfile.id) : null,
    enabled: !!managerProfile,
  });

  if (!user || !managerProfile) {
    return <div className="loading-container">Loading...</div>;
  }

  const referralLink = `${window.location.origin}/register/user?ref=${managerProfile.referral_code}`;

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
  };

  return (
    <div className="profile-page">
      <header className="profile-page-header">
        <button className="back-btn" onClick={() => navigate('/manager/dashboard')}>
          &larr; Back to Dashboard
        </button>
        <button className="logout-btn" onClick={signOut}>
          Logout
        </button>
      </header>

      <div className="profile-page-content">
        <div className="profile-hero manager">
          <div className="profile-avatar large manager">
            {managerProfile.full_name.charAt(0).toUpperCase()}
          </div>
          <h1>{managerProfile.full_name}</h1>
          <span className="profile-role-badge manager">Manager</span>
          <span className={`status-badge ${managerProfile.status}`}>
            {managerProfile.status}
          </span>
        </div>

        <div className="profile-grid">
          {/* Account Information */}
          <div className="profile-card">
            <h2>Account Information</h2>
            <div className="profile-details">
              <div className="profile-row">
                <label>Email</label>
                <span>{user.email}</span>
              </div>
              <div className="profile-row">
                <label>Username</label>
                <span>{user.username}</span>
              </div>
              {user.phone_number && (
                <div className="profile-row">
                  <label>Phone Number</label>
                  <span>{user.phone_number}</span>
                </div>
              )}
              <div className="profile-row">
                <label>Member Since</label>
                <span>{new Date(user.created_at).toLocaleDateString('en-NG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div className="profile-row">
                <label>Account Status</label>
                <span className={`status-badge ${user.is_active ? 'verified' : 'suspended'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>

          {/* Team Information */}
          <div className="profile-card">
            <h2>Team Details</h2>
            <div className="profile-details">
              <div className="profile-row">
                <label>Team Name</label>
                <span className="highlight">{managerProfile.team_name}</span>
              </div>
              <div className="profile-row">
                <label>Team Size</label>
                <span>{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="profile-row">
                <label>Verification Status</label>
                <span className={`status-badge ${managerProfile.status}`}>
                  {managerProfile.status}
                </span>
              </div>
              {managerProfile.verified_at && (
                <div className="profile-row">
                  <label>Verified On</label>
                  <span>{new Date(managerProfile.verified_at).toLocaleDateString('en-NG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
              )}
            </div>
          </div>

          {/* Commission & Earnings */}
          <div className="profile-card highlight-card manager">
            <h2>Commission Details</h2>
            <div className="commission-display">
              <div className="commission-rate">
                <span className="rate-number">{(managerProfile.commission_rate * 100).toFixed(1)}%</span>
                <span className="rate-label">Commission Rate</span>
              </div>
            </div>
            <div className="profile-details">
              <div className="profile-row">
                <label>Total Earnings</label>
                <span className="highlight-amount">N{(stats?.totalCommission || 0).toLocaleString()}</span>
              </div>
              <div className="profile-row">
                <label>Team Transactions Today</label>
                <span>{stats?.todayTeamTransactions || 0}</span>
              </div>
              <div className="profile-row">
                <label>Pending Reviews</label>
                <span>{stats?.pendingReviews || 0}</span>
              </div>
            </div>
          </div>

          {/* Referral Code */}
          <div className="profile-card">
            <h2>Referral Code</h2>
            <div className="referral-display">
              <div className="referral-code-large">{managerProfile.referral_code}</div>
              <button className="copy-btn" onClick={copyReferralLink}>
                Copy Referral Link
              </button>
            </div>
            <p className="helper-text">Share this code with users you want to recruit to your team.</p>
          </div>
        </div>

        {/* Team Members Section */}
        <div className="profile-card full-width">
          <div className="card-header">
            <h2>Team Members ({teamMembers.length})</h2>
            <p className="card-subtitle">iOS users under your management</p>
          </div>

          {loadingTeam ? (
            <div className="loading">Loading team...</div>
          ) : teamMembers.length === 0 ? (
            <div className="empty-state">
              <p>No team members yet. Share your referral code to grow your team!</p>
            </div>
          ) : (
            <div className="team-members-grid">
              {teamMembers.map(member => (
                <div key={member.id} className="team-member-card-full">
                  <div className="member-avatar">
                    {member.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="member-info">
                    <h4>{member.full_name}</h4>
                    <p className="member-apple-id">{member.apple_id}</p>
                  </div>
                  <div className="member-status-info">
                    <span className={`funding-status ${member.is_funded ? 'funded' : 'not-funded'}`}>
                      {member.is_funded ? `N${member.funding_amount.toLocaleString()}` : 'Not Funded'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registration Summary */}
        <div className="profile-card full-width">
          <h2>Registration Summary</h2>
          <div className="registration-timeline">
            <div className="timeline-item completed">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Account Created</h4>
                <p>{new Date(user.created_at).toLocaleDateString('en-NG', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}</p>
              </div>
            </div>
            <div className="timeline-item completed">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Manager Profile Created</h4>
                <p>Team: {managerProfile.team_name}</p>
              </div>
            </div>
            <div className={`timeline-item ${managerProfile.status === 'verified' ? 'completed' : 'pending'}`}>
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Verification</h4>
                <p>{managerProfile.status === 'verified'
                  ? `Verified on ${new Date(managerProfile.verified_at!).toLocaleDateString()}`
                  : 'Pending admin verification'}</p>
              </div>
            </div>
            <div className={`timeline-item ${teamMembers.length > 0 ? 'completed' : 'pending'}`}>
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <h4>Team Building</h4>
                <p>{teamMembers.length > 0
                  ? `${teamMembers.length} team member${teamMembers.length !== 1 ? 's' : ''} recruited`
                  : 'Start recruiting team members'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
