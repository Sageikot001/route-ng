import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getIOSUserStats, toggleWorkAvailability, updateLastSeen, isUserAvailable } from '../../api/users';
import { getIOSUserTransactions } from '../../api/transactions';
import { getManagerById, isHouseAccount } from '../../api/managers';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import RoleSwitcher from '../../components/RoleSwitcher';

export default function IOSUserDashboard() {
  const navigate = useNavigate();
  useQueryClient(); // Keep query context active
  const { earningsPerCard, maxDailyTransactions } = usePlatformSettings();
  const { user, iosUserProfile, managerProfile, signOut, refreshProfile } = useAuth();

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['ios-user-stats', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getIOSUserStats(iosUserProfile.id) : null,
    enabled: !!iosUserProfile,
  });

  const { data: recentTransactions = [], isLoading: loadingTransactions } = useQuery({
    queryKey: ['ios-user-transactions', iosUserProfile?.id],
    queryFn: () => iosUserProfile
      ? getIOSUserTransactions(iosUserProfile.id, { limit: 5 })
      : [],
    enabled: !!iosUserProfile,
  });

  // Fetch manager to check if house account
  const { data: userManager } = useQuery({
    queryKey: ['user-manager', iosUserProfile?.manager_id],
    queryFn: () => iosUserProfile?.manager_id ? getManagerById(iosUserProfile.manager_id) : null,
    enabled: !!iosUserProfile?.manager_id,
  });

  // Check if user is part of House Account (independent partner)
  const isHouseMember = isHouseAccount(userManager ?? null);

  // Update last seen on dashboard load
  useEffect(() => {
    if (iosUserProfile?.id) {
      updateLastSeen(iosUserProfile.id).catch(console.error);
    }
  }, [iosUserProfile?.id]);

  // Toggle availability mutation
  const availabilityMutation = useMutation({
    mutationFn: (isAvailable: boolean) => {
      if (!iosUserProfile) throw new Error('No profile');
      return toggleWorkAvailability(iosUserProfile.id, isAvailable);
    },
    onSuccess: () => {
      refreshProfile();
    },
  });

  if (!user || !iosUserProfile) {
    return <div className="loading-container">Loading...</div>;
  }

  // Check if currently available (considering expiry)
  const currentlyAvailable = isUserAvailable(iosUserProfile);

  // Calculate time remaining if available
  const getTimeRemaining = () => {
    if (!iosUserProfile.available_until) return '';
    const remaining = new Date(iosUserProfile.available_until).getTime() - Date.now();
    if (remaining <= 0) return '';
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m remaining`;
  };

  // Calculate today's earnings based on per-card rate
  const todayCards = stats?.todayTransactions || 0;
  const todayEarnings = todayCards * earningsPerCard;

  const targetProgress = stats
    ? Math.min((todayCards / maxDailyTransactions) * 100, 100)
    : 0;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1 className="logo-link" onClick={() => navigate('/ios-user/profile')}>Route.ng</h1>
          <p>Welcome, {iosUserProfile.full_name}</p>
        </div>
        <RoleSwitcher />
        <button className="logout-btn" onClick={signOut}>
          Logout
        </button>
      </header>

      {/* Work Availability Toggle - Only for managed users (not house account members) */}
      {!isHouseMember && (
        <div className={`availability-card ${currentlyAvailable ? 'available' : 'unavailable'}`}>
          <div className="availability-info">
            <h3>Work Availability</h3>
            <p>
              {currentlyAvailable
                ? `You're available for funding. ${getTimeRemaining()}`
                : "You're currently unavailable. Toggle on to receive funding today."
              }
            </p>
          </div>
          <button
            className={`availability-toggle ${currentlyAvailable ? 'on' : 'off'}`}
            onClick={() => availabilityMutation.mutate(!currentlyAvailable)}
            disabled={availabilityMutation.isPending}
          >
            {availabilityMutation.isPending
              ? '...'
              : currentlyAvailable ? 'Available' : 'Unavailable'
            }
          </button>
        </div>
      )}

      <div className="stats">
        <div className="stat-card highlight">
          <h3>Today's Earnings</h3>
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${targetProgress}%` }}
              />
            </div>
            <p className="stat-number">
              {loadingStats ? '...' : `N${todayEarnings.toLocaleString()}`}
            </p>
            <p className="stat-label">{todayCards} cards @ N{earningsPerCard.toLocaleString()} each</p>
          </div>
        </div>

        <div className="stat-card">
          <h3>Total Earnings</h3>
          <p className="stat-number">
            {loadingStats ? '...' : `N${(stats?.totalEarnings || 0).toLocaleString()}`}
          </p>
        </div>

        <div className="stat-card">
          <h3>Pending Payout</h3>
          <p className="stat-number">
            {loadingStats ? '...' : `N${(stats?.pendingPayout || 0).toLocaleString()}`}
          </p>
        </div>

        {/* Funding Status - Only for managed users (not house account members) */}
        {!isHouseMember && (
          <div className="stat-card">
            <h3>Funding Status</h3>
            <p className={`stat-number ${iosUserProfile.is_funded ? 'funded' : 'not-funded'}`}>
              {iosUserProfile.is_funded
                ? `N${iosUserProfile.funding_amount.toLocaleString()}`
                : 'Not Funded'}
            </p>
          </div>
        )}
      </div>

      {!managerProfile && (
        <div className="add-profile-section">
          <p>Want to build and lead your own team? Become a manager and earn commission on your team's transactions.</p>
          <button
            className="add-profile-btn"
            onClick={() => navigate('/ios-user/add-manager-profile')}
          >
            Become a Manager
          </button>
        </div>
      )}

      <div className="dashboard-section">
        <div className="section-header">
          <h2>Recent Transactions</h2>
          <button className="primary-btn" onClick={() => navigate('/ios-user/log-transaction')}>
            Log Transaction
          </button>
        </div>

        {loadingTransactions ? (
          <div className="loading">Loading transactions...</div>
        ) : recentTransactions.length === 0 ? (
          <div className="empty-state">
            <p>No transactions yet. Log your first transaction to get started!</p>
          </div>
        ) : (
          <div className="transactions-list">
            {recentTransactions.map(tx => (
              <div key={tx.id} className="transaction-item">
                {tx.proof_image_url ? (
                  <img
                    src={tx.proof_image_url}
                    alt="Proof"
                    className="transaction-thumbnail"
                  />
                ) : (
                  <div className="no-image-placeholder">No img</div>
                )}
                <div className="transaction-info">
                  <span className="transaction-amount">
                    N{tx.gift_card_amount.toLocaleString()}
                  </span>
                  <span className="transaction-meta">
                    {tx.receipt_count} card{tx.receipt_count !== 1 ? 's' : ''} @ N{tx.card_amount?.toLocaleString() || '—'}/each
                  </span>
                  <span className="transaction-date">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="transaction-actions">
                  <span className={`status-badge ${tx.status}`}>
                    {formatStatus(tx.status)}
                  </span>
                  {tx.status === 'pending_manager' && (
                    <button
                      className="edit-btn small"
                      onClick={() => navigate(`/ios-user/log-transaction?edit=${tx.id}`)}
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Profile Link */}
      <div className="profile-quick-link" onClick={() => navigate('/ios-user/profile')}>
        <div className="profile-avatar small">
          {iosUserProfile.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="profile-quick-info">
          <span className="profile-quick-name">{iosUserProfile.full_name}</span>
          <span className="profile-quick-meta">{iosUserProfile.apple_id}</span>
        </div>
        <span className="profile-quick-arrow">&rarr;</span>
      </div>
    </div>
  );
}

function formatStatus(status: string): string {
  switch (status) {
    case 'pending_manager':
      return 'Pending Review';
    case 'pending_admin':
      return 'Under Verification';
    case 'verified':
      return 'Verified';
    case 'rejected':
      return 'Rejected';
    default:
      return status;
  }
}
