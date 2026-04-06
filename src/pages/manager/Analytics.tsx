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
  getManagerTeamSummary,
  getManagerTeamDailyStats,
  getManagerTeamTopPerformers,
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

export default function ManagerAnalytics() {
  const { managerProfile } = useAuth();
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
    queryKey: ['manager-analytics-summary', managerProfile?.id],
    queryFn: () => managerProfile ? getManagerTeamSummary(managerProfile.id) : null,
    enabled: !!managerProfile,
  });

  const { data: dailyStats = [], isLoading: statsLoading } = useQuery({
    queryKey: ['manager-analytics-daily', managerProfile?.id, start, end],
    queryFn: () => managerProfile ? getManagerTeamDailyStats(managerProfile.id, start, end) : [],
    enabled: !!managerProfile,
  });

  const { data: topPerformers = [] } = useQuery({
    queryKey: ['manager-analytics-top', managerProfile?.id],
    queryFn: () => managerProfile ? getManagerTeamTopPerformers(managerProfile.id, 10) : [],
    enabled: !!managerProfile,
  });

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
    accent: 'rgb(255, 152, 0)',
  };

  // Revenue Chart Data
  const revenueChartData = {
    labels: dailyStats.map(s => formatLabel(s.date)),
    datasets: [
      {
        label: 'Team Revenue (₦)',
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

  if (!managerProfile) {
    return <div className="loading">Loading...</div>;
  }

  // Calculate totals for the period
  const periodTotal = dailyStats.reduce((sum, s) => sum + s.totalValue, 0);
  const periodCards = dailyStats.reduce((sum, s) => sum + s.cardCount, 0);

  return (
    <div className="manager-page analytics-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>Team Analytics</h1>
            <p>Track your team's performance</p>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="analytics-summary-grid">
        <div className="analytics-summary-card">
          <div className="summary-icon revenue">₦</div>
          <div className="summary-content">
            <span className="summary-label">Total Team Revenue</span>
            <span className="summary-value">
              {summaryLoading ? '...' : `₦${(summary?.teamTotalValue || 0).toLocaleString()}`}
            </span>
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="summary-icon cards">🎴</div>
          <div className="summary-content">
            <span className="summary-label">Total Team Cards</span>
            <span className="summary-value">
              {summaryLoading ? '...' : (summary?.teamTotalCards || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="summary-icon users">👥</div>
          <div className="summary-content">
            <span className="summary-label">Team Members</span>
            <span className="summary-value">
              {summaryLoading ? '...' : summary?.teamMemberCount || 0}
            </span>
          </div>
        </div>

        <div className="analytics-summary-card">
          <div className="summary-icon transactions">📊</div>
          <div className="summary-content">
            <span className="summary-label">Avg Cards/Member</span>
            <span className="summary-value">
              {summaryLoading ? '...' : (summary?.avgCardsPerMember || 0).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

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
      <div className="charts-grid">
        <div className="chart-card large">
          <h3>Team Revenue Over Time</h3>
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

      {/* Top Performers */}
      <div className="top-performers-section">
        <h3>Top Team Performers</h3>
        {topPerformers.length === 0 ? (
          <p className="empty-text">No data yet</p>
        ) : (
          <div className="performers-table-container">
            <table className="performers-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Member</th>
                  <th>Cards</th>
                  <th>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {topPerformers.map((performer, index) => (
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
