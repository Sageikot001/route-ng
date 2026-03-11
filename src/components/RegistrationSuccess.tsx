import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RegistrationSuccess() {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  const handleGoToDashboard = () => {
    const dashboardPath = userRole === 'admin'
      ? '/admin/dashboard'
      : userRole === 'manager'
        ? '/manager/dashboard'
        : '/ios-user/dashboard';
    navigate(dashboardPath);
  };

  return (
    <div className="setup-container">
      <h1>Route.ng</h1>
      <div className="success-card">
        <h2>Registration Complete!</h2>
        <p>Your profile has been created successfully.</p>
        <p>
          {userRole === 'manager'
            ? 'You can now start building your team and managing transactions.'
            : 'Your manager will now be able to see your activity and track your transactions.'}
        </p>
        <button onClick={handleGoToDashboard} className="primary-btn">
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
