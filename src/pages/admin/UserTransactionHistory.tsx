import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../api/supabase';

// Cutoff date - use parsed_gift_cards BEFORE this date, transaction logs FROM this date
const TRANSACTION_LOG_CUTOFF = '2026-04-08';

interface DailySummary {
  date: string;
  transactionCount: number;
  totalCards: number;
  cardAmountPerCard: number | null;  // Per-card amount (null if mixed values)
  bankChargePerCard: number | null;  // Per-card bank charge (null if N/A or mixed)
  totalValue: number;                // Total = (bank_charge ?? card_amount) × cards
}

interface TransactionDetail {
  id: string;
  transaction_date: string;
  receipt_count: number;
  card_amount: number;        // Per-card amount (e.g., 14900)
  bank_charge_amount: number | null;  // Per-card bank charge (null for old transactions)
  gift_card_amount: number;   // Total value stored in DB
  status: string;
  created_at: string;
  source: 'transaction' | 'auto_checker';
}

export default function UserTransactionHistory() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'summary' | 'details'>('summary');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('all');

  // Fetch user info
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ios_user_profiles')
        .select('id, full_name, apple_id')
        .eq('id', userId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Calculate date filter
  const getDateFilter = () => {
    const now = new Date();
    switch (dateRange) {
      case '7d':
        return new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
      case '30d':
        return new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
      case '90d':
        return new Date(now.setDate(now.getDate() - 90)).toISOString().split('T')[0];
      default:
        return null;
    }
  };

  // Fetch transactions (hybrid: parsed_gift_cards before cutoff, transactions from cutoff)
  const { data: transactionData, isLoading, error } = useQuery({
    queryKey: ['user-transaction-history', userId, dateRange],
    queryFn: async () => {
      const dateFilter = getDateFilter();
      const allTransactions: TransactionDetail[] = [];

      // Query parsed_gift_cards for historical data (before April 8)
      {
        let acQuery = supabase
          .from('parsed_gift_cards')
          .select('id, received_at, amount, sender_email')
          .eq('matched_user_id', userId)
          .lt('received_at', `${TRANSACTION_LOG_CUTOFF}T00:00:00.000Z`)
          .order('received_at', { ascending: false });

        if (dateFilter) {
          acQuery = acQuery.gte('received_at', `${dateFilter}T00:00:00.000Z`);
        }

        const { data: acData, error: acError } = await acQuery;
        if (acError) console.error('AutoChecker query error:', acError);

        // Transform parsed_gift_cards to TransactionDetail format
        acData?.forEach(card => {
          const receivedDate = card.received_at.split('T')[0];
          allTransactions.push({
            id: card.id,
            transaction_date: receivedDate,
            receipt_count: 1,
            card_amount: card.amount,
            bank_charge_amount: null, // No bank charge data for old auto_checker records
            gift_card_amount: card.amount,
            status: 'verified',
            created_at: card.received_at,
            source: 'auto_checker',
          });
        });
      }

      // Query transactions table (logged transactions from April 8 onwards)
      {
        let txQuery = supabase
          .from('transactions')
          .select('*')
          .eq('ios_user_id', userId)
          .order('created_at', { ascending: false });

        if (dateFilter) {
          txQuery = txQuery.gte('transaction_date', dateFilter);
        }

        const { data: txData, error: txError } = await txQuery;
        if (txError) {
          console.error('Transaction query error:', txError);
          throw txError;
        }

        txData?.forEach(tx => {
          allTransactions.push({
            id: tx.id,
            transaction_date: tx.transaction_date,
            receipt_count: tx.receipt_count,
            card_amount: tx.card_amount,
            bank_charge_amount: tx.bank_charge_amount, // Keep null for old transactions
            gift_card_amount: tx.gift_card_amount,
            status: tx.status,
            created_at: tx.created_at,
            source: 'transaction',
          });
        });
      }

      // Sort all by date descending
      allTransactions.sort((a, b) =>
        new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
      );

      return { transactions: allTransactions };
    },
    enabled: !!userId,
  });

  const transactions = transactionData?.transactions || [];

  // Group transactions by date for summary view
  // Card Amount & Bank Charge = per-card values (show "Mixed" if different values on same day)
  // Total Value = sum of ((bank_charge ?? card_amount) × cards)
  const dailySummaries: DailySummary[] = transactions.reduce((acc, tx) => {
    const totalValue = (tx.bank_charge_amount ?? tx.card_amount) * tx.receipt_count;

    const existing = acc.find(s => s.date === tx.transaction_date);
    if (existing) {
      existing.transactionCount += 1;
      existing.totalCards += tx.receipt_count;
      // If card_amount differs from previous, set to null (mixed)
      if (existing.cardAmountPerCard !== null && existing.cardAmountPerCard !== tx.card_amount) {
        existing.cardAmountPerCard = null;
      }
      // If bank_charge differs from previous, set to null (mixed)
      if (existing.bankChargePerCard !== tx.bank_charge_amount) {
        existing.bankChargePerCard = null;
      }
      existing.totalValue += totalValue;
    } else {
      acc.push({
        date: tx.transaction_date,
        transactionCount: 1,
        totalCards: tx.receipt_count,
        cardAmountPerCard: tx.card_amount,
        bankChargePerCard: tx.bank_charge_amount,
        totalValue: totalValue,
      });
    }
    return acc;
  }, [] as DailySummary[]);

  // Calculate totals
  const totals = dailySummaries.reduce(
    (acc, day) => {
      // Track if all days have same per-card amounts
      const newCardAmount = acc.cardAmountPerCard === undefined
        ? day.cardAmountPerCard
        : (acc.cardAmountPerCard === day.cardAmountPerCard ? day.cardAmountPerCard : null);
      const newBankCharge = acc.bankChargePerCard === undefined
        ? day.bankChargePerCard
        : (acc.bankChargePerCard === day.bankChargePerCard ? day.bankChargePerCard : null);

      return {
        transactions: acc.transactions + day.transactionCount,
        cards: acc.cards + day.totalCards,
        cardAmountPerCard: newCardAmount,
        bankChargePerCard: newBankCharge,
        totalValue: acc.totalValue + day.totalValue,
      };
    },
    { transactions: 0, cards: 0, cardAmountPerCard: undefined as number | null | undefined, bankChargePerCard: undefined as number | null | undefined, totalValue: 0 }
  );

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      verified: 'status-badge verified',
      rejected: 'status-badge rejected',
      pending_admin: 'status-badge pending',
      pending_manager: 'status-badge pending-manager',
    };
    const labels: Record<string, string> = {
      verified: 'Verified',
      rejected: 'Rejected',
      pending_admin: 'Pending Admin',
      pending_manager: 'Pending Manager',
    };
    return <span className={classes[status] || 'status-badge'}>{labels[status] || status}</span>;
  };

  return (
    <div className="admin-page user-tx-history-page">
      <header className="page-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div>
          <h1>Transaction History</h1>
          {userProfile ? (
            <p>{userProfile.full_name} ({userProfile.apple_id})</p>
          ) : (
            <p className="loading-text">Loading user profile...</p>
          )}
        </div>
      </header>

      {/* Controls */}
      <div className="history-controls">
        <div className="view-toggle">
          <button
            className={viewMode === 'summary' ? 'active' : ''}
            onClick={() => setViewMode('summary')}
          >
            Daily Summary
          </button>
          <button
            className={viewMode === 'details' ? 'active' : ''}
            onClick={() => setViewMode('details')}
          >
            All Transactions
          </button>
        </div>
        <div className="date-range-select">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value as typeof dateRange)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
      </div>

      {/* Totals Summary */}
      <div className="history-totals">
        <div className="total-item">
          <span className="total-label">Transactions</span>
          <span className="total-value">{totals.transactions}</span>
        </div>
        <div className="total-item">
          <span className="total-label">Total Cards</span>
          <span className="total-value">{totals.cards}</span>
        </div>
        <div className="total-item">
          <span className="total-label">Amount/Card</span>
          <span className="total-value">
            {totals.cardAmountPerCard != null ? `₦${totals.cardAmountPerCard.toLocaleString()}` : 'Mixed'}
          </span>
        </div>
        <div className="total-item">
          <span className="total-label">Bank Charge/Card</span>
          <span className="total-value">
            {totals.bankChargePerCard != null ? `₦${totals.bankChargePerCard.toLocaleString()}` : 'N/A'}
          </span>
        </div>
        <div className="total-item">
          <span className="total-label">Total Value</span>
          <span className="total-value">₦{totals.totalValue.toLocaleString()}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">Loading transactions...</div>
      ) : error ? (
        <div className="empty-state error">
          <p>Error loading transactions: {(error as Error).message}</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions found for this period.</p>
          <p className="empty-hint">This user may not have logged any transactions yet.</p>
        </div>
      ) : viewMode === 'summary' ? (
        /* Daily Summary Table */
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Txns</th>
                <th>Cards</th>
                <th>Amount/Card</th>
                <th>Bank Charge/Card</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {dailySummaries.map(day => (
                <tr key={day.date}>
                  <td className="date-cell">{day.date}</td>
                  <td>{day.transactionCount}</td>
                  <td>{day.totalCards}</td>
                  <td>{day.cardAmountPerCard != null ? `₦${day.cardAmountPerCard.toLocaleString()}` : 'Mixed'}</td>
                  <td>{day.bankChargePerCard != null ? `₦${day.bankChargePerCard.toLocaleString()}` : 'N/A'}</td>
                  <td className="total-cell">₦{day.totalValue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                <td><strong>{totals.transactions}</strong></td>
                <td><strong>{totals.cards}</strong></td>
                <td><strong>{totals.cardAmountPerCard != null ? `₦${totals.cardAmountPerCard.toLocaleString()}` : 'Mixed'}</strong></td>
                <td><strong>{totals.bankChargePerCard != null ? `₦${totals.bankChargePerCard.toLocaleString()}` : 'N/A'}</strong></td>
                <td className="total-cell"><strong>₦{totals.totalValue.toLocaleString()}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        /* Detailed Transactions Table */
        <div className="history-table-container">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Cards</th>
                <th>Card Amount</th>
                <th>Bank Charge</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                // Total = (bank_charge ?? card_amount) × cards
                const perCardForTotal = tx.bank_charge_amount ?? tx.card_amount;
                const totalValue = perCardForTotal * tx.receipt_count;
                return (
                  <tr key={tx.id}>
                    <td className="date-cell">{tx.transaction_date}</td>
                    <td>{tx.receipt_count}</td>
                    <td>₦{tx.card_amount.toLocaleString()}</td>
                    <td>{tx.bank_charge_amount != null ? `₦${tx.bank_charge_amount.toLocaleString()}` : 'N/A'}</td>
                    <td className="total-cell">₦{totalValue.toLocaleString()}</td>
                    <td>{getStatusBadge(tx.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
