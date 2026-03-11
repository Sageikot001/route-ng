import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../api/supabase';

type AudienceType = 'all' | 'managers' | 'ios_users';

interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: AudienceType;
  created_by: string;
  created_at: string;
  expires_at?: string;
  is_active: boolean;
}

async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

async function createAnnouncement(announcement: Omit<Announcement, 'id' | 'created_at'>): Promise<Announcement> {
  const { data, error } = await supabase
    .from('announcements')
    .insert(announcement)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement> {
  const { data, error } = await supabase
    .from('announcements')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export default function AdminAnnouncements() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newAudience, setNewAudience] = useState<AudienceType>('all');
  const [newExpiresAt, setNewExpiresAt] = useState('');

  // Reserved for future edit functionality
  const [, setEditingAnnouncement] = useState<Announcement | null>(null);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: getAnnouncements,
  });

  const createMutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Announcement> }) =>
      updateAnnouncement(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setEditingAnnouncement(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const resetForm = () => {
    setShowCreateModal(false);
    setNewTitle('');
    setNewContent('');
    setNewAudience('all');
    setNewExpiresAt('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    createMutation.mutate({
      title: newTitle.trim(),
      content: newContent.trim(),
      audience: newAudience,
      created_by: user.id,
      expires_at: newExpiresAt || undefined,
      is_active: true,
    });
  };

  const handleToggleActive = (announcement: Announcement) => {
    updateMutation.mutate({
      id: announcement.id,
      updates: { is_active: !announcement.is_active },
    });
  };

  const getAudienceLabel = (audience: AudienceType) => {
    switch (audience) {
      case 'all': return 'Everyone';
      case 'managers': return 'Managers Only';
      case 'ios_users': return 'iOS Users Only';
    }
  };

  const getAudienceColor = (audience: AudienceType) => {
    switch (audience) {
      case 'all': return 'purple';
      case 'managers': return 'blue';
      case 'ios_users': return 'green';
    }
  };

  const activeAnnouncements = announcements.filter(a => a.is_active);
  const inactiveAnnouncements = announcements.filter(a => !a.is_active);

  return (
    <div className="admin-page">
      <header className="page-header">
        <h1>Announcements</h1>
        <p>Send broadcast messages to users and managers</p>
      </header>

      <div className="page-actions">
        <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
          + Create Announcement
        </button>
      </div>

      <div className="announcement-stats">
        <div className="stat-pill">
          <span className="stat-label">Total</span>
          <span className="stat-value">{announcements.length}</span>
        </div>
        <div className="stat-pill active">
          <span className="stat-label">Active</span>
          <span className="stat-value">{activeAnnouncements.length}</span>
        </div>
        <div className="stat-pill inactive">
          <span className="stat-label">Inactive</span>
          <span className="stat-value">{inactiveAnnouncements.length}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">Loading announcements...</div>
      ) : announcements.length === 0 ? (
        <div className="empty-state">
          <p>No announcements yet.</p>
          <p>Create an announcement to broadcast messages to your users.</p>
        </div>
      ) : (
        <div className="announcements-list">
          {activeAnnouncements.length > 0 && (
            <section className="announcements-section">
              <h2>Active Announcements</h2>
              <div className="announcements-grid">
                {activeAnnouncements.map(announcement => (
                  <div key={announcement.id} className="announcement-card active">
                    <div className="announcement-header">
                      <h3>{announcement.title}</h3>
                      <span className={`audience-badge ${getAudienceColor(announcement.audience)}`}>
                        {getAudienceLabel(announcement.audience)}
                      </span>
                    </div>
                    <p className="announcement-content">{announcement.content}</p>
                    <div className="announcement-meta">
                      <span className="announcement-date">
                        {new Date(announcement.created_at).toLocaleDateString()}
                      </span>
                      {announcement.expires_at && (
                        <span className="announcement-expires">
                          Expires: {new Date(announcement.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="announcement-actions">
                      <button
                        className="secondary-btn small"
                        onClick={() => handleToggleActive(announcement)}
                        disabled={updateMutation.isPending}
                      >
                        Deactivate
                      </button>
                      <button
                        className="delete-btn small"
                        onClick={() => {
                          if (window.confirm('Delete this announcement?')) {
                            deleteMutation.mutate(announcement.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {inactiveAnnouncements.length > 0 && (
            <section className="announcements-section">
              <h2>Inactive Announcements</h2>
              <div className="announcements-grid">
                {inactiveAnnouncements.map(announcement => (
                  <div key={announcement.id} className="announcement-card inactive">
                    <div className="announcement-header">
                      <h3>{announcement.title}</h3>
                      <span className={`audience-badge ${getAudienceColor(announcement.audience)}`}>
                        {getAudienceLabel(announcement.audience)}
                      </span>
                    </div>
                    <p className="announcement-content">{announcement.content}</p>
                    <div className="announcement-meta">
                      <span className="announcement-date">
                        {new Date(announcement.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="announcement-actions">
                      <button
                        className="primary-btn small"
                        onClick={() => handleToggleActive(announcement)}
                        disabled={updateMutation.isPending}
                      >
                        Activate
                      </button>
                      <button
                        className="delete-btn small"
                        onClick={() => {
                          if (window.confirm('Delete this announcement?')) {
                            deleteMutation.mutate(announcement.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => resetForm()}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <h3>Create Announcement</h3>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Announcement title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Content</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write your announcement message..."
                  rows={5}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Audience</label>
                  <select
                    value={newAudience}
                    onChange={(e) => setNewAudience(e.target.value as AudienceType)}
                  >
                    <option value="all">Everyone</option>
                    <option value="managers">Managers Only</option>
                    <option value="ios_users">iOS Users Only</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Expires On (Optional)</label>
                  <input
                    type="date"
                    value={newExpiresAt}
                    onChange={(e) => setNewExpiresAt(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              {createMutation.isError && (
                <p className="error-msg">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Failed to create announcement'}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={createMutation.isPending || !newTitle.trim() || !newContent.trim()}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Announcement'}
                </button>
                <button type="button" className="secondary-btn" onClick={resetForm}>
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
