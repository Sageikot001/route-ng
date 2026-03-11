import { useNavigate } from 'react-router-dom';

export default function RegisterChoice() {
  const navigate = useNavigate();

  return (
    <div className="setup-container">
      <h1>Route.ng</h1>
      <h2>Get Started</h2>

      <div className="choice-section">
        <h3>New User?</h3>
        <div className="register-choice">
          <button
            className="choice-btn user-btn"
            onClick={() => navigate('/register/user')}
          >
            Register as Route-User
          </button>
          <button
            className="choice-btn manager-btn"
            onClick={() => navigate('/register/manager')}
          >
            Register as Manager
          </button>
        </div>
      </div>

      <div className="divider">
        <span>or</span>
      </div>

      <div className="choice-section">
        <h3>Already have an account?</h3>
        <div className="register-choice">
          <button
            className="choice-btn user-btn"
            onClick={() => navigate('/login/user')}
          >
            Login as Route-User
          </button>
          <button
            className="choice-btn manager-btn"
            onClick={() => navigate('/login/manager')}
          >
            Login as Manager
          </button>
        </div>
      </div>
    </div>
  );
}
