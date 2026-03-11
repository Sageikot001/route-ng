import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getAllAdmins, createAdmin } from '../../api/users';

export default function AdminAdmins() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const { data: allAdmins = [], isLoading } = useQuery({
    queryKey: ['all-admins'],
    queryFn: getAllAdmins,
  });

  const createAdminMutation = useMutation({
    mutationFn: (data: { email: string; username: string; password: string }) =>
      createAdmin(data.email, data.username, data.password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-admins'] });
      setNewAdminEmail('');
      setNewAdminUsername('');
      setNewAdminPassword('');
      setShowCreateAdmin(false);
    },
  });

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Administrators</h1>
        <p>Manage system administrators</p>
      </header>

      <div className="page-actions">
        <button className="primary-btn purple" onClick={() => setShowCreateAdmin(true)}>
          + Add Administrator
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading administrators...</div>
      ) : allAdmins.length === 0 ? (
        <div className="empty-state">
          <p>No administrators found.</p>
        </div>
      ) : (
        <div className="admins-grid">
          {allAdmins.map(admin => (
            <div
              key={admin.id}
              className={`admin-card-full ${admin.id === user?.id ? 'current' : ''}`}
            >
              <div className="admin-avatar">
                {admin.username.charAt(0).toUpperCase()}
              </div>
              <div className="admin-info-full">
                <h4>
                  {admin.username}
                  {admin.id === user?.id && <span className="you-badge">You</span>}
                </h4>
                <p className="admin-email">{admin.email}</p>
                <span className="admin-joined">
                  Joined {new Date(admin.created_at).toLocaleDateString()}
                </span>
              </div>
              <span className={`status-badge ${admin.is_active ? 'active' : 'inactive'}`}>
                {admin.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateAdmin && (
        <div className="modal-overlay" onClick={() => setShowCreateAdmin(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Administrator</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              createAdminMutation.mutate({
                email: newAdminEmail,
                username: newAdminUsername,
                password: newAdminPassword,
              });
            }}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@route.ng"
                  required
                />
              </div>
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={newAdminUsername}
                  onChange={(e) => setNewAdminUsername(e.target.value)}
                  placeholder="adminuser"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input
                  type="password"
                  value={newAdminPassword}
                  onChange={(e) => setNewAdminPassword(e.target.value)}
                  placeholder="Secure password"
                  required
                  minLength={8}
                />
              </div>
              {createAdminMutation.isError && (
                <p className="error-msg">
                  {createAdminMutation.error instanceof Error
                    ? createAdminMutation.error.message
                    : 'Failed to create admin'}
                </p>
              )}
              <div className="modal-actions">
                <button
                  type="submit"
                  className="primary-btn purple"
                  disabled={createAdminMutation.isPending}
                >
                  {createAdminMutation.isPending ? 'Creating...' : 'Create Admin'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setShowCreateAdmin(false);
                    setNewAdminEmail('');
                    setNewAdminUsername('');
                    setNewAdminPassword('');
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
