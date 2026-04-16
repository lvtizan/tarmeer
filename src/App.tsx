import { Suspense, lazy, type ReactNode, Component, type ErrorInfo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminProvider } from './contexts/AdminContext';
import { api } from './lib/api';
import SeoManager from './components/SeoManager';
import GoogleOneTap from './components/GoogleOneTap';
import ToastContainer from './components/ui/Toast';

const Layout = lazy(() => import('./components/Layout'));
const CompanyLayout = lazy(() => import('./components/company/CompanyLayout'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

// Public pages
const HomePage = lazy(() => import('./pages/HomePage'));
const ShowroomsPage = lazy(() => import('./pages/ShowroomsPage'));
const MaterialCategoryPage = lazy(() => import('./pages/MaterialCategoryPage'));
const BrandPage = lazy(() => import('./pages/BrandPage'));
const AuthPage = lazy(() => import('./pages/HomeownerAuthPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const DmcaPage = lazy(() => import('./pages/DmcaPage'));
const NewHomeDesignPage = lazy(() => import('./pages/NewHomeDesignPage'));
const SoftDecorationPage = lazy(() => import('./pages/SoftDecorationPage'));
const HouseExteriorDesignPage = lazy(() => import('./pages/HouseExteriorDesignPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const CompaniesPage = lazy(() => import('./pages/CompaniesPage'));
const CompanyDetailPage = lazy(() => import('./pages/CompanyDetailPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogDetailPage = lazy(() => import('./pages/BlogDetailPage'));
const ForCompaniesPage = lazy(() => import('./pages/ForCompaniesPage'));
const JoinPage = lazy(() => import('./pages/CompanyAuthPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

// Onboarding
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'));

// Company portal
const CompanyOnboardingPage = lazy(() => import('./pages/company/CompanyOnboardingPage'));
const CompanyDashboardPage = lazy(() => import('./pages/company/CompanyDashboardPage'));
const CompanyProjectsPage = lazy(() => import('./pages/company/CompanyProjectsPage'));
const CompanyUploadPage = lazy(() => import('./pages/company/CompanyUploadPage'));
const CompanyArticlesPage = lazy(() => import('./pages/company/CompanyArticlesPage'));

// Homeowner dashboard
const UserDashboardLayout = lazy(() => import('./layouts/UserDashboardLayout'));
const HomeownerDashboardPage = lazy(() => import('./pages/dashboard/HomeownerDashboardPage'));
const HomeownerProjectsPage = lazy(() => import('./pages/dashboard/HomeownerProjectsPage'));
const DashboardProfilePage = lazy(() => import('./pages/dashboard/DashboardProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// Admin
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminForgotPasswordPage = lazy(() => import('./pages/admin/AdminForgotPasswordPage'));
const AdminResetPasswordPage = lazy(() => import('./pages/admin/AdminResetPasswordPage'));
const AdminInstallPage = lazy(() => import('./pages/admin/AdminInstallPage'));
const AdminDesignersPage = lazy(() => import('./pages/admin/AdminDesignersPage'));
const AdminAdminsPage = lazy(() => import('./pages/admin/AdminAdminsPage'));
const AdminDesignerDetailPage = lazy(() => import('./pages/admin/AdminDesignerDetailPage'));
const AdminVisitorsPage = lazy(() => import('./pages/admin/AdminVisitorsPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetailPage'));
const AdminCompaniesPage = lazy(() => import('./pages/admin/AdminCompaniesPage'));
const AdminInquiriesPage = lazy(() => import('./pages/admin/AdminInquiriesPage'));
const AdminComplaintsPage = lazy(() => import('./pages/admin/AdminComplaintsPage'));
const AdminRoleManagementPage = lazy(() => import('./pages/admin/AdminRoleManagementPage'));
const AdminNotificationEmailsPage = lazy(() => import('./pages/admin/AdminNotificationEmailsPage'));
const AdminCompanyImportPage = lazy(() => import('./pages/admin/AdminCompanyImportPage'));
const AdminCompanyDetailPage = lazy(() => import('./pages/admin/AdminCompanyDetailPage'));
const AdminRegisteredCompanyDetailPage = lazy(() => import('./pages/admin/AdminRegisteredCompanyDetailPage'));
const AdminHelpPage = lazy(() => import('./pages/admin/AdminHelpPage'));
const AdminStatsPage = lazy(() => import('./pages/admin/AdminStatsPage'));
const AdminProjectDetailPage = lazy(() => import('./pages/admin/AdminProjectDetailPage'));

// Catches "Failed to fetch dynamically imported module" errors caused by stale browser cache after deploy
class ChunkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    if (error.message?.includes('dynamically imported module') || error.message?.includes('Failed to fetch')) {
      return { hasError: true };
    }
    return null;
  }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (error.message?.includes('dynamically imported module') || error.message?.includes('Failed to fetch')) {
      // Auto-reload once to pick up the new bundle
      const reloaded = sessionStorage.getItem('chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
      }
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-tarmeer-bg)]">
          <div className="text-center px-6">
            <p className="text-stone-600 mb-4">A new version is available. Please refresh to continue.</p>
            <button
              onClick={() => { sessionStorage.removeItem('chunk_reload'); window.location.reload(); }}
              className="btn-primary px-6 py-2 rounded-2xl text-sm font-semibold"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-tarmeer-bg)]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-tarmeer-primary)]/20 border-t-[var(--color-tarmeer-primary)] animate-spin" />
      </div>
    </div>
  );
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
      <ToastContainer />
      <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ====== Admin ====== */}
          <Route path="/admin" element={<AdminProvider><AdminLayout /></AdminProvider>}>
            <Route index element={<AdminAnalyticsPage />} />
            <Route path="designers" element={<AdminDesignersPage />} />
            <Route path="designers/:id" element={<AdminDesignerDetailPage />} />
            <Route path="visitors" element={<AdminVisitorsPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="companies" element={<AdminCompaniesPage />} />
            <Route path="companies/:id" element={<AdminCompanyDetailPage />} />
            <Route path="profile-companies/:id" element={<AdminRegisteredCompanyDetailPage />} />
            <Route path="profile-companies/:companyId/projects/:projectId" element={<AdminProjectDetailPage />} />
            <Route path="inquiries" element={<AdminInquiriesPage />} />
            <Route path="complaints" element={<AdminComplaintsPage />} />
            <Route path="admins" element={<AdminAdminsPage />} />
            <Route path="roles" element={<AdminRoleManagementPage />} />
            <Route path="notification-emails" element={<AdminNotificationEmailsPage />} />
            <Route path="company-import" element={<AdminCompanyImportPage />} />
            <Route path="help" element={<AdminHelpPage />} />
            <Route path="stats" element={<AdminStatsPage />} />
          </Route>
          <Route path="/admin/login" element={<Layout navbarVariant="admin-auth"><AdminProvider><AdminLoginPage /></AdminProvider></Layout>} />
          <Route path="/admin/forgot-password" element={<Layout navbarVariant="admin-auth"><AdminForgotPasswordPage /></Layout>} />
          <Route path="/admin/reset-password" element={<Layout navbarVariant="admin-auth"><AdminResetPasswordPage /></Layout>} />
          <Route path="/admin/install" element={<AdminProvider><AdminInstallPage /></AdminProvider>} />

          {/* ====== Onboarding ====== */}
          <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

          {/* ====== Company Onboarding (independent, no CompanyLayout) ====== */}
          <Route path="/company/onboarding" element={<ProtectedRoute><CompanyOnboardingPage /></ProtectedRoute>} />

          {/* ====== Company ====== */}
          <Route path="/company" element={<ProtectedRoute><CompanyLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<CompanyDashboardPage />} />
            <Route path="projects" element={<CompanyProjectsPage />} />
            <Route path="upload" element={<CompanyUploadPage />} />
            <Route path="articles" element={<CompanyArticlesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* ====== Homeowner Dashboard ====== */}
          <Route path="/dashboard" element={<ProtectedRoute><UserDashboardLayout /></ProtectedRoute>}>
            <Route index element={<HomeownerDashboardPage />} />
            <Route path="projects" element={<HomeownerProjectsPage />} />
            <Route path="profile" element={<DashboardProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* ====== Legacy redirects ====== */}
          <Route path="/designer/*" element={<Navigate to="/company" replace />} />
          <Route path="/designers" element={<Navigate to="/companies" replace />} />
          <Route path="/designers/apply" element={<Navigate to="/onboarding" replace />} />
          <Route path="/designers/:slug" element={<Navigate to="/companies" replace />} />

          {/* ====== Independent landing pages ====== */}
          <Route path="/for-companies" element={<ForCompaniesPage />} />
          <Route path="/join" element={<JoinPage />} />

          {/* ====== Auth ====== */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

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
                <Route path="/services/house-exterior" element={<HouseExteriorDesignPage />} />
                <Route path="/contact" element={<ContactPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/dmca" element={<DmcaPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/blog/:slug" element={<BlogDetailPage />} />
                <Route path="/companies" element={<CompaniesPage />} />
                <Route path="/companies/:companySlug/:projectSlug" element={<ProjectDetailPage />} />
                <Route path="/companies/:id" element={<CompanyDetailPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Layout>
          } />
        </Routes>
      </Suspense>
      </ChunkErrorBoundary>
    </>
  );
}

export default App;
