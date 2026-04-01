import { Suspense, lazy, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DesignerProvider } from './contexts/DesignerContext';
import { AdminProvider } from './contexts/AdminContext';
import { api } from './lib/api';
import SeoManager from './components/SeoManager';
import GoogleOneTap from './components/GoogleOneTap';

const Layout = lazy(() => import('./components/Layout'));
const DesignerLayout = lazy(() => import('./components/designer/DesignerLayout'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

const HomePage = lazy(() => import('./pages/HomePage'));
const DesignersPage = lazy(() => import('./pages/DesignersPage'));
const DesignerProfilePage = lazy(() => import('./pages/DesignerProfilePage'));
const DesignerProfileWithModalPage = lazy(() => import('./pages/DesignerProfileWithModalPage'));
const ApplyPage = lazy(() => import('./pages/ApplyPage'));
const ShowroomsPage = lazy(() => import('./pages/ShowroomsPage'));
const MaterialCategoryPage = lazy(() => import('./pages/MaterialCategoryPage'));
const BrandPage = lazy(() => import('./pages/BrandPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const DmcaPage = lazy(() => import('./pages/DmcaPage'));
const NewHomeDesignPage = lazy(() => import('./pages/NewHomeDesignPage'));
const SoftDecorationPage = lazy(() => import('./pages/SoftDecorationPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const CompanyDetailPage = lazy(() => import('./pages/CompanyDetailPage'));

const DesignerDashboardPage = lazy(() => import('./pages/designer/DesignerDashboardPage'));
const DesignerProfileEditPage = lazy(() => import('./pages/designer/DesignerProfileEditPage'));
const DesignerProjectsPage = lazy(() => import('./pages/designer/DesignerProjectsPage'));
const DesignerUploadPage = lazy(() => import('./pages/designer/DesignerUploadPage'));

const UserDashboardLayout = lazy(() => import('./layouts/UserDashboardLayout'));
const DashboardHomePage = lazy(() => import('./pages/dashboard/DashboardHomePage'));
const DashboardProfilePage = lazy(() => import('./pages/dashboard/DashboardProfilePage'));
const ApplyDesignerPage = lazy(() => import('./pages/dashboard/ApplyDesignerPage'));
const ApplyCompanyPage = lazy(() => import('./pages/dashboard/ApplyCompanyPage'));
const MyInquiriesPage = lazy(() => import('./pages/dashboard/MyInquiriesPage'));

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminInstallPage = lazy(() => import('./pages/admin/AdminInstallPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminDesignersPage = lazy(() => import('./pages/admin/AdminDesignersPage'));
const AdminAdminsPage = lazy(() => import('./pages/admin/AdminAdminsPage'));
const AdminDesignerDetailPage = lazy(() => import('./pages/admin/AdminDesignerDetailPage'));
const AdminVisitorsPage = lazy(() => import('./pages/admin/AdminVisitorsPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminCompaniesPage = lazy(() => import('./pages/admin/AdminCompaniesPage'));
const AdminInquiriesPage = lazy(() => import('./pages/admin/AdminInquiriesPage'));
const AdminComplaintsPage = lazy(() => import('./pages/admin/AdminComplaintsPage'));

function PageLoader() {
  return <div className="min-h-[40vh] flex items-center justify-center text-sm text-stone-500">Loading...</div>;
}

function DesignerProtectedRoute({ children }: { children: ReactNode }) {
  const token = api.getToken();
  if (!token) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <>
      <SeoManager />
      <GoogleOneTap />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminProvider><AdminLayout /></AdminProvider>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="designers" element={<AdminDesignersPage />} />
            <Route path="designers/:id" element={<AdminDesignerDetailPage />} />
            <Route path="visitors" element={<AdminVisitorsPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="stats" element={<AdminDashboardPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="companies" element={<AdminCompaniesPage />} />
            <Route path="inquiries" element={<AdminInquiriesPage />} />
            <Route path="complaints" element={<AdminComplaintsPage />} />
            <Route path="admins" element={<AdminAdminsPage />} />
          </Route>
          <Route path="/admin/login" element={<Layout><AdminProvider><AdminLoginPage /></AdminProvider></Layout>} />
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

          {/* Unified User Dashboard */}
          <Route path="/dashboard" element={<DesignerProtectedRoute><UserDashboardLayout /></DesignerProtectedRoute>}>
            <Route index element={<DashboardHomePage />} />
            <Route path="profile" element={<DashboardProfilePage />} />
            <Route path="projects" element={<DesignerProvider><DesignerProjectsPage /></DesignerProvider>} />
            <Route path="upload" element={<DesignerProvider><DesignerUploadPage /></DesignerProvider>} />
            <Route path="upload/:id" element={<DesignerProvider><DesignerUploadPage /></DesignerProvider>} />
            <Route path="inquiries" element={<MyInquiriesPage />} />
            <Route path="apply/designer" element={<ApplyDesignerPage />} />
            <Route path="apply/company" element={<ApplyCompanyPage />} />
          </Route>

          {/* Auth with Layout */}
          <Route path="/auth" element={<Layout><AuthPage /></Layout>} />
          <Route path="/auth/callback" element={<Layout><AuthCallbackPage /></Layout>} />

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
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/dmca" element={<DmcaPage />} />
                <Route path="/companies" element={<CompaniesPage />} />
                <Route path="/companies/:id" element={<CompanyDetailPage />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
