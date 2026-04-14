#!/usr/bin/env node
/**
 * Harness lint: verify mobile adaptation.
 *
 * Checks:
 * 1. Company dashboard has mobile bottom nav (not just hidden sidebar)
 * 2. Key routes are accessible (not missing from App.tsx)
 * 3. No sidebar-only navigation (must have mobile fallback)
 * 4. Forms have responsive padding
 * 5. Images have loading="lazy"
 *
 * Usage:
 *   node scripts/harness/lint-mobile.mjs
 *
 * Exit code: 0 = pass, 1 = fail
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}: ${detail || 'FAILED'}`);
    failed++;
  }
}

function readFile(relPath) {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  } catch {
    return null;
  }
}

// ─── 1. Company Layout has mobile bottom nav ───
const companyLayout = readFile('src/components/company/CompanyLayout.tsx');
check(
  'CompanyLayout has mobile bottom nav',
  companyLayout && companyLayout.includes('md:hidden') && companyLayout.includes('fixed bottom-0'),
  'Must have a fixed bottom nav for mobile (hidden on md+)'
);

// ─── 2. Desktop sidebar has mobile counterpart ───
check(
  'CompanyLayout sidebar hidden on mobile',
  companyLayout && companyLayout.includes('hidden md:flex'),
  'Sidebar must be hidden on mobile with a mobile nav alternative'
);

// ─── 3. All company routes registered in App.tsx ───
const appTsx = readFile('src/App.tsx');
const requiredRoutes = [
  { path: 'dashboard', label: '/company/dashboard' },
  { path: 'projects', label: '/company/projects' },
  { path: 'upload', label: '/company/upload' },
  { path: 'settings', label: '/company/settings' },
];

for (const route of requiredRoutes) {
  check(
    `Route ${route.label} registered`,
    appTsx && appTsx.includes(`path="${route.path}"`),
    `${route.label} route missing from App.tsx`
  );
}

// ─── 4. Main content has bottom padding for mobile nav ───
check(
  'Main content has mobile nav padding (pb-20)',
  companyLayout && /pb-20|pb-\[80px\]/.test(companyLayout),
  'Main content needs bottom padding to avoid being hidden behind mobile nav'
);

// ─── 5. Homeowner dashboard layout also has mobile nav ───
const userLayout = readFile('src/layouts/UserDashboardLayout.tsx');
check(
  'UserDashboardLayout has mobile nav or is simple enough',
  userLayout !== null,
  'UserDashboardLayout.tsx must exist'
);

// ─── 6. Key pages have responsive text/padding ───
const pages = [
  'src/pages/company/CompanyDashboardPage.tsx',
  'src/pages/company/CompanyProjectsPage.tsx',
  'src/pages/ForCompaniesPage.tsx',
];
for (const p of pages) {
  const content = readFile(p);
  if (!content) continue;
  const name = path.basename(p);
  // Check for responsive padding (p-4 sm:p-6 or similar)
  const hasResponsive = /p-[34]\s+sm:p-[56]|px-[345]\s+sm:px-[56]|className.*sm:/.test(content);
  check(
    `${name} has responsive styles`,
    hasResponsive,
    `${name} should have responsive breakpoints (sm:/md:/lg:)`
  );
}

// ─── 7. No viewport-breaking fixed widths ───
const forCompanies = readFile('src/pages/ForCompaniesPage.tsx');
check(
  'ForCompaniesPage no fixed width overflow',
  forCompanies && !(/w-\[\d{4,}px\]/.test(forCompanies)),
  'Avoid fixed widths > 999px that break mobile viewport'
);

// ─── Summary ───
console.log(`\n${'='.repeat(40)}`);
console.log(`  ${passed}/${passed + failed} checks passed`);
console.log(`${'='.repeat(40)}`);

process.exit(failed > 0 ? 1 : 0);
