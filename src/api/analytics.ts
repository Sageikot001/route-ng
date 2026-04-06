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
// ANALYTICS QUERIES (Using AutoChecker data)
// ============================================

// Get overall summary stats from parsed_gift_cards
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  // Get total cards and value from AutoChecker parsed data
  const { data: giftCards, error: cardError } = await supabase
    .from('parsed_gift_cards')
    .select('amount, matched_user_id');

  if (cardError) throw cardError;

  const totalCards = giftCards?.length || 0;
  const totalGTV = giftCards?.reduce((sum, card) => sum + (card.amount || 0), 0) || 0;
  const totalTransactions = totalCards; // Each card is a transaction

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
    avgTransactionValue: totalCards > 0 ? totalGTV / totalCards : 0,
  };
}

// Period-specific summary for custom date ranges
export interface PeriodSummary {
  totalCards: number;
  totalRevenue: number;
  uniqueUsers: number;
  avgCardValue: number;
  correctAmountCards: number;
  incorrectAmountCards: number;
}

// Get summary stats for a specific date range
export async function getAnalyticsSummaryForPeriod(
  startDate: string,
  endDate: string
): Promise<PeriodSummary> {
  const { data: giftCards, error } = await supabase
    .from('parsed_gift_cards')
    .select('amount, matched_user_id')
    .gte('received_at', startDate)
    .lte('received_at', endDate + 'T23:59:59');

  if (error) throw error;

  const totalCards = giftCards?.length || 0;
  const totalRevenue = giftCards?.reduce((sum, card) => sum + (card.amount || 0), 0) || 0;
  const uniqueUserIds = new Set(giftCards?.map(c => c.matched_user_id).filter(Boolean));
  const correctAmountCards = giftCards?.filter(c => c.amount === 14900).length || 0;
  const incorrectAmountCards = totalCards - correctAmountCards;

  return {
    totalCards,
    totalRevenue,
    uniqueUsers: uniqueUserIds.size,
    avgCardValue: totalCards > 0 ? totalRevenue / totalCards : 0,
    correctAmountCards,
    incorrectAmountCards,
  };
}

