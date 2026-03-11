import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePlatformSettings } from '../hooks/usePlatformSettings';
import RoleSwitcher from '../components/RoleSwitcher';

export default function IOSUserLayout() {
  const navigate = useNavigate();
  const { user, iosUserProfile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { earningsPerCard } = usePlatformSettings();

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
    </div>
  );
}
