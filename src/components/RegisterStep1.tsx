import { useState } from 'react';
import { useNavigate, Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

export default function RegisterStep1() {
  const { role } = useParams<{ role: 'user' | 'manager' }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signUp, setIsRegistering } = useAuth();

  const referralCode = searchParams.get('ref') || '';

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    setIsLoading(true);
    setIsRegistering(true);

    try {
      const userRole: UserRole = role === 'manager' ? 'manager' : 'ios_user';
      const result = await signUp({ email, password, username, role: userRole });

      if (result.needsEmailConfirmation) {
        // Email confirmation required - redirect to login with message
        setIsRegistering(false);
        navigate('/login', {
          state: { message: 'Account created! Please check your email to confirm, then log in.' }
        });
      } else if (result.session) {
        // No email confirmation needed - go to step 2 (preserve referral code)
        const step2Url = referralCode
          ? `/register/${role}/step2?ref=${referralCode}`
          : `/register/${role}/step2`;
        navigate(step2Url, { state: { email, username } });
      }
    } catch (err) {
      setIsRegistering(false);
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';

      // Check for duplicate email error
      if (errorMessage.toLowerCase().includes('already registered') ||
          errorMessage.toLowerCase().includes('already exists') ||
          errorMessage.toLowerCase().includes('duplicate')) {
        setError(`This email already has an account. Please log in instead. If you want to add a ${role === 'user' ? 'iOS User' : 'Manager'} profile, you can do so from your dashboard after logging in.`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="setup-container">
      <h1>Route.ng</h1>
      <h2>Create your account</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email {role === 'user' ? '(Apple ID)' : ''}</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={role === 'user' ? 'your@icloud.com' : 'your@email.com'}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
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
              placeholder="At least 6 characters"
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

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <div className="password-input-wrapper">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              disabled={isLoading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Creating account...' : 'Create Account'}
        </button>

        <div className="auth-switch">
          Already have an account? <Link to="/">Login</Link>
        </div>
        <div className="auth-switch">
          <Link to="/register">Back to registration options</Link>
        </div>
      </form>
    </div>
  );
}
