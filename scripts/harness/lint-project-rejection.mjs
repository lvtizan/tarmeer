#!/usr/bin/env node
/**
 * lint-project-rejection.mjs
 *
 * Source-level checks for the project rejection notification system:
 * 1. rejection_templates table in autoMigrate
 * 2. sendProjectRejectionEmail exported from emailService
 * 3. rejectProject: template upsert + fire-and-forget email
 * 4. getRejectionTemplates: controller + route
 * 5. adminApi.getRejectionTemplates method
 * 6. Admin UI: reject modal with template list + approve/reject buttons
 * 7. CompanyDashboardPage: rejection banner + pending banner + sessionStorage keys
 * 8. CompanyProjectsPage: Not Approved badge + projectId deep-link scroll + highlight style
 * 9. CompanyUploadPage: warning banner + sessionStorage key
 * 10. App.tsx: company_returnTo saved on protected redirect
 * 11. CompanyAuthPage: company_returnTo redirect after login/register
 *
 * Usage: node scripts/harness/lint-project-rejection.mjs
 * Exit code: 0 = all pass, 1 = failures
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;

function log(label, ok, detail) {
  console.log((ok ? '✅' : '❌') + ' ' + label + (detail ? ': ' + detail : ''));
  if (ok) passed++; else failed++;
}

function read(rel) {
  return readFileSync(path.join(ROOT, rel), 'utf8');
}

// ── 1. autoMigrate: rejection_templates table ─────────────────────────────────
const migrate = read('server/src/lib/autoMigrate.ts');

log(
  'autoMigrate: rejection_templates table defined',
  migrate.includes('rejection_templates'),
  migrate.includes('rejection_templates') ? 'found' : 'MISSING'
);
log(
  'autoMigrate: UNIQUE KEY on (admin_id, text)',
  migrate.includes('uq_admin_text') || (migrate.includes('admin_id') && migrate.includes('text(500)')),
  migrate.includes('uq_admin_text') ? 'uq_admin_text found' : 'MISSING unique key'
);
log(
  'autoMigrate: use_count column',
  migrate.includes('use_count'),
  migrate.includes('use_count') ? 'found' : 'MISSING'
);

// ── 2. emailService: sendProjectRejectionEmail ────────────────────────────────
const email = read('server/src/services/emailService.ts');

log(
  'emailService: sendProjectRejectionEmail exported',
  email.includes('export async function sendProjectRejectionEmail'),
  email.includes('sendProjectRejectionEmail') ? 'found' : 'MISSING'
);
log(
  'emailService: rejection email has project link',
  email.includes('projectListUrl') || email.includes('projectId'),
  'URL param in email body'
);

// ── 3. designerAdminController: rejectProject ─────────────────────────────────
const ctrl = read('server/src/controllers/designerAdminController.ts');

log(
  'controller: rejectProject exported',
  ctrl.includes('export async function rejectProject'),
  ctrl.includes('rejectProject') ? 'found' : 'MISSING'
);
log(
  'controller: rejectProject upserts rejection_templates',
  ctrl.includes('INSERT INTO rejection_templates') && ctrl.includes('ON DUPLICATE KEY UPDATE'),
  ctrl.includes('rejection_templates') ? 'upsert found' : 'MISSING upsert'
);
log(
  'controller: template upsert increments use_count',
  ctrl.includes('use_count = use_count + 1'),
  ctrl.includes('use_count + 1') ? 'found' : 'MISSING'
);
log(
  'controller: rejectProject fires email asynchronously',
  ctrl.includes('sendProjectRejectionEmail') && ctrl.includes('company_profile_id'),
  ctrl.includes('sendProjectRejectionEmail') ? 'fire-and-forget email found' : 'MISSING'
);
log(
  'controller: email uses projectId deep-link',
  ctrl.includes('projectId=') || ctrl.includes('projectListUrl'),
  ctrl.includes('projectListUrl') ? 'deep-link URL found' : 'MISSING deep-link'
);

// ── 4. designerAdminController: getRejectionTemplates ─────────────────────────
log(
  'controller: getRejectionTemplates exported',
  ctrl.includes('export async function getRejectionTemplates'),
  ctrl.includes('getRejectionTemplates') ? 'found' : 'MISSING'
);
log(
  'controller: getRejectionTemplates queries by admin_id',
  ctrl.includes('WHERE admin_id') || ctrl.includes('admin_id = ?'),
  ctrl.includes('admin_id') ? 'found' : 'MISSING admin_id filter'
);
log(
  'controller: getRejectionTemplates orders by last_used_at',
  ctrl.includes('last_used_at DESC'),
  ctrl.includes('last_used_at DESC') ? 'found' : 'MISSING ORDER BY'
);

// ── 5. admin routes ───────────────────────────────────────────────────────────
const routes = read('server/src/routes/admin.ts');

log(
  'admin.ts: imports getRejectionTemplates',
  routes.includes('getRejectionTemplates'),
  routes.includes('getRejectionTemplates') ? 'found' : 'MISSING import'
);
log(
  'admin.ts: GET /rejection-templates registered',
  routes.includes("router.get('/rejection-templates'"),
  routes.includes('/rejection-templates') ? 'found' : 'MISSING route'
);
log(
  'admin.ts: PUT /projects/:projectId/reject registered',
  routes.includes("router.put('/projects/:projectId/reject'") || routes.includes('/reject'),
  routes.includes('/reject') ? 'found' : 'MISSING reject route'
);

// ── 6. adminApi client ────────────────────────────────────────────────────────
const adminApi = read('src/lib/adminApi.ts');

log(
  'adminApi: getRejectionTemplates method',
  adminApi.includes('getRejectionTemplates'),
  adminApi.includes('getRejectionTemplates') ? 'found' : 'MISSING'
);
log(
  'adminApi: calls /rejection-templates endpoint',
  adminApi.includes('/rejection-templates'),
  adminApi.includes('/rejection-templates') ? 'found' : 'MISSING endpoint'
);

// ── 7. AdminRegisteredCompanyDetailPage: reject modal ────────────────────────
const adminDetail = read('src/pages/admin/AdminRegisteredCompanyDetailPage.tsx');

log(
  'AdminDetail: rejectingProjectId state',
  adminDetail.includes('rejectingProjectId'),
  adminDetail.includes('rejectingProjectId') ? 'found' : 'MISSING state'
);
log(
  'AdminDetail: rejectionTemplates state',
  adminDetail.includes('rejectionTemplates'),
  adminDetail.includes('rejectionTemplates') ? 'found' : 'MISSING state'
);
log(
  'AdminDetail: opens reject modal (openProjectRejectModal)',
  adminDetail.includes('openProjectRejectModal'),
  adminDetail.includes('openProjectRejectModal') ? 'found' : 'MISSING handler'
);
log(
  'AdminDetail: template list rendered in modal',
  adminDetail.includes('rejectionTemplates.map') || adminDetail.includes('rejectionTemplates.length'),
  adminDetail.includes('rejectionTemplates') ? 'template list found' : 'MISSING template render'
);
log(
  'AdminDetail: handleProjectApprove',
  adminDetail.includes('handleProjectApprove'),
  adminDetail.includes('handleProjectApprove') ? 'found' : 'MISSING'
);

// ── 8. CompanyDashboardPage: banners ──────────────────────────────────────────
const dashboard = read('src/pages/company/CompanyDashboardPage.tsx');

log(
  'Dashboard: rejectedProjects state',
  dashboard.includes('rejectedProjects'),
  dashboard.includes('rejectedProjects') ? 'found' : 'MISSING'
);
log(
  'Dashboard: rejection banner rendered (not approved)',
  dashboard.includes('not approved') || dashboard.includes('Not Approved') || dashboard.includes('were not approved'),
  dashboard.includes('not approved') || dashboard.includes('Not Approved') ? 'banner found' : 'MISSING rejection banner'
);
log(
  'Dashboard: sessionStorage key tarmeer_pending_banner_dismissed',
  dashboard.includes('tarmeer_pending_banner_dismissed'),
  dashboard.includes('tarmeer_pending_banner_dismissed') ? 'found' : 'MISSING sessionStorage key'
);
log(
  'Dashboard: pending banner dismissible',
  dashboard.includes('bannerDismissed') || dashboard.includes('hasPendingProjects'),
  dashboard.includes('hasPendingProjects') ? 'found' : 'MISSING pending banner logic'
);
log(
  'Dashboard: link to /company/projects from rejection banner',
  dashboard.includes('/company/projects'),
  dashboard.includes('/company/projects') ? 'found' : 'MISSING projects link'
);

// ── 9. CompanyProjectsPage: Not Approved badge + deep-link ───────────────────
const projects = read('src/pages/company/CompanyProjectsPage.tsx');

log(
  'ProjectsPage: Not Approved status badge',
  projects.includes('Not Approved'),
  projects.includes('Not Approved') ? 'found' : 'MISSING — should show "Not Approved" not "rejected"'
);
log(
  'ProjectsPage: Under Review status badge',
  projects.includes('Under Review'),
  projects.includes('Under Review') ? 'found' : 'MISSING Under Review badge'
);
log(
  'ProjectsPage: projectId from useSearchParams',
  projects.includes('highlightId') && (projects.includes('useSearchParams') || projects.includes('searchParams')),
  projects.includes('highlightId') ? 'deep-link param found' : 'MISSING highlightId'
);
log(
  'ProjectsPage: highlight ring style on matching card',
  projects.includes('ring-2') && projects.includes('b8864a'),
  projects.includes('ring-2') ? 'highlight style found' : 'MISSING ring highlight'
);
log(
  'ProjectsPage: scrollIntoView on highlight',
  projects.includes('scrollIntoView'),
  projects.includes('scrollIntoView') ? 'found' : 'MISSING scroll behavior'
);

// ── 10. CompanyUploadPage: warning banner ─────────────────────────────────────
const upload = read('src/pages/company/CompanyUploadPage.tsx');

log(
  'UploadPage: warning banner for rejected projects',
  upload.includes('tarmeer_upload_warning_dismissed') || upload.includes('rejected'),
  upload.includes('tarmeer_upload_warning_dismissed') ? 'sessionStorage key found' : 'MISSING warning banner'
);
log(
  'UploadPage: tarmeer_upload_warning_dismissed key',
  upload.includes('tarmeer_upload_warning_dismissed'),
  upload.includes('tarmeer_upload_warning_dismissed') ? 'found' : 'MISSING'
);

// ── 11. App.tsx: returnTo save on protected redirect ─────────────────────────
const app = read('src/App.tsx');

log(
  'App.tsx: saves company_returnTo to sessionStorage',
  app.includes('company_returnTo'),
  app.includes('company_returnTo') ? 'found' : 'MISSING returnTo save'
);
log(
  'App.tsx: saves intended URL for /company/* paths',
  app.includes("startsWith('/company/')") || (app.includes('company') && app.includes('returnTo')),
  app.includes('company_returnTo') ? 'found' : 'MISSING /company/ path check'
);

// ── 12. CompanyAuthPage: returnTo redirect ────────────────────────────────────
const authPage = read('src/pages/CompanyAuthPage.tsx');

log(
  'CompanyAuthPage: reads company_returnTo after login',
  authPage.includes('company_returnTo'),
  authPage.includes('company_returnTo') ? 'found' : 'MISSING'
);
log(
  'CompanyAuthPage: removes company_returnTo key after use',
  authPage.includes("removeItem('company_returnTo')") || authPage.includes('removeItem'),
  authPage.includes('removeItem') ? 'found' : 'MISSING removeItem — key will linger'
);

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(55));
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(55));
process.exit(failed > 0 ? 1 : 0);
