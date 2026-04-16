import { supabase } from './supabase';

// ============================================
// ANALYTICS DATA TYPES
// ============================================

export interface DailyStats {
  date: string;
  transactionCount: number;
  cardCount: number;
  totalValue: number;
  userCount: number;
}

export interface GrowthMetrics {
  currentPeriod: number;
  previousPeriod: number;
  growthRate: number;
  growthAmount: number;
}

export interface AnalyticsSummary {
  totalGTV: number;
  totalTransactions: number;
  totalCards: number;
  totalUsers: number;
  totalManagers: number;
  avgTransactionValue: number;
}

export interface PeriodComparison {
  revenue: GrowthMetrics;
  transactions: GrowthMetrics;
  cards: GrowthMetrics;
  users: GrowthMetrics;
}

// ============================================
// ANALYTICS QUERIES (Hybrid: AutoChecker + Transaction Logs)
// ============================================

// Cutoff date - use parsed_gift_cards BEFORE this date, transaction logs FROM this date
const TRANSACTION_LOG_CUTOFF = '2026-04-08';

// Standard expected card amount (Naira)
const EXPECTED_CARD_AMOUNT = 14900;

// Get overall summary stats (combines both data sources)
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  // Get parsed_gift_cards BEFORE cutoff date
  const { data: giftCards, error: gcError } = await supabase
    .from('parsed_gift_cards')
    .select('amount, matched_user_id')
    .lt('received_at', TRANSACTION_LOG_CUTOFF);

  if (gcError) throw gcError;

  // Get transactions FROM cutoff date onwards
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('gift_card_amount, receipt_count, ios_user_id')
    .gte('transaction_date', TRANSACTION_LOG_CUTOFF);

  if (txError) throw txError;

  // Combine stats
  const gcCards = giftCards?.length || 0;
  const gcValue = giftCards?.reduce((sum, gc) => sum + (gc.amount || 0), 0) || 0;

  const txCards = transactions?.reduce((sum, tx) => sum + (tx.receipt_count || 1), 0) || 0;
  const txValue = transactions?.reduce((sum, tx) => sum + (tx.gift_card_amount || 0), 0) || 0;

  const totalCards = gcCards + txCards;
  const totalGTV = gcValue + txValue;
  const totalTransactions = (giftCards?.length || 0) + (transactions?.length || 0);

  // Get total users
  const { count: totalUsers, error: userError } = await supabase
    .from('ios_user_profiles')
    .select('*', { count: 'exact', head: true });

  if (userError) throw userError;

  // Get total managers
  const { count: totalManagers, error: managerError } = await supabase
    .from('manager_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'verified');

  if (managerError) throw managerError;

  return {
    totalGTV,
    totalTransactions,
    totalCards,
    totalUsers: totalUsers || 0,
    totalManagers: totalManagers || 0,
    avgTransactionValue: totalTransactions > 0 ? totalGTV / totalTransactions : 0,
  };
}

// Period-specific summary for custom date ranges
export interface IncorrectAmountDetail {
  date: string;
  amount: number;
  senderEmail: string;
}

export interface PeriodSummary {
  totalCards: number;
  totalRevenue: number;
  uniqueUsers: number;
  avgCardValue: number;
  correctAmountCards: number;
  incorrectAmountCards: number;
  incorrectAmountDetails: IncorrectAmountDetail[];
}

