import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../api/supabase';
import { getManagerById, isHouseAccount } from '../../api/managers';

interface SystemAnnouncement {
  id: string;
  title: string;
  content: string;
  audience: 'all' | 'managers' | 'ios_users';
  created_at: string;
}

interface TeamAnnouncement {
  id: string;
  manager_id: string;
  title: string;
  content: string;
  created_at: string;
}

interface ManagerSuggestion {
  id: string;
  manager_id: string;
  ios_user_id: string | null;
  title: string;
  content: string;
  created_at: string;
}

async function getSystemAnnouncements(): Promise<SystemAnnouncement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .in('audience', ['all', 'ios_users'])
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
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

async function getSuggestionsForUser(managerId: string, userId: string): Promise<ManagerSuggestion[]> {
  const { data, error } = await supabase
    .from('manager_suggestions')
    .select('*')
    .eq('manager_id', managerId)
    .or(`ios_user_id.eq.${userId},ios_user_id.is.null`)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === '42P01') return [];
    throw error;
  }
  return data || [];
}

export default function IOSUserAnnouncements() {
  const { iosUserProfile } = useAuth();

  const { data: managerProfile } = useQuery({
    queryKey: ['user-manager', iosUserProfile?.manager_id],
    queryFn: () => iosUserProfile?.manager_id ? getManagerById(iosUserProfile.manager_id) : null,
    enabled: !!iosUserProfile?.manager_id,
  });

  const isHouseMember = isHouseAccount(managerProfile ?? null);

  const { data: systemAnnouncements = [], isLoading: loadingSystem } = useQuery({
    queryKey: ['system-announcements-user'],
    queryFn: getSystemAnnouncements,
  });

  const { data: teamAnnouncements = [], isLoading: loadingTeam } = useQuery({
    queryKey: ['team-announcements-user', iosUserProfile?.manager_id],
    queryFn: () => iosUserProfile?.manager_id
      ? getTeamAnnouncements(iosUserProfile.manager_id)
      : [],
    enabled: !!iosUserProfile?.manager_id,
  });

  const { data: suggestions = [], isLoading: loadingSuggestions } = useQuery({
    queryKey: ['user-suggestions', iosUserProfile?.manager_id, iosUserProfile?.id],
    queryFn: () => iosUserProfile?.manager_id && iosUserProfile?.id
      ? getSuggestionsForUser(iosUserProfile.manager_id, iosUserProfile.id)
      : [],
    enabled: !!iosUserProfile?.manager_id && !!iosUserProfile?.id,
  });

  const isLoading = loadingSystem || loadingTeam || loadingSuggestions;
  const hasContent = systemAnnouncements.length > 0 || teamAnnouncements.length > 0 || suggestions.length > 0;

  return (
    <div className="ios-user-page">
      <header className="page-header">
        <h1>Announcements</h1>
        <p>Stay updated with the latest news and tips</p>
      </header>

      {isLoading ? (
        <div className="loading">Loading...</div>
      ) : !hasContent ? (
        <div className="empty-state">
          <p>No announcements at the moment.</p>
          <p>Check back later for updates from Route.ng{isHouseMember ? '.' : ' and your manager.'}</p>
        </div>
      ) : (
        <div className="announcements-feed">
          {/* System Announcements */}
          {systemAnnouncements.length > 0 && (
            <section className="announcements-section">
              <h2>From Route.ng</h2>
              <div className="announcements-list">
                {systemAnnouncements.map(announcement => (
                  <div key={announcement.id} className="announcement-card system">
                    <div className="announcement-badge system">Platform</div>
                    <h3>{announcement.title}</h3>
                    <p>{announcement.content}</p>
                    <span className="announcement-date">
                      {new Date(announcement.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Team Announcements */}
          {teamAnnouncements.length > 0 && (
            <section className="announcements-section">
              <h2>{isHouseMember ? 'Team Updates' : 'From Your Manager'}</h2>
              <div className="announcements-list">
                {teamAnnouncements.map(announcement => (
                  <div key={announcement.id} className="announcement-card team">
                    <div className="announcement-badge team">Team</div>
                    <h3>{announcement.title}</h3>
                    <p>{announcement.content}</p>
                    <span className="announcement-date">
                      {new Date(announcement.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <section className="announcements-section">
              <h2>Tips & Suggestions</h2>
              <div className="suggestions-feed">
                {suggestions.map(suggestion => (
                  <div key={suggestion.id} className="suggestion-card-user">
                    <div className="suggestion-icon">💡</div>
                    <div className="suggestion-content">
                      <h4>{suggestion.title}</h4>
                      <p>{suggestion.content}</p>
                      <span className="suggestion-date">
                        {new Date(suggestion.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
