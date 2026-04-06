import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="admin-layout">
      {/* Mobile Menu Toggle */}
      <button
        className="mobile-menu-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Header */}
      <div className="mobile-header">
        <h1>Route.ng Admin</h1>
      </div>

      {/* Sidebar Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'active' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1 className="sidebar-logo">Route.ng</h1>
          <span className="sidebar-role">Admin Panel</span>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <span className="nav-section-title">Dashboard</span>
            <NavLink to="/admin/overview" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">📊</span>
              Overview
            </NavLink>
            <NavLink to="/admin/analytics" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">📈</span>
              Analytics
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Management</span>
            <NavLink to="/admin/managers" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">👔</span>
              Managers
            </NavLink>
            <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">👥</span>
              iOS Users
            </NavLink>
            <NavLink to="/admin/transactions" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">💳</span>
              Transactions
            </NavLink>
            <NavLink to="/admin/opportunities" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">📋</span>
              Opportunities
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Configuration</span>
            <NavLink to="/admin/banks" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">🏦</span>
              Banks
            </NavLink>
            <NavLink to="/admin/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">⚙️</span>
              Settings
            </NavLink>
            <NavLink to="/admin/admins" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">🔐</span>
              Admins
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Finance</span>
            <NavLink to="/admin/payouts" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">💵</span>
              Payouts
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Automation</span>
            <NavLink to="/admin/auto-checker" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">🔍</span>
              Auto-Checker
            </NavLink>
          </div>

          <div className="nav-section">
            <span className="nav-section-title">Communication</span>
            <NavLink to="/admin/announcements" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">📢</span>
              Announcements
            </NavLink>
            <NavLink to="/admin/resources" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">📚</span>
              Resource Center
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
          <div className="sidebar-theme-toggle">
            <span className="theme-label">Theme</span>
            <ThemeToggle />
          </div>
          <div className="sidebar-user">
            <span className="user-name">{user?.username}</span>
            <button className="logout-btn-small" onClick={handleSignOut}>
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
