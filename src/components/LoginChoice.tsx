import { Link, useNavigate } from 'react-router-dom';

export default function LoginChoice() {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Route.ng</h1>
          <p className="auth-subtitle">Sign in to your account</p>
        </div>

        <div className="auth-section">
          <h3>Sign in as</h3>
          <div className="auth-buttons">
            <button
              className="auth-choice-btn user"
              onClick={() => navigate('/login/user')}
            >
              <span className="btn-icon">👤</span>
              <span className="btn-text">Route User</span>
            </button>
            <button
              className="auth-choice-btn manager"
              onClick={() => navigate('/login/manager')}
            >
              <span className="btn-icon">👥</span>
              <span className="btn-text">Route Manager</span>
            </button>
          </div>
        </div>

        <div className="auth-footer">
          <p>Don't have an account? <Link to="/register" className="auth-link">Get Registered</Link></p>
          <p className="back-link"><Link to="/" className="auth-link">← Back to Home</Link></p>
        </div>
      </div>
    </div>
  );
}