// Get summary stats for a specific date range (hybrid: AutoChecker + Transaction Logs)
export async function getAnalyticsSummaryForPeriod(
  startDate: string,
  endDate: string
): Promise<PeriodSummary> {
  const allIncorrectDetails: IncorrectAmountDetail[] = [];
  const uniqueUserIds = new Set<string>();
  let totalCards = 0;
  let totalRevenue = 0;
  let correctAmountCards = 0;

  // Determine date ranges for each source
  const cutoffDate = new Date(TRANSACTION_LOG_CUTOFF);
  const start = new Date(startDate);
  const end = new Date(endDate);

  // If any part of range is before cutoff, query parsed_gift_cards
  if (start < cutoffDate) {
    const gcEndDate = end < cutoffDate ? endDate : TRANSACTION_LOG_CUTOFF;

    const { data: giftCards, error: gcError } = await supabase
      .from('parsed_gift_cards')
      .select('amount, matched_user_id, received_at, sender_email')
      .gte('received_at', startDate)
      .lt('received_at', gcEndDate + 'T00:00:00');

    if (gcError) throw gcError;

    totalCards += giftCards?.length || 0;
    totalRevenue += giftCards?.reduce((sum, gc) => sum + (gc.amount || 0), 0) || 0;
    giftCards?.forEach(gc => {
      if (gc.matched_user_id) uniqueUserIds.add(gc.matched_user_id);
      if (gc.amount === EXPECTED_CARD_AMOUNT) {
        correctAmountCards += 1;
      } else {
        allIncorrectDetails.push({
          date: gc.received_at.split('T')[0],
          amount: gc.amount || 0,
          senderEmail: gc.sender_email || 'Unknown',
        });
      }
    });
  }

  // If any part of range is from cutoff onwards, query transactions
  if (end >= cutoffDate) {
    const txStartDate = start >= cutoffDate ? startDate : TRANSACTION_LOG_CUTOFF;

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select(`
        gift_card_amount,
        card_amount,
        receipt_count,
        ios_user_id,
        transaction_date,
        ios_user:ios_user_profiles(apple_id)
      `)
      .gte('transaction_date', txStartDate)
      .lte('transaction_date', endDate);

    if (txError) throw txError;

    totalCards += transactions?.reduce((sum, tx) => sum + (tx.receipt_count || 1), 0) || 0;
    totalRevenue += transactions?.reduce((sum, tx) => sum + (tx.gift_card_amount || 0), 0) || 0;
    transactions?.forEach(tx => {
      if (tx.ios_user_id) uniqueUserIds.add(tx.ios_user_id);
      const cardCount = tx.receipt_count || 1;
      if (tx.card_amount === EXPECTED_CARD_AMOUNT) {
        correctAmountCards += cardCount;
      } else {
        allIncorrectDetails.push({
          date: tx.transaction_date,
          amount: tx.card_amount || 0,
          senderEmail: (tx.ios_user as { apple_id?: string })?.apple_id || 'Unknown',
        });
      }
    });
  }

  // Sort incorrect details by date descending
  allIncorrectDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    totalCards,
    totalRevenue,
    uniqueUsers: uniqueUserIds.size,
    avgCardValue: totalCards > 0 ? totalRevenue / totalCards : 0,
    correctAmountCards,
    incorrectAmountCards: allIncorrectDetails.length,
    incorrectAmountDetails: allIncorrectDetails,
  };
}

// Get top performers for a specific date range (hybrid: AutoChecker + Transaction Logs)
export async function getTopPerformersForPeriod(
  startDate: string,
  endDate: string,
  limit: number = 10
): Promise<{
  userId: string;
  userName: string;
  transactionCount: number;
  totalValue: number;
}[]> {
  const userStats = new Map<string, { count: number; value: number }>();

  // Determine date ranges for each source
  const cutoffDate = new Date(TRANSACTION_LOG_CUTOFF);
  const start = new Date(startDate);
  const end = new Date(endDate);

  // If any part of range is before cutoff, query parsed_gift_cards
  if (start < cutoffDate) {
    const gcEndDate = end < cutoffDate ? endDate : TRANSACTION_LOG_CUTOFF;

    const { data: giftCards, error: gcError } = await supabase
      .from('parsed_gift_cards')
      .select('matched_user_id, amount')
      .gte('received_at', startDate)
      .lt('received_at', gcEndDate + 'T00:00:00');

    if (gcError) throw gcError;

    giftCards?.forEach(gc => {
      if (!gc.matched_user_id) return;
      const existing = userStats.get(gc.matched_user_id) || { count: 0, value: 0 };
      existing.count += 1;
      existing.value += gc.amount || 0;
      userStats.set(gc.matched_user_id, existing);
    });
  }

  // If any part of range is from cutoff onwards, query transactions
  if (end >= cutoffDate) {
    const txStartDate = start >= cutoffDate ? startDate : TRANSACTION_LOG_CUTOFF;

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('ios_user_id, gift_card_amount, receipt_count')
      .gte('transaction_date', txStartDate)
      .lte('transaction_date', endDate);

    if (txError) throw txError;

    transactions?.forEach(tx => {
      if (!tx.ios_user_id) return;
      const existing = userStats.get(tx.ios_user_id) || { count: 0, value: 0 };
      existing.count += tx.receipt_count || 1;
      existing.value += tx.gift_card_amount || 0;
      userStats.set(tx.ios_user_id, existing);
    });
  }

  // Get user names
  const userIds = Array.from(userStats.keys());
  if (userIds.length === 0) return [];

  const { data: users, error: userError } = await supabase
    .from('ios_user_profiles')
    .select('id, full_name')
    .in('id', userIds);

  if (userError) throw userError;

  const userNameMap = new Map(users?.map(u => [u.id, u.full_name]) || []);

  return Array.from(userStats.entries())
    .map(([userId, stats]) => ({
      userId,
      userName: userNameMap.get(userId) || 'Unknown',
      transactionCount: stats.count,
      totalValue: stats.value,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, limit);
}

// Get daily stats for a date range (hybrid: AutoChecker + Transaction Logs)
export async function getDailyStats(
  startDate: string,
  endDate: string
): Promise<DailyStats[]> {
  // Initialize all dates in range
  const dailyMap = new Map<string, DailyStats>();
  const usersByDate = new Map<string, Set<string>>();

  const start = new Date(startDate);
  const end = new Date(endDate);
  const cutoffDate = new Date(TRANSACTION_LOG_CUTOFF);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dailyMap.set(dateStr, {
      date: dateStr,
      transactionCount: 0,
      cardCount: 0,
      totalValue: 0,
      userCount: 0,
    });
    usersByDate.set(dateStr, new Set());
  }

  // If any part of range is before cutoff, query parsed_gift_cards
  if (start < cutoffDate) {
    const gcEndDate = end < cutoffDate ? endDate : TRANSACTION_LOG_CUTOFF;

    const { data: giftCards, error: gcError } = await supabase
      .from('parsed_gift_cards')
      .select('received_at, amount, matched_user_id')
      .gte('received_at', startDate)
      .lt('received_at', gcEndDate + 'T00:00:00')
      .order('received_at', { ascending: true });

    if (gcError) throw gcError;

    giftCards?.forEach(gc => {
      const date = gc.received_at.split('T')[0];
      const existing = dailyMap.get(date);
      if (existing) {
        existing.transactionCount += 1;
        existing.cardCount += 1;
        existing.totalValue += gc.amount || 0;

        if (gc.matched_user_id) {
          usersByDate.get(date)!.add(gc.matched_user_id);
        }
      }
    });
  }

  // If any part of range is from cutoff onwards, query transactions
  if (end >= cutoffDate) {
    const txStartDate = start >= cutoffDate ? startDate : TRANSACTION_LOG_CUTOFF;

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('transaction_date, gift_card_amount, receipt_count, ios_user_id')
      .gte('transaction_date', txStartDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true });

    if (txError) throw txError;

    transactions?.forEach(tx => {
      const date = tx.transaction_date;
      const existing = dailyMap.get(date);
      if (existing) {
        existing.transactionCount += 1;
        existing.cardCount += tx.receipt_count || 1;
        existing.totalValue += tx.gift_card_amount || 0;

        if (tx.ios_user_id) {
          usersByDate.get(date)!.add(tx.ios_user_id);
        }
      }
    });
  }

  // Set user counts
  usersByDate.forEach((users, date) => {
    const stats = dailyMap.get(date);
    if (stats) {
      stats.userCount = users.size;
    }
  });

  return Array.from(dailyMap.values());
}

