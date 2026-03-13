import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Public pages
import Landing from './pages/public/Landing';
import LoginChoice from './components/LoginChoice';
import RegisterChoice from './components/RegisterChoice';
import RegisterStep1 from './components/RegisterStep1';
import UserRegistration from './components/UserRegistration';
import ManagerRegistration from './components/ManagerRegistration';
import Login from './components/Login';
import RegistrationSuccess from './components/RegistrationSuccess';
import Blog from './pages/public/Blog';

// iOS User pages with sidebar layout
import IOSUserLayout from './layouts/IOSUserLayout';
import IOSUserOverview from './pages/ios-user/Overview';
import IOSUserProfile from './pages/ios-user/Profile';
import IOSUserAddManagerProfile from './pages/ios-user/AddManagerProfile';
import IOSUserLogTransaction from './pages/ios-user/LogTransaction';
import IOSUserHistory from './pages/ios-user/History';
import IOSUserEarnings from './pages/ios-user/Earnings';
import IOSUserAnnouncements from './pages/ios-user/Announcements';
import ManagerAddUserProfile from './pages/manager/AddUserProfile';
import AdminLogin from './pages/admin/Login';

// Manager pages with sidebar layout
import ManagerLayout from './layouts/ManagerLayout';
import ManagerOverview from './pages/manager/Overview';
import ManagerTeam from './pages/manager/Team';
import ManagerReviews from './pages/manager/Reviews';
import ManagerHistory from './pages/manager/History';
import ManagerInvites from './pages/manager/Invites';
import ManagerProfile from './pages/manager/Profile';
import ManagerAnnouncements from './pages/manager/Announcements';
import ManagerSuggestions from './pages/manager/Suggestions';
import ManagerPayouts from './pages/manager/Payouts';

// Admin pages with sidebar layout
import AdminLayout from './layouts/AdminLayout';
import AdminOverview from './pages/admin/Overview';
import AdminManagers from './pages/admin/Managers';
import AdminUsers from './pages/admin/Users';
import AdminTransactions from './pages/admin/Transactions';
import AdminBanks from './pages/admin/Banks';
import AdminAdmins from './pages/admin/Admins';
import AdminSettings from './pages/admin/Settings';
import AdminAnnouncements from './pages/admin/Announcements';
import AdminPayouts from './pages/admin/Payouts';

import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="app">
            <Routes>
              {/* Public routes - no auth checks */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<LoginChoice />} />
              <Route path="/login/:role" element={<Login />} />
              <Route path="/register" element={<RegisterChoice />} />
              <Route path="/register/:role" element={<RegisterStep1 />} />
              <Route path="/register/user/step2" element={<UserRegistration />} />
              <Route path="/register/manager/step2" element={<ManagerRegistration />} />
              <Route path="/registration-success" element={<RegistrationSuccess />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/about" element={<Blog />} />
              <Route path="/faq" element={<Blog />} />

              {/* Admin login - separate flow */}
              <Route path="/admin/login" element={<AdminLogin />} />

              {/* Protected routes */}
              {/* iOS User routes with sidebar layout */}
              <Route
                path="/ios-user"
                element={
                  <ProtectedRoute allowedRoles={['ios_user']}>
                    <IOSUserLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/ios-user/overview" replace />} />
                <Route path="dashboard" element={<Navigate to="/ios-user/overview" replace />} />
                <Route path="overview" element={<IOSUserOverview />} />
                <Route path="profile" element={<IOSUserProfile />} />
                <Route path="log-transaction" element={<IOSUserLogTransaction />} />
                <Route path="history" element={<IOSUserHistory />} />
                <Route path="earnings" element={<IOSUserEarnings />} />
                <Route path="announcements" element={<IOSUserAnnouncements />} />
                <Route path="add-manager-profile" element={<IOSUserAddManagerProfile />} />
              </Route>
              {/* Manager routes with sidebar layout */}
              <Route
                path="/manager"
                element={
                  <ProtectedRoute allowedRoles={['manager']}>
                    <ManagerLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/manager/overview" replace />} />
                <Route path="dashboard" element={<Navigate to="/manager/overview" replace />} />
                <Route path="overview" element={<ManagerOverview />} />
                <Route path="team" element={<ManagerTeam />} />
                <Route path="reviews" element={<ManagerReviews />} />
                <Route path="history" element={<ManagerHistory />} />
                <Route path="invites" element={<ManagerInvites />} />
                <Route path="profile" element={<ManagerProfile />} />
                <Route path="announcements" element={<ManagerAnnouncements />} />
                <Route path="suggestions" element={<ManagerSuggestions />} />
                <Route path="payouts" element={<ManagerPayouts />} />
                <Route path="add-user-profile" element={<ManagerAddUserProfile />} />
              </Route>
              {/* Admin routes with sidebar layout */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/admin/overview" replace />} />
                <Route path="dashboard" element={<Navigate to="/admin/overview" replace />} />
                <Route path="overview" element={<AdminOverview />} />
                <Route path="managers" element={<AdminManagers />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="transactions" element={<AdminTransactions />} />
                <Route path="banks" element={<AdminBanks />} />
                <Route path="admins" element={<AdminAdmins />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="announcements" element={<AdminAnnouncements />} />
                <Route path="payouts" element={<AdminPayouts />} />
              </Route>

              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
