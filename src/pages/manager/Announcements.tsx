import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../api/supabase';

interface Announcement {
  id: string;
  title: string;
  content: string;
  audience: 'all' | 'managers' | 'ios_users';
  created_by: string;
  created_at: string;
  is_active: boolean;
}

interface TeamAnnouncement {
  id: string;
  manager_id: string;
  title: string;
  content: string;
  created_at: string;
  is_active: boolean;
}

async function getSystemAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .in('audience', ['all', 'managers'])
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

async function getTeamAnnouncements(managerId: string): Promise<TeamAnnouncement[]> {
  const { data, error } = await supabase
    .from('team_announcements')
    .select('*')
    .eq('manager_id', managerId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

async function createTeamAnnouncement(managerId: string, title: string, content: string): Promise<TeamAnnouncement> {
  const { data, error } = await supabase
    .from('team_announcements')
    .insert({ manager_id: managerId, title, content, is_active: true })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteTeamAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from('team_announcements')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export default function ManagerAnnouncements() {
  const { managerProfile } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const { data: systemAnnouncements = [], isLoading: loadingSystem } = useQuery({
    queryKey: ['system-announcements-manager'],
    queryFn: getSystemAnnouncements,
  });

  const { data: teamAnnouncements = [], isLoading: loadingTeam } = useQuery({
    queryKey: ['team-announcements', managerProfile?.id],
    queryFn: () => managerProfile ? getTeamAnnouncements(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!managerProfile) throw new Error('No manager profile');
      return createTeamAnnouncement(managerProfile.id, newTitle.trim(), newContent.trim());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-announcements'] });
      setShowCreateModal(false);
      setNewTitle('');
      setNewContent('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTeamAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-announcements'] });
    },
  });

  return (
    <div className="manager-page">
      <header className="page-header">
        <h1>Announcements</h1>
        <p>View system announcements and send messages to your team</p>
      </header>

      {/* System Announcements */}
      <section className="announcements-section">
        <h2>From Route.ng</h2>
        {loadingSystem ? (
          <div className="loading">Loading...</div>
        ) : systemAnnouncements.length === 0 ? (
          <p className="empty-text">No announcements from the platform</p>
        ) : (
          <div className="system-announcements-list">
            {systemAnnouncements.map(announcement => (
              <div key={announcement.id} className="system-announcement-card">
                <div className="announcement-badge">Platform</div>
                <h3>{announcement.title}</h3>
                <p>{announcement.content}</p>
                <span className="announcement-date">
                  {new Date(announcement.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Team Announcements */}
      <section className="announcements-section">
        <div className="section-header-with-action">
          <h2>My Team Announcements</h2>
          <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
            + New Announcement
          </button>
        </div>

        {loadingTeam ? (
          <div className="loading">Loading...</div>
        ) : teamAnnouncements.length === 0 ? (
          <div className="empty-state">
            <p>No team announcements yet.</p>
            <p>Create an announcement to communicate with your team members.</p>
          </div>
        ) : (
          <div className="team-announcements-list">
            {teamAnnouncements.map(announcement => (
              <div key={announcement.id} className="team-announcement-card">
                <div className="announcement-header">
                  <h3>{announcement.title}</h3>
                  <button
                    className="delete-btn small"
                    onClick={() => {
                      if (confirm('Delete this announcement?')) {
                        deleteMutation.mutate(announcement.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </div>
                <p>{announcement.content}</p>
                <span className="announcement-date">
                  {new Date(announcement.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Announcement Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Team Announcement</h3>
            <p className="helper-text">This will be visible to all your team members</p>
            <form onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}>
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
                <label>Message</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write your message..."
                  rows={4}
                  required
                />
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
                  {createMutation.isPending ? 'Creating...' : 'Send to Team'}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowCreateModal(false)}
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
