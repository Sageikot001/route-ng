import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllOpportunities,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getAvailabilityForOpportunity,
} from '../../api/opportunities';
import { useAuth } from '../../contexts/AuthContext';
import type { TransactionOpportunity } from '../../types';

export default function AdminOpportunities() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState<TransactionOpportunity | null>(null);
  const [viewingAvailability, setViewingAvailability] = useState<TransactionOpportunity | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: 'Gift Card Transaction',
    recipient_email: '',
    amount: 0,
    min_transactions_per_day: 1,
    max_transactions_per_day: 5,
    total_slots: '',
    expires_at: '',
    instructions: '',
    is_active: true,
  });

  const { data: opportunities = [], isLoading } = useQuery({
    queryKey: ['admin-opportunities'],
    queryFn: () => getAllOpportunities(),
  });

  const { data: availableUsers = [] } = useQuery({
    queryKey: ['opportunity-availability', viewingAvailability?.id],
    queryFn: () => viewingAvailability ? getAvailabilityForOpportunity(viewingAvailability.id) : [],
    enabled: !!viewingAvailability,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => createOpportunity({
      ...data,
      total_slots: data.total_slots ? parseInt(data.total_slots) : undefined,
      expires_at: data.expires_at || undefined,
      created_by: user?.id || '',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-opportunities'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TransactionOpportunity> }) =>
      updateOpportunity(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-opportunities'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOpportunity,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-opportunities'] });
    },
  });

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingOpportunity(null);
    setFormData({
      title: 'Gift Card Transaction',
      recipient_email: '',
      amount: 0,
      min_transactions_per_day: 1,
      max_transactions_per_day: 5,
      total_slots: '',
      expires_at: '',
      instructions: '',
      is_active: true,
    });
  };

  const openCreateModal = () => {
    setEditingOpportunity(null);
    setIsModalOpen(true);
  };

  const openEditModal = (opp: TransactionOpportunity) => {
    setEditingOpportunity(opp);
    setFormData({
      title: opp.title,
      recipient_email: opp.recipient_email,
      amount: opp.amount,
      min_transactions_per_day: opp.min_transactions_per_day,
      max_transactions_per_day: opp.max_transactions_per_day,
      total_slots: opp.total_slots?.toString() || '',
      expires_at: opp.expires_at ? opp.expires_at.split('T')[0] : '',
      instructions: opp.instructions || '',
      is_active: opp.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingOpportunity) {
      updateMutation.mutate({
        id: editingOpportunity.id,
        data: {
          ...formData,
          total_slots: formData.total_slots ? parseInt(formData.total_slots) : undefined,
          expires_at: formData.expires_at || undefined,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (opp: TransactionOpportunity) => {
    if (confirm(`Delete "${opp.title}"? This will also remove all user availability records.`)) {
      deleteMutation.mutate(opp.id);
    }
  };

  const toggleActive = (opp: TransactionOpportunity) => {
    updateMutation.mutate({
      id: opp.id,
      data: { is_active: !opp.is_active },
    });
  };

  const filteredOpportunities = opportunities.filter(opp => {
    if (filter === 'active') return opp.is_active;
    if (filter === 'inactive') return !opp.is_active;
    return true;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="admin-page">
      <header className="page-header">
        <div className="header-content">
          <div>
            <h1>Transaction Opportunities</h1>
            <p>Manage available transactions for partners</p>
          </div>
          <button className="primary-btn" onClick={openCreateModal}>
            + New Opportunity
          </button>
        </div>
      </header>

      {/* Filter */}
      <div className="filter-bar">
        <button
          className={filter === 'active' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('active')}
        >
          Active ({opportunities.filter(o => o.is_active).length})
        </button>
        <button
          className={filter === 'inactive' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('inactive')}
        >
          Inactive ({opportunities.filter(o => !o.is_active).length})
        </button>
        <button
          className={filter === 'all' ? 'filter-btn active' : 'filter-btn'}
          onClick={() => setFilter('all')}
        >
          All ({opportunities.length})
        </button>
      </div>

      {/* Opportunities List */}
      {isLoading ? (
        <div className="loading">Loading opportunities...</div>
      ) : filteredOpportunities.length === 0 ? (
        <div className="empty-state">
          <p>No opportunities found. Create one to get started.</p>
        </div>
      ) : (
        <div className="opportunities-list">
          {filteredOpportunities.map(opp => (
            <div key={opp.id} className={`opportunity-card ${!opp.is_active ? 'inactive' : ''}`}>
              <div className="opportunity-header">
                <div className="opportunity-title">
                  <h3>{opp.title}</h3>
                  <span className={`status-badge ${opp.is_active ? 'active' : 'inactive'}`}>
                    {opp.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="opportunity-actions">
                  <button
                    className="icon-btn"
                    onClick={() => setViewingAvailability(opp)}
                    title="View Available Users"
                  >
                    👥
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => toggleActive(opp)}
                    title={opp.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {opp.is_active ? '⏸️' : '▶️'}
                  </button>
                  <button className="icon-btn" onClick={() => openEditModal(opp)} title="Edit">
                    ✏️
                  </button>
                  <button className="icon-btn danger" onClick={() => handleDelete(opp)} title="Delete">
                    🗑️
                  </button>
                </div>
              </div>

              <div className="opportunity-details">
                <div className="detail-item">
                  <span className="detail-label">Recipient Email</span>
                  <span className="detail-value email">{opp.recipient_email}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Amount</span>
                  <span className="detail-value amount">N{opp.amount.toLocaleString()}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Expected Range</span>
                  <span className="detail-value">
                    {opp.min_transactions_per_day} - {opp.max_transactions_per_day} per Apple ID/day
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Available Users</span>
                  <span className="detail-value">
                    {opp.filled_slots}
                    {opp.total_slots ? ` / ${opp.total_slots}` : ''}
                  </span>
                </div>
                {opp.expires_at && (
                  <div className="detail-item">
                    <span className="detail-label">Expires</span>
                    <span className="detail-value">{formatDate(opp.expires_at)}</span>
                  </div>
                )}
              </div>

              {opp.instructions && (
                <div className="opportunity-instructions">
                  <strong>Instructions:</strong> {opp.instructions}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal opportunity-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>&times;</button>
            <h2>{editingOpportunity ? 'Edit Opportunity' : 'New Opportunity'}</h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Gift Card Transaction"
                />
              </div>

              <div className="form-group">
                <label>Recipient Email *</label>
                <input
                  type="email"
                  value={formData.recipient_email}
                  onChange={e => setFormData({ ...formData, recipient_email: e.target.value })}
                  required
                  placeholder="email@example.com"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Amount (NGN) *</label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                    required
                    min="0"
                    step="1"
                    placeholder="0"
                  />
                </div>
                <div className="form-group">
                  <label>Total Slots</label>
                  <input
                    type="number"
                    value={formData.total_slots}
                    onChange={e => setFormData({ ...formData, total_slots: e.target.value })}
                    min="1"
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Min Transactions/Day *</label>
                  <input
                    type="number"
                    value={formData.min_transactions_per_day}
                    onChange={e => setFormData({ ...formData, min_transactions_per_day: parseInt(e.target.value) || 1 })}
                    required
                    min="1"
                  />
                </div>
                <div className="form-group">
                  <label>Max Transactions/Day *</label>
                  <input
                    type="number"
                    value={formData.max_transactions_per_day}
                    onChange={e => setFormData({ ...formData, max_transactions_per_day: parseInt(e.target.value) || 1 })}
                    required
                    min="1"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Expires At</label>
                <input
                  type="date"
                  value={formData.expires_at}
                  onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Instructions</label>
                <textarea
                  value={formData.instructions}
                  onChange={e => setFormData({ ...formData, instructions: e.target.value })}
                  rows={3}
                  placeholder="Any special instructions for partners..."
                />
              </div>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                />
                Active (visible to partners)
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingOpportunity ? 'Save Changes' : 'Create Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Available Users Modal */}
      {viewingAvailability && (
        <div className="modal-overlay" onClick={() => setViewingAvailability(null)}>
          <div className="modal availability-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setViewingAvailability(null)}>&times;</button>
            <h2>Available Users</h2>
            <p className="modal-subtitle">{viewingAvailability.title}</p>

            {availableUsers.length === 0 ? (
              <div className="empty-state">
                <p>No users have marked themselves as available yet.</p>
              </div>
            ) : (
              <div className="available-users-list">
                {availableUsers.map(avail => (
                  <div key={avail.id} className="available-user-item">
                    <div className="user-info">
                      <strong>{(avail.user as any)?.full_name || 'Unknown'}</strong>
                      <span className="user-email">{(avail.user as any)?.users?.email}</span>
                    </div>
                    <div className="user-meta">
                      {avail.expected_transactions && (
                        <span className="expected-count">
                          Expects: {avail.expected_transactions} txns
                        </span>
                      )}
                      <span className="available-since">
                        Since: {new Date(avail.available_from).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
