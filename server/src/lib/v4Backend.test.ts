import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// __dirname at runtime = dist/lib/ → we need server/src/
const SRC = resolve(__dirname, '..').replace('/dist', '/src');
function read(path: string) { return readFileSync(resolve(SRC, path), 'utf-8'); }

// ============================================================
// Admin Company Edit API
// ============================================================
describe('Admin: Company edit endpoints', () => {
  const ctrl = read('controllers/companyAdminController.ts');
  const routes = read('routes/admin.ts');

  it('has editScrapedCompany function', () => {
    assert.match(ctrl, /export async function editScrapedCompany/);
  });

  it('has editCompanyProfile function', () => {
    assert.match(ctrl, /export async function editCompanyProfile/);
  });

  it('has getScrapedCompany detail endpoint', () => {
    assert.match(ctrl, /export async function getScrapedCompany/);
  });

  it('routes registered for edit + detail', () => {
    assert.match(routes, /companies\/:companyId\/edit/);
    assert.match(routes, /companies\/:companyId\/detail/);
    assert.match(routes, /roles\/companies\/:id\/edit/);
    assert.match(routes, /roles\/companies\/:id\/detail/);
  });

  it('editScrapedCompany updates uae_companies fields', () => {
    assert.match(ctrl, /UPDATE uae_companies SET/);
  });

  it('editCompanyProfile updates company_profiles fields', () => {
    assert.match(ctrl, /UPDATE company_profiles SET/);
  });
});

// ============================================================
// Settings API — update name + change password
// ============================================================
describe('Settings: update name and change password', () => {
  const ctrl = read('controllers/userAuthController.ts');
  const routes = read('routes/auth.ts');

  it('has updateName controller function', () => {
    assert.match(ctrl, /export async function updateName/);
  });

  it('has changePassword controller function', () => {
    assert.match(ctrl, /export async function changePassword/);
  });

  it('updateName verifies current password with bcrypt', () => {
    const fn = ctrl.slice(ctrl.indexOf('async function updateName'));
    assert.match(fn, /bcrypt\.compare/);
  });

  it('changePassword verifies current password', () => {
    const fn = ctrl.slice(ctrl.indexOf('async function changePassword'));
    assert.match(fn, /bcrypt\.compare/);
  });

  it('changePassword hashes new password', () => {
    const fn = ctrl.slice(ctrl.indexOf('async function changePassword'));
    assert.match(fn, /bcrypt\.hash/);
  });

  it('routes registered with validation', () => {
    assert.match(routes, /update-name/);
    assert.match(routes, /change-password/);
    assert.match(routes, /body\('full_name'\)/);
    assert.match(routes, /body\('current_password'\)/);
    assert.match(routes, /body\('new_password'\)/);
  });
});

