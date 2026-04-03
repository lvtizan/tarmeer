import { Suspense, lazy, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminProvider } from './contexts/AdminContext';
import { api } from './lib/api';
import SeoManager from './components/SeoManager';
import GoogleOneTap from './components/GoogleOneTap';

const Layout = lazy(() => import('./components/Layout'));
const CompanyLayout = lazy(() => import('./components/company/CompanyLayout'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

// Public pages
const HomePage = lazy(() => import('./pages/HomePage'));
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

// Onboarding
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));

// Company portal
const CompanyDashboardPage = lazy(() => import('./pages/company/CompanyDashboardPage'));
const CompanyProjectsPage = lazy(() => import('./pages/company/CompanyProjectsPage'));

// Homeowner dashboard
const UserDashboardLayout = lazy(() => import('./layouts/UserDashboardLayout'));
const HomeownerDashboardPage = lazy(() => import('./pages/dashboard/HomeownerDashboardPage'));
const DashboardProfilePage = lazy(() => import('./pages/dashboard/DashboardProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Admin
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
const AdminRoleManagementPage = lazy(() => import('./pages/admin/AdminRoleManagementPage'));
const AdminNotificationEmailsPage = lazy(() => import('./pages/admin/AdminNotificationEmailsPage'));
const AdminCompanyImportPage = lazy(() => import('./pages/admin/AdminCompanyImportPage'));

function PageLoader() {
  return <div className="min-h-[40vh] flex items-center justify-center text-sm text-stone-500">Loading...</div>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
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
          {/* ====== Admin ====== */}
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
            <Route path="roles" element={<AdminRoleManagementPage />} />
            <Route path="notification-emails" element={<AdminNotificationEmailsPage />} />
            <Route path="company-import" element={<AdminCompanyImportPage />} />
          </Route>
          <Route path="/admin/login" element={<Layout navbarVariant="admin-auth"><AdminProvider><AdminLoginPage /></AdminProvider></Layout>} />
          <Route path="/admin/install" element={<AdminProvider><AdminInstallPage /></AdminProvider>} />

          {/* ====== Onboarding ====== */}
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

          {/* ====== Company ====== */}
          <Route path="/company" element={<ProtectedRoute><CompanyLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CompanyDashboardPage />} />
            <Route path="projects" element={<CompanyProjectsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* ====== Homeowner Dashboard ====== */}
          <Route path="/dashboard" element={<ProtectedRoute><UserDashboardLayout /></ProtectedRoute>}>
            <Route index element={<HomeownerDashboardPage />} />
            <Route path="profile" element={<DashboardProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* ====== Legacy redirects ====== */}
          <Route path="/designer/*" element={<Navigate to="/company" replace />} />
          <Route path="/designers" element={<Navigate to="/companies" replace />} />
          <Route path="/designers/apply" element={<Navigate to="/onboarding" replace />} />
          <Route path="/designers/:slug" element={<Navigate to="/companies" replace />} />

          {/* ====== Auth ====== */}
          <Route path="/auth" element={<Layout><AuthPage /></Layout>} />
          <Route path="/auth/callback" element={<Layout><AuthCallbackPage /></Layout>} />

          {/* ====== Public ====== */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
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
