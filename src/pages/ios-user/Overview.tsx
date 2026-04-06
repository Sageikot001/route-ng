import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getUserBanks } from '../../api/users';
import { getManagerById, isHouseAccount } from '../../api/managers';
import { getUserTransactions } from '../../api/transactions';
import { getSystemBanks } from '../../api/systemBanks';
import { getFeaturedResources } from '../../api/resources';
import { supabase } from '../../api/supabase';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';
import {
  getActiveOpportunities,
  getUserAvailability,
  toggleAvailability,
} from '../../api/opportunities';
import type { TransactionOpportunity, Resource } from '../../types';

export default function IOSUserOverview() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { iosUserProfile } = useAuth();
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [dismissedFeatured, setDismissedFeatured] = useState(() => {
    // Check localStorage to see if user has dismissed the featured resource
    return localStorage.getItem('dismissedFeaturedResource') === 'true';
  });

  // Scroll to section when navigating with hash (e.g., #opportunities)
  useEffect(() => {
    if (location.hash) {
      const elementId = location.hash.replace('#', '');
      // Small delay to ensure element is rendered
      setTimeout(() => {
        const element = document.getElementById(elementId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [location.hash]);
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

  // Fetch active opportunities
  const { data: opportunities = [], isLoading: loadingOpportunities, error: opportunitiesError } = useQuery({
    queryKey: ['active-opportunities'],
    queryFn: getActiveOpportunities,
  });

  // Debug log
  console.log('Opportunities state:', { opportunities, loadingOpportunities, opportunitiesError });

  // Direct debug test
  useEffect(() => {
    async function testDirectQuery() {
      // Check session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Current session:', session ? 'exists' : 'none', session?.user?.id);

      // Direct query
      const { data, error } = await supabase
        .from('transaction_opportunities')
        .select('*');

      console.log('Direct query result:', { data, error });
    }
    testDirectQuery();
  }, []);

  // Fetch active system banks (for opportunity bank info)
  const { data: activeSystemBanks = [] } = useQuery({
    queryKey: ['active-system-banks'],
    queryFn: () => getSystemBanks(false),
  });

  // Fetch user's availability
  const { data: myAvailability = [] } = useQuery({
    queryKey: ['my-availability', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserAvailability(iosUserProfile.id) : [],
    enabled: !!iosUserProfile,
  });

  // Fetch featured resource for new user prompt
  const { data: featuredResources = [] } = useQuery({
    queryKey: ['featured-resources-partners'],
    queryFn: () => getFeaturedResources('partners'),
  });

  // Get the most recent featured resource (first one, ordered by sort_order)
  const featuredResource: Resource | undefined = featuredResources[0];

  // Toggle availability mutation
  const toggleMutation = useMutation({
    mutationFn: ({ opportunityId, isAvailable }: { opportunityId: string; isAvailable: boolean }) =>
      toggleAvailability(iosUserProfile!.id, opportunityId, isAvailable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-availability'] });
      queryClient.invalidateQueries({ queryKey: ['active-opportunities'] });
      setTogglingId(null);
    },
    onError: () => {
      setTogglingId(null);
    },
  });

  // Check if user is available for a specific opportunity
  const isAvailableFor = (opportunityId: string): boolean => {
    const avail = myAvailability.find(a => a.opportunity_id === opportunityId);
    return avail?.is_available ?? false;
  };

  // Handle toggle
  const handleToggle = (opportunity: TransactionOpportunity) => {
    if (!iosUserProfile) return;
    setTogglingId(opportunity.id);
    const currentlyAvailable = isAvailableFor(opportunity.id);
    toggleMutation.mutate({
      opportunityId: opportunity.id,
      isAvailable: !currentlyAvailable,
    });
  };

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

  // Check if user is part of House Account (independent partner)
  const isHouseMember = isHouseAccount(managerProfile ?? null);

  const progress = maxDailyTransactions > 0
    ? Math.min((todayCardsCount / maxDailyTransactions) * 100, 100)
    : 0;

  const handleDismissFeatured = () => {
    setDismissedFeatured(true);
    localStorage.setItem('dismissedFeaturedResource', 'true');
  };

  return (
    <div className="ios-user-page">
      <header className="page-header">
        <h1>Welcome, {iosUserProfile.full_name}</h1>
        <p>Let's make today count!</p>
      </header>

      {/* Featured Resource for New Users */}
      {featuredResource && !dismissedFeatured && (
        <div className="featured-resource-banner">
          <button
            className="featured-dismiss"
            onClick={handleDismissFeatured}
            aria-label="Dismiss"
          >
            &times;
          </button>
          <div className="featured-content">
            <div className="featured-icon">
              {featuredResource.resource_type === 'video' ? '🎬' :
               featuredResource.resource_type === 'image' ? '🖼️' : '📄'}
            </div>
            <div className="featured-text">
              <h3>
                {featuredResource.resource_type === 'video'
                  ? 'Watch this to get familiar with the platform'
                  : 'Check this out to get started'}
              </h3>
              <p>{featuredResource.title}</p>
            </div>
          </div>
          <button
            className="featured-action-btn"
            onClick={() => navigate('/ios-user/resources')}
          >
            {featuredResource.resource_type === 'video' ? 'Watch Now' : 'View Now'}
          </button>
        </div>
      )}

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

      {/* Debug: Show opportunities loading state */}
      {import.meta.env.DEV && (
        <div className="debug-box">
          <strong>Debug:</strong> Opportunities: {opportunities.length} | Loading: {loadingOpportunities ? 'yes' : 'no'} | Error: {opportunitiesError ? String(opportunitiesError) : 'none'}
        </div>
      )}

      {/* Active Opportunities - Toggle Availability */}
      {opportunities.length > 0 && (
        <div className="opportunities-section" id="opportunities">
          <h3>Available Transactions</h3>
          <p className="section-subtitle">Toggle ON to let your manager know you're ready to participate</p>

          {/* Active Banks Warning */}
          <div className="bank-warning-banner">
            <div className="warning-icon">⚠️</div>
            <div className="warning-content">
              <strong>Important:</strong> Only use the following banks for transactions:
              <div className="supported-banks-list">
                {activeSystemBanks.map(bank => (
                  <span key={bank.id} className="supported-bank-tag">{bank.name}</span>
                ))}
              </div>
              <p className="warning-note">
                Using other banks may result in rejected transactions. We only pay based on rates from our supported banks.
              </p>
            </div>
          </div>

          <div className="opportunities-list-user">
            {opportunities.map(opp => {
              const isAvailable = isAvailableFor(opp.id);
              const isToggling = togglingId === opp.id;

              return (
                <div key={opp.id} className={`opportunity-toggle-card ${isAvailable ? 'available' : ''}`}>
                  <div className="opportunity-info">
                    <div className="opportunity-main">
                      <span className="opportunity-amount">N{opp.amount.toLocaleString()}</span>
                      <span className="opportunity-email">{opp.recipient_email}</span>
                    </div>
                    <div className="opportunity-range">
                      Expected: {opp.min_transactions_per_day}-{opp.max_transactions_per_day} per Apple ID/day
                    </div>
                    <div className="opportunity-banks">
                      <span className="banks-label">Supported Banks:</span>
                      {activeSystemBanks.slice(0, 3).map(bank => (
                        <span key={bank.id} className="bank-chip">{bank.name}</span>
                      ))}
                      {activeSystemBanks.length > 3 && (
                        <span className="bank-chip more">+{activeSystemBanks.length - 3} more</span>
                      )}
                    </div>
                    {opp.instructions && (
                      <div className="opportunity-note">{opp.instructions}</div>
                    )}
                  </div>
                  <div className="toggle-wrapper">
                    <button
                      className={`availability-toggle ${isAvailable ? 'on' : 'off'}`}
                      onClick={() => handleToggle(opp)}
                      disabled={isToggling}
                      aria-label={isAvailable ? 'Mark as unavailable' : 'Mark as available'}
                    >
                      <span className="toggle-slider" />
                      <span className="toggle-label toggle-label-on">Available</span>
                      <span className="toggle-label toggle-label-off">Unavailable</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

        {/* Only show funding card for managed users (not house account members) */}
        {!isHouseMember && (
          <div className="stat-card">
            <h3>Funding</h3>
            <p className="stat-number">
              {iosUserProfile.is_funded
                ? `N${iosUserProfile.funding_amount.toLocaleString()}`
                : 'None'}
            </p>
          </div>
        )}
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

        {/* Manager Info - Different view for house account members */}
        <div className="overview-card">
          <h3>{isHouseMember ? 'Your Team' : 'Your Manager'}</h3>
          {isHouseMember ? (
            <div className="house-member-info">
              <div className="house-icon">🏠</div>
              <div className="house-details">
                <span className="house-title">Independent Partner</span>
                <span className="house-subtitle">Route.ng Direct Team</span>
              </div>
            </div>
          ) : managerProfile ? (
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