// Get top performers for a specific date range
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
  const { data: giftCards, error: cardError } = await supabase
    .from('parsed_gift_cards')
    .select('matched_user_id, amount')
    .gte('received_at', startDate)
    .lte('received_at', endDate + 'T23:59:59');

  if (cardError) throw cardError;

  // Aggregate by user
  const userStats = new Map<string, { count: number; value: number }>();
  giftCards?.forEach(card => {
    if (!card.matched_user_id) return;
    const existing = userStats.get(card.matched_user_id) || { count: 0, value: 0 };
    existing.count += 1;
    existing.value += card.amount || 0;
    userStats.set(card.matched_user_id, existing);
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

// Get daily stats for a date range from AutoChecker data
export async function getDailyStats(
  startDate: string,
  endDate: string
): Promise<DailyStats[]> {
  // Get all parsed gift cards in range
  const { data: giftCards, error: cardError } = await supabase
    .from('parsed_gift_cards')
    .select('received_at, amount, matched_user_id')
    .gte('received_at', startDate)
    .lte('received_at', endDate + 'T23:59:59')
    .order('received_at', { ascending: true });

  if (cardError) throw cardError;

  // Group by date
  const dailyMap = new Map<string, DailyStats>();

  // Initialize all dates in range
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dailyMap.set(dateStr, {
      date: dateStr,
      transactionCount: 0,
      cardCount: 0,
      totalValue: 0,
      userCount: 0,
    });
  }

  // Aggregate gift cards
  const usersByDate = new Map<string, Set<string>>();

  giftCards?.forEach(card => {
    const date = card.received_at.split('T')[0];
    const existing = dailyMap.get(date);
    if (existing) {
      existing.transactionCount += 1; // Each card is a transaction
      existing.cardCount += 1;
      existing.totalValue += card.amount || 0;

      // Track unique users per day
      if (card.matched_user_id) {
        if (!usersByDate.has(date)) {
          usersByDate.set(date, new Set());
        }
        usersByDate.get(date)!.add(card.matched_user_id);
      }
    }
  });

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

// Get card status breakdown from AutoChecker data
export async function getTransactionStatusBreakdown(): Promise<{ status: string; count: number }[]> {
  const { data: giftCards, error } = await supabase
    .from('parsed_gift_cards')
    .select('matched_user_id, amount');

  if (error) throw error;

  // Categorize cards
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

    // Standard expected amount is ₦14,900
    if (card.amount === 14900) {
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

// Get top performing users from AutoChecker data
export async function getTopPerformers(limit: number = 10): Promise<{
  userId: string;
  userName: string;
  transactionCount: number;
  totalValue: number;
}[]> {
  const { data: giftCards, error: cardError } = await supabase
    .from('parsed_gift_cards')
    .select('matched_user_id, amount');

  if (cardError) throw cardError;

  // Aggregate by user
  const userStats = new Map<string, { count: number; value: number }>();
  giftCards?.forEach(card => {
    if (!card.matched_user_id) return; // Skip unmatched cards
    const existing = userStats.get(card.matched_user_id) || { count: 0, value: 0 };
    existing.count += 1;
    existing.value += card.amount || 0;
    userStats.set(card.matched_user_id, existing);
  });

  // Get user names
  const userIds = Array.from(userStats.keys());
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

// Get team summary stats for a manager
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

  const { data: giftCards, error } = await supabase
    .from('parsed_gift_cards')
    .select('amount, matched_user_id')
    .in('matched_user_id', teamIds);

  if (error) throw error;

  const teamTotalCards = giftCards?.length || 0;
  const teamTotalValue = giftCards?.reduce((sum, card) => sum + (card.amount || 0), 0) || 0;

  return {
    teamTotalCards,
    teamTotalValue,
    teamMemberCount: teamIds.length,
    avgCardsPerMember: teamIds.length > 0 ? teamTotalCards / teamIds.length : 0,
  };
}

// Get daily stats for manager's team
export async function getManagerTeamDailyStats(
  managerId: string,
  startDate: string,
  endDate: string
): Promise<DailyStats[]> {
  const teamIds = await getManagerTeamIds(managerId);

  if (teamIds.length === 0) {
    return [];
  }

  const { data: giftCards, error } = await supabase
    .from('parsed_gift_cards')
    .select('received_at, amount, matched_user_id')
    .in('matched_user_id', teamIds)
    .gte('received_at', startDate)
    .lte('received_at', endDate + 'T23:59:59')
    .order('received_at', { ascending: true });

  if (error) throw error;

  // Group by date
  const dailyMap = new Map<string, DailyStats>();
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    dailyMap.set(dateStr, {
      date: dateStr,
      transactionCount: 0,
      cardCount: 0,
      totalValue: 0,
      userCount: 0,
    });
  }

  const usersByDate = new Map<string, Set<string>>();

  giftCards?.forEach(card => {
    const date = card.received_at.split('T')[0];
    const existing = dailyMap.get(date);
    if (existing) {
      existing.transactionCount += 1;
      existing.cardCount += 1;
      existing.totalValue += card.amount || 0;

      if (card.matched_user_id) {
        if (!usersByDate.has(date)) {
          usersByDate.set(date, new Set());
        }
        usersByDate.get(date)!.add(card.matched_user_id);
      }
    }
  });

  usersByDate.forEach((users, date) => {
    const stats = dailyMap.get(date);
    if (stats) {
      stats.userCount = users.size;
    }
  });

  return Array.from(dailyMap.values());
}

// Get top performers within manager's team
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

  const { data: giftCards, error: cardError } = await supabase
    .from('parsed_gift_cards')
    .select('matched_user_id, amount')
    .in('matched_user_id', teamIds);

  if (cardError) throw cardError;

  const userStats = new Map<string, { count: number; value: number }>();
  giftCards?.forEach(card => {
    if (!card.matched_user_id) return;
    const existing = userStats.get(card.matched_user_id) || { count: 0, value: 0 };
    existing.count += 1;
    existing.value += card.amount || 0;
    userStats.set(card.matched_user_id, existing);
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

// Get personal summary stats for a user
export async function getUserPersonalSummary(userId: string): Promise<UserAnalyticsSummary> {
  // Get user's cards
  const { data: userCards, error: userError } = await supabase
    .from('parsed_gift_cards')
    .select('amount')
    .eq('matched_user_id', userId);

  if (userError) throw userError;

  const totalCards = userCards?.length || 0;
  const totalValue = userCards?.reduce((sum, card) => sum + (card.amount || 0), 0) || 0;

  // Get all users' totals for ranking
  const { data: allCards, error: allError } = await supabase
    .from('parsed_gift_cards')
    .select('matched_user_id, amount');

  if (allError) throw allError;

  const userTotals = new Map<string, number>();
  allCards?.forEach(card => {
    if (!card.matched_user_id) return;
    userTotals.set(
      card.matched_user_id,
      (userTotals.get(card.matched_user_id) || 0) + (card.amount || 0)
    );
  });

  const sortedUsers = Array.from(userTotals.entries())
    .sort((a, b) => b[1] - a[1]);

  const rank = sortedUsers.findIndex(([id]) => id === userId) + 1;
  const totalUsers = sortedUsers.length;
  const percentile = totalUsers > 0 ? Math.round(((totalUsers - rank) / totalUsers) * 100) : 0;

  return {
    totalCards,
    totalValue,
    avgCardValue: totalCards > 0 ? totalValue / totalCards : 0,
    rank: rank || totalUsers + 1,
    totalUsers,
    percentile,
  };
}

// Get personal daily stats for a user
export async function getUserPersonalDailyStats(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyStats[]> {
  const { data: giftCards, error } = await supabase
    .from('parsed_gift_cards')
    .select('received_at, amount')
    .eq('matched_user_id', userId)
    .gte('received_at', startDate)
    .lte('received_at', endDate + 'T23:59:59')
    .order('received_at', { ascending: true });

  if (error) throw error;

  const dailyMap = new Map<string, DailyStats>();
  const start = new Date(startDate);
  const end = new Date(endDate);

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

  giftCards?.forEach(card => {
    const date = card.received_at.split('T')[0];
    const existing = dailyMap.get(date);
    if (existing) {
      existing.transactionCount += 1;
      existing.cardCount += 1;
      existing.totalValue += card.amount || 0;
    }
  });

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
