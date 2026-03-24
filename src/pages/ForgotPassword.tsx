import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from '../api/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(email);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="setup-container">
        <h1>Route.ng</h1>
        <h2>Check Your Email</h2>

        <div className="success-box">
          <p>We've sent a password reset link to <strong>{email}</strong></p>
          <p>Please check your inbox and click the link to reset your password.</p>
        </div>

        <div className="auth-switch">
          <Link to="/login">Back to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="setup-container">
      <h1>Route.ng</h1>
      <h2>Forgot Password</h2>
      <p className="subtitle">Enter your email and we'll send you a reset link</p>

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

        {error && <p className="error-msg">{error}</p>}

        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send Reset Link'}
        </button>

        <div className="auth-switch">
          Remember your password? <Link to="/login">Login</Link>
        </div>
      </form>
    </div>
  );
}
