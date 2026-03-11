import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role } = useParams<{ role?: 'user' | 'manager' }>();
  const { signIn, isAuthenticated, activeRole, setActiveRole, iosUserProfile, managerProfile, hasCompletedProfile, isLoading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Get success message from registration redirect
  const successMessage = location.state?.message;

  // Redirect after successful login
  useEffect(() => {
    console.log('Login useEffect:', { isAuthenticated, activeRole, hasCompletedProfile, authLoading, loginRole: role });

    if (isAuthenticated && !authLoading) {
      // Admin users should use /admin/login - redirect them there
      if (activeRole === 'admin') {
        navigate('/admin/login', { replace: true });
        return;
      }

      // Determine target role based on URL parameter (no admin here)
      const targetRole = role === 'manager' ? 'manager' : role === 'user' ? 'ios_user' : activeRole;

      // Check if user has the profile for the target role
      const hasTargetProfile =
        (targetRole === 'manager' && managerProfile) ||
        (targetRole === 'ios_user' && iosUserProfile);

      if (hasTargetProfile) {
        // Set the active role to match login choice
        if (targetRole && targetRole !== activeRole) {
          setActiveRole(targetRole as 'ios_user' | 'manager');
        }

        // Go to role-specific dashboard (no admin - they use /admin/login)
        const dashboardPath = targetRole === 'manager'
          ? '/manager/dashboard'
          : '/ios-user/dashboard';
        console.log('Redirecting to:', dashboardPath);
        navigate(dashboardPath, { replace: true });
      } else if (targetRole) {
        // User doesn't have the target profile - prompt to create it
        if (targetRole === 'manager' && !managerProfile) {
          // Logged in as user but wants manager - go to add manager profile
          if (iosUserProfile) {
            navigate('/ios-user/add-manager-profile', { replace: true });
          } else {
            navigate('/register/manager/step2', { replace: true });
          }
        } else if (targetRole === 'ios_user' && !iosUserProfile) {
          // Logged in as manager but wants user - go to add user profile
          if (managerProfile) {
            navigate('/manager/add-user-profile', { replace: true });
          } else {
            navigate('/register/user/step2', { replace: true });
          }
        }
      } else if (hasCompletedProfile && activeRole && (activeRole === 'manager' || activeRole === 'ios_user')) {
        // Fallback to active role dashboard (no admin - they use /admin/login)
        const dashboardPath = activeRole === 'manager'
          ? '/manager/dashboard'
          : '/ios-user/dashboard';
        navigate(dashboardPath, { replace: true });
      }
    }
  }, [isAuthenticated, activeRole, hasCompletedProfile, authLoading, navigate, role, managerProfile, iosUserProfile, setActiveRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn({ email, password });
      // Redirect handled by useEffect above
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const roleLabel = role === 'manager' ? 'Manager' : role === 'user' ? 'Route-User' : null;

  return (
    <div className="setup-container">
      <h1>Route.ng</h1>
      <h2>{roleLabel ? `Login as ${roleLabel}` : 'Welcome back'}</h2>

      {successMessage && (
        <div className="success-box">
          <p>{successMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Signing in...' : 'Login'}
        </button>

        <div className="auth-switch">
          Don't have an account? <Link to="/register">Register</Link>
        </div>
        <div className="auth-switch">
          <Link to="/">Back to login options</Link>
        </div>
      </form>
    </div>
  );
}
