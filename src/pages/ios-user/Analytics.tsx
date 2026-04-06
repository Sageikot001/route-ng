import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { useAuth } from '../../contexts/AuthContext';
import {
  getUserPersonalSummary,
  getUserPersonalDailyStats,
  getUserWeeklyGrowth,
  getTopPerformers,
} from '../../api/analytics';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type TimeRange = '7d' | '30d' | '90d';

export default function IOSUserAnalytics() {
  const { iosUserProfile } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const getDateRange = () => {
    const end = new Date();
    const start = new Date();

    switch (timeRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  const { start, end } = getDateRange();

  // Queries
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['user-analytics-summary', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserPersonalSummary(iosUserProfile.id) : null,
    enabled: !!iosUserProfile,
  });

  const { data: dailyStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['user-analytics-daily', iosUserProfile?.id, start, end],
    queryFn: () => iosUserProfile ? getUserPersonalDailyStats(iosUserProfile.id, start, end) : [],
    enabled: !!iosUserProfile,
  });

  const { data: weeklyGrowth } = useQuery({
    queryKey: ['user-analytics-growth', iosUserProfile?.id],
    queryFn: () => iosUserProfile ? getUserWeeklyGrowth(iosUserProfile.id) : null,
    enabled: !!iosUserProfile,
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['user-analytics-leaderboard'],
    queryFn: () => getTopPerformers(20),
  });

  // Find user's position in leaderboard
  const userLeaderboardPosition = leaderboard.findIndex(
    p => p.userId === iosUserProfile?.id
  ) + 1;

  // Format date label
  const formatLabel = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
  };

  // Chart colors
  const chartColors = {
    primary: 'rgb(76, 175, 80)',
    primaryLight: 'rgba(76, 175, 80, 0.1)',
    secondary: 'rgb(33, 150, 243)',
  };

  // Revenue Chart Data
  const revenueChartData = {
    labels: dailyStats.map(s => formatLabel(s.date)),
    datasets: [
      {
        label: 'Your Revenue (₦)',
        data: dailyStats.map(s => s.totalValue),
        borderColor: chartColors.primary,
        backgroundColor: chartColors.primaryLight,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Cards Chart Data
  const cardsChartData = {
    labels: dailyStats.map(s => formatLabel(s.date)),
    datasets: [
      {
        label: 'Cards',
        data: dailyStats.map(s => s.cardCount),
        backgroundColor: chartColors.secondary,
        borderRadius: 4,
      },
    ],
  };

  // Chart options
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' as const },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => `₦${context.parsed.y.toLocaleString()}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => {
            if (value >= 1000000) return `₦${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `₦${(value / 1000).toFixed(0)}K`;
            return `₦${value}`;
          },
        },
      },
    },
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top' as const } },
    scales: { y: { beginAtZero: true } },
  };

  // Growth indicator
  const GrowthIndicator = ({ value, label }: { value: number; label: string }) => {
    const isPositive = value >= 0;
    return (
      <div className={`growth-indicator ${isPositive ? 'positive' : 'negative'}`}>
        <span className="growth-arrow">{isPositive ? '↑' : '↓'}</span>
        <span className="growth-value">{Math.abs(value).toFixed(1)}%</span>
        <span className="growth-label">{label}</span>
      </div>
    );
  };

  if (!iosUserProfile) {
    return <div className="loading">Loading...</div>;
  }

  // Period totals
  const periodTotal = dailyStats.reduce((sum, s) => sum + s.totalValue, 0);
  const periodCards = dailyStats.reduce((sum, s) => sum + s.cardCount, 0);

  return (
    <div className="ios-user-page analytics-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>Your Analytics</h1>
            <p>Track your performance and progress</p>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="analytics-summary-grid">
        <div className="analytics-summary-card">
          <div className="summary-icon revenue">₦</div>
          <div className="summary-content">
            <span className="summary-label">Total Revenue</span>
            <span className="summary-value">
              {summaryLoading ? '...' : `₦${(summary?.totalValue || 0).toLocaleString()}`}
            </span>
          </div>
          {weeklyGrowth && (
            <GrowthIndicator value={weeklyGrowth.growthRate} label="vs last week" />
          )}
        </div>

        <div className="analytics-summary-card">
          <div className="summary-icon cards">🎴</div>
          <div className="summary-content">
            <span className="summary-label">Total Cards</span>
            <span className="summary-value">
              {summaryLoading ? '...' : (summary?.totalCards || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="analytics-summary-card highlight">
          <div className="summary-icon rank">🏆</div>
          <div className="summary-content">
            <span className="summary-label">Your Rank</span>
            <span className="summary-value">
              {summaryLoading ? '...' : `#${summary?.rank || '-'}`}
            </span>
          </div>
          <div className="rank-percentile">
            Top {summary?.percentile || 0}%
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="summary-icon transactions">📊</div>
          <div className="summary-content">
            <span className="summary-label">Avg Card Value</span>
            <span className="summary-value">
              {summaryLoading ? '...' : `₦${(summary?.avgCardValue || 0).toLocaleString()}`}
            </span>
          </div>
        </div>
      </div>

      {/* Week Growth Summary */}
      {weeklyGrowth && (
        <div className="week-growth-card">
          <h3>This Week vs Last Week</h3>
          <div className="growth-comparison">
            <div className="growth-item">
              <span className="growth-current">₦{weeklyGrowth.currentPeriod.toLocaleString()}</span>
              <span className="growth-previous">vs ₦{weeklyGrowth.previousPeriod.toLocaleString()}</span>
            </div>
            <GrowthIndicator value={weeklyGrowth.growthRate} label="" />
          </div>
        </div>
      )}

      {/* Period Stats */}
      <div className="period-summary">
        <div className="period-stat">
          <span className="period-label">Period Revenue</span>
          <span className="period-value">₦{periodTotal.toLocaleString()}</span>
        </div>
        <div className="period-stat">
          <span className="period-label">Period Cards</span>
          <span className="period-value">{periodCards}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="analytics-filters">
        <div className="filter-group">
          <label>Time Range</label>
          <div className="filter-buttons">
            {(['7d', '30d', '90d'] as TimeRange[]).map(range => (
              <button
                key={range}
                className={`filter-btn ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid user-charts">
        <div className="chart-card">
          <h3>Your Revenue Over Time</h3>
          <div className="chart-container">
            {statsLoading ? (
              <div className="chart-loading">Loading...</div>
            ) : (
              <Line data={revenueChartData} options={lineChartOptions} />
            )}
          </div>
        </div>

        <div className="chart-card">
          <h3>Daily Cards</h3>
          <div className="chart-container">
            {statsLoading ? (
              <div className="chart-loading">Loading...</div>
            ) : (
              <Bar data={cardsChartData} options={barChartOptions} />
            )}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="leaderboard-section">
        <h3>Leaderboard</h3>
        <p className="leaderboard-subtitle">
          {userLeaderboardPosition > 0
            ? `You're ranked #${userLeaderboardPosition} out of ${summary?.totalUsers || leaderboard.length} users`
            : 'Keep transacting to appear on the leaderboard!'}
        </p>
        <div className="leaderboard-table-container">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>User</th>
                <th>Cards</th>
                <th>Total Value</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 10).map((user, index) => {
                const isCurrentUser = user.userId === iosUserProfile?.id;
                return (
                  <tr key={user.userId} className={isCurrentUser ? 'current-user' : ''}>
                    <td className="rank">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </td>
                    <td>
                      {isCurrentUser ? (
                        <strong>{user.userName} (You)</strong>
                      ) : (
                        user.userName
                      )}
                    </td>
                    <td>{user.transactionCount.toLocaleString()}</td>
                    <td>₦{user.totalValue.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
