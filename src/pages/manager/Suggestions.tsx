import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { getTeamMembers } from '../../api/managers';
import { supabase } from '../../api/supabase';
// IOSUserProfile type used via getTeamMembers return type

interface Suggestion {
  id: string;
  manager_id: string;
  ios_user_id: string | null; // null means sent to all team
  title: string;
  content: string;
  created_at: string;
}

async function getSuggestions(managerId: string): Promise<Suggestion[]> {
  const { data, error } = await supabase
    .from('manager_suggestions')
    .select('*')
    .eq('manager_id', managerId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

async function createSuggestion(
  managerId: string,
  iosUserId: string | null,
  title: string,
  content: string
): Promise<Suggestion> {
  const { data, error } = await supabase
    .from('manager_suggestions')
    .insert({
      manager_id: managerId,
      ios_user_id: iosUserId,
      title,
      content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function deleteSuggestion(id: string): Promise<void> {
  const { error } = await supabase
    .from('manager_suggestions')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export default function ManagerSuggestions() {
  const { managerProfile } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [targetUser, setTargetUser] = useState<string>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members', managerProfile?.id],
    queryFn: () => managerProfile ? getTeamMembers(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['manager-suggestions', managerProfile?.id],
    queryFn: () => managerProfile ? getSuggestions(managerProfile.id) : [],
    enabled: !!managerProfile,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!managerProfile) throw new Error('No manager profile');
      const userId = targetUser === 'all' ? null : targetUser;
      return createSuggestion(managerProfile.id, userId, newTitle.trim(), newContent.trim());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-suggestions'] });
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-suggestions'] });
    },
  });

  const resetForm = () => {
    setShowCreateModal(false);
    setTargetUser('all');
    setNewTitle('');
    setNewContent('');
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'All Team Members';
    const member = teamMembers.find(m => m.id === userId);
    return member?.full_name || 'Unknown User';
  };

  return (
    <div className="manager-page">
      <header className="page-header">
        <h1>Suggestions</h1>
        <p>Send helpful tips and suggestions to your team members</p>
      </header>

      <div className="page-actions">
        <button className="primary-btn" onClick={() => setShowCreateModal(true)}>
          + New Suggestion
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading suggestions...</div>
      ) : suggestions.length === 0 ? (
        <div className="empty-state">
          <p>No suggestions sent yet.</p>
          <p>Send suggestions to help guide your team members.</p>
        </div>
      ) : (
        <div className="suggestions-list">
          {suggestions.map(suggestion => (
            <div key={suggestion.id} className="suggestion-card">
              <div className="suggestion-header">
                <div className="suggestion-meta">
                  <span className="suggestion-recipient">
                    To: {getUserName(suggestion.ios_user_id)}
                  </span>
                  <span className="suggestion-date">
                    {new Date(suggestion.created_at).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className="delete-btn small"
                  onClick={() => {
                    if (confirm('Delete this suggestion?')) {
                      deleteMutation.mutate(suggestion.id);
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  Delete
                </button>
              </div>
              <h3>{suggestion.title}</h3>
              <p>{suggestion.content}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create Suggestion Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => resetForm()}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Suggestion</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}>
              <div className="form-group">
                <label>Send To</label>
                <select
                  value={targetUser}
                  onChange={(e) => setTargetUser(e.target.value)}
                >
                  <option value="all">All Team Members</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Tips for faster transactions"
                  required
                />
              </div>

              <div className="form-group">
                <label>Suggestion</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write your suggestion or tip..."
                  rows={4}
                  required
                />
              </div>

              {createMutation.isError && (
                <p className="error-msg">
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Failed to send suggestion'}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={createMutation.isPending || !newTitle.trim() || !newContent.trim()}
                >
                  {createMutation.isPending ? 'Sending...' : 'Send Suggestion'}
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
