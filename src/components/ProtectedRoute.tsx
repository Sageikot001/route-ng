import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, activeRole, iosUserProfile, managerProfile } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if the current active role has a completed profile
  const activeRoleHasProfile =
    (activeRole === 'ios_user' && iosUserProfile) ||
    (activeRole === 'manager' && managerProfile) ||
    (activeRole === 'admin');

  // If active role doesn't have a profile, redirect to complete it
  if (!activeRoleHasProfile && activeRole) {
    const step2Path = activeRole === 'manager'
      ? '/register/manager/step2'
      : '/register/user/step2';
    return <Navigate to={step2Path} replace />;
  }

  // Check role access - use activeRole for the check
  if (allowedRoles && activeRole && !allowedRoles.includes(activeRole)) {
    // Wrong dashboard for current active role - redirect to correct one
    const dashboardPath = activeRole === 'admin'
      ? '/admin/dashboard'
      : activeRole === 'manager'
        ? '/manager/dashboard'
        : '/ios-user/dashboard';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
}
