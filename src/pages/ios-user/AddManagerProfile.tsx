import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { createManagerProfile } from '../../api/auth';

export default function AddManagerProfile() {
  const navigate = useNavigate();
  const { authUser, user, refreshProfile, setActiveRole } = useAuth();

  const [fullName, setFullName] = useState(user?.username || '');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!authUser) {
      setError('Not authenticated');
      return;
    }

    setIsLoading(true);

    try {
      await createManagerProfile(authUser.id, fullName, teamName);
      await refreshProfile();
      setActiveRole('manager');
      navigate('/manager/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="setup-container">
      <h1>Route.ng</h1>
      <h2>Become a Manager</h2>
      <p className="subtitle">Create a manager profile to build and lead a team</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fullName">Full Name</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Enter your full name"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="teamName">Team Name</label>
          <input
            id="teamName"
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g., Alpha Team, Lagos Squad"
            required
            disabled={isLoading}
          />
          <p className="helper-text">Choose a name for your team</p>
        </div>

        <div className="info-box">
          <p>Your manager profile will require admin verification before you can invite team members.</p>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Manager Profile'}
        </button>

        <button
          type="button"
          className="secondary-btn"
          onClick={() => navigate('/ios-user/dashboard')}
          disabled={isLoading}
        >
          Cancel
        </button>
      </form>
    </div>
  );
}
