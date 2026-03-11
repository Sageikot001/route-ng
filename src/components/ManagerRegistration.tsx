import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { createManagerProfile } from '../api/auth';

interface LocationState {
  email: string;
  username: string;
  password: string;
}

export default function ManagerRegistration() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authUser, refreshProfile, setIsRegistering } = useAuth();

  const state = location.state as LocationState | null;

  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Redirect to step 1 if no state data and not authenticated
    if (!state?.email && !authUser) {
      navigate('/register/manager');
    }
  }, [state, authUser, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!authUser) {
      setError('Please complete the registration first');
      return;
    }

    setIsLoading(true);

    try {
      // Create manager profile in database
      await createManagerProfile(authUser.id, name, teamName);

      // Refresh the auth context to get the new profile
      await refreshProfile();

      // Clear the registering flag now that registration is complete
      setIsRegistering(false);

      // Navigate to success page
      navigate('/registration-success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!state && !authUser) return null;

  return (
    <div className="setup-container">
      <h1>Route.ng</h1>
      <h2>Complete your profile</h2>
      <p className="subtitle">Set up your manager profile to start building your team</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            placeholder="Enter your team name"
            required
            disabled={isLoading}
          />
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating profile...' : 'Complete Registration'}
        </button>
      </form>

      <div className="info-box">
        <p>
          <strong>Note:</strong> Your manager account will be pending verification.
          An admin will review and verify your account before you can invite team members.
        </p>
      </div>
    </div>
  );
}
