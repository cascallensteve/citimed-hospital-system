import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PrivateRoute from './components/auth/PrivateRoute';
import RoleRoute from './components/auth/RoleRoute';
// import AdminLayout from './pages/admin/AdminLayout';
import Patients from './pages/admin/Patients';
import Visits from './pages/admin/Visits';
import Pharmacy from './pages/admin/Pharmacy';
import AdminReports from './pages/admin/Reports';
import Finance from './pages/admin/Finance';
import PatientDetails from './pages/admin/PatientDetails';
import SuperLayout from './pages/super/SuperLayout';
import Financials from './pages/super/Financials';
import Admins from './pages/super/Admins';
import SuperReports from './pages/super/Reports';
import AddAdmin from './pages/super/AddAdmin';
// import { useAuth } from './context/AuthContext';
import { AuthProvider } from './context/AuthContext';
import { DataCacheProvider } from './context/DataCacheContext';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import SuperAdminSignup from './pages/auth/SuperAdminSignup';
import VerifyEmail from './pages/auth/VerifyEmail';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import Logout from './pages/Logout';

function App() {
  return (
    <AuthProvider>
      <DataCacheProvider>
        <div className="min-h-screen bg-white dark:bg-gray-900">
          <Toaster position="top-right" />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup/super" element={<SuperAdminSignup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/login/forgot" element={<ForgotPassword />} />
            <Route path="/login/reset" element={<ResetPassword />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            >
              {/* Settings page (available to any authenticated user) */}
              <Route path="settings" element={<Settings />} />

              {/* Admin Profile page (admin and superadmin) */}
              <Route
                path="profile"
                element={
                  <RoleRoute roles={['admin', 'superadmin']}>
                    <Profile />
                  </RoleRoute>
                }
              />
              <Route
                path="logout"
                element={
                  <RoleRoute roles={['admin', 'superadmin']}>
                    <Logout />
                  </RoleRoute>
                }
              />

              {/* Admin nested routes */}
              <Route path="admin" element={<Navigate to="/dashboard" replace />} />
              <Route
                path="admin/patients"
                element={
                  <RoleRoute roles={['admin', 'superadmin']}>
                    <Patients />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/patients/:id"
                element={
                  <RoleRoute roles={['admin', 'superadmin']}>
                    <PatientDetails />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/visits"
                element={
                  <RoleRoute roles={['admin', 'superadmin']}>
                    <Visits />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/pharmacy"
                element={
                  <RoleRoute roles={['admin', 'superadmin']}>
                    <Pharmacy />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/reports"
                element={
                  <RoleRoute roles={['admin', 'superadmin']}>
                    <AdminReports />
                  </RoleRoute>
                }
              />
              <Route
                path="admin/finance"
                element={
                  <RoleRoute roles={['admin', 'superadmin']}>
                    <Finance />
                  </RoleRoute>
                }
              />

              {/* Super Admin nested routes */}
              <Route
                path="super"
                element={
                  <RoleRoute roles={['superadmin']}>
                    <SuperLayout />
                  </RoleRoute>
                }
              />
              <Route
                path="super/financials"
                element={
                  <RoleRoute roles={['superadmin']}>
                    <Financials />
                  </RoleRoute>
                }
              />
              <Route
                path="super/admins"
                element={
                  <RoleRoute roles={['superadmin']}>
                    <Admins />
                  </RoleRoute>
                }
              />
              <Route
                path="super/admins/new"
                element={
                  <RoleRoute roles={['superadmin']}>
                    <AddAdmin />
                  </RoleRoute>
                }
              />
              <Route
                path="super/reports"
                element={
                  <RoleRoute roles={['superadmin']}>
                    <SuperReports />
                  </RoleRoute>
                }
              />
              {/* Catch-all for unknown nested dashboard paths */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </div>
      </DataCacheProvider>
    </AuthProvider>
  )
}

export default App
