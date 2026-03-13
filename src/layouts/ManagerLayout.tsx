import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { getManagerStats } from '../api/managers';
import RoleSwitcher from '../components/RoleSwitcher';

export default function ManagerLayout() {
  const navigate = useNavigate();
  const { user, managerProfile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['manager-stats', managerProfile?.id],
    queryFn: () => managerProfile ? getManagerStats(managerProfile.id) : null,
    enabled: !!managerProfile,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  if (!managerProfile) {
    return <div className="loading-container">Loading...</div>;
  }

  const isPending = managerProfile.status === 'pending';

  return (
    <div className="manager-layout">
      {/* Mobile Menu Toggle */}
      <button
        className="mobile-menu-toggle manager"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Header */}
      <div className="mobile-header manager">
        <h1>Route.ng Manager</h1>
      </div>

      {/* Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={closeSidebar}
      />

      <aside className={`manager-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="sidebar-logo">Route.ng</h1>
          <span className="sidebar-role">Manager Panel</span>
          {isPending && <span className="pending-badge">Pending Verification</span>}
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-title">Dashboard</span>
            <NavLink to="/manager/overview" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">📊</span>
              Overview
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Team</span>
            <NavLink to="/manager/team" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">👥</span>
              My Team
              {stats && <span className="nav-badge">{stats.teamSize}</span>}
            </NavLink>
            <NavLink to="/manager/reviews" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">📝</span>
              Reviews
              {stats && stats.pendingReviews > 0 && (
                <span className="nav-badge highlight">{stats.pendingReviews}</span>
              )}
            </NavLink>
            <NavLink to="/manager/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">📜</span>
              History
            </NavLink>
            <NavLink to="/manager/invites" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">✉️</span>
              Invites
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Finance</span>
            <NavLink to="/manager/payouts" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">💵</span>
              Team Payouts
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Communication</span>
            <NavLink to="/manager/announcements" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">📢</span>
              Announcements
            </NavLink>
            <NavLink to="/manager/suggestions" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">💡</span>
              Suggestions
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Account</span>
            <NavLink to="/manager/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={closeSidebar}>
              <span className="nav-icon">👤</span>
              My Profile
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <a
            href="https://support.apple.com/contact"
            target="_blank"
            rel="noopener noreferrer"
            className="apple-support-link"
          >
            <span className="nav-icon">🍎</span>
            Apple Support
          </a>
          <RoleSwitcher />
          <div className="sidebar-user">
            <span className="user-name">{user?.username}</span>
            <button className="logout-btn-small" onClick={handleSignOut}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="manager-main">
        <Outlet />
      </main>
    </div>
  );
}
