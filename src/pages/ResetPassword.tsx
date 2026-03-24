import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { updatePassword } from '../api/auth';
import { supabase } from '../api/supabase';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsValidSession(!!session);
    };
    checkSession();
  }, []);

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

    setIsLoading(true);

    try {
      await updatePassword(password);
      setSuccess(true);
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login', {
          state: { message: 'Password reset successful. Please login with your new password.' }
        });
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  // Still checking session
  if (isValidSession === null) {
    return (
      <div className="setup-container">
        <h1>Route.ng</h1>
        <p>Verifying reset link...</p>
      </div>
    );
  }

  // Invalid or expired link
  if (!isValidSession) {
    return (
      <div className="setup-container">
        <h1>Route.ng</h1>
        <h2>Invalid Reset Link</h2>

        <div className="error-box">
          <p>This password reset link is invalid or has expired.</p>
          <p>Please request a new reset link.</p>
        </div>

        <div className="auth-switch">
          <Link to="/forgot-password">Request New Link</Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="setup-container">
        <h1>Route.ng</h1>
        <h2>Password Reset!</h2>

        <div className="success-box">
          <p>Your password has been successfully reset.</p>
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-container">
      <h1>Route.ng</h1>
      <h2>Reset Password</h2>
      <p className="subtitle">Enter your new password</p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="password">New Password</label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              disabled={isLoading}
              minLength={6}
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
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              disabled={isLoading}
              minLength={6}
            />
          </div>
        </div>

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  );
}
