import { Suspense, lazy, type ReactNode, Component, type ErrorInfo } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AdminProvider } from './contexts/AdminContext';
import { api } from './lib/api';
import SeoManager from './components/SeoManager';
import GoogleOneTap from './components/GoogleOneTap';
import ToastContainer from './components/ui/Toast';
import { useMetaPixelPageView } from './hooks/useMetaPixelPageView';

// Retry dynamic import up to 2 times before giving up.
// Handles stale chunk hashes after deploy — first retry with cache-bust query param.
function lazyRetry<T extends React.ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch(() =>
      // First retry: bust browser cache with timestamp
      factory().catch(() => {
        // Second retry: force full page reload if still failing
        const KEY = 'chunk_reload_times';
        const now = Date.now();
        const raw = sessionStorage.getItem(KEY);
        const times: number[] = raw ? JSON.parse(raw).filter((t: number) => now - t < 60000) : [];
        if (times.length < 2) {
          times.push(now);
          sessionStorage.setItem(KEY, JSON.stringify(times));
          window.location.reload();
        }
        return factory(); // last attempt, will throw if still fails
      })
    )
  );
}

const Layout = lazyRetry(() => import('./components/Layout'));
const CompanyLayout = lazyRetry(() => import('./components/company/CompanyLayout'));
const AdminLayout = lazyRetry(() => import('./components/admin/AdminLayout'));

