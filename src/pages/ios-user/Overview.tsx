import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getUserBanks } from '../../api/users';
import { getManagerById } from '../../api/managers';
import { getUserTransactions } from '../../api/transactions';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';

export default function IOSUserOverview() {
  const navigate = useNavigate();
  const { iosUserProfile } = useAuth();
  const {
    earningsPerCard,
    minDailyTransactions,
    maxDailyTransactions,
    minDailyEarnings,
    maxDailyEarnings
  } = usePlatformSettings();

  const { data: banks = [] } = useQuery({
    queryKey: ['user-banks', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserBanks(iosUserProfile.id) : [],
    enabled: !!iosUserProfile,
  });

  const { data: managerProfile } = useQuery({
    queryKey: ['user-manager', iosUserProfile?.manager_id],
    queryFn: () => iosUserProfile?.manager_id ? getManagerById(iosUserProfile.manager_id) : null,
    enabled: !!iosUserProfile?.manager_id,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['user-transactions', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserTransactions(iosUserProfile.id) : [],
    enabled: !!iosUserProfile,
  });

  if (!iosUserProfile) {
    return <div className="loading">Loading...</div>;
  }

  // Filter today's verified transactions
  const today = new Date().toISOString().split('T')[0];
  const todayTransactions = transactions.filter(tx =>
    tx.transaction_date.startsWith(today) && tx.status === 'verified'
  );

  // Count total cards from today's verified transactions
  const todayCardsCount = todayTransactions.reduce((sum, tx) => sum + (tx.card_count || 1), 0);
  const todayEarnings = todayCardsCount * earningsPerCard;

  const pendingTransactions = transactions.filter(tx =>
    tx.status === 'pending_manager' || tx.status === 'pending_admin'
  );

  const progress = maxDailyTransactions > 0
    ? Math.min((todayCardsCount / maxDailyTransactions) * 100, 100)
    : 0;

  return (
    <div className="ios-user-page">
      <header className="page-header">
        <h1>Welcome, {iosUserProfile.full_name}</h1>
        <p>Let's make today count!</p>
      </header>

      {/* Daily Progress */}
      <div className="daily-progress-card">
        <div className="progress-header">
          <h3>Today's Earnings</h3>
          <span className="progress-text">
            {todayCardsCount} cards = N{todayEarnings.toLocaleString()}
          </span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="progress-message">
          {todayCardsCount >= maxDailyTransactions
            ? `Maximum reached! You've earned N${todayEarnings.toLocaleString()} today.`
            : `Daily target: ${minDailyTransactions}-${maxDailyTransactions} cards (N${minDailyEarnings.toLocaleString()}-N${maxDailyEarnings.toLocaleString()})`}
        </p>
        <button className="primary-btn" onClick={() => navigate('/ios-user/log-transaction')}>
          + Log New Transaction
        </button>
      </div>

      <div className="overview-stats">
        <div className="stat-card">
          <h3>Per Card</h3>
          <p className="stat-number">N{earningsPerCard.toLocaleString()}</p>
          <span className="stat-detail">Earnings per approved card</span>
        </div>

        <div className="stat-card">
          <h3>Today's Cards</h3>
          <p className="stat-number">{todayCardsCount}</p>
          <span className="stat-detail">N{todayEarnings.toLocaleString()} earned</span>
        </div>

        <div className="stat-card highlight">
          <h3>Pending Review</h3>
          <p className="stat-number">{pendingTransactions.length}</p>
        </div>

        <div className="stat-card">
          <h3>Funding</h3>
          <p className="stat-number">
            {iosUserProfile.is_funded
              ? `N${iosUserProfile.funding_amount.toLocaleString()}`
              : 'None'}
          </p>
        </div>
      </div>

      <div className="overview-grid">
        {/* Quick Actions */}
        <div className="overview-card">
          <h3>Quick Actions</h3>
          <div className="quick-actions">
            <button className="quick-action-btn" onClick={() => navigate('/ios-user/log-transaction')}>
              <span className="action-icon">➕</span>
              <span className="action-label">Log Transaction</span>
            </button>
            <button className="quick-action-btn" onClick={() => navigate('/ios-user/history')}>
              <span className="action-icon">📋</span>
              <span className="action-label">View History</span>
            </button>
            <button className="quick-action-btn" onClick={() => navigate('/ios-user/profile')}>
              <span className="action-icon">🏦</span>
              <span className="action-label">Manage Banks</span>
            </button>
          </div>
        </div>

        {/* Manager Info */}
        <div className="overview-card">
          <h3>Your Manager</h3>
          {managerProfile ? (
            <div className="manager-info-card">
              <div className="manager-avatar-small">
                {managerProfile.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="manager-details">
                <span className="manager-name">{managerProfile.full_name}</span>
                <span className="manager-team">{managerProfile.team_name}</span>
              </div>
            </div>
          ) : (
            <p className="empty-text">No manager assigned</p>
          )}
        </div>

        {/* Banks Summary */}
        <div className="overview-card">
          <div className="card-header-simple">
            <h3>My Banks ({banks.length})</h3>
            <button className="link-btn" onClick={() => navigate('/ios-user/profile')}>
              Manage
            </button>
          </div>
          {banks.length === 0 ? (
            <p className="empty-text">No banks registered</p>
          ) : (
            <div className="banks-mini-list">
              {banks.slice(0, 3).map(bank => (
                <div key={bank.id} className="bank-mini-item">
                  <span className="bank-name">{bank.bank_name}</span>
                  <span className="bank-status">{bank.is_verified ? 'Verified' : 'Pending'}</span>
                </div>
              ))}
              {banks.length > 3 && (
                <span className="more-banks">+{banks.length - 3} more</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
