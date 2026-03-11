import { Link, useNavigate } from 'react-router-dom';

export default function RegisterChoice() {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Route.ng</h1>
          <p className="auth-subtitle">Create your account</p>
        </div>

        <div className="auth-section">
          <h3>Get Started as</h3>
          <div className="auth-buttons">
            <button
              className="auth-choice-btn user"
              onClick={() => navigate('/register/user')}
            >
              <span className="btn-icon">👤</span>
              <span className="btn-text">Route User</span>
            </button>
            <button
              className="auth-choice-btn manager"
              onClick={() => navigate('/register/manager')}
            >
              <span className="btn-icon">👥</span>
              <span className="btn-text">Route Manager</span>
            </button>
          </div>
        </div>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login" className="auth-link">Login</Link></p>
          <p className="back-link"><Link to="/" className="auth-link">← Back to Home</Link></p>
        </div>
      </div>
    </div>
  );
}
