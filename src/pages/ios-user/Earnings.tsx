import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getUserTransactions } from '../../api/transactions';
import { getUserPayouts, requestPayout, type Payout } from '../../api/payouts';
import { usePlatformSettings } from '../../hooks/usePlatformSettings';

export default function IOSUserEarnings() {
  const { iosUserProfile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'earnings' | 'payouts'>('earnings');
  const {
    earningsPerCard,
    minDailyTransactions,
    maxDailyTransactions,
    minDailyEarnings,
    maxDailyEarnings
  } = usePlatformSettings();

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['user-transactions', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserTransactions(iosUserProfile.id) : [],
    enabled: !!iosUserProfile,
  });

  const { data: payouts = [], isLoading: loadingPayouts } = useQuery({
    queryKey: ['user-payouts', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserPayouts(iosUserProfile.id) : [],
    enabled: !!iosUserProfile,
  });

  const requestPayoutMutation = useMutation({
    mutationFn: ({ date, amount }: { date: string; amount: number }) => {
      if (!iosUserProfile) throw new Error('No profile');
      return requestPayout(iosUserProfile.id, 'ios_user', amount, date);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-payouts'] });
    },
  });

  // Group verified transactions by date
  const verifiedByDate = transactions
    .filter(tx => tx.status === 'verified')
    .reduce((acc, tx) => {
      const date = tx.transaction_date.split('T')[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(tx);
      return acc;
    }, {} as Record<string, typeof transactions>);

  // Get dates that already have payout requests
  const requestedDates = new Set(payouts.map(p => p.reference_date));

  // Calculate earnings per day based on card count
  const dailyEarnings = Object.entries(verifiedByDate)
    .map(([date, txs]) => {
      // Sum up all cards from transactions (each tx can have multiple cards)
      const cardCount = txs.reduce((sum, tx) => sum + (tx.card_count || 1), 0);
      const earned = cardCount * earningsPerCard;
      return {
        date,
        transactionCount: txs.length,
        cardCount,
        totalAmount: txs.reduce((sum, tx) => sum + tx.gift_card_amount, 0),
        earned,
        payoutRequested: requestedDates.has(date),
        payout: payouts.find(p => p.reference_date === date),
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalCards = dailyEarnings.reduce((sum, d) => sum + d.cardCount, 0);
  const totalEarned = dailyEarnings.reduce((sum, d) => sum + d.earned, 0);

  // Calculate pending payout amount (earned but not yet requested)
  const pendingAmount = dailyEarnings
    .filter(d => d.earned > 0 && !d.payoutRequested)
    .reduce((sum, d) => sum + d.earned, 0);

  const paidAmount = payouts
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const getPayoutStatusBadge = (payout?: Payout) => {
    if (!payout) return null;
    const classes: Record<string, string> = {
      pending: 'pending',
      approved: 'approved',
      paid: 'paid',
      rejected: 'rejected',
    };
    return (
      <span className={`payout-status-badge ${classes[payout.status]}`}>
        {payout.status}
      </span>
    );
  };

  return (
    <div className="ios-user-page">
      <header className="page-header">
        <h1>Earnings & Payouts</h1>
        <p>Track your earnings and request payouts</p>
      </header>

      <div className="earnings-summary">
        <div className="earnings-card total">
          <h3>Total Earned</h3>
          <p className="earnings-amount">N{totalEarned.toLocaleString()}</p>
          <span className="earnings-detail">{totalCards} cards</span>
        </div>
        <div className="earnings-card">
          <h3>Paid Out</h3>
          <p className="earnings-number">N{paidAmount.toLocaleString()}</p>
        </div>
        <div className="earnings-card highlight">
          <h3>Available</h3>
          <p className="earnings-number">N{pendingAmount.toLocaleString()}</p>
        </div>
        <div className="earnings-card">
          <h3>Per Card</h3>
          <p className="earnings-number">N{earningsPerCard.toLocaleString()}</p>
        </div>
      </div>

      <div className="earnings-tabs">
        <button
          className={activeTab === 'earnings' ? 'active' : ''}
          onClick={() => setActiveTab('earnings')}
        >
          Daily Earnings
        </button>
        <button
          className={activeTab === 'payouts' ? 'active' : ''}
          onClick={() => setActiveTab('payouts')}
        >
          Payout History ({payouts.length})
        </button>
      </div>

      {activeTab === 'earnings' && (
        <>
          <div className="earnings-info-banner">
            <h4>How Earnings Work</h4>
            <p>You earn <strong>N{earningsPerCard.toLocaleString()}</strong> for each approved gift card.</p>
            <p>Daily target: <strong>{minDailyTransactions}-{maxDailyTransactions} cards</strong> = N{minDailyEarnings.toLocaleString()}-N{maxDailyEarnings.toLocaleString()}</p>
          </div>

          <section className="earnings-history">
            <h2>Daily Breakdown</h2>
            {loadingTx ? (
              <div className="loading">Loading...</div>
            ) : dailyEarnings.length === 0 ? (
              <div className="empty-state">
                <p>No verified transactions yet.</p>
                <p>Complete transactions to start earning!</p>
              </div>
            ) : (
              <div className="earnings-table">
                <div className="earnings-table-header">
                  <span>Date</span>
                  <span>Cards</span>
                  <span>Earned</span>
                  <span>Action</span>
                </div>
                {dailyEarnings.map(day => (
                  <div key={day.date} className={`earnings-row ${day.cardCount > 0 ? 'has-earnings' : ''}`}>
                    <span className="earnings-date">
                      {new Date(day.date).toLocaleDateString('en-NG', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <span className="earnings-count">{day.cardCount}</span>
                    <span className={`earnings-payout ${day.earned > 0 ? 'earned' : ''}`}>
                      {day.earned > 0 ? `N${day.earned.toLocaleString()}` : '-'}
                    </span>
                    <span className="earnings-action">
                      {day.earned > 0 && !day.payoutRequested ? (
                        <button
                          className="request-payout-btn"
                          onClick={() => requestPayoutMutation.mutate({
                            date: day.date,
                            amount: day.earned
                          })}
                          disabled={requestPayoutMutation.isPending}
                        >
                          Request
                        </button>
                      ) : day.payout ? (
                        getPayoutStatusBadge(day.payout)
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'payouts' && (
        <section className="payouts-history">
          <h2>Payout Requests</h2>
          {loadingPayouts ? (
            <div className="loading">Loading...</div>
          ) : payouts.length === 0 ? (
            <div className="empty-state">
              <p>No payout requests yet.</p>
              <p>Request payouts for days you've met your target.</p>
            </div>
          ) : (
            <div className="payouts-list-user">
              {payouts.map(payout => (
                <div key={payout.id} className={`payout-item ${payout.status}`}>
                  <div className="payout-item-info">
                    <span className="payout-date">
                      {new Date(payout.reference_date).toLocaleDateString('en-NG', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <span className="payout-requested">
                      Requested: {new Date(payout.requested_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="payout-item-amount">
                    N{payout.amount.toLocaleString()}
                  </div>
                  <span className={`status-badge ${payout.status}`}>
                    {payout.status}
                  </span>
                  {payout.status === 'rejected' && payout.rejection_reason && (
                    <div className="payout-rejection-reason">
                      Reason: {payout.rejection_reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
