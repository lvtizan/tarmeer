import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Helper to read source files
const SRC = (() => {
  const tsSrc = resolve(__dirname, '..', '..', 'src');
  return existsSync(tsSrc) ? tsSrc : resolve(__dirname, '..');
})();
const ROOT_SRC = resolve(__dirname, '..', '..', '..', 'src');
function readSrc(path: string) { return readFileSync(resolve(SRC, path), 'utf-8'); }
function readFrontend(path: string) { return readFileSync(resolve(ROOT_SRC, path), 'utf-8'); }

// ============================================================
// Module 1: Auth — no designer role in new user creation
// ============================================================
describe('M1: Auth - designer role removed', () => {
  const authCtrl = readSrc('controllers/userAuthController.ts');

  it('register() sets role=user, not designer', () => {
    // The INSERT should have 'user' as role
    assert.match(authCtrl, /INSERT INTO users.*'user'/s);
    assert.doesNotMatch(authCtrl, /INSERT INTO users.*'designer'/s);
  });

  it('login() does not return designer object', () => {
    // Should NOT have "designer:" in the login response
    const loginFn = authCtrl.slice(authCtrl.indexOf('export async function login'));
    const loginEnd = loginFn.indexOf('export async function', 10);
    const loginBody = loginFn.slice(0, loginEnd > 0 ? loginEnd : undefined);
    assert.doesNotMatch(loginBody, /designer:\s*linkedData/);
  });

  it('oauthCallback() sets role=user for new users', () => {
    assert.match(authCtrl, /oauthCallback[\s\S]*?'user', TRUE, 'active'/);
    assert.doesNotMatch(authCtrl, /oauthCallback[\s\S]*?'designer', TRUE, 'active'/);
  });

  it('googleOneTap() does not set role=designer', () => {
    assert.doesNotMatch(authCtrl, /UPDATE users SET role = 'designer'/);
  });

  it('getLinkedData function is removed', () => {
    assert.doesNotMatch(authCtrl, /function getLinkedData/);
  });

  it('no designer table sync in verifyEmail/resetPassword', () => {
    assert.doesNotMatch(authCtrl, /UPDATE designers SET.*email_verified/);
    assert.doesNotMatch(authCtrl, /UPDATE designers SET.*password/);
  });
});

// ============================================================
// Module 2: Auth middleware — no designers query for new tokens
// ============================================================
describe('M2: Auth middleware - no designers query', () => {
  const authMiddleware = readSrc('middleware/auth.ts');

  it('new token path does not query designers table', () => {
    // Find the "if (decoded.userId)" block
    const newTokenBlock = authMiddleware.slice(
      authMiddleware.indexOf('if (decoded.userId)'),
      authMiddleware.indexOf('if (decoded.id)')
    );
    assert.doesNotMatch(newTokenBlock, /FROM designers/);
  });

  it('new token path includes active_role in SELECT', () => {
    assert.match(authMiddleware, /SELECT id, email, role, active_role, status FROM users/);
  });

  it('legacy token prompts re-login for unlinked designers', () => {
    assert.match(authMiddleware, /Please log in again to continue/);
  });
});

// ============================================================
// Module 3: Inquiry system — no designer references
// ============================================================
describe('M3: Inquiry system - company only', () => {
  const inquiryCtrl = readSrc('controllers/inquiryController.ts');

  it('submitInquiry INSERT has no designer_id column', () => {
    const submitFn = inquiryCtrl.slice(0, inquiryCtrl.indexOf('// List inquiries'));
    assert.doesNotMatch(submitFn, /designer_id/);
  });

  it('admin getInquiries joins company_profiles not designers', () => {
    assert.match(inquiryCtrl, /LEFT JOIN company_profiles cp ON/);
    assert.doesNotMatch(inquiryCtrl, /LEFT JOIN designers/);
  });

  it('getMyInquiries queries company_profiles not designers', () => {
    const myFn = inquiryCtrl.slice(inquiryCtrl.indexOf('getMyInquiries'));
    assert.match(myFn, /FROM company_profiles WHERE user_id/);
    assert.doesNotMatch(myFn, /FROM designers WHERE/);
    assert.doesNotMatch(myFn, /FROM uae_companies WHERE/);
  });

  it('submitInquiry calls notifyNewInquiry', () => {
    assert.match(inquiryCtrl, /notifyNewInquiry/);
  });
});