// ============================================================
// Notification system
// ============================================================
describe('Notification: service + routes', () => {
  const service = read('services/notificationService.ts');
  const routes = read('routes/admin.ts');

  it('notifyNewInquiry sends in-app + email', () => {
    assert.match(service, /export async function notifyNewInquiry/);
    assert.match(service, /createNotification/);
    assert.match(service, /sendGroupEmail/);
  });

  it('notifyCompanyRegistration sends in-app + email', () => {
    assert.match(service, /export async function notifyCompanyRegistration/);
  });

  it('getActiveNotificationEmails queries DB', () => {
    assert.match(service, /FROM notification_emails WHERE is_active = 1/);
  });

  it('admin notification-emails CRUD routes exist', () => {
    assert.match(routes, /notification-emails/);
    // All 4 methods present
    assert.match(routes, /router\.get\('\/notification-emails'/);
    assert.match(routes, /router\.post\('\/notification-emails'/);
    assert.match(routes, /router\.put\('\/notification-emails/);
    assert.match(routes, /router\.delete\('\/notification-emails/);
  });
});

// ============================================================
// Inquiry → notification trigger
// ============================================================
describe('Inquiry: triggers notification on submit', () => {
  const ctrl = read('controllers/inquiryController.ts');

  it('imports notifyNewInquiry', () => {
    assert.match(ctrl, /import.*notifyNewInquiry/);
  });

  it('calls notifyNewInquiry in submitInquiry', () => {
    const fn = ctrl.slice(0, ctrl.indexOf('// List inquiries'));
    assert.match(fn, /notifyNewInquiry/);
  });

  it('no designer_id in INSERT', () => {
    const fn = ctrl.slice(0, ctrl.indexOf('// List inquiries'));
    assert.doesNotMatch(fn, /designer_id/);
  });
});

// ============================================================
// Company Import (Word template)
// ============================================================
describe('Company Import: template + parse + import', () => {
  const service = read('services/companyImportService.ts');
  const routes = read('routes/admin.ts');

  it('generateTemplate creates a Document', () => {
    assert.match(service, /export async function generateTemplate/);
    assert.match(service, /new Document/);
  });

  it('parseTemplate uses mammoth', () => {
    assert.match(service, /export async function parseTemplate/);
    assert.match(service, /mammoth/);
  });

  it('importCompany inserts into both tables', () => {
    assert.match(service, /INSERT INTO company_profiles/);
    assert.match(service, /INSERT INTO uae_companies/);
  });

  it('routes registered for template, parse, confirm', () => {
    assert.match(routes, /companies\/import\/template/);
    assert.match(routes, /companies\/import\/parse/);
    assert.match(routes, /companies\/import\/confirm/);
  });
});

// ============================================================
// Portfolio Scraper
// ============================================================
describe('Portfolio Scraper: fast + browser fallback', () => {
  const scraper = read('services/portfolioScraper.ts');

  it('exports scrapePortfolio function', () => {
    assert.match(scraper, /export async function scrapePortfolio/);
  });

  it('has fast (axios) scrape method', () => {
    assert.match(scraper, /async function scrapeFast/);
    assert.match(scraper, /axios\.get/);
  });

  it('has browser (puppeteer) fallback', () => {
    assert.match(scraper, /async function scrapeBrowser/);
    assert.match(scraper, /puppeteer/);
  });

  it('extracts images from multiple sources', () => {
    assert.match(scraper, /og:image/);
    assert.match(scraper, /srcset/);
    assert.match(scraper, /background/);
    assert.match(scraper, /noscript/);
    assert.match(scraper, /JSON-LD|ld\+json/);
  });

  it('filters out non-project images', () => {
    assert.match(scraper, /function isProjectImage/);
    assert.match(scraper, /logo.*icon.*favicon/s);
  });

  it('route registered on auth', () => {
    const routes = read('routes/auth.ts');
    assert.match(routes, /scrape-portfolio/);
  });
});

// ============================================================
// Auth Middleware
// ============================================================
describe('Auth Middleware: new + legacy token handling', () => {
  const auth = read('middleware/auth.ts');

  it('handles new token format (userId)', () => {
    assert.match(auth, /decoded\.userId/);
    assert.match(auth, /SELECT.*active_role.*FROM users/);
  });

  it('handles legacy token format (id)', () => {
    assert.match(auth, /decoded\.id/);
    assert.match(auth, /FROM designers WHERE id/);
  });

  it('sets active_role on req.user', () => {
    assert.match(auth, /active_role:.*active_role/);
  });

  it('prompts re-login for unlinked legacy designers', () => {
    assert.match(auth, /Please log in again/);
  });
});

// ============================================================
// Company Profile Controller
// ============================================================
describe('Company Profile: upsert + notification', () => {
  const ctrl = read('controllers/companyProfileController.ts');

  it('validates required fields', () => {
    assert.match(ctrl, /company_name.*description.*contact_person.*phone/s);
  });

  it('validates profile payload', () => {
    assert.match(ctrl, /validateCompanyProfilePayload|VALID_SERVICES/);
  });

  it('triggers notification on new company', () => {
    assert.match(ctrl, /notifyCompanyRegistration/);
  });

  it('uses LIMIT with Number() not prepared param', () => {
    const pubCtrl = read('controllers/publicCompanyController.ts');
    assert.match(pubCtrl, /LIMIT \$\{Number/);
  });
});
