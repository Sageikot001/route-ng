import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  getAutoCheckerStats,
  getParsedGiftCards,
  getScanLogs,
  triggerManualScan,
  getDailySummaryData,
  getDailyGiftCardDetails,
  getUserGiftCardDetails,
  getUnmatchedGiftCards,
  matchGiftCardToUser,
  removeDuplicateGiftCards,
} from '../../api/autoChecker';
import { getAllIOSUserProfiles } from '../../api/users';
import type { ParsedGiftCardWithUser } from '../../types';
import * as XLSX from 'xlsx';

export default function AdminAutoChecker() {
  const queryClient = useQueryClient();

  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'cards' | 'logs' | 'unmatched'>('cards');
  const [selectedCard, setSelectedCard] = useState<ParsedGiftCardWithUser | null>(null);
  const [matchingUserId, setMatchingUserId] = useState('');
  const [exportDate, setExportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [exportUserId, setExportUserId] = useState<string>('');

  // Copy codes state
  const [copyDropdownOpen, setCopyDropdownOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(0);
  const [copyMessage, setCopyMessage] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setCopyDropdownOpen(false);
      }
    };

    if (copyDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [copyDropdownOpen]);

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['auto-checker-stats'],
    queryFn: getAutoCheckerStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: giftCards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ['parsed-gift-cards', dateFilter],
    queryFn: () => getParsedGiftCards({ date: dateFilter, limit: 100 }),
  });

  const { data: unmatchedCards = [] } = useQuery({
    queryKey: ['unmatched-gift-cards'],
    queryFn: getUnmatchedGiftCards,
    enabled: viewMode === 'unmatched',
  });

  const { data: scanLogs = [] } = useQuery({
    queryKey: ['scan-logs'],
    queryFn: () => getScanLogs(20),
    enabled: viewMode === 'logs',
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-ios-users'],
    queryFn: getAllIOSUserProfiles,
  });

  // Mutations
  const [reconnectRequired, setReconnectRequired] = useState(false);

  const scanMutation = useMutation({
    mutationFn: () => triggerManualScan(),
    onSuccess: (result: any) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['auto-checker-stats'] });
        queryClient.invalidateQueries({ queryKey: ['parsed-gift-cards'] });
        queryClient.invalidateQueries({ queryKey: ['scan-logs'] });
        queryClient.invalidateQueries({ queryKey: ['unmatched-gift-cards'] });
        setReconnectRequired(false);

        // Show detailed info including debug data
        const duplicatesMsg = result.duplicatesRemoved && result.duplicatesRemoved > 0
          ? `\nDuplicates removed: ${result.duplicatesRemoved}`
          : '';
        const debugMsg = result.debug
          ? `\n\nDebug Info:\n- Config Email: ${result.debug.configEmail}\n- From Date: ${result.debug.scanFromDate}\n- To Date: ${result.debug.scanToDate}`
          : '';
        alert(`Scan complete!\n\nEmails fetched: ${result.emailsFetched || 0}\nGift cards found: ${result.cardsFound || 0}${duplicatesMsg}${debugMsg}`);
      } else {
        // Check if Gmail reconnection is required
        if (result.errorCode === 'GMAIL_RECONNECT_REQUIRED') {
          setReconnectRequired(true);
        } else {
          alert(result.error || 'Scan failed');
        }
      }
    },
  });

  const rescanMutation = useMutation({
    mutationFn: () => triggerManualScan({ rescanExisting: true }),
    onSuccess: (result: any) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['auto-checker-stats'] });
        queryClient.invalidateQueries({ queryKey: ['parsed-gift-cards'] });
        queryClient.invalidateQueries({ queryKey: ['scan-logs'] });
        queryClient.invalidateQueries({ queryKey: ['unmatched-gift-cards'] });
        setReconnectRequired(false);
        const duplicatesMsg = result.duplicatesRemoved && result.duplicatesRemoved > 0
          ? `, removed ${result.duplicatesRemoved} duplicates`
          : '';
        alert(`Rescan complete! Re-parsed ${result.emailsFetched || 0} emails, found ${result.cardsFound || 0} new gift cards${duplicatesMsg}.`);
      } else {
        // Check if Gmail reconnection is required
        if (result.errorCode === 'GMAIL_RECONNECT_REQUIRED') {
          setReconnectRequired(true);
        } else {
          alert(result.error || 'Rescan failed');
        }
      }
    },
  });

  const matchUserMutation = useMutation({
    mutationFn: ({ cardId, userId }: { cardId: string; userId: string }) =>
      matchGiftCardToUser(cardId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parsed-gift-cards'] });
      queryClient.invalidateQueries({ queryKey: ['unmatched-gift-cards'] });
      setSelectedCard(null);
      setMatchingUserId('');
    },
  });

  const deduplicateMutation = useMutation({
    mutationFn: removeDuplicateGiftCards,
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['auto-checker-stats'] });
        queryClient.invalidateQueries({ queryKey: ['parsed-gift-cards'] });
        if (result.duplicatesRemoved > 0) {
          alert(`Removed ${result.duplicatesRemoved} duplicate gift cards.`);
        } else {
          alert('No duplicates found.');
        }
      } else {
        alert(result.error || 'Failed to remove duplicates');
      }
    },
  });

  // Export handlers
  const handleExportDailySummary = async () => {
    try {
      const data = await getDailySummaryData(exportDate);
      if (data.length === 0) {
        alert('No data found for this date');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data.map(d => ({
        'Date': d.date,
        'User Name': d.userName,
        'Email': d.userEmail,
        'Cards Count': d.cardsCount,
        'Total Amount (NGN)': d.totalAmount,
      })));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Summary');
      XLSX.writeFile(wb, `gift-cards-summary-${exportDate}.xlsx`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    }
  };

  const handleExportDailyDetails = async () => {
    try {
      const data = await getDailyGiftCardDetails(exportDate);
      if (data.length === 0) {
        alert('No data found for this date');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(data.map(d => ({
        'Date': d.date,
        'Time': d.time,
        'User Name': d.userName,
        'Email': d.userEmail,
        'Redemption Code': d.redemptionCode || 'N/A',
        'Amount (NGN)': d.amount || 0,
      })));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Details');
      XLSX.writeFile(wb, `gift-cards-details-${exportDate}.xlsx`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    }
  };

  const handleExportUserDetails = async () => {
    if (!exportUserId) {
      alert('Please select a user');
      return;
    }

    try {
      const data = await getUserGiftCardDetails(exportUserId);
      if (data.length === 0) {
        alert('No data found for this user');
        return;
      }

      const user = allUsers.find(u => u.id === exportUserId);
      const ws = XLSX.utils.json_to_sheet(data.map(d => ({
        'Date': d.date,
        'Time': d.time,
        'Redemption Code': d.redemptionCode || 'N/A',
        'Amount (NGN)': d.amount || 0,
        'Email Subject': d.emailSubject || 'N/A',
      })));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Gift Cards');
      XLSX.writeFile(wb, `gift-cards-${user?.full_name || 'user'}-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed');
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString();
  };

  // Get all valid codes from current view
  const getValidCodes = () => {
    const cards = viewMode === 'unmatched' ? unmatchedCards : giftCards;
    return cards
      .map(card => card.redemption_code)
      .filter((code): code is string => !!code && code !== 'N/A');
  };

  // Copy next batch of 5 codes
  const handleCopyNextBatch = async () => {
    const allCodes = getValidCodes();
    if (allCodes.length === 0) {
      setCopyMessage('No codes to copy');
      setTimeout(() => setCopyMessage(''), 2000);
      return;
    }

    const batchSize = 5;
    const startIndex = copiedIndex;
    const endIndex = Math.min(startIndex + batchSize, allCodes.length);
    const batch = allCodes.slice(startIndex, endIndex);

    if (batch.length === 0) {
      // Reset to beginning if we've copied all
      setCopiedIndex(0);
      setCopyMessage('All codes copied! Starting over...');
      setTimeout(() => setCopyMessage(''), 2000);
      return;
    }

    try {
      await navigator.clipboard.writeText(batch.join('\n'));
      setCopiedIndex(endIndex);
      const remaining = allCodes.length - endIndex;
      setCopyMessage(`Copied ${batch.length} codes (${remaining} remaining)`);
      setTimeout(() => setCopyMessage(''), 2000);
      setCopyDropdownOpen(false);
    } catch (err) {
      setCopyMessage('Failed to copy');
      setTimeout(() => setCopyMessage(''), 2000);
    }
  };

  // Copy all codes at once
  const handleCopyAllCodes = async () => {
    const allCodes = getValidCodes();
    if (allCodes.length === 0) {
      setCopyMessage('No codes to copy');
      setTimeout(() => setCopyMessage(''), 2000);
      return;
    }

    try {
      await navigator.clipboard.writeText(allCodes.join('\n'));
      setCopyMessage(`Copied all ${allCodes.length} codes!`);
      setTimeout(() => setCopyMessage(''), 2000);
      setCopyDropdownOpen(false);
    } catch (err) {
      setCopyMessage('Failed to copy');
      setTimeout(() => setCopyMessage(''), 2000);
    }
  };

  // Reset copy index when data changes
  const resetCopyIndex = () => {
    setCopiedIndex(0);
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>Auto-Checker</h1>
            <p>Automated gift card receipt verification</p>
          </div>
          <div className="header-actions">
            <Link to="/admin/auto-checker/settings" className="settings-btn">
              Settings
            </Link>
            <button
              className="scan-btn tertiary"
              onClick={() => deduplicateMutation.mutate()}
              disabled={deduplicateMutation.isPending}
              title="Remove duplicate gift card codes (keeps latest)"
            >
              {deduplicateMutation.isPending ? 'Removing...' : 'Remove Duplicates'}
            </button>
            <button
              className="scan-btn secondary"
              onClick={() => rescanMutation.mutate()}
              disabled={rescanMutation.isPending || !stats?.isConnected}
              title="Re-parse existing emails to find missing codes"
            >
              {rescanMutation.isPending ? 'Rescanning...' : 'Rescan Missing'}
            </button>
            <button
              className="scan-btn"
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending || !stats?.isConnected}
            >
              {scanMutation.isPending ? 'Scanning...' : 'Scan Now'}
            </button>
          </div>
        </div>
      </header>

      {/* Gmail Reconnection Required Banner */}
      {reconnectRequired && (
        <div className="warning-banner">
          <div className="warning-content">
            <strong>Gmail Connection Expired</strong>
            <p>Your Gmail connection has expired or been revoked. Please reconnect to continue scanning for gift cards.</p>
          </div>
          <Link to="/admin/auto-checker/settings" className="reconnect-btn">
            Reconnect Gmail
          </Link>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Connection Status</div>
          <div className={`stat-value ${stats?.isConnected ? 'connected' : 'disconnected'}`}>
            {statsLoading ? '...' : stats?.isConnected ? 'Connected' : 'Not Connected'}
          </div>
          {!stats?.isConnected && (
            <Link to="/admin/auto-checker/settings" className="setup-link">
              Connect Gmail
            </Link>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-label">Today's Cards</div>
          <div className="stat-value">{statsLoading ? '...' : stats?.todayCardsCount || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today's Total</div>
          <div className="stat-value">₦{statsLoading ? '...' : (stats?.todayTotalAmount || 0).toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Processed</div>
          <div className="stat-value">{statsLoading ? '...' : stats?.totalCardsFound || 0}</div>
        </div>
      </div>

      {stats?.lastScanAt && (
        <p className="last-scan">Last scan: {formatDateTime(stats.lastScanAt)}</p>
      )}

      {/* Export Section */}
      <div className="export-section">
        <h3>Export Data</h3>
        <div className="export-controls">
          <div className="export-group">
            <label>Daily Export</label>
            <div className="export-row">
              <input
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
              />
              <button onClick={handleExportDailySummary} className="export-btn">
                Summary
              </button>
              <button onClick={handleExportDailyDetails} className="export-btn">
                With Codes
              </button>
            </div>
          </div>
          <div className="export-group">
            <label>User Details</label>
            <div className="export-row">
              <select
                value={exportUserId}
                onChange={(e) => setExportUserId(e.target.value)}
              >
                <option value="">Select User...</option>
                {allUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
              <button onClick={handleExportUserDetails} className="export-btn">
                Export User
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="filter-bar">
        <button
          className={viewMode === 'cards' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setViewMode('cards')}
        >
          Gift Cards
        </button>
        <button
          className={viewMode === 'unmatched' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setViewMode('unmatched')}
        >
          Unmatched ({unmatchedCards.length})
        </button>
        <button
          className={viewMode === 'logs' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setViewMode('logs')}
        >
          Scan Logs
        </button>
      </div>

      {/* Date Filter for Cards View */}
      {viewMode === 'cards' && (
        <div className="date-filter">
          <label>Filter by date:</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
      )}

      {/* Gift Cards Table */}
      {viewMode === 'cards' && (
        cardsLoading ? (
          <div className="loading">Loading gift cards...</div>
        ) : giftCards.length === 0 ? (
          <div className="empty-state">
            <p>No gift cards found for {dateFilter}</p>
          </div>
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Sender Email</th>
                  <th>Matched User</th>
                  <th className="code-column-header">
                    <div className="code-header-wrapper">
                      <span>Code</span>
                      <div className="copy-dropdown-container" ref={dropdownRef}>
                        <button
                          className="copy-dropdown-trigger"
                          onClick={() => setCopyDropdownOpen(!copyDropdownOpen)}
                          title="Copy codes"
                        >
                          📋
                        </button>
                        {copyDropdownOpen && (
                          <div className="copy-dropdown-menu">
                            <button onClick={handleCopyNextBatch}>
                              Copy Next 5 ({Math.min(5, getValidCodes().length - copiedIndex)} codes)
                            </button>
                            <button onClick={handleCopyAllCodes}>
                              Copy All ({getValidCodes().length} codes)
                            </button>
                            {copiedIndex > 0 && (
                              <button onClick={resetCopyIndex}>
                                Reset (start from beginning)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {copyMessage && <span className="copy-message">{copyMessage}</span>}
                    </div>
                  </th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {giftCards.map(card => (
                  <tr key={card.id}>
                    <td>{formatTime(card.received_at)}</td>
                    <td>{card.sender_email}</td>
                    <td>
                      {card.matched_user ? (
                        card.matched_user.full_name
                      ) : (
                        <span className="unmatched">Unmatched</span>
                      )}
                    </td>
                    <td>
                      <code className="redemption-code">{card.redemption_code || 'N/A'}</code>
                    </td>
                    <td>₦{(card.amount || 0).toLocaleString()}</td>
                    <td>
                      <button
                        className="view-btn small"
                        onClick={() => setSelectedCard(card)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Unmatched Cards View */}
      {viewMode === 'unmatched' && (
        unmatchedCards.length === 0 ? (
          <div className="empty-state">
            <p>No unmatched gift cards</p>
          </div>
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sender Email</th>
                  <th className="code-column-header">
                    <div className="code-header-wrapper">
                      <span>Code</span>
                      <div className="copy-dropdown-container" ref={dropdownRef}>
                        <button
                          className="copy-dropdown-trigger"
                          onClick={() => setCopyDropdownOpen(!copyDropdownOpen)}
                          title="Copy codes"
                        >
                          📋
                        </button>
                        {copyDropdownOpen && (
                          <div className="copy-dropdown-menu">
                            <button onClick={handleCopyNextBatch}>
                              Copy Next 5 ({Math.min(5, getValidCodes().length - copiedIndex)} codes)
                            </button>
                            <button onClick={handleCopyAllCodes}>
                              Copy All ({getValidCodes().length} codes)
                            </button>
                            {copiedIndex > 0 && (
                              <button onClick={resetCopyIndex}>
                                Reset (start from beginning)
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {copyMessage && <span className="copy-message">{copyMessage}</span>}
                    </div>
                  </th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {unmatchedCards.map(card => (
                  <tr key={card.id}>
                    <td>{formatDateTime(card.received_at)}</td>
                    <td>{card.sender_email}</td>
                    <td>
                      <code className="redemption-code">{card.redemption_code || 'N/A'}</code>
                    </td>
                    <td>₦{(card.amount || 0).toLocaleString()}</td>
                    <td>
                      <button
                        className="match-btn small"
                        onClick={() => setSelectedCard(card)}
                      >
                        Match User
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Scan Logs View */}
      {viewMode === 'logs' && (
        scanLogs.length === 0 ? (
          <div className="empty-state">
            <p>No scan logs yet</p>
          </div>
        ) : (
          <div className="users-table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Emails Fetched</th>
                  <th>Cards Found</th>
                  <th>Trigger</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {scanLogs.map(log => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.started_at)}</td>
                    <td>{log.completed_at ? formatDateTime(log.completed_at) : '-'}</td>
                    <td>{log.emails_fetched}</td>
                    <td>{log.cards_found}</td>
                    <td>
                      <span className={`trigger-badge ${log.triggered_by}`}>
                        {log.triggered_by}
                      </span>
                    </td>
                    <td>
                      {log.errors && log.errors.length > 0 ? (
                        <span className="status-pill rejected">Errors</span>
                      ) : log.completed_at ? (
                        <span className="status-pill verified">Success</span>
                      ) : (
                        <span className="status-pill pending">Running</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Card Detail / Match User Modal */}
      {selectedCard && (
        <div className="modal-overlay" onClick={() => setSelectedCard(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedCard(null)}>
              &times;
            </button>
            <h3>Gift Card Details</h3>

            <div className="card-details">
              <div className="detail-row">
                <label>Sender Email</label>
                <span>{selectedCard.sender_email}</span>
              </div>
              <div className="detail-row">
                <label>Received At</label>
                <span>{formatDateTime(selectedCard.received_at)}</span>
              </div>
              <div className="detail-row">
                <label>Redemption Code</label>
                <code>{selectedCard.redemption_code || 'N/A'}</code>
              </div>
              <div className="detail-row">
                <label>Amount</label>
                <span>₦{(selectedCard.amount || 0).toLocaleString()} ({selectedCard.currency})</span>
              </div>
              {selectedCard.raw_email && (
                <div className="detail-row">
                  <label>Email Subject</label>
                  <span>{selectedCard.raw_email.subject || 'N/A'}</span>
                </div>
              )}
              <div className="detail-row">
                <label>Matched User</label>
                <span>
                  {selectedCard.matched_user?.full_name || 'Not matched'}
                </span>
              </div>
            </div>

            {!selectedCard.matched_user && (
              <div className="match-section">
                <h4>Match to User</h4>
                <div className="form-group">
                  <select
                    value={matchingUserId}
                    onChange={(e) => setMatchingUserId(e.target.value)}
                  >
                    <option value="">Select User...</option>
                    {allUsers.map(user => (
                      <option key={user.id} value={user.id}>
                        {user.full_name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="match-btn"
                  onClick={() => {
                    if (matchingUserId) {
                      matchUserMutation.mutate({
                        cardId: selectedCard.id,
                        userId: matchingUserId,
                      });
                    }
                  }}
                  disabled={!matchingUserId || matchUserMutation.isPending}
                >
                  {matchUserMutation.isPending ? 'Matching...' : 'Match User'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
