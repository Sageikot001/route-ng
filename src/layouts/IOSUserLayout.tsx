import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { usePlatformSettings } from '../hooks/usePlatformSettings';
import { useNotificationCounts } from '../hooks/useNotificationCounts';
import { needsTermsAcceptance, acceptTermsIOSUser } from '../api/users';
import RoleSwitcher from '../components/RoleSwitcher';
import ThemeToggle from '../components/ThemeToggle';
import TermsAgreementModal from '../components/TermsAgreementModal';

export default function IOSUserLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, iosUserProfile, signOut, refreshProfile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { earningsPerCard } = usePlatformSettings();
  const { counts, markContentAsRead } = useNotificationCounts();

  // Check if user needs to accept terms
  const showTermsModal = iosUserProfile && needsTermsAcceptance(
    iosUserProfile.terms_accepted_at,
    iosUserProfile.terms_version
  );

  // Terms acceptance mutation
  const acceptTermsMutation = useMutation({
    mutationFn: async () => {
      await acceptTermsIOSUser(iosUserProfile!.id);
    },
    onSuccess: async () => {
      // Refresh the profile to update terms_accepted_at
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['ios-user-profile'] });
    },
    onError: (error) => {
      console.error('Failed to accept terms:', error);
      alert('Failed to accept terms. Please try again or contact support.');
    },
  });

  // Mark content as read when visiting the respective pages
  useEffect(() => {
    if (location.pathname === '/ios-user/announcements') {
      markContentAsRead('announcements');
    } else if (location.pathname === '/ios-user/resources') {
      markContentAsRead('resources');
    }
  }, [location.pathname, markContentAsRead]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  if (!iosUserProfile) {
    return <div className="loading-container">Loading...</div>;
  }

  return (
    <div className="ios-user-layout">
      {/* Mobile Menu Toggle */}
      <button
        className="mobile-menu-toggle ios-user"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Header */}
      <div className="mobile-header ios-user">
        <h1>Route.ng</h1>
      </div>

      {/* Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={closeSidebar}
      />

      <aside className={`ios-user-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="sidebar-logo">Route.ng</h1>
          <span className="sidebar-role">iOS User</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-title">Dashboard</span>
            <NavLink to="/ios-user/overview" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">🏠</span>
              Overview
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Transactions</span>
            <NavLink to="/ios-user/log-transaction" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">➕</span>
              Log Transaction
            </NavLink>
            <NavLink to="/ios-user/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">📋</span>
              History
            </NavLink>
            <NavLink to="/ios-user/earnings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">💰</span>
              Earnings
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Communication</span>
            <NavLink to="/ios-user/announcements" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">📢</span>
              Announcements
              {counts.announcements > 0 && (
                <span className="notification-badge">{counts.announcements > 99 ? '99+' : counts.announcements}</span>
              )}
            </NavLink>
            <NavLink to="/ios-user/resources" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">📚</span>
              Resources
              {counts.resources > 0 && (
                <span className="notification-badge">{counts.resources > 99 ? '99+' : counts.resources}</span>
              )}
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Account</span>
            <NavLink to="/ios-user/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">👤</span>
              My Profile
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="daily-target-mini">
            <span className="target-label">Per Card</span>
            <span className="target-value">N{earningsPerCard.toLocaleString()}</span>
          </div>
          <a
            href="https://support.apple.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="apple-support-link"
          >
            <span className="nav-icon">🍎</span>
            Apple Support
          </a>
          <div className="sidebar-theme-toggle">
            <span className="theme-label">Theme</span>
            <ThemeToggle />
          </div>
          <RoleSwitcher />
          <div className="sidebar-user">
            <span className="user-name">{user?.username}</span>
            <button className="logout-btn-small" onClick={handleSignOut}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="ios-user-main">
        <Outlet />
      </main>

      {/* Terms Agreement Modal */}
      {showTermsModal && (
        <TermsAgreementModal
          onAccept={() => acceptTermsMutation.mutate()}
          isLoading={acceptTermsMutation.isPending}
        />
      )}
    </div>
  );
}
