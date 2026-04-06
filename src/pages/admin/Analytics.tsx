import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  getAnalyticsSummary,
  getDailyStats,
  getWeeklyStats,
  getMonthlyStats,
  getPeriodComparison,
  getUserGrowthStats,
  getTransactionStatusBreakdown,
  getAnalyticsSummaryForPeriod,
  getTopPerformersForPeriod,
} from '../../api/analytics';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';
type ChartView = 'daily' | 'weekly' | 'monthly';

export default function AdminAnalytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [chartView, setChartView] = useState<ChartView>('daily');

  // Custom date range
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Calculate date range
  const getDateRange = () => {
    if (timeRange === 'custom') {
      return {
        start: customStartDate,
        end: customEndDate,
      };
    }

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
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all':
        start.setFullYear(2020);
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
    queryKey: ['analytics-summary'],
    queryFn: getAnalyticsSummary,
  });

  const { data: dailyStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['analytics-daily', start, end],
    queryFn: () => getDailyStats(start, end),
    enabled: chartView === 'daily',
  });

  const { data: weeklyStats = [] } = useQuery({
    queryKey: ['analytics-weekly', start, end],
    queryFn: () => getWeeklyStats(start, end),
    enabled: chartView === 'weekly',
  });

  const { data: monthlyStats = [] } = useQuery({
    queryKey: ['analytics-monthly', start, end],
    queryFn: () => getMonthlyStats(start, end),
    enabled: chartView === 'monthly',
  });

  const { data: weekComparison } = useQuery({
    queryKey: ['analytics-comparison-week'],
    queryFn: () => getPeriodComparison('week'),
  });

  const { data: monthComparison } = useQuery({
    queryKey: ['analytics-comparison-month'],
    queryFn: () => getPeriodComparison('month'),
  });

  const { data: userGrowth = [] } = useQuery({
    queryKey: ['analytics-user-growth', start, end],
    queryFn: () => getUserGrowthStats(start, end),
  });

  const { data: statusBreakdown = [] } = useQuery({
    queryKey: ['analytics-status-breakdown'],
    queryFn: getTransactionStatusBreakdown,
  });

  // Period-specific queries (for custom date range)
  const { data: periodSummary, isLoading: periodLoading } = useQuery({
    queryKey: ['analytics-period-summary', start, end],
    queryFn: () => getAnalyticsSummaryForPeriod(start, end),
  });

  const { data: periodTopPerformers = [] } = useQuery({
    queryKey: ['analytics-period-top-performers', start, end],
    queryFn: () => getTopPerformersForPeriod(start, end, 10),
  });

  // Get current stats based on view
  const currentStats = chartView === 'daily' ? dailyStats : chartView === 'weekly' ? weeklyStats : monthlyStats;

  // Format date label based on view
  const formatLabel = (date: string) => {
    const d = new Date(date);
    switch (chartView) {
      case 'daily':
        return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
      case 'weekly':
        return `Week of ${d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}`;
      case 'monthly':
        return d.toLocaleDateString('en-NG', { month: 'short', year: 'numeric' });
    }
  };

  // Chart colors
  const chartColors = {
    primary: 'rgb(76, 175, 80)',
    primaryLight: 'rgba(76, 175, 80, 0.1)',
    secondary: 'rgb(33, 150, 243)',
    secondaryLight: 'rgba(33, 150, 243, 0.1)',
    accent: 'rgb(255, 152, 0)',
    accentLight: 'rgba(255, 152, 0, 0.1)',
    danger: 'rgb(244, 67, 54)',
    purple: 'rgb(156, 39, 176)',
  };

  // Revenue Chart Data
  const revenueChartData = {
    labels: currentStats.map(s => formatLabel(s.date)),
    datasets: [
      {
        label: 'Revenue (₦)',
        data: currentStats.map(s => s.totalValue),
        borderColor: chartColors.primary,
        backgroundColor: chartColors.primaryLight,
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Transaction Volume Chart Data
  const volumeChartData = {
    labels: currentStats.map(s => formatLabel(s.date)),
    datasets: [
      {
        label: 'Transactions',
        data: currentStats.map(s => s.transactionCount),
        backgroundColor: chartColors.secondary,
        borderRadius: 4,
      },
      {
        label: 'Cards',
        data: currentStats.map(s => s.cardCount),
        backgroundColor: chartColors.accent,
        borderRadius: 4,
      },
    ],
  };

  // User Growth Chart Data
  const userGrowthChartData = {
    labels: userGrowth.map(s => formatLabel(s.date)),
    datasets: [
      {
        label: 'Total Users',
        data: userGrowth.map(s => s.totalUsers),
        borderColor: chartColors.purple,
        backgroundColor: 'rgba(156, 39, 176, 0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  // Status Breakdown Chart Data (from AutoChecker)
  const statusLabels: Record<string, string> = {
    matched: 'Matched Users',
    unmatched: 'Unmatched',
    correct_amount: 'Correct Amount (₦14,900)',
    incorrect_amount: 'Incorrect Amount',
  };

  const statusColors: Record<string, string> = {
    matched: chartColors.primary,
    unmatched: chartColors.accent,
    correct_amount: chartColors.secondary,
    incorrect_amount: chartColors.danger,
  };

  const statusChartData = {
    labels: statusBreakdown.map(s => statusLabels[s.status] || s.status),
    datasets: [
      {
        data: statusBreakdown.map(s => s.count),
        backgroundColor: statusBreakdown.map(s => statusColors[s.status] || '#999'),
        borderWidth: 0,
      },
    ],
  };

  // Chart options
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y;
            if (context.dataset.label?.includes('Revenue')) {
              return `Revenue: ₦${value.toLocaleString()}`;
            }
            return `${context.dataset.label}: ${value.toLocaleString()}`;
          },
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
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
    },
  };

  // Growth indicator component
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

  return (
    <div className="admin-page analytics-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>Analytics</h1>
            <p>Track growth and revenue trends</p>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="analytics-summary-grid">
        <div className="analytics-summary-card">
          <div className="summary-icon revenue">₦</div>
          <div className="summary-content">
            <span className="summary-label">Total Revenue (GTV)</span>
            <span className="summary-value">
              {summaryLoading ? '...' : `₦${(summary?.totalGTV || 0).toLocaleString()}`}
            </span>
          </div>
          {monthComparison && (
            <GrowthIndicator value={monthComparison.revenue.growthRate} label="vs last month" />
          )}
        </div>

        <div className="analytics-summary-card">
          <div className="summary-icon transactions">📊</div>
          <div className="summary-content">
            <span className="summary-label">Total Transactions</span>
            <span className="summary-value">
              {summaryLoading ? '...' : (summary?.totalTransactions || 0).toLocaleString()}
            </span>
          </div>
          {monthComparison && (
            <GrowthIndicator value={monthComparison.transactions.growthRate} label="vs last month" />
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
          {monthComparison && (
            <GrowthIndicator value={monthComparison.cards.growthRate} label="vs last month" />
          )}
        </div>

        <div className="analytics-summary-card">
          <div className="summary-icon users">👥</div>
          <div className="summary-content">
            <span className="summary-label">Total Users</span>
            <span className="summary-value">
              {summaryLoading ? '...' : (summary?.totalUsers || 0).toLocaleString()}
            </span>
          </div>
          {monthComparison && (
            <GrowthIndicator value={monthComparison.users.growthRate} label="vs last month" />
          )}
        </div>
      </div>

      {/* Week-over-Week Comparison */}
      {weekComparison && (
        <div className="comparison-section">
          <h3>Week-over-Week Performance</h3>
          <div className="comparison-grid">
            <div className="comparison-card">
              <span className="comparison-label">Revenue</span>
              <span className="comparison-current">₦{weekComparison.revenue.currentPeriod.toLocaleString()}</span>
              <GrowthIndicator value={weekComparison.revenue.growthRate} label="vs last week" />
            </div>
            <div className="comparison-card">
              <span className="comparison-label">Transactions</span>
              <span className="comparison-current">{weekComparison.transactions.currentPeriod.toLocaleString()}</span>
              <GrowthIndicator value={weekComparison.transactions.growthRate} label="vs last week" />
            </div>
            <div className="comparison-card">
              <span className="comparison-label">Cards</span>
              <span className="comparison-current">{weekComparison.cards.currentPeriod.toLocaleString()}</span>
              <GrowthIndicator value={weekComparison.cards.growthRate} label="vs last week" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="analytics-filters">
        <div className="filter-group">
          <label>Time Range</label>
          <div className="filter-buttons">
            {(['7d', '30d', '90d', '1y', 'all', 'custom'] as TimeRange[]).map(range => (
              <button
                key={range}
                className={`filter-btn ${timeRange === range ? 'active' : ''}`}
                onClick={() => setTimeRange(range)}
              >
                {range === '7d' ? '7 Days' :
                 range === '30d' ? '30 Days' :
                 range === '90d' ? '90 Days' :
                 range === '1y' ? '1 Year' :
                 range === 'all' ? 'All Time' : 'Custom'}
              </button>
            ))}
          </div>
        </div>
        {timeRange === 'custom' && (
          <div className="filter-group">
            <label>Date Range</label>
            <div className="date-range-inputs">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                max={customEndDate}
              />
              <span className="date-separator">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                min={customStartDate}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        )}
        <div className="filter-group">
          <label>View By</label>
          <div className="filter-buttons">
            {(['daily', 'weekly', 'monthly'] as ChartView[]).map(view => (
              <button
                key={view}
                className={`filter-btn ${chartView === view ? 'active' : ''}`}
                onClick={() => setChartView(view)}
              >
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Period Summary */}
      <div className="period-summary-section">
        <h3>
          Period Summary
          <span className="period-dates">
            ({new Date(start).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(end).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })})
          </span>
        </h3>
        <div className="period-stats-grid">
          <div className="period-stat-card">
            <span className="period-stat-label">Total Cards</span>
            <span className="period-stat-value">
              {periodLoading ? '...' : (periodSummary?.totalCards || 0).toLocaleString()}
            </span>
          </div>
          <div className="period-stat-card">
            <span className="period-stat-label">Total Revenue</span>
            <span className="period-stat-value">
              {periodLoading ? '...' : `₦${(periodSummary?.totalRevenue || 0).toLocaleString()}`}
            </span>
          </div>
          <div className="period-stat-card">
            <span className="period-stat-label">Active Users</span>
            <span className="period-stat-value">
              {periodLoading ? '...' : (periodSummary?.uniqueUsers || 0).toLocaleString()}
            </span>
          </div>
          <div className="period-stat-card">
            <span className="period-stat-label">Avg Card Value</span>
            <span className="period-stat-value">
              {periodLoading ? '...' : `₦${(periodSummary?.avgCardValue || 0).toLocaleString()}`}
            </span>
          </div>
          <div className="period-stat-card correct">
            <span className="period-stat-label">Correct Amount</span>
            <span className="period-stat-value">
              {periodLoading ? '...' : (periodSummary?.correctAmountCards || 0).toLocaleString()}
            </span>
          </div>
          <div className="period-stat-card incorrect">
            <span className="period-stat-label">Incorrect Amount</span>
            <span className="period-stat-value">
              {periodLoading ? '...' : (periodSummary?.incorrectAmountCards || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-grid">
        {/* Revenue Chart */}
        <div className="chart-card large">
          <h3>Revenue Over Time</h3>
          <div className="chart-container">
            {statsLoading ? (
              <div className="chart-loading">Loading...</div>
            ) : (
              <Line data={revenueChartData} options={lineChartOptions} />
            )}
          </div>
        </div>

        {/* Volume Chart */}
        <div className="chart-card large">
          <h3>Transaction Volume</h3>
          <div className="chart-container">
            {statsLoading ? (
              <div className="chart-loading">Loading...</div>
            ) : (
              <Bar data={volumeChartData} options={barChartOptions} />
            )}
          </div>
        </div>

        {/* User Growth Chart */}
        <div className="chart-card">
          <h3>User Growth</h3>
          <div className="chart-container">
            <Line data={userGrowthChartData} options={lineChartOptions} />
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="chart-card">
          <h3>Card Status (AutoChecker)</h3>
          <div className="chart-container doughnut">
            <Doughnut data={statusChartData} options={doughnutOptions} />
          </div>
        </div>
      </div>

      {/* Top Performers for Period */}
      <div className="top-performers-section">
        <h3>
          Top Performers
          <span className="period-dates">
            ({new Date(start).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} - {new Date(end).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })})
          </span>
        </h3>
        {periodTopPerformers.length === 0 ? (
          <p className="empty-text">No data for this period</p>
        ) : (
          <div className="performers-table-container">
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>User</th>
                  <th>Cards</th>
                  <th>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {periodTopPerformers.map((performer, index) => (
                  <tr key={performer.userId}>
                    <td className="rank">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </td>
                    <td>{performer.userName}</td>
                    <td>{performer.transactionCount.toLocaleString()}</td>
                    <td>₦{performer.totalValue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