// ============================================================
// Module 4: Company profile controller
// ============================================================
describe('M4: Company profile - notifications on registration', () => {
  const companyCtrl = readSrc('controllers/companyProfileController.ts');

  it('imports notifyCompanyRegistration', () => {
    assert.match(companyCtrl, /import.*notifyCompanyRegistration/);
  });

  it('calls notifyCompanyRegistration in INSERT branch', () => {
    // After the INSERT branch, registration should trigger async notification.
    const insertIdx = companyCtrl.indexOf('INSERT INTO company_profiles');
    const afterInsert = companyCtrl.slice(insertIdx, insertIdx + 2400);
    assert.match(afterInsert, /setImmediate\s*\(\s*\(\)\s*=>\s*{\s*notifyCompanyRegistration/s);
  });

  it('does NOT call notification in UPDATE branch', () => {
    // The UPDATE block should not have notify
    const updateIdx = companyCtrl.indexOf('UPDATE company_profiles SET');
    const insertIdx = companyCtrl.indexOf('INSERT INTO company_profiles');
    const updateBlock = companyCtrl.slice(updateIdx, insertIdx);
    assert.doesNotMatch(updateBlock, /notifyCompanyRegistration/);
  });
});

// ============================================================
// Module 5: Notification service
// ============================================================
describe('M5: Notification service', () => {
  const notifService = readSrc('services/notificationService.ts');

  it('notifyNewInquiry creates in-app + sends email', () => {
    const fn = notifService.slice(notifService.indexOf('export async function notifyNewInquiry'));
    assert.match(fn, /createNotification/);
    assert.match(fn, /sendGroupEmail/);
  });

  it('notifyCompanyRegistration creates in-app + sends email', () => {
    const fn = notifService.slice(notifService.indexOf('export async function notifyCompanyRegistration'));
    assert.match(fn, /createNotification/);
    assert.match(fn, /sendGroupEmail/);
  });

  it('getActiveNotificationEmails queries notification_emails table', () => {
    assert.match(notifService, /FROM notification_emails WHERE is_active = 1/);
  });
});

// ============================================================
// Module 6: Company import service
// ============================================================
describe('M6: Company import service', () => {
  const importService = readSrc('services/companyImportService.ts');

  it('generateTemplate exists and creates a Document', () => {
    assert.match(importService, /export async function generateTemplate/);
    assert.match(importService, /new Document/);
    assert.match(importService, /Packer\.toBuffer/);
  });

  it('parseTemplate uses mammoth to extract text', () => {
    assert.match(importService, /export async function parseTemplate/);
    assert.match(importService, /mammoth\.extractRawText/);
  });

  it('importCompany inserts into both tables', () => {
    assert.match(importService, /INSERT INTO company_profiles/);
    assert.match(importService, /INSERT INTO uae_companies/);
  });

  it('template has all required fields', () => {
    for (const field of ['company_name', 'contact_person', 'phone', 'city', 'services', 'description']) {
      assert.match(importService, new RegExp(`key: '${field}'`), `Missing template field: ${field}`);
    }
  });
});

// ============================================================
// Module 7: Admin routes — edit + import + notification-emails
// ============================================================
describe('M7: Admin routes completeness', () => {
  const adminRoutes = readSrc('routes/admin.ts');

  it('has company edit routes for scraped companies', () => {
    assert.match(adminRoutes, /companies\/:companyId\/edit/);
    assert.match(adminRoutes, /editScrapedCompany/);
  });

  it('has company edit routes for registered companies', () => {
    assert.match(adminRoutes, /roles\/companies\/:id\/edit/);
    assert.match(adminRoutes, /editCompanyProfile/);
  });

  it('has company import routes', () => {
    assert.match(adminRoutes, /companies\/import\/template/);
    assert.match(adminRoutes, /companies\/import\/parse/);
    assert.match(adminRoutes, /companies\/import\/confirm/);
  });

  it('has notification email CRUD routes', () => {
    assert.match(adminRoutes, /notification-emails/);
    assert.match(adminRoutes, /router\.delete\('\/notification-emails\/:id'/);
  });
});

// ============================================================
// Module 8: Frontend — designer removal
// ============================================================
describe('M8: Frontend - designer removal', () => {
  it('App.tsx redirects /designers to /companies', () => {
    const app = readFrontend('App.tsx');
    assert.match(app, /path="\/designers".*Navigate to="\/companies"/s);
  });

  it('App.tsx has no public DesignersPage/DesignerProfilePage lazy import', () => {
    const app = readFrontend('App.tsx');
    assert.doesNotMatch(app, /lazy\(\(\) => import\('\.\/pages\/DesignersPage/);
    assert.doesNotMatch(app, /lazy\(\(\) => import\('\.\/pages\/DesignerProfilePage/);
    assert.doesNotMatch(app, /lazy\(\(\) => import\('\.\/pages\/ApplyPage/);
  });

  it('UserDashboardLayout redirects company users to /company', () => {
    const layout = readFrontend('layouts/UserDashboardLayout.tsx');
    assert.match(layout, /Navigate to="\/company"/);
    assert.doesNotMatch(layout, /Become a Designer/);
  });

  it('OnboardingPage uses correct API path (no double /api)', () => {
    const onboarding = readFrontend('pages/OnboardingPage.tsx');
    assert.match(onboarding, /request\('\/auth\/select-role'/);
    assert.doesNotMatch(onboarding, /request\('\/api\/auth/);
  });
});

// ============================================================
// Module 9: Company dashboard - services and profile
// ============================================================
describe('M9: Company dashboard - services and profile', () => {
  it('has correct service list (SERVICES constant)', () => {
    const page = readFrontend('pages/company/CompanyDashboardPage.tsx');
    assert.match(page, /SERVICES = \[/);
    assert.match(page, /'Interior Design'/);
    assert.match(page, /'Fit-Out'/);
    assert.match(page, /'MEP'/);
  });

  it('services rendered as FormTag components', () => {
    const page = readFrontend('pages/company/CompanyDashboardPage.tsx');
    assert.match(page, /SERVICES\.map/);
    assert.match(page, /FormTag/);
  });

  it('saves company_name field to API', () => {
    const page = readFrontend('pages/company/CompanyDashboardPage.tsx');
    assert.match(page, /company_name:.*\.company_name/);
  });
});

// ============================================================
// Module 10: Frontend — InquiryForm no designer
// ============================================================
describe('M10: InquiryForm - no designer reference', () => {
  it('InquiryForm has no designerId prop', () => {
    const form = readFrontend('components/InquiryForm.tsx');
    assert.doesNotMatch(form, /designerId/);
    assert.doesNotMatch(form, /designer_id/);
  });
});

// ============================================================
// Module 11: Notification bell
// ============================================================
describe('M11: NotificationBell component', () => {
  it('polls every 30 seconds', () => {
    const bell = readFrontend('components/NotificationBell.tsx');
    assert.match(bell, /setInterval.*30000/s);
  });

  it('has mark-all-read functionality', () => {
    const bell = readFrontend('components/NotificationBell.tsx');
    assert.match(bell, /read-all/);
  });

  it('is temporarily disabled in AdminLayout', () => {
    const layout = readFrontend('components/admin/AdminLayout.tsx');
    assert.doesNotMatch(layout, /NotificationBell/);
  });

  it('is enabled in Navbar for user-facing notifications', () => {
    const navbar = readFrontend('components/Navbar.tsx');
    assert.match(navbar, /NotificationBell/);
  });
});

// ============================================================
// Module 12: Homeowner Dashboard
// ============================================================
describe('M12: Homeowner dashboard', () => {
  it('uses global input styles', () => {
    const page = readFrontend('pages/dashboard/HomeownerDashboardPage.tsx');
    assert.match(page, /border-stone-200 bg-stone-50/);
    assert.match(page, /focus:border-\[#b8864a\]/);
  });

  it('has checklist with 3 steps', () => {
    const page = readFrontend('pages/dashboard/HomeownerDashboardPage.tsx');
    assert.match(page, /Submit renovation requirements/);
    assert.match(page, /Upload renovation progress/);
    assert.match(page, /Get matched with a company/);
  });

  it('has renovation form fields', () => {
    const page = readFrontend('pages/dashboard/HomeownerDashboardPage.tsx');
    assert.match(page, /area_range/);
    assert.match(page, /budget_range/);
  });

  it('has image board with folder upload', () => {
    const page = readFrontend('pages/dashboard/HomeownerDashboardPage.tsx');
    assert.match(page, /My Renovation Progress/);
    assert.match(page, /webkitdirectory/);
    assert.match(page, /coverIndex/);
    assert.match(page, /GripVertical/);
  });

  it('auto-saves profile on blur', () => {
    const page = readFrontend('pages/dashboard/HomeownerDashboardPage.tsx');
    assert.match(page, /triggerSave/);
  });

  it('does NOT reference designer', () => {
    const page = readFrontend('pages/dashboard/HomeownerDashboardPage.tsx');
    assert.doesNotMatch(page, /[Dd]esigner/);
  });
});

// ============================================================
// Module 13: Company Projects page — left-right layout
// ============================================================
describe('M13: Company projects page', () => {
  it('uses two column grid layout', () => {
    const page = readFrontend('pages/company/CompanyProjectsPage.tsx');
    assert.match(page, /xl:grid-cols-\[/);
  });

  it('left has Project Details, right has Image Board', () => {
    const page = readFrontend('pages/company/CompanyProjectsPage.tsx');
    assert.match(page, /Project Details/);
    assert.match(page, /Image Board/);
  });

  it('has URL scraper', () => {
    const page = readFrontend('pages/company/CompanyProjectsPage.tsx');
    assert.match(page, /scrape-portfolio/);
  });

  it('has folder upload', () => {
    const page = readFrontend('pages/company/CompanyProjectsPage.tsx');
    assert.match(page, /webkitdirectory/);
  });

  it('has drag reorder + cover selection + lightbox', () => {
    const page = readFrontend('pages/company/CompanyProjectsPage.tsx');
    assert.match(page, /mvImg/);
    assert.match(page, /Set as Cover/);
    assert.match(page, /prevI/);
  });

  it('has inline field validation on submit', () => {
    const page = readFrontend('pages/company/CompanyProjectsPage.tsx');
    assert.match(page, /tried/);
    assert.match(page, /text-red-500/);
    assert.match(page, /Project title is required/);
  });

  it('Dashboard is single column with FormInput components', () => {
    const dash = readFrontend('pages/company/CompanyDashboardPage.tsx');
    assert.match(dash, /FormInput/);
    assert.match(dash, /FormTag/);
    assert.match(dash, /FormSelect/);
    assert.doesNotMatch(dash, /xl:grid-cols/);
  });
});

// ============================================================
// Module 14: Drag-and-drop folder support
// ============================================================
describe('M14: Folder drag-and-drop', () => {
  it('dropFiles utility returns DropResult with folderName', () => {
    const util = readFrontend('lib/dropFiles.ts');
    assert.match(util, /interface DropResult/);
    assert.match(util, /folderName: string \| null/);
    assert.match(util, /fileNames: string\[\]/);
  });

  it('uses webkitGetAsEntry for folder traversal', () => {
    const util = readFrontend('lib/dropFiles.ts');
    assert.match(util, /webkitGetAsEntry/);
    assert.match(util, /isDirectory/);
    assert.match(util, /createReader/);
    assert.match(util, /readEntries/);
  });

  it('CompanyProjectsPage imports and uses getDroppedImageFiles', () => {
    const page = readFrontend('pages/company/CompanyProjectsPage.tsx');
    assert.match(page, /getDroppedImageFiles/);
    assert.match(page, /result\.folderName/);
    assert.match(page, /result\.files/);
  });

  it('auto-fills project title from folder name', () => {
    const page = readFrontend('pages/company/CompanyProjectsPage.tsx');
    assert.match(page, /folderName.*!form\.title/s);
  });

  it('unified upload zone has URL + drop + folder in one block', () => {
    const page = readFrontend('pages/company/CompanyProjectsPage.tsx');
    assert.match(page, /Drop images or folders here/);
    assert.match(page, /Or paste a URL to import/);
    assert.match(page, /Select Folder/);
  });

  it('HomeownerDashboardPage also uses folder drop', () => {
    const page = readFrontend('pages/dashboard/HomeownerDashboardPage.tsx');
    assert.match(page, /getDroppedImageFiles/);
    assert.match(page, /result\.files/);
  });
});

// ============================================================
// Module 15: Navbar & Layout
// ============================================================
describe('M15: Navbar and sidebar', () => {
  it('Navbar is full-width (no max-w container)', () => {
    const nav = readFrontend('components/Navbar.tsx');
    assert.match(nav, /w-full px-4/);
    assert.doesNotMatch(nav, /max-w-6xl mx-auto.*flex items-center justify-between h-14/);
  });

  it('User menu in Navbar, NotificationBell not in CompanyLayout sidebar', () => {
    const nav = readFrontend('components/Navbar.tsx');
    assert.match(nav, /UserMenu/);
    const layout = readFrontend('components/company/CompanyLayout.tsx');
    assert.doesNotMatch(layout, /NotificationBell/);
  });

  it('Company sidebar uses rounded-full active style without border-l', () => {
    const layout = readFrontend('components/company/CompanyLayout.tsx');
    assert.match(layout, /rounded-full/);
    assert.doesNotMatch(layout, /border-l-4/);
  });

  it('Company sidebar is fixed position', () => {
    const layout = readFrontend('components/company/CompanyLayout.tsx');
    assert.match(layout, /fixed top-\[57px\]/);
  });

  it('OnboardingPage has Navbar and no progress bar', () => {
    const page = readFrontend('pages/OnboardingPage.tsx');
    assert.match(page, /<Navbar/);
    assert.doesNotMatch(page, /bg-amber-500.*width.*50%/);
  });

  it('OnboardingPage select-role does not check response.ok', () => {
    const page = readFrontend('pages/OnboardingPage.tsx');
    assert.doesNotMatch(page, /response\.ok/);
  });

  it('Footer links to /companies not /designers', () => {
    const footer = readFrontend('components/Footer.tsx');
    assert.match(footer, /\/companies/);
    assert.doesNotMatch(footer, /\/#designers/);
  });
});

// ============================================================
// Module 16: Global form components
// ============================================================
describe('M16: FormInput components', () => {
  it('FormInput component exists with correct base styles', () => {
    const form = readFrontend('components/form/FormInput.tsx');
    assert.match(form, /export const FormInput/);
    assert.match(form, /export const FormTextarea/);
    assert.match(form, /export const FormSelect/);
    assert.match(form, /export function FormTag/);
    assert.match(form, /export function FormLabel/);
  });

  it('uses consistent focus ring color', () => {
    const form = readFrontend('components/form/FormInput.tsx');
    assert.match(form, /focus:border-\[#b8864a\]/);
    assert.match(form, /focus:ring-\[#b8864a\]/);
  });

  it('CompanyDashboardPage uses FormInput not raw classes', () => {
    const page = readFrontend('pages/company/CompanyDashboardPage.tsx');
    assert.match(page, /FormInput/);
    assert.match(page, /FormLabel/);
    assert.doesNotMatch(page, /const fieldCls/);
    assert.doesNotMatch(page, /const labelCls/);
  });
});
