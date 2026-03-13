import type { ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DesignerLayout from './components/designer/DesignerLayout';
import AdminLayout from './components/admin/AdminLayout';
import { DesignerProvider } from './contexts/DesignerContext';
import { AdminProvider } from './contexts/AdminContext';
import HomePage from './pages/HomePage';
import DesignersPage from './pages/DesignersPage';
import DesignerProfilePage from './pages/DesignerProfilePage';
import DesignerProfileWithModalPage from './pages/DesignerProfileWithModalPage';
import ApplyPage from './pages/ApplyPage';
import ShowroomsPage from './pages/ShowroomsPage';
import MaterialCategoryPage from './pages/MaterialCategoryPage';
import BrandPage from './pages/BrandPage';
import AuthPage from './pages/AuthPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PrivacyPage from './pages/PrivacyPage';
import NewHomeDesignPage from './pages/NewHomeDesignPage';
import SoftDecorationPage from './pages/SoftDecorationPage';
import DesignerDashboardPage from './pages/designer/DesignerDashboardPage';
import DesignerProfileEditPage from './pages/designer/DesignerProfileEditPage';
import DesignerProjectsPage from './pages/designer/DesignerProjectsPage';
import DesignerUploadPage from './pages/designer/DesignerUploadPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminInstallPage from './pages/admin/AdminInstallPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminDesignersPage from './pages/admin/AdminDesignersPage';
import AdminAdminsPage from './pages/admin/AdminAdminsPage';
import AdminDesignerDetailPage from './pages/admin/AdminDesignerDetailPage';
import { api } from './lib/api';

function DesignerProtectedRoute({ children }: { children: ReactNode }) {
  const token = api.getToken();
  const designer = typeof window !== 'undefined' ? localStorage.getItem('designer') : null;

  if (!token || !designer) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Routes>
      {/* Admin Routes */}
      <Route path="/admin" element={<AdminProvider><AdminLayout /></AdminProvider>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="designers" element={<AdminDesignersPage />} />
        <Route path="designers/:id" element={<AdminDesignerDetailPage />} />
        <Route path="stats" element={<AdminDashboardPage />} />
        <Route path="admins" element={<AdminAdminsPage />} />
      </Route>
      <Route path="/admin/login" element={<AdminProvider><AdminLoginPage /></AdminProvider>} />
      <Route path="/admin/install" element={<AdminProvider><AdminInstallPage /></AdminProvider>} />

      {/* Designer Routes */}
      <Route path="/designer" element={<DesignerProtectedRoute><DesignerProvider><DesignerLayout /></DesignerProvider></DesignerProtectedRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DesignerDashboardPage />} />
        <Route path="profile" element={<DesignerProfileEditPage />} />
        <Route path="projects" element={<DesignerProjectsPage />} />
        <Route path="upload" element={<DesignerUploadPage />} />
        <Route path="upload/:id" element={<DesignerUploadPage />} />
      </Route>

      {/* Public Routes */}
      <Route path="/*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/designers" element={<DesignersPage />} />
            <Route path="/designers/apply" element={<ApplyPage />} />
            <Route path="/designers/:slug" element={<DesignerProfilePage />} />
            <Route path="/designers/:slug/projects/:projectId" element={<DesignerProfileWithModalPage />} />
            <Route path="/showrooms" element={<Navigate to="/materials" replace />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/login" element={<Navigate to="/auth" replace />} />
            <Route path="/register" element={<Navigate to="/auth" replace />} />
            <Route path="/materials" element={<ShowroomsPage />} />
            <Route path="/materials/brands/:slug" element={<BrandPage />} />
            <Route path="/materials/:category" element={<MaterialCategoryPage />} />
            <Route path="/services/new-home-design" element={<NewHomeDesignPage />} />
            <Route path="/services/soft-decoration" element={<SoftDecorationPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}

export default App;
