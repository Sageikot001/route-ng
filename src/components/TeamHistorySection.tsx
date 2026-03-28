import { useQuery } from '@tanstack/react-query';
import { getTeamHistory } from '../api/teamTransfers';
import type { TeamHistoryWithDetails } from '../types';

interface TeamHistorySectionProps {
  iosUserProfileId: string;
}

export default function TeamHistorySection({ iosUserProfileId }: TeamHistorySectionProps) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['team-history', iosUserProfileId],
    queryFn: () => getTeamHistory(iosUserProfileId),
  });

  if (isLoading) {
    return <div className="loading">Loading team history...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="empty-state small">
        <p>No team history available</p>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="team-history-section">
      <div className="team-history-timeline">
        {history.map((entry: TeamHistoryWithDetails, index: number) => (
          <div
            key={entry.id}
            className={`team-history-item ${index === 0 && !entry.left_at ? 'current' : ''}`}
          >
            <div className="history-dot" />
            <div className="history-content">
              <div className="history-header">
                <h4>{entry.team_name}</h4>
                {index === 0 && !entry.left_at && (
                  <span className="current-badge">Current</span>
                )}
              </div>
              <p className="history-manager">
                Manager: {entry.manager_name}
              </p>
              <p className="history-dates">
                {formatDate(entry.joined_at)}
                {entry.left_at && (
                  <> — {formatDate(entry.left_at)}</>
                )}
                {!entry.left_at && index === 0 && (
                  <> — Present</>
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
