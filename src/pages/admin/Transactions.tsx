import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getAllManagers } from '../../api/managers';
import {
  verifyTransactionByAdmin,
  rejectTransactionByAdmin,
  getManagerTransactionsWithDetails
} from '../../api/transactions';
import { supabase } from '../../api/supabase';
import type { TransactionWithDetails, TransactionStatus } from '../../types';

type FilterStatus = 'pending_admin' | 'verified' | 'rejected' | 'all';
type ViewMode = 'review' | 'logs';
type LogsFilterStatus = 'all' | 'pending_manager' | 'pending_admin' | 'verified' | 'rejected';

interface TransactionLog {
  id: string;
  transaction_date: string;
  created_at: string;
  gift_card_amount: number;
  card_amount: number;
  receipt_count: number;
  status: TransactionStatus;
  proof_image_url: string | null;
  manager_reviewed_at: string | null;
  admin_reviewed_at: string | null;
  ios_user: {
    full_name: string;
    apple_id: string;
  } | null;
  manager: {
    full_name: string;
  } | null;
}

export default function AdminTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<ViewMode>('review');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('pending_admin');
  const [logsStatusFilter, setLogsStatusFilter] = useState<LogsFilterStatus>('all');
  const [logsDateFilter, setLogsDateFilter] = useState<string>('');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data: allManagers = [] } = useQuery({
    queryKey: ['all-managers'],
    queryFn: getAllManagers,
  });

  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['admin-all-transactions', statusFilter],
    queryFn: async () => {
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      const allTxPromises = allManagers.map(m =>
        getManagerTransactionsWithDetails(m.id, { status: statusParam })
      );
      const results = await Promise.all(allTxPromises);
      return results.flat().sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: allManagers.length > 0,
  });

  // Query for Transaction Logs view
  const { data: transactionLogs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ['admin-transaction-logs', logsStatusFilter, logsDateFilter],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select(`
          id,
          transaction_date,
          created_at,
          gift_card_amount,
          card_amount,
          receipt_count,
          status,
          proof_image_url,
          manager_reviewed_at,
          admin_reviewed_at,
          ios_user:ios_user_profiles(full_name, apple_id),
          manager:manager_profiles!transactions_manager_id_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (logsStatusFilter !== 'all') {
        query = query.eq('status', logsStatusFilter);
      }

      if (logsDateFilter) {
        query = query.eq('transaction_date', logsDateFilter);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      // Transform the data to handle Supabase's array format for joins
      return (data || []).map((item: Record<string, unknown>) => ({
        ...item,
        ios_user: Array.isArray(item.ios_user) ? item.ios_user[0] : item.ios_user,
        manager: Array.isArray(item.manager) ? item.manager[0] : item.manager,
      })) as TransactionLog[];
    },
    enabled: viewMode === 'logs',
  });

  const verifyMutation = useMutation({
    mutationFn: (transactionId: string) => {
      if (!user) throw new Error('Not authenticated');
      return verifyTransactionByAdmin(transactionId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-transactions-detailed'] });
      setSelectedTransaction(null);
    },
    onError: (error) => {
      console.error('Failed to verify:', error);
      alert('Failed to verify transaction');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ transactionId, reason }: { transactionId: string; reason: string }) => {
      if (!user) throw new Error('Not authenticated');
      return rejectTransactionByAdmin(transactionId, user.id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pending-transactions-detailed'] });
      setSelectedTransaction(null);
      setShowRejectModal(false);
      setRejectReason('');
    },
    onError: (error) => {
      console.error('Failed to reject:', error);
      alert('Failed to reject transaction');
    },
  });

  const handleReject = () => {
    if (selectedTransaction && rejectReason.trim()) {
      rejectMutation.mutate({
        transactionId: selectedTransaction.id,
        reason: rejectReason.trim()
      });
    }
  };

  // Stats for Review mode
  const stats = {
    pending: allTransactions.filter(t => t.status === 'pending_admin').length,
    verified: allTransactions.filter(t => t.status === 'verified').length,
    rejected: allTransactions.filter(t => t.status === 'rejected').length,
    total: allTransactions.length,
  };

  // Stats for Logs view
  const logsStats = {
    all: transactionLogs.length,
    pendingManager: transactionLogs.filter(t => t.status === 'pending_manager').length,
    pendingAdmin: transactionLogs.filter(t => t.status === 'pending_admin').length,
    verified: transactionLogs.filter(t => t.status === 'verified').length,
    rejected: transactionLogs.filter(t => t.status === 'rejected').length,
  };

  const getStatusBadge = (status: TransactionStatus) => {
    const classes: Record<string, string> = {
      verified: 'status-badge verified',
      rejected: 'status-badge rejected',
      pending_admin: 'status-badge pending',
      pending_manager: 'status-badge pending-manager',
    };
    const labels: Record<string, string> = {
      verified: 'Verified',
      rejected: 'Rejected',
      pending_admin: 'Pending',
      pending_manager: 'With Manager',
    };
    return <span className={classes[status] || 'status-badge'}>{labels[status] || status}</span>;
  };

  // Group transactions by date
  const groupedTransactions = allTransactions.reduce((groups, tx) => {
    const date = new Date(tx.created_at).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(tx);
    return groups;
  }, {} as Record<string, TransactionWithDetails[]>);

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Transactions</h1>
        <p>Review and verify team transactions</p>
      </header>

      {/* View Mode Toggle */}
      <div className="view-mode-toggle">
        <button
          className={`view-mode-btn ${viewMode === 'review' ? 'active' : ''}`}
          onClick={() => setViewMode('review')}
        >
          Review Queue
        </button>
        <button
          className={`view-mode-btn ${viewMode === 'logs' ? 'active' : ''}`}
          onClick={() => setViewMode('logs')}
        >
          Transaction Logs
        </button>
      </div>

      {viewMode === 'review' ? (
        <>
          {/* Stats Cards */}
          <div className="admin-tx-stats">
        <div
          className={`tx-stat-card ${statusFilter === 'pending_admin' ? 'active' : ''} pending`}
          onClick={() => setStatusFilter('pending_admin')}
        >
          <div className="tx-stat-icon">⏳</div>
          <div className="tx-stat-info">
            <span className="tx-stat-number">{stats.pending}</span>
            <span className="tx-stat-label">Pending Review</span>
          </div>
        </div>
        <div
          className={`tx-stat-card ${statusFilter === 'verified' ? 'active' : ''} verified`}
          onClick={() => setStatusFilter('verified')}
        >
          <div className="tx-stat-icon">✓</div>
          <div className="tx-stat-info">
            <span className="tx-stat-number">{stats.verified}</span>
            <span className="tx-stat-label">Verified</span>
          </div>
        </div>
        <div
          className={`tx-stat-card ${statusFilter === 'rejected' ? 'active' : ''} rejected`}
          onClick={() => setStatusFilter('rejected')}
        >
          <div className="tx-stat-icon">✕</div>
          <div className="tx-stat-info">
            <span className="tx-stat-number">{stats.rejected}</span>
            <span className="tx-stat-label">Rejected</span>
          </div>
        </div>
        <div
          className={`tx-stat-card ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          <div className="tx-stat-icon">📋</div>
          <div className="tx-stat-info">
            <span className="tx-stat-number">{stats.total}</span>
            <span className="tx-stat-label">All Transactions</span>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      {isLoading ? (
        <div className="loading">Loading transactions...</div>
      ) : allTransactions.length === 0 ? (
        <div className="empty-state">
          <p>No transactions found{statusFilter !== 'all' ? ' with this status' : ''}.</p>
        </div>
      ) : (
        <div className="admin-tx-list">
          {Object.entries(groupedTransactions).map(([date, transactions]) => (
            <div key={date} className="tx-date-group">
              <div className="tx-date-header">
                <span className="tx-date">{date}</span>
                <span className="tx-count">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="tx-table">
                <div className="tx-table-header">
                  <div className="tx-col proof">Proof</div>
                  <div className="tx-col user">User</div>
                  <div className="tx-col amount">Amount</div>
                  <div className="tx-col cards">Cards</div>
                  <div className="tx-col status">Status</div>
                  <div className="tx-col actions">Actions</div>
                </div>

                {transactions.map(tx => (
                  <div key={tx.id} className="tx-table-row" onClick={() => setSelectedTransaction(tx)}>
                    <div className="tx-col proof">
                      {tx.proof_image_url ? (
                        <img
                          src={tx.proof_image_url}
                          alt="Proof"
                          className="tx-proof-thumb"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage(tx.proof_image_url!);
                          }}
                        />
                      ) : (
                        <div className="no-proof">No image</div>
                      )}
                    </div>
                    <div className="tx-col user">
                      <span className="tx-user-name">{tx.ios_user?.full_name || 'Unknown'}</span>
                      <span className="tx-user-email">{tx.ios_user?.apple_id}</span>
                    </div>
                    <div className="tx-col amount">
                      <span className="tx-amount-value">₦{tx.gift_card_amount.toLocaleString()}</span>
                    </div>
                    <div className="tx-col cards">
                      <span>{tx.receipt_count}</span>
                    </div>
                    <div className="tx-col status">
                      {getStatusBadge(tx.status)}
                    </div>
                    <div className="tx-col actions" onClick={(e) => e.stopPropagation()}>
                      {tx.status === 'pending_admin' && (
                        <>
                          <button
                            className="tx-action-btn verify"
                            onClick={() => verifyMutation.mutate(tx.id)}
                            disabled={verifyMutation.isPending}
                            title="Verify"
                          >
                            ✓
                          </button>
                          <button
                            className="tx-action-btn reject"
                            onClick={() => {
                              setSelectedTransaction(tx);
                              setShowRejectModal(true);
                            }}
                            title="Reject"
                          >
                            ✕
                          </button>
                        </>
                      )}
                      {tx.status === 'rejected' && (
                        <span className="tx-rejection-hint" title={tx.rejection_reason}>
                          ⚠️
                        </span>
                      )}
                      <button
                        className="tx-action-btn view"
                        onClick={() => setSelectedTransaction(tx)}
                        title="View Details"
                      >
                        👁
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      ) : (
        /* Transaction Logs View */
        <div className="transaction-logs-view">
          {/* Logs Filter Bar */}
          <div className="logs-filter-bar">
            <div className="logs-filter-group">
              <label>Status:</label>
              <select
                value={logsStatusFilter}
                onChange={(e) => setLogsStatusFilter(e.target.value as LogsFilterStatus)}
              >
                <option value="all">All ({logsStats.all})</option>
                <option value="pending_manager">With Manager ({logsStats.pendingManager})</option>
                <option value="pending_admin">Awaiting Admin ({logsStats.pendingAdmin})</option>
                <option value="verified">Verified ({logsStats.verified})</option>
                <option value="rejected">Rejected ({logsStats.rejected})</option>
              </select>
            </div>
            <div className="logs-filter-group">
              <label>Date:</label>
              <input
                type="date"
                value={logsDateFilter}
                onChange={(e) => setLogsDateFilter(e.target.value)}
              />
              {logsDateFilter && (
                <button
                  className="clear-date-btn"
                  onClick={() => setLogsDateFilter('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Logs Stats Summary */}
          <div className="logs-stats-summary">
            <div className="logs-stat">
              <span className="logs-stat-number">{logsStats.pendingManager}</span>
              <span className="logs-stat-label">With Manager</span>
            </div>
            <div className="logs-stat">
              <span className="logs-stat-number">{logsStats.pendingAdmin}</span>
              <span className="logs-stat-label">Awaiting Admin</span>
            </div>
            <div className="logs-stat success">
              <span className="logs-stat-number">{logsStats.verified}</span>
              <span className="logs-stat-label">Verified</span>
            </div>
            <div className="logs-stat rejected">
              <span className="logs-stat-number">{logsStats.rejected}</span>
              <span className="logs-stat-label">Rejected</span>
            </div>
          </div>

          {/* Logs Table */}
          {isLoadingLogs ? (
            <div className="loading">Loading transaction logs...</div>
          ) : transactionLogs.length === 0 ? (
            <div className="empty-state">
              <p>No transaction logs found{logsStatusFilter !== 'all' || logsDateFilter ? ' with these filters' : ''}.</p>
            </div>
          ) : (
            <div className="logs-table-container">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Proof</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Cards</th>
                    <th>Status</th>
                    <th>Logged</th>
                    <th>Manager Review</th>
                    <th>Admin Review</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionLogs.map(log => (
                    <tr key={log.id} className={`log-row status-${log.status}`}>
                      <td className="log-proof">
                        {log.proof_image_url ? (
                          <img
                            src={log.proof_image_url}
                            alt="Proof"
                            className="log-proof-thumb"
                            onClick={() => setLightboxImage(log.proof_image_url!)}
                          />
                        ) : (
                          <span className="no-proof">-</span>
                        )}
                      </td>
                      <td className="log-user">
                        <span className="log-user-name">{log.ios_user?.full_name || 'Unknown'}</span>
                        <span className="log-user-email">{log.ios_user?.apple_id}</span>
                      </td>
                      <td className="log-amount">
                        <span className="log-total">₦{log.gift_card_amount.toLocaleString()}</span>
                        <span className="log-per-card">₦{log.card_amount.toLocaleString()}/card</span>
                      </td>
                      <td className="log-cards">{log.receipt_count}</td>
                      <td className="log-status">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="log-date">
                        <span className="log-date-main">{log.transaction_date}</span>
                        <span className="log-date-time">
                          {new Date(log.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="log-date">
                        {log.manager_reviewed_at ? (
                          <>
                            <span className="log-date-main">
                              {new Date(log.manager_reviewed_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="log-date-time">
                              {new Date(log.manager_reviewed_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        ) : (
                          <span className="log-pending">Pending</span>
                        )}
                      </td>
                      <td className="log-date">
                        {log.admin_reviewed_at ? (
                          <>
                            <span className="log-date-main">
                              {new Date(log.admin_reviewed_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="log-date-time">
                              {new Date(log.admin_reviewed_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </>
                        ) : (
                          <span className="log-pending">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && !showRejectModal && (
        <div className="modal-overlay" onClick={() => setSelectedTransaction(null)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedTransaction(null)}>
              &times;
            </button>

            <div className="tx-modal-header">
              <h3>Transaction Details</h3>
              {getStatusBadge(selectedTransaction.status)}
            </div>

            <div className="tx-modal-content">
              <div className="tx-modal-left">
                {selectedTransaction.proof_image_url ? (
                  <img
                    src={selectedTransaction.proof_image_url}
                    alt="Transaction Proof"
                    className="tx-modal-proof"
                    onClick={() => setLightboxImage(selectedTransaction.proof_image_url!)}
                  />
                ) : (
                  <div className="tx-modal-no-proof">No proof image</div>
                )}
              </div>

              <div className="tx-modal-right">
                <div className="tx-modal-section">
                  <h4>User Information</h4>
                  <div className="tx-modal-grid">
                    <div className="tx-modal-item">
                      <label>Name</label>
                      <span>{selectedTransaction.ios_user?.full_name}</span>
                    </div>
                    <div className="tx-modal-item">
                      <label>Apple ID</label>
                      <span>{selectedTransaction.ios_user?.apple_id}</span>
                    </div>
                  </div>
                </div>

                <div className="tx-modal-section">
                  <h4>Transaction Details</h4>
                  <div className="tx-modal-grid">
                    <div className="tx-modal-item highlight">
                      <label>Total Amount</label>
                      <span className="large">₦{selectedTransaction.gift_card_amount.toLocaleString()}</span>
                    </div>
                    <div className="tx-modal-item">
                      <label>Per Card</label>
                      <span>₦{selectedTransaction.card_amount.toLocaleString()}</span>
                    </div>
                    <div className="tx-modal-item">
                      <label>Card Count</label>
                      <span>{selectedTransaction.receipt_count}</span>
                    </div>
                  </div>
                </div>

                <div className="tx-modal-section">
                  <h4>Dates</h4>
                  <div className="tx-modal-grid">
                    <div className="tx-modal-item">
                      <label>Logged</label>
                      <span>{new Date(selectedTransaction.transaction_date).toLocaleString('en-NG', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {selectedTransaction.manager_reviewed_at && (
                      <div className="tx-modal-item">
                        <label>Manager Reviewed</label>
                        <span>{new Date(selectedTransaction.manager_reviewed_at).toLocaleString('en-NG', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                    {selectedTransaction.admin_reviewed_at && (
                      <div className="tx-modal-item">
                        <label>Admin Reviewed</label>
                        <span>{new Date(selectedTransaction.admin_reviewed_at).toLocaleString('en-NG', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedTransaction.recipient_address && (
                  <div className="tx-modal-section">
                    <h4>Recipient</h4>
                    <p className="tx-recipient">{selectedTransaction.recipient_address}</p>
                  </div>
                )}

                {selectedTransaction.rejection_reason && (
                  <div className="tx-modal-section rejection">
                    <h4>Rejection Reason</h4>
                    <p>{selectedTransaction.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>

            {selectedTransaction.status === 'pending_admin' && (
              <div className="tx-modal-actions">
                <button
                  className="btn-verify"
                  onClick={() => verifyMutation.mutate(selectedTransaction.id)}
                  disabled={verifyMutation.isPending}
                >
                  {verifyMutation.isPending ? 'Verifying...' : '✓ Verify Transaction'}
                </button>
                <button
                  className="btn-reject"
                  onClick={() => setShowRejectModal(true)}
                >
                  ✕ Reject Transaction
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedTransaction && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reject Transaction</h3>
            <p>
              Rejecting transaction from <strong>{selectedTransaction.ios_user?.full_name}</strong> for{' '}
              <strong>₦{selectedTransaction.gift_card_amount.toLocaleString()}</strong>
            </p>
            <div className="warning-banner">
              <p>⚠️ This rejection will be flagged against both the user and their manager.</p>
            </div>
            <div className="form-group">
              <label>Reason for rejection:</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Please provide a detailed reason..."
                rows={4}
                required
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-reject"
                onClick={handleReject}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <button className="lightbox-close" onClick={() => setLightboxImage(null)}>
            &times;
          </button>
          <img
            src={lightboxImage}
            alt="Full size proof"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
