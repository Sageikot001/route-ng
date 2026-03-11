import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getManagerStats, getTeamMembers } from '../../api/managers';
import { isUserAvailable } from '../../api/users';
import { getManagerTransactionsWithDetails } from '../../api/transactions';

export default function ManagerOverview() {
  const navigate = useNavigate();
  const { managerProfile, iosUserProfile } = useAuth();
  const [copiedCode, setCopiedCode] = useState(false);

  const referralLink = managerProfile?.referral_code
    ? `${window.location.origin}/register/user?ref=${managerProfile.referral_code}`
    : '';

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['manager-stats', managerProfile?.id],
    queryFn: () => managerProfile ? getManagerStats(managerProfile.id) : null,
    enabled: !!managerProfile,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members', managerProfile?.id],
    queryFn: () => managerProfile ? getTeamMembers(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  const { data: pendingReviews = [] } = useQuery({
    queryKey: ['pending-reviews', managerProfile?.id],
    queryFn: () => managerProfile
      ? getManagerTransactionsWithDetails(managerProfile.id, { status: 'pending_manager' })
      : [],
    enabled: !!managerProfile,
  });

  if (!managerProfile) {
    return <div className="loading">Loading...</div>;
  }

  const isPending = managerProfile.status === 'pending';
  const availableMembers = teamMembers.filter(m => isUserAvailable(m));
  const fundedMembers = teamMembers.filter(m => m.is_funded);

  return (
    <div className="manager-page">
      <header className="page-header">
        <h1>Welcome back, {managerProfile.full_name}</h1>
        <p>{managerProfile.team_name}</p>
      </header>

      {isPending && (
        <div className="warning-banner">
          <p>Your manager account is pending verification. Some features are limited until an admin verifies your account.</p>
        </div>
      )}

      {!iosUserProfile && (
        <div className="info-banner clickable" onClick={() => navigate('/manager/add-user-profile')}>
          <p>Want to participate in transactions yourself? <strong>Add an iOS User profile</strong> to your account.</p>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <h3>Team Members</h3>
          <p className="stat-number">{loadingStats ? '...' : stats?.teamSize || 0}</p>
          <span className="stat-detail">{availableMembers.length} available now</span>
        </div>

        <div className="stat-card highlight" onClick={() => navigate('/manager/reviews')}>
          <h3>Pending Reviews</h3>
          <p className="stat-number">{loadingStats ? '...' : stats?.pendingReviews || 0}</p>
          <span className="stat-detail">Click to review</span>
        </div>

        <div className="stat-card">
          <h3>Team Transactions Today</h3>
          <p className="stat-number">{loadingStats ? '...' : stats?.todayTeamTransactions || 0}</p>
        </div>

        <div className="stat-card">
          <h3>Commission Rate</h3>
          <p className="stat-number">
            {((managerProfile.commission_rate || 0) * 100).toFixed(1)}%
          </p>
          <span className="stat-detail">Your earnings per transaction</span>
        </div>

        <div className="stat-card">
          <h3>Total Commission</h3>
          <p className="stat-number">
            {loadingStats ? '...' : `N${(stats?.totalCommission || 0).toLocaleString()}`}
          </p>
        </div>
      </div>

      {/* Referral Section */}
      {managerProfile.referral_code && (
        <div className="referral-card">
          <h3>Your Referral Code</h3>
          <div className="referral-code-display">
            <span className="code">{managerProfile.referral_code}</span>
            <button className="copy-btn" onClick={copyReferralLink}>
              {copiedCode ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <p className="helper-text">Share this code or link to recruit users to your team</p>
        </div>
      )}

      <div className="overview-grid">
        {/* Recent Activity */}
        <div className="overview-card">
          <div className="card-header-simple">
            <h3>Pending Reviews</h3>
            <button className="link-btn" onClick={() => navigate('/manager/reviews')}>
              View All
            </button>
          </div>
          {pendingReviews.length === 0 ? (
            <p className="empty-text">No pending reviews</p>
          ) : (
            <div className="mini-list">
              {pendingReviews.slice(0, 3).map(tx => (
                <div
                  key={tx.id}
                  className="mini-item clickable"
                  onClick={() => navigate('/manager/reviews')}
                >
                  <span className="mini-name">{tx.ios_user?.full_name}</span>
                  <span className="mini-amount">N{tx.gift_card_amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Status */}
        <div className="overview-card">
          <div className="card-header-simple">
            <h3>Team Status</h3>
            <button className="link-btn" onClick={() => navigate('/manager/team')}>
              View Team
            </button>
          </div>
          <div className="team-status-grid">
            <div className="status-item">
              <span className="status-number">{teamMembers.length}</span>
              <span className="status-label">Total</span>
            </div>
            <div className="status-item available">
              <span className="status-number">{availableMembers.length}</span>
              <span className="status-label">Available</span>
            </div>
            <div className="status-item funded">
              <span className="status-number">{fundedMembers.length}</span>
              <span className="status-label">Funded</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
