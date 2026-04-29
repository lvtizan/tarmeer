#!/usr/bin/env node
/**
 * lint-navbar-and-slug.mjs
 *
 * Source-level checks for:
 * 1. Navbar dropdown gap fix (pt-2 not mt-2 on outer absolute container)
 * 2. /@:slug route registered in App.tsx
 * 3. CompanyDetailPage URL canonicalization (/companies/:slug → /@:slug)
 * 4. activity-log routes registered in admin.ts
 *
 * Usage: node scripts/harness/lint-navbar-and-slug.mjs
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

// ── 1. Navbar dropdown: no mt-2 on outer absolute container ──────────────────
const navbar = read('src/components/Navbar.tsx');

// Check that outer absolute divs use pt-2 not mt-2
// Both dropdowns should have "absolute top-full ... pt-2" and NOT "mt-2" near them
const hasFindCompanyPt2 = navbar.includes('absolute top-full right-0 pt-2');
const hasPortfolioPt2   = navbar.includes('absolute top-full left-0 pt-2');
// mt-2 should not appear on any absolute top-full container
const findCompanyMt2Lines = navbar.split('\n').filter(l => l.includes('absolute top-full right-0') && l.includes('mt-2'));
const portfolioMt2Lines   = navbar.split('\n').filter(l => l.includes('absolute top-full left-0') && l.includes('mt-2'));

log(
  'Find Company dropdown outer uses pt-2 (not mt-2)',
  hasFindCompanyPt2 && findCompanyMt2Lines.length === 0,
  findCompanyMt2Lines.length > 0 ? 'STILL has mt-2 → gap causes dropdown to close' : (hasFindCompanyPt2 ? 'OK' : 'pt-2 not found')
);

log(
  'Portfolio dropdown outer uses pt-2 (not mt-2)',
  hasPortfolioPt2 && portfolioMt2Lines.length === 0,
  portfolioMt2Lines.length > 0 ? 'STILL has mt-2 → gap causes dropdown to close' : (hasPortfolioPt2 ? 'OK' : 'pt-2 not found')
);

// Visual styles must be on an inner div (bg-white present inside the panel)
log(
  'Find Company dropdown has inner div with bg-white',
  navbar.includes('<div className="bg-white shadow-xl rounded-lg border border-stone-200">'),
  navbar.includes('<div className="bg-white shadow-xl rounded-lg border border-stone-200">') ? 'found' : 'MISSING inner visual wrapper'
);

// ── 2. App.tsx: /@:id route registered ───────────────────────────────────────
const app = read('src/App.tsx');

log(
  'App.tsx has /@:id route',
  app.includes('path="/@:id"'),
  app.includes('/@:id') ? 'route found' : 'MISSING /@:id route'
);

log(
  'App.tsx /@:id renders CompanyDetailPage',
  app.includes('path="/@:id"') && app.includes('CompanyDetailPage'),
  'OK'
);

// ── 3. CompanyDetailPage: URL canonicalization ────────────────────────────────
const cdp = read('src/pages/CompanyDetailPage.tsx');

log(
  'CompanyDetailPage redirects /companies/:slug → /@:slug',
  cdp.includes("startsWith('/companies/')") && cdp.includes('`/@${id}`'),
  cdp.includes('startsWith') ? 'canonicalization found' : 'MISSING redirect logic'
);

log(
  'CompanyDetailPage uses replace:true for canonicalization',
  cdp.includes("replace: true"),
  cdp.includes('replace: true') ? 'OK' : 'MISSING replace:true — will create extra history entry'
);

// ── 4. Admin routes: activity-log registered ─────────────────────────────────
const adminRoutes = read('server/src/routes/admin.ts');

log(
  'admin.ts imports getActivityLogStats',
  adminRoutes.includes('getActivityLogStats'),
  adminRoutes.includes('getActivityLogStats') ? 'found' : 'MISSING import'
);

log(
  'admin.ts imports exportActivityLogs',
  adminRoutes.includes('exportActivityLogs'),
  adminRoutes.includes('exportActivityLogs') ? 'found' : 'MISSING import'
);

log(
  'admin.ts has GET /activity-log route',
  adminRoutes.includes("router.get('/activity-log'"),
  adminRoutes.includes("router.get('/activity-log'") ? 'found' : 'MISSING — was /activity-logs (with s)'
);

log(
  'admin.ts has GET /activity-log/stats route',
  adminRoutes.includes("'/activity-log/stats'"),
  adminRoutes.includes("'/activity-log/stats'") ? 'found' : 'MISSING'
);

log(
  'admin.ts has GET /activity-log/export route',
  adminRoutes.includes("'/activity-log/export'"),
  adminRoutes.includes("'/activity-log/export'") ? 'found' : 'MISSING'
);

// ── 5. activityLogController: all three handlers exported ────────────────────
const actCtrl = read('server/src/controllers/activityLogController.ts');

for (const fn of ['getActivityLogs', 'getActivityLogStats', 'exportActivityLogs']) {
  log(
    `activityLogController exports ${fn}`,
    actCtrl.includes(`export async function ${fn}`),
    actCtrl.includes(fn) ? 'found' : 'MISSING'
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(50));
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