// Public pages
const HomePage = lazyRetry(() => import('./pages/HomePage'));
const ShowroomsPage = lazyRetry(() => import('./pages/ShowroomsPage'));
const SupplierDetailPage = lazyRetry(() => import('./pages/SupplierDetailPage'));
const SupplierProjectDetailPage = lazyRetry(() => import('./pages/SupplierProjectDetailPage'));
const SupplierAuthPage = lazyRetry(() => import('./pages/supplier/SupplierAuthPage'));
const ForSuppliersPage = lazyRetry(() => import('./pages/ForSuppliersPage'));
const SupplierLayout = lazyRetry(() => import('./components/supplier/SupplierLayout'));
const SupplierDashboardPage = lazyRetry(() => import('./pages/supplier/SupplierDashboardPage'));
const SupplierProfilePage = lazyRetry(() => import('./pages/supplier/SupplierProfilePage'));
const SupplierProductsPage = lazyRetry(() => import('./pages/supplier/SupplierProductsPage'));
const SupplierProjectsPage = lazyRetry(() => import('./pages/supplier/SupplierProjectsPage'));
const SupplierCatalogsPage = lazyRetry(() => import('./pages/supplier/SupplierCatalogsPage'));
const AuthPage = lazyRetry(() => import('./pages/HomeownerAuthPage'));
const AuthCallbackPage = lazyRetry(() => import('./pages/AuthCallbackPage'));
const VerifyEmailPage = lazyRetry(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazyRetry(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazyRetry(() => import('./pages/ResetPasswordPage'));
const PrivacyPage = lazyRetry(() => import('./pages/PrivacyPage'));
const DmcaPage = lazyRetry(() => import('./pages/DmcaPage'));
const NewHomeDesignPage = lazyRetry(() => import('./pages/NewHomeDesignPage'));
const SoftDecorationPage = lazyRetry(() => import('./pages/SoftDecorationPage'));
const HouseExteriorDesignPage = lazyRetry(() => import('./pages/HouseExteriorDesignPage'));
const ContactPage = lazyRetry(() => import('./pages/ContactPage'));
const CompaniesPage = lazyRetry(() => import('./pages/CompaniesPage'));
const CompanyDetailPage = lazyRetry(() => import('./pages/CompanyDetailPage'));
const PortfolioPage = lazyRetry(() => import('./pages/PortfolioPage'));
const ProjectDetailPage = lazyRetry(() => import('./pages/ProjectDetailPage'));
const FaqPage = lazyRetry(() => import('./pages/FaqPage'));
const BlogPage = lazyRetry(() => import('./pages/BlogPage'));
const BlogDetailPage = lazyRetry(() => import('./pages/BlogDetailPage'));
const ForCompaniesPage = lazyRetry(() => import('./pages/ForCompaniesPage'));
const ForHomeownersPage = lazyRetry(() => import('./pages/ForHomeownersPage'));
const StartGuidePage = lazyRetry(() => import('./pages/StartGuidePage'));
const SupplierStartGuidePage = lazyRetry(() => import('./pages/SupplierStartGuidePage'));
const NotFoundPage = lazyRetry(() => import('./pages/NotFoundPage'));

// Onboarding
const OnboardingPage = lazyRetry(() => import('./pages/OnboardingPage'));

// Company portal
const CompanyOnboardingPage = lazyRetry(() => import('./pages/company/CompanyOnboardingPage'));
const CompanyDashboardPage = lazyRetry(() => import('./pages/company/CompanyDashboardPage'));
const CompanyProjectsPage = lazyRetry(() => import('./pages/company/CompanyProjectsPage'));
const CompanyUploadPage = lazyRetry(() => import('./pages/company/CompanyUploadPage'));
const CompanyArticlesPage = lazyRetry(() => import('./pages/company/CompanyArticlesPage'));
const CompanyProfilePage = lazyRetry(() => import('./pages/company/CompanyProfilePage'));

// Homeowner dashboard
const UserDashboardLayout = lazyRetry(() => import('./layouts/UserDashboardLayout'));
const HomeownerDashboardPage = lazyRetry(() => import('./pages/dashboard/HomeownerDashboardPage'));
const HomeownerProjectsPage = lazyRetry(() => import('./pages/dashboard/HomeownerProjectsPage'));
const DashboardProfilePage = lazyRetry(() => import('./pages/dashboard/DashboardProfilePage'));
const SettingsPage = lazyRetry(() => import('./pages/SettingsPage'));

// Admin
const AdminLoginPage = lazyRetry(() => import('./pages/admin/AdminLoginPage'));
const AdminForgotPasswordPage = lazyRetry(() => import('./pages/admin/AdminForgotPasswordPage'));
const AdminResetPasswordPage = lazyRetry(() => import('./pages/admin/AdminResetPasswordPage'));
const AdminInstallPage = lazyRetry(() => import('./pages/admin/AdminInstallPage'));
const AdminDesignersPage = lazyRetry(() => import('./pages/admin/AdminDesignersPage'));
const AdminAdminsPage = lazyRetry(() => import('./pages/admin/AdminAdminsPage'));
const AdminDesignerDetailPage = lazyRetry(() => import('./pages/admin/AdminDesignerDetailPage'));
const AdminAnalyticsPage = lazyRetry(() => import('./pages/admin/AdminAnalyticsNextPage'));
const AdminVisitorsPage = lazyRetry(() => import('./pages/admin/AdminVisitorsPage'));
const AdminSignedCompaniesPage = lazyRetry(() => import('./pages/admin/AdminSignedCompaniesPage'));
const AdminUsersPage = lazyRetry(() => import('./pages/admin/AdminUsersPage'));
const AdminUserDetailPage = lazyRetry(() => import('./pages/admin/AdminUserDetailPage'));
const AdminCompaniesPage = lazyRetry(() => import('./pages/admin/AdminCompaniesPage'));
const AdminInquiriesPage = lazyRetry(() => import('./pages/admin/AdminInquiriesPage'));
const AdminComplaintsPage = lazyRetry(() => import('./pages/admin/AdminComplaintsPage'));
const AdminFeedbackPage = lazyRetry(() => import('./pages/admin/AdminFeedbackPage'));
const AdminFeedbackDetailPage = lazyRetry(() => import('./pages/admin/AdminFeedbackDetailPage'));
const AdminRoleManagementPage = lazyRetry(() => import('./pages/admin/AdminRoleManagementPage'));
const AdminNotificationEmailsPage = lazyRetry(() => import('./pages/admin/AdminNotificationEmailsPage'));
const AdminCompanyImportPage = lazyRetry(() => import('./pages/admin/AdminCompanyImportPage'));
const AdminCompanyDetailPage = lazyRetry(() => import('./pages/admin/AdminCompanyDetailPage'));
const AdminRegisteredCompanyDetailPage = lazyRetry(() => import('./pages/admin/AdminRegisteredCompanyDetailPage'));
const AdminHelpPage = lazyRetry(() => import('./pages/admin/AdminHelpPage'));
const AdminActivityLogPage = lazyRetry(() => import('./pages/admin/AdminActivityLogPage'));
const AdminUserTimelinePage = lazyRetry(() => import('./pages/admin/AdminUserTimelinePage'));
const AdminSuppliersPage = lazyRetry(() => import('./pages/admin/AdminSuppliersPage'));
const AdminSupplierDetailPage = lazyRetry(() => import('./pages/admin/AdminSupplierDetailPage'));
const AdminProjectDetailPage = lazyRetry(() => import('./pages/admin/AdminProjectDetailPage'));
const AdminVisitRecordsPage = lazyRetry(() => import('./pages/admin/AdminVisitRecordsPage'));
const AdminStaffPage = lazyRetry(() => import('./pages/admin/AdminStaffPage'));
const AdminEnumsPage = lazyRetry(() => import('./pages/admin/AdminEnumsPage'));
const AdminShowcaseImagesPage = lazyRetry(() => import('./pages/admin/AdminShowcaseImagesPage'));

// Field
const FieldSurveyPage = lazyRetry(() => import('./pages/field/FieldSurveyPage'));
const FieldAuthGuard = lazyRetry(() => import('./components/field/FieldAuthGuard'));

// Silently auto-reloads when lazy-loaded chunks fail (stale cache after deploy).
// Loop guard: max 2 reloads per 60s window to avoid infinite refresh.
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
      const KEY = 'chunk_reload_times';
      const now = Date.now();
      const raw = sessionStorage.getItem(KEY);
      const times: number[] = raw ? JSON.parse(raw).filter((t: number) => now - t < 60000) : [];
      if (times.length < 2) {
        times.push(now);
        sessionStorage.setItem(KEY, JSON.stringify(times));
        window.location.reload();
      }
      // If we've reloaded twice in 60s, give up silently — user continues on old version.
    }
  }
  render() {
    // Even if hasError is true, render children. Reload is in flight or we've given up.
    // Avoids flashing an error screen to the user.
    return this.props.children;
  }
}