// Get weekly aggregated stats
export async function getWeeklyStats(
  startDate: string,
  endDate: string
): Promise<DailyStats[]> {
  const dailyStats = await getDailyStats(startDate, endDate);

  // Group by week
  const weeklyMap = new Map<string, DailyStats>();

  dailyStats.forEach(day => {
    const date = new Date(day.date);
    // Get Monday of the week
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const weekKey = monday.toISOString().split('T')[0];

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, {
        date: weekKey,
        transactionCount: 0,
        cardCount: 0,
        totalValue: 0,
        userCount: 0,
      });
    }

    const week = weeklyMap.get(weekKey)!;
    week.transactionCount += day.transactionCount;
    week.cardCount += day.cardCount;
    week.totalValue += day.totalValue;
    week.userCount = Math.max(week.userCount, day.userCount); // Peak users
  });

  return Array.from(weeklyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Get monthly aggregated stats
export async function getMonthlyStats(
  startDate: string,
  endDate: string
): Promise<DailyStats[]> {
  const dailyStats = await getDailyStats(startDate, endDate);

  // Group by month
  const monthlyMap = new Map<string, DailyStats>();

  dailyStats.forEach(day => {
    const monthKey = day.date.substring(0, 7); // YYYY-MM

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        date: monthKey + '-01',
        transactionCount: 0,
        cardCount: 0,
        totalValue: 0,
        userCount: 0,
      });
    }

    const month = monthlyMap.get(monthKey)!;
    month.transactionCount += day.transactionCount;
    month.cardCount += day.cardCount;
    month.totalValue += day.totalValue;
    month.userCount = Math.max(month.userCount, day.userCount);
  });

  return Array.from(monthlyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Get growth comparison (current vs previous period)
export async function getPeriodComparison(
  period: 'week' | 'month' | 'quarter'
): Promise<PeriodComparison> {
  const now = new Date();
  let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

  switch (period) {
    case 'week':
      currentEnd = new Date(now);
      currentStart = new Date(now);
      currentStart.setDate(currentStart.getDate() - 7);
      previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      previousStart = new Date(previousEnd);
      previousStart.setDate(previousStart.getDate() - 6);
      break;
    case 'month':
      currentEnd = new Date(now);
      currentStart = new Date(now);
      currentStart.setMonth(currentStart.getMonth() - 1);
      previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      previousStart = new Date(previousEnd);
      previousStart.setMonth(previousStart.getMonth() - 1);
      break;
    case 'quarter':
      currentEnd = new Date(now);
      currentStart = new Date(now);
      currentStart.setMonth(currentStart.getMonth() - 3);
      previousEnd = new Date(currentStart);
      previousEnd.setDate(previousEnd.getDate() - 1);
      previousStart = new Date(previousEnd);
      previousStart.setMonth(previousStart.getMonth() - 3);
      break;
  }

  const [currentStats, previousStats] = await Promise.all([
    getDailyStats(currentStart.toISOString().split('T')[0], currentEnd.toISOString().split('T')[0]),
    getDailyStats(previousStart.toISOString().split('T')[0], previousEnd.toISOString().split('T')[0]),
  ]);

  const sumStats = (stats: DailyStats[]) => ({
    revenue: stats.reduce((sum, s) => sum + s.totalValue, 0),
    transactions: stats.reduce((sum, s) => sum + s.transactionCount, 0),
    cards: stats.reduce((sum, s) => sum + s.cardCount, 0),
    users: new Set(stats.flatMap(s => s.userCount)).size || stats.reduce((max, s) => Math.max(max, s.userCount), 0),
  });

  const current = sumStats(currentStats);
  const previous = sumStats(previousStats);

  const calcGrowth = (curr: number, prev: number): GrowthMetrics => ({
    currentPeriod: curr,
    previousPeriod: prev,
    growthRate: prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0,
    growthAmount: curr - prev,
  });

  return {
    revenue: calcGrowth(current.revenue, previous.revenue),
    transactions: calcGrowth(current.transactions, previous.transactions),
    cards: calcGrowth(current.cards, previous.cards),
    users: calcGrowth(current.users, previous.users),
  };
}

// Get user growth over time
export async function getUserGrowthStats(
  startDate: string,
  endDate: string
): Promise<{ date: string; totalUsers: number; newUsers: number }[]> {
  const { data: users, error } = await supabase
    .from('ios_user_profiles')
    .select('created_at')
    .gte('created_at', startDate)
    .lte('created_at', endDate + 'T23:59:59')
    .order('created_at', { ascending: true });

  if (error) throw error;

  // Get total users before start date
  const { count: existingUsers } = await supabase
    .from('ios_user_profiles')
    .select('*', { count: 'exact', head: true })
    .lt('created_at', startDate);

  let runningTotal = existingUsers || 0;
  const dailyMap = new Map<string, { totalUsers: number; newUsers: number }>();

  // Initialize dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dailyMap.set(dateStr, { totalUsers: runningTotal, newUsers: 0 });
  }

  // Count new users per day
  users?.forEach(user => {
    const date = user.created_at.split('T')[0];
    const stats = dailyMap.get(date);
    if (stats) {
      stats.newUsers += 1;
    }
  });

  // Calculate running totals
  const result: { date: string; totalUsers: number; newUsers: number }[] = [];
  dailyMap.forEach((stats, date) => {
    runningTotal += stats.newUsers;
    result.push({
      date,
      totalUsers: runningTotal,
      newUsers: stats.newUsers,
    });
  });

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

// Get transaction status breakdown (Transaction Logs view - from cutoff date)
export async function getTransactionStatusBreakdown(): Promise<{ status: string; count: number }[]> {
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('status, card_amount, receipt_count')
    .gte('transaction_date', TRANSACTION_LOG_CUTOFF);

  if (error) throw error;

  // Count by status
  let pendingManager = 0;
  let pendingAdmin = 0;
  let verified = 0;
  let rejected = 0;
  let correctAmount = 0;
  let incorrectAmount = 0;

  transactions?.forEach(tx => {
    const cardCount = tx.receipt_count || 1;

    switch (tx.status) {
      case 'pending_manager':
        pendingManager += cardCount;
        break;
      case 'pending_admin':
        pendingAdmin += cardCount;
        break;
      case 'verified':
        verified += cardCount;
        break;
      case 'rejected':
        rejected += cardCount;
        break;
    }

    // Check card amount
    if (tx.card_amount === EXPECTED_CARD_AMOUNT) {
      correctAmount += cardCount;
    } else {
      incorrectAmount += cardCount;
    }
  });

  return [
    { status: 'pending_manager', count: pendingManager },
    { status: 'pending_admin', count: pendingAdmin },
    { status: 'verified', count: verified },
    { status: 'rejected', count: rejected },
    { status: 'correct_amount', count: correctAmount },
    { status: 'incorrect_amount', count: incorrectAmount },
  ];
}

// Get AutoChecker-style breakdown (matched/unmatched, correct/incorrect amount)
// Uses parsed_gift_cards only (before cutoff date)
export async function getAutoCheckerStatusBreakdown(): Promise<{ status: string; count: number }[]> {
  const { data: giftCards, error } = await supabase
    .from('parsed_gift_cards')
    .select('matched_user_id, amount')
    .lt('received_at', TRANSACTION_LOG_CUTOFF);

  if (error) throw error;

  let matched = 0;
  let unmatched = 0;
  let correctAmount = 0;
  let incorrectAmount = 0;

  giftCards?.forEach(card => {
    if (card.matched_user_id) {
      matched++;
    } else {
      unmatched++;
    }

    if (card.amount === EXPECTED_CARD_AMOUNT) {
      correctAmount++;
    } else {
      incorrectAmount++;
    }
  });

  return [
    { status: 'matched', count: matched },
    { status: 'unmatched', count: unmatched },
    { status: 'correct_amount', count: correctAmount },
    { status: 'incorrect_amount', count: incorrectAmount },
  ];
}

// Combined status breakdown (both sources)
export type StatusBreakdownMode = 'autochecker' | 'transactions' | 'combined';

export async function getStatusBreakdown(mode: StatusBreakdownMode = 'combined'): Promise<{ status: string; count: number }[]> {
  if (mode === 'autochecker') {
    return getAutoCheckerStatusBreakdown();
  }
  if (mode === 'transactions') {
    return getTransactionStatusBreakdown();
  }

  // Combined mode - show both
  const [autoChecker, transactions] = await Promise.all([
    getAutoCheckerStatusBreakdown(),
    getTransactionStatusBreakdown(),
  ]);

  // Combine correct/incorrect amounts from both sources
  const acCorrect = autoChecker.find(s => s.status === 'correct_amount')?.count || 0;
  const acIncorrect = autoChecker.find(s => s.status === 'incorrect_amount')?.count || 0;
  const txCorrect = transactions.find(s => s.status === 'correct_amount')?.count || 0;
  const txIncorrect = transactions.find(s => s.status === 'incorrect_amount')?.count || 0;

  return [
    // AutoChecker specific
    { status: 'matched', count: autoChecker.find(s => s.status === 'matched')?.count || 0 },
    { status: 'unmatched', count: autoChecker.find(s => s.status === 'unmatched')?.count || 0 },
    // Transaction Logs specific
    { status: 'pending_manager', count: transactions.find(s => s.status === 'pending_manager')?.count || 0 },
    { status: 'pending_admin', count: transactions.find(s => s.status === 'pending_admin')?.count || 0 },
    { status: 'verified', count: transactions.find(s => s.status === 'verified')?.count || 0 },
    { status: 'rejected', count: transactions.find(s => s.status === 'rejected')?.count || 0 },
    // Combined amounts
    { status: 'correct_amount', count: acCorrect + txCorrect },
    { status: 'incorrect_amount', count: acIncorrect + txIncorrect },
  ];
}

// Get top performing users (hybrid: all AutoChecker + Transaction Logs from cutoff)
export async function getTopPerformers(limit: number = 10): Promise<{
  userId: string;
  userName: string;
  transactionCount: number;
  totalValue: number;
}[]> {
  const userStats = new Map<string, { count: number; value: number }>();

  // Get ALL parsed_gift_cards BEFORE cutoff date
  const { data: giftCards, error: gcError } = await supabase
    .from('parsed_gift_cards')
    .select('matched_user_id, amount')
    .lt('received_at', TRANSACTION_LOG_CUTOFF);

  if (gcError) throw gcError;

  giftCards?.forEach(gc => {
    if (!gc.matched_user_id) return;
    const existing = userStats.get(gc.matched_user_id) || { count: 0, value: 0 };
    existing.count += 1;
    existing.value += gc.amount || 0;
    userStats.set(gc.matched_user_id, existing);
  });

  // Get transactions FROM cutoff date
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('ios_user_id, gift_card_amount, receipt_count')
    .gte('transaction_date', TRANSACTION_LOG_CUTOFF);

  if (txError) throw txError;

  transactions?.forEach(tx => {
    if (!tx.ios_user_id) return;
    const existing = userStats.get(tx.ios_user_id) || { count: 0, value: 0 };
    existing.count += tx.receipt_count || 1;
    existing.value += tx.gift_card_amount || 0;
    userStats.set(tx.ios_user_id, existing);
  });

  // Get user names
  const userIds = Array.from(userStats.keys());
  if (userIds.length === 0) return [];

  const { data: users, error: userError } = await supabase
    .from('ios_user_profiles')
    .select('id, full_name')
    .in('id', userIds);

  if (userError) throw userError;

  const userNameMap = new Map(users?.map(u => [u.id, u.full_name]) || []);

  // Sort and limit
  return Array.from(userStats.entries())
    .map(([userId, stats]) => ({
      userId,
      userName: userNameMap.get(userId) || 'Unknown',
      transactionCount: stats.count,
      totalValue: stats.value,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, limit);
}

// ============================================
// MANAGER ANALYTICS (Team-scoped)
// ============================================

export interface ManagerAnalyticsSummary {
  teamTotalCards: number;
  teamTotalValue: number;
  teamMemberCount: number;
  avgCardsPerMember: number;
}

// Get manager's team member IDs
async function getManagerTeamIds(managerId: string): Promise<string[]> {
  const { data: teamMembers, error } = await supabase
    .from('ios_user_profiles')
    .select('id')
    .eq('manager_id', managerId);

  if (error) throw error;
  return teamMembers?.map(m => m.id) || [];
}

// Get team summary stats for a manager (hybrid: AutoChecker + Transaction Logs)
export async function getManagerTeamSummary(managerId: string): Promise<ManagerAnalyticsSummary> {
  const teamIds = await getManagerTeamIds(managerId);

  if (teamIds.length === 0) {
    return {
      teamTotalCards: 0,
      teamTotalValue: 0,
      teamMemberCount: 0,
      avgCardsPerMember: 0,
    };
  }

  let teamTotalCards = 0;
  let teamTotalValue = 0;

  // Get parsed_gift_cards BEFORE cutoff date
  const { data: giftCards, error: gcError } = await supabase
    .from('parsed_gift_cards')
    .select('amount, matched_user_id')
    .in('matched_user_id', teamIds)
    .lt('received_at', TRANSACTION_LOG_CUTOFF);

  if (gcError) throw gcError;

  teamTotalCards += giftCards?.length || 0;
  teamTotalValue += giftCards?.reduce((sum, gc) => sum + (gc.amount || 0), 0) || 0;

  // Get transactions FROM cutoff date
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('gift_card_amount, receipt_count, ios_user_id')
    .in('ios_user_id', teamIds)
    .gte('transaction_date', TRANSACTION_LOG_CUTOFF);

  if (txError) throw txError;

  teamTotalCards += transactions?.reduce((sum, tx) => sum + (tx.receipt_count || 1), 0) || 0;
  teamTotalValue += transactions?.reduce((sum, tx) => sum + (tx.gift_card_amount || 0), 0) || 0;

  return {
    teamTotalCards,
    teamTotalValue,
    teamMemberCount: teamIds.length,
    avgCardsPerMember: teamIds.length > 0 ? teamTotalCards / teamIds.length : 0,
  };
}

// Get daily stats for manager's team (hybrid: AutoChecker + Transaction Logs)
export async function getManagerTeamDailyStats(
  managerId: string,
  startDate: string,
  endDate: string
): Promise<DailyStats[]> {
  const teamIds = await getManagerTeamIds(managerId);

  if (teamIds.length === 0) {
    return [];
  }

  // Initialize all dates in range
  const dailyMap = new Map<string, DailyStats>();
  const usersByDate = new Map<string, Set<string>>();

  const start = new Date(startDate);
  const end = new Date(endDate);
  const cutoffDate = new Date(TRANSACTION_LOG_CUTOFF);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dailyMap.set(dateStr, {
      date: dateStr,
      transactionCount: 0,
      cardCount: 0,
      totalValue: 0,
      userCount: 0,
    });
    usersByDate.set(dateStr, new Set());
  }

  // If any part of range is before cutoff, query parsed_gift_cards
  if (start < cutoffDate) {
    const gcEndDate = end < cutoffDate ? endDate : TRANSACTION_LOG_CUTOFF;

    const { data: giftCards, error: gcError } = await supabase
      .from('parsed_gift_cards')
      .select('received_at, amount, matched_user_id')
      .in('matched_user_id', teamIds)
      .gte('received_at', startDate)
      .lt('received_at', gcEndDate + 'T00:00:00')
      .order('received_at', { ascending: true });

    if (gcError) throw gcError;

    giftCards?.forEach(gc => {
      const date = gc.received_at.split('T')[0];
      const existing = dailyMap.get(date);
      if (existing) {
        existing.transactionCount += 1;
        existing.cardCount += 1;
        existing.totalValue += gc.amount || 0;

        if (gc.matched_user_id) {
          usersByDate.get(date)!.add(gc.matched_user_id);
        }
      }
    });
  }

  // If any part of range is from cutoff onwards, query transactions
  if (end >= cutoffDate) {
    const txStartDate = start >= cutoffDate ? startDate : TRANSACTION_LOG_CUTOFF;

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('transaction_date, gift_card_amount, receipt_count, ios_user_id')
      .in('ios_user_id', teamIds)
      .gte('transaction_date', txStartDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true });

    if (txError) throw txError;

    transactions?.forEach(tx => {
      const date = tx.transaction_date;
      const existing = dailyMap.get(date);
      if (existing) {
        existing.transactionCount += 1;
        existing.cardCount += tx.receipt_count || 1;
        existing.totalValue += tx.gift_card_amount || 0;

        if (tx.ios_user_id) {
          usersByDate.get(date)!.add(tx.ios_user_id);
        }
      }
    });
  }

  usersByDate.forEach((users, date) => {
    const stats = dailyMap.get(date);
    if (stats) {
      stats.userCount = users.size;
    }
  });

  return Array.from(dailyMap.values());
}

// Get top performers within manager's team (hybrid: AutoChecker + Transaction Logs)
export async function getManagerTeamTopPerformers(
  managerId: string,
  limit: number = 10
): Promise<{
  userId: string;
  userName: string;
  transactionCount: number;
  totalValue: number;
}[]> {
  const teamIds = await getManagerTeamIds(managerId);

  if (teamIds.length === 0) {
    return [];
  }

  const userStats = new Map<string, { count: number; value: number }>();

  // Get parsed_gift_cards BEFORE cutoff date
  const { data: giftCards, error: gcError } = await supabase
    .from('parsed_gift_cards')
    .select('matched_user_id, amount')
    .in('matched_user_id', teamIds)
    .lt('received_at', TRANSACTION_LOG_CUTOFF);

  if (gcError) throw gcError;

  giftCards?.forEach(gc => {
    if (!gc.matched_user_id) return;
    const existing = userStats.get(gc.matched_user_id) || { count: 0, value: 0 };
    existing.count += 1;
    existing.value += gc.amount || 0;
    userStats.set(gc.matched_user_id, existing);
  });

  // Get transactions FROM cutoff date
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('ios_user_id, gift_card_amount, receipt_count')
    .in('ios_user_id', teamIds)
    .gte('transaction_date', TRANSACTION_LOG_CUTOFF);

  if (txError) throw txError;

  transactions?.forEach(tx => {
    if (!tx.ios_user_id) return;
    const existing = userStats.get(tx.ios_user_id) || { count: 0, value: 0 };
    existing.count += tx.receipt_count || 1;
    existing.value += tx.gift_card_amount || 0;
    userStats.set(tx.ios_user_id, existing);
  });

  const { data: users, error: userError } = await supabase
    .from('ios_user_profiles')
    .select('id, full_name')
    .in('id', teamIds);

  if (userError) throw userError;

  const userNameMap = new Map(users?.map(u => [u.id, u.full_name]) || []);

  return Array.from(userStats.entries())
    .map(([userId, stats]) => ({
      userId,
      userName: userNameMap.get(userId) || 'Unknown',
      transactionCount: stats.count,
      totalValue: stats.value,
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, limit);
}

// ============================================
// USER ANALYTICS (Personal stats)
// ============================================

export interface UserAnalyticsSummary {
  totalCards: number;
  totalValue: number;
  avgCardValue: number;
  rank: number;
  totalUsers: number;
  percentile: number;
}

// Get personal summary stats for a user (hybrid: AutoChecker + Transaction Logs)
export async function getUserPersonalSummary(userId: string): Promise<UserAnalyticsSummary> {
  let totalCards = 0;
  let totalValue = 0;
  const userTotals = new Map<string, number>();

  // Get user's gift cards BEFORE cutoff
  const { data: userGc, error: gcError } = await supabase
    .from('parsed_gift_cards')
    .select('amount')
    .eq('matched_user_id', userId)
    .lt('received_at', TRANSACTION_LOG_CUTOFF);

  if (gcError) throw gcError;

  totalCards += userGc?.length || 0;
  totalValue += userGc?.reduce((sum, gc) => sum + (gc.amount || 0), 0) || 0;

  // Get user's transactions FROM cutoff
  const { data: userTx, error: txError } = await supabase
    .from('transactions')
    .select('gift_card_amount, receipt_count')
    .eq('ios_user_id', userId)
    .gte('transaction_date', TRANSACTION_LOG_CUTOFF);

  if (txError) throw txError;

  totalCards += userTx?.reduce((sum, tx) => sum + (tx.receipt_count || 1), 0) || 0;
  totalValue += userTx?.reduce((sum, tx) => sum + (tx.gift_card_amount || 0), 0) || 0;

  // Get all users' totals for ranking (from both sources)
  const { data: allGc, error: allGcError } = await supabase
    .from('parsed_gift_cards')
    .select('matched_user_id, amount')
    .lt('received_at', TRANSACTION_LOG_CUTOFF);

  if (allGcError) throw allGcError;

  allGc?.forEach(gc => {
    if (!gc.matched_user_id) return;
    userTotals.set(
      gc.matched_user_id,
      (userTotals.get(gc.matched_user_id) || 0) + (gc.amount || 0)
    );
  });

  const { data: allTx, error: allTxError } = await supabase
    .from('transactions')
    .select('ios_user_id, gift_card_amount')
    .gte('transaction_date', TRANSACTION_LOG_CUTOFF);

  if (allTxError) throw allTxError;

  allTx?.forEach(tx => {
    if (!tx.ios_user_id) return;
    userTotals.set(
      tx.ios_user_id,
      (userTotals.get(tx.ios_user_id) || 0) + (tx.gift_card_amount || 0)
    );
  });

  const sortedUsers = Array.from(userTotals.entries())
    .sort((a, b) => b[1] - a[1]);

  const rank = sortedUsers.findIndex(([id]) => id === userId) + 1;
  const totalUsersCount = sortedUsers.length;
  const percentile = totalUsersCount > 0 ? Math.round(((totalUsersCount - rank) / totalUsersCount) * 100) : 0;

  return {
    totalCards,
    totalValue,
    avgCardValue: totalCards > 0 ? totalValue / totalCards : 0,
    rank: rank || totalUsersCount + 1,
    totalUsers: totalUsersCount,
    percentile,
  };
}

// Get personal daily stats for a user (hybrid: AutoChecker + Transaction Logs)
export async function getUserPersonalDailyStats(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyStats[]> {
  const dailyMap = new Map<string, DailyStats>();

  const start = new Date(startDate);
  const end = new Date(endDate);
  const cutoffDate = new Date(TRANSACTION_LOG_CUTOFF);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dailyMap.set(dateStr, {
      date: dateStr,
      transactionCount: 0,
      cardCount: 0,
      totalValue: 0,
      userCount: 1,
    });
  }

  // If any part of range is before cutoff, query parsed_gift_cards
  if (start < cutoffDate) {
    const gcEndDate = end < cutoffDate ? endDate : TRANSACTION_LOG_CUTOFF;

    const { data: giftCards, error: gcError } = await supabase
      .from('parsed_gift_cards')
      .select('received_at, amount')
      .eq('matched_user_id', userId)
      .gte('received_at', startDate)
      .lt('received_at', gcEndDate + 'T00:00:00')
      .order('received_at', { ascending: true });

    if (gcError) throw gcError;

    giftCards?.forEach(gc => {
      const date = gc.received_at.split('T')[0];
      const existing = dailyMap.get(date);
      if (existing) {
        existing.transactionCount += 1;
        existing.cardCount += 1;
        existing.totalValue += gc.amount || 0;
      }
    });
  }

  // If any part of range is from cutoff onwards, query transactions
  if (end >= cutoffDate) {
    const txStartDate = start >= cutoffDate ? startDate : TRANSACTION_LOG_CUTOFF;

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('transaction_date, gift_card_amount, receipt_count')
      .eq('ios_user_id', userId)
      .gte('transaction_date', txStartDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true });

    if (txError) throw txError;

    transactions?.forEach(tx => {
      const date = tx.transaction_date;
      const existing = dailyMap.get(date);
      if (existing) {
        existing.transactionCount += 1;
        existing.cardCount += tx.receipt_count || 1;
        existing.totalValue += tx.gift_card_amount || 0;
      }
    });
  }

  return Array.from(dailyMap.values());
}

// Get user's week-over-week growth
export async function getUserWeeklyGrowth(userId: string): Promise<GrowthMetrics> {
  const now = new Date();
  const currentEnd = new Date(now);
  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - 7);

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - 6);

  const [currentStats, previousStats] = await Promise.all([
    getUserPersonalDailyStats(userId, currentStart.toISOString().split('T')[0], currentEnd.toISOString().split('T')[0]),
    getUserPersonalDailyStats(userId, previousStart.toISOString().split('T')[0], previousEnd.toISOString().split('T')[0]),
  ]);

  const currentTotal = currentStats.reduce((sum, s) => sum + s.totalValue, 0);
  const previousTotal = previousStats.reduce((sum, s) => sum + s.totalValue, 0);

  return {
    currentPeriod: currentTotal,
    previousPeriod: previousTotal,
    growthRate: previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : currentTotal > 0 ? 100 : 0,
    growthAmount: currentTotal - previousTotal,
  };
}
