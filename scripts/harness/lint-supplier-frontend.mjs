#!/usr/bin/env node
/**
 * lint-supplier-frontend.mjs
 *
 * Source-level checks for supplier-related frontend components.
 * Verifies that components are imported, routes registered, and nav entries live.
 * Fast — no server, no browser needed.
 *
 * Usage:
 *   node scripts/harness/lint-supplier-frontend.mjs
 *
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

// ── 1. HomePage — HomeSupplierSection present ──────────────────────────────
const homePage = read('src/pages/HomePage.tsx');

log(
  'HomePage imports HomeSupplierSection',
  homePage.includes("import HomeSupplierSection from '../components/home/HomeSupplierSection'"),
  homePage.includes('HomeSupplierSection') ? 'import found' : 'MISSING import'
);

log(
  'HomePage renders <HomeSupplierSection />',
  homePage.includes('<HomeSupplierSection />'),
  homePage.includes('<HomeSupplierSection />') ? 'JSX found' : 'MISSING JSX'
);

// ── 2. HomeSupplierSection — no Chinese badge text ─────────────────────────
const supplierSection = read('src/components/home/HomeSupplierSection.tsx');

log(
  'HomeSupplierSection badge is not Chinese (中国)',
  !supplierSection.includes('中国'),
  supplierSection.includes('中国') ? 'FOUND Chinese "中国" — must be English' : 'clean'
);

log(
  'HomeSupplierSection link uses /materials/suppliers/:slug',
  supplierSection.includes('/materials/suppliers/'),
  supplierSection.includes('/materials/suppliers/') ? 'link OK' : 'MISSING correct link path'
);

// ── 3. Navbar — Materials link active (not commented out) ──────────────────
const navbar = read('src/components/Navbar.tsx');

const desktopCommented = navbar.includes("{/* {renderNavLink('/materials', 'Materials')}");
const mobileCommented  = navbar.includes("{/* {renderNavLink('/materials', 'Materials', 'py-2')}");
const desktopActive    = navbar.includes("renderNavLink('/materials', 'Materials')") && !desktopCommented;
const mobileActive     = navbar.includes("renderNavLink('/materials', 'Materials', 'py-2')") && !mobileCommented;

log(
  'Navbar desktop Materials link is active',
  desktopActive,
  desktopCommented ? 'STILL COMMENTED OUT' : (desktopActive ? 'active' : 'not found')
);

log(
  'Navbar mobile Materials link is active',
  mobileActive,
  mobileCommented ? 'STILL COMMENTED OUT' : (mobileActive ? 'active' : 'not found')
);

// ── 4. App.tsx — supplier routes registered ────────────────────────────────
const app = read('src/App.tsx');

log(
  'App.tsx has /materials/suppliers/:slug route',
  app.includes("path=\"/materials/suppliers/:slug\""),
  app.includes('/materials/suppliers/:slug') ? 'route found' : 'MISSING route'
);

log(
  'App.tsx imports AdminSuppliersPage',
  app.includes('AdminSuppliersPage'),
  app.includes('AdminSuppliersPage') ? 'found' : 'MISSING'
);

// ── 5. supplierProfileController — sort_order in ORDER BY ─────────────────
const supplierCtrl = read('server/src/controllers/supplierProfileController.ts');

log(
  'supplierProfileController uses sort_order in ORDER BY',
  supplierCtrl.includes('sort_order'),
  supplierCtrl.includes('sort_order') ? 'found' : 'MISSING — suppliers may not sort correctly'
);

// ── 6. No Chinese text in public-facing home components ───────────────────
const publicComponents = [
  'src/pages/HomePage.tsx',
  'src/components/home/Banner.tsx',
  'src/components/home/HomeDesignSection.tsx',
  'src/components/home/HomeSupplierSection.tsx',
  'src/components/Navbar.tsx',
];

const chineseRegex = /[\u4e00-\u9fff]/;
for (const rel of publicComponents) {
  const src = read(rel);
  // Allow Chinese in comments only — strip comments before checking
  const noComments = src
    .replace(/\/\/[^\n]*/g, '')           // line comments
    .replace(/\/\*[\s\S]*?\*\//g, '');    // block comments
  const hasChinese = chineseRegex.test(noComments);
  log(
    `No Chinese in ${path.basename(rel)} (non-comment)`,
    !hasChinese,
    hasChinese ? 'FOUND Chinese characters in source code' : 'clean'
  );
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(50));
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
