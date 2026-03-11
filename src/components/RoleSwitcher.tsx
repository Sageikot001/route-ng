import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function RoleSwitcher() {
  const { activeRole, setActiveRole, availableRoles } = useAuth();
  const navigate = useNavigate();

  // Filter out admin - admin has its own separate login flow at /admin/login
  const switchableRoles = availableRoles.filter(role => role !== 'admin');

  // Only show switcher if user has multiple non-admin roles
  if (switchableRoles.length <= 1) return null;

  const handleSwitch = (role: 'ios_user' | 'manager') => {
    setActiveRole(role);

    // Navigate to the appropriate dashboard
    const dashboardPath = role === 'manager'
      ? '/manager/dashboard'
      : '/ios-user/dashboard';

    navigate(dashboardPath);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'ios_user': return 'iOS User';
      case 'manager': return 'Manager';
      default: return role;
    }
  };

  return (
    <div className="role-switcher">
      <span className="role-switcher-label">Switch Role:</span>
      <div className="role-buttons">
        {switchableRoles.map((role) => (
          <button
            key={role}
            className={`role-btn ${activeRole === role ? 'active' : ''}`}
            onClick={() => handleSwitch(role as 'ios_user' | 'manager')}
          >
            {getRoleLabel(role)}
          </button>
        ))}
      </div>
    </div>
  );
}
