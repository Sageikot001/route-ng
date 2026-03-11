import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabase';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { setActiveRole, user, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check if already authenticated as admin
  useEffect(() => {
    const checkAdminSession = async () => {
      if (authLoading) return;

      if (user?.role === 'admin') {
        setActiveRole('admin');
        navigate('/admin/overview', { replace: true });
      }
    };
    checkAdminSession();
  }, [navigate, user, authLoading, setActiveRole]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error('Authentication failed');
      }

      // Check if user has admin role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (userError) throw userError;

      if (userData?.role !== 'admin') {
        // Sign out immediately - not an admin
        await supabase.auth.signOut();
        throw new Error('Access denied. Admin credentials required.');
      }

      // Set flag so AuthContext knows to prioritize admin role
      sessionStorage.setItem('adminLogin', 'true');

      // Set active role to admin before navigating
      setActiveRole('admin');

      // Small delay to ensure state updates before navigation
      setTimeout(() => {
        navigate('/admin/overview', { replace: true });
      }, 100);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <div className="admin-login-card">
        <div className="admin-login-header">
          <h1>Route.ng</h1>
          <h2>Admin Portal</h2>
          <p>Authorized personnel only</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Admin Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@route.ng"
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
                placeholder="Enter password"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '🔒' : '👁️'}
              </button>
            </div>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Authenticating...' : 'Access Admin Panel'}
          </button>
        </form>

        <div className="admin-login-footer">
          <p>This portal is for authorized administrators only.</p>
          <p>All access attempts are logged.</p>
        </div>
      </div>
    </div>
  );
}