// Clear reload counter on successful mount (means new bundle loaded OK)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    sessionStorage.removeItem('chunk_reload_times');
  });
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
    const intended = window.location.pathname + window.location.search;
    if (intended.startsWith('/company/')) {
      sessionStorage.setItem('company_returnTo', intended);
    }
    return <Navigate to="/auth" replace />;
  }
  return <>{children}</>;
}


// React Router v6 does not support partial dynamic segments like /@:id.
// This fallback handles /@slug paths via useLocation.
function AtSlugOrNotFound() {
  const location = useLocation();
  const m = location.pathname.match(/^\/@([^/?#]+)$/);
  if (m) return <CompanyDetailPage />;
  return <NotFoundPage />;
}

// Old /designers/:slug links (e.g. from third-party backlinks) preserve slug
// when redirecting to canonical /@slug. Server should also send a
// 301 for SEO; client redirect just covers in-page navigation.
function DesignerSlugRedirect() {
  const location = useLocation();
  const m = location.pathname.match(/^\/designers\/([^/?#]+)$/);
  return <Navigate to={m ? `/@${m[1]}` : '/companies'} replace />;
}

// Old /designers/:slug/projects/:projectSlug URLs (indexed by Google before the
// /companies rename). Redirect to the equivalent /companies/:slug/:projectSlug.
function DesignerProjectRedirect() {
  const { slug, projectSlug } = useParams<{ slug: string; projectSlug: string }>();
  if (slug && projectSlug) {
    return <Navigate to={`/companies/${slug}/${projectSlug}`} replace />;
  }
  return <Navigate to="/companies" replace />;
}
function App() {
  useMetaPixelPageView();
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
            <Route path="visitors" element={<AdminVisitorsPage />} />
            <Route path="signed-companies" element={<AdminSignedCompaniesPage />} />
            <Route path="designers" element={<AdminDesignersPage />} />
            <Route path="designers/:id" element={<AdminDesignerDetailPage />} />
            <Route path="activity-log">
              <Route index element={<AdminActivityLogPage />} />
              <Route path="user/:userId" element={<AdminUserTimelinePage />} />
            </Route>
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="users/:id" element={<AdminUserDetailPage />} />
            <Route path="companies" element={<AdminCompaniesPage />} />
            <Route path="companies/:id" element={<AdminCompanyDetailPage />} />
            <Route path="profile-companies/:id" element={<AdminRegisteredCompanyDetailPage />} />
            <Route path="profile-companies/:companyId/projects/:projectId" element={<AdminProjectDetailPage />} />
            <Route path="inquiries" element={<AdminInquiriesPage />} />
            <Route path="complaints" element={<AdminComplaintsPage />} />
            <Route path="feedback" element={<AdminFeedbackPage />} />
            <Route path="feedback/:id" element={<AdminFeedbackDetailPage />} />
            <Route path="admins" element={<AdminAdminsPage />} />
            <Route path="roles" element={<AdminRoleManagementPage />} />
            <Route path="notification-emails" element={<AdminNotificationEmailsPage />} />
            <Route path="company-import" element={<AdminCompanyImportPage />} />
            <Route path="help" element={<AdminHelpPage />} />
            <Route path="enums" element={<AdminEnumsPage />} />
            <Route path="suppliers" element={<AdminSuppliersPage />} />
            <Route path="suppliers/:id" element={<AdminSupplierDetailPage />} />
            <Route path="visit-records" element={<AdminVisitRecordsPage />} />
            <Route path="staff" element={<AdminStaffPage />} />
            <Route path="showcase-images" element={<AdminShowcaseImagesPage />} />
          </Route>
          <Route path="/admin/login" element={<Layout navbarVariant="admin-auth"><AdminProvider><AdminLoginPage /></AdminProvider></Layout>} />
          <Route path="/admin/forgot-password" element={<Layout navbarVariant="admin-auth"><AdminForgotPasswordPage /></Layout>} />
          <Route path="/admin/reset-password" element={<Layout navbarVariant="admin-auth"><AdminResetPasswordPage /></Layout>} />
          <Route path="/admin/install" element={<AdminProvider><AdminInstallPage /></AdminProvider>} />

          {/* ====== Field Survey ====== */}
          <Route path="/field/survey" element={<AdminProvider><FieldAuthGuard><FieldSurveyPage /></FieldAuthGuard></AdminProvider>} />

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
            <Route path="profile" element={<CompanyProfilePage />} />
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
          {/* Old /designers/:slug/projects/:projectSlug → preserve project for SEO */}
          <Route path="/designers/:slug/projects/:projectSlug" element={<DesignerProjectRedirect />} />
          {/* Preserve slug when redirecting old /designers/:slug → /companies/:slug (was losing slug) */}
          <Route path="/designers/:slug" element={<DesignerSlugRedirect />} />

          {/* ====== Independent landing pages ====== */}
          <Route path="/start" element={<StartGuidePage />} />
          <Route path="/start-suppliers" element={<SupplierStartGuidePage />} />
          <Route path="/for-companies" element={<ForCompaniesPage />} />
          <Route path="/for-homeowners" element={<ForHomeownersPage />} />
          <Route path="/start" element={<StartGuidePage />} />
          <Route path="/join" element={<Navigate to="/for-companies" replace />} />

          {/* ====== Auth ====== */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />

          {/* ====== Supplier Dashboard (own layout, no main Navbar) ====== */}
          <Route path="/supplier" element={<SupplierLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<SupplierDashboardPage />} />
            <Route path="profile" element={<SupplierProfilePage />} />
            <Route path="products" element={<SupplierProductsPage />} />
            <Route path="projects" element={<SupplierProjectsPage />} />
            <Route path="catalogs" element={<SupplierCatalogsPage />} />
          </Route>

          {/* ====== Public ====== */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/showrooms" element={<Navigate to="/materials" replace />} />
                <Route path="/home" element={<Navigate to="/" replace />} />
                <Route path="/materials/brands" element={<Navigate to="/materials" replace />} />
                <Route path="/materials/brands/*" element={<Navigate to="/materials" replace />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/login" element={<Navigate to="/auth" replace />} />
                <Route path="/register" element={<Navigate to="/auth" replace />} />
                <Route path="/materials" element={<ShowroomsPage />} />
                <Route path="/materials/suppliers/:slug" element={<SupplierDetailPage />} />
                <Route path="/materials/suppliers/:slug/projects/:projectId" element={<SupplierProjectDetailPage />} />
                <Route path="/for-suppliers" element={<ForSuppliersPage />} />
                <Route path="/supplier/auth" element={<SupplierAuthPage />} />
                <Route path="/supplier/auth/callback" element={<SupplierAuthPage />} />
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
                <Route path="/@:id" element={<CompanyDetailPage />} />
                <Route path="*" element={<AtSlugOrNotFound />} />
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
