import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSystemBanks, addSystemBank, toggleSystemBankStatus, deleteSystemBank } from '../../api/systemBanks';
import { sendNotificationToAll } from '../../lib/sendNotification';

export default function AdminBanks() {
  const queryClient = useQueryClient();

  const [showAddBank, setShowAddBank] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [bankError, setBankError] = useState('');

  const { data: systemBanks = [], isLoading } = useQuery({
    queryKey: ['system-banks-admin'],
    queryFn: () => getSystemBanks(true),
  });

  const addBankMutation = useMutation({
    mutationFn: (name: string) => addSystemBank(name),
    onSuccess: async (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ['system-banks-admin'] });
      queryClient.invalidateQueries({ queryKey: ['system-banks'] });
      setShowAddBank(false);
      setNewBankName('');
      setBankError('');

      // Notify all users about new bank
      await sendNotificationToAll({
        title: 'New Bank Added',
        body: `${name} is now available for transactions on Route.ng!`,
        url: '/',
        tag: 'bank-update',
      });
    },
    onError: (error) => {
      setBankError(error instanceof Error ? error.message : 'Failed to add bank');
    },
  });

  const toggleBankMutation = useMutation({
    mutationFn: ({ bankId, isActive }: { bankId: string; isActive: boolean; bankName: string }) =>
      toggleSystemBankStatus(bankId, isActive),
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['system-banks-admin'] });
      queryClient.invalidateQueries({ queryKey: ['system-banks'] });

      // Notify users about bank status change
      if (variables.isActive) {
        await sendNotificationToAll({
          title: 'Bank Activated',
          body: `${variables.bankName} is now active and available for transactions.`,
          url: '/',
          tag: 'bank-update',
        });
      } else {
        await sendNotificationToAll({
          title: 'Bank Deactivated',
          body: `${variables.bankName} has been temporarily deactivated. Please use another bank for transactions.`,
          url: '/',
          tag: 'bank-update',
        });
      }
    },
  });

  const deleteBankMutation = useMutation({
    mutationFn: (bankId: string) => deleteSystemBank(bankId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-banks-admin'] });
      queryClient.invalidateQueries({ queryKey: ['system-banks'] });
    },
  });

  const activeBanks = systemBanks.filter(b => b.is_active);
  const inactiveBanks = systemBanks.filter(b => !b.is_active);

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>System Banks</h1>
        <p>Manage available banks for user registration</p>
      </header>

      <div className="page-actions">
        <button className="primary-btn" onClick={() => setShowAddBank(true)}>
          + Add New Bank
        </button>
      </div>

      <div className="bank-stats">
        <div className="stat-pill">
          <span className="stat-label">Total</span>
          <span className="stat-value">{systemBanks.length}</span>
        </div>
        <div className="stat-pill active">
          <span className="stat-label">Active</span>
          <span className="stat-value">{activeBanks.length}</span>
        </div>
        <div className="stat-pill inactive">
          <span className="stat-label">Inactive</span>
          <span className="stat-value">{inactiveBanks.length}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">Loading banks...</div>
      ) : systemBanks.length === 0 ? (
        <div className="empty-state">
          <p>No banks configured yet.</p>
          <p>Add banks to enable user registration.</p>
        </div>
      ) : (
        <>
          <section className="banks-section-page">
            <h2>Active Banks ({activeBanks.length})</h2>
            {activeBanks.length === 0 ? (
              <p className="empty-text">No active banks</p>
            ) : (
              <div className="banks-grid-admin">
                {activeBanks.map(bank => (
                  <div key={bank.id} className="bank-card-admin active">
                    <div className="bank-icon-admin">🏦</div>
                    <div className="bank-info-admin">
                      <h4>{bank.name}</h4>
                      <span className="bank-added">
                        Added {new Date(bank.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="bank-actions-admin">
                      <button
                        className="deactivate-btn"
                        onClick={() => toggleBankMutation.mutate({ bankId: bank.id, isActive: false, bankName: bank.name })}
                        disabled={toggleBankMutation.isPending}
                      >
                        Deactivate
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => {
                          if (window.confirm(`Delete "${bank.name}"? This cannot be undone.`)) {
                            deleteBankMutation.mutate(bank.id);
                          }
                        }}
                        disabled={deleteBankMutation.isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {inactiveBanks.length > 0 && (
            <section className="banks-section-page">
              <h2>Inactive Banks ({inactiveBanks.length})</h2>
              <div className="banks-grid-admin">
                {inactiveBanks.map(bank => (
                  <div key={bank.id} className="bank-card-admin inactive">
                    <div className="bank-icon-admin">🏦</div>
                    <div className="bank-info-admin">
                      <h4>{bank.name}</h4>
                      <span className="bank-added">
                        Added {new Date(bank.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="bank-actions-admin">
                      <button
                        className="activate-btn"
                        onClick={() => toggleBankMutation.mutate({ bankId: bank.id, isActive: true, bankName: bank.name })}
                        disabled={toggleBankMutation.isPending}
                      >
                        Activate
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => {
                          if (window.confirm(`Delete "${bank.name}"? This cannot be undone.`)) {
                            deleteBankMutation.mutate(bank.id);
                          }
                        }}
                        disabled={deleteBankMutation.isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Add Bank Modal */}
      {showAddBank && (
        <div className="modal-overlay" onClick={() => setShowAddBank(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Bank</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (newBankName.trim()) {
                addBankMutation.mutate(newBankName.trim());
              }
            }}>
              <div className="form-group">
                <label>Bank Name</label>
                <input
                  type="text"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  placeholder="e.g., Zenith Bank"
                  required
                  autoFocus
                />
              </div>
              {bankError && <p className="error-msg">{bankError}</p>}
              <div className="modal-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={addBankMutation.isPending || !newBankName.trim()}
                >
                  {addBankMutation.isPending ? 'Adding...' : 'Add Bank'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowAddBank(false);
                    setNewBankName('');
                    setBankError('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
