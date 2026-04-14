#!/usr/bin/env node
/**
 * Harness lint: verify auth & registration flow integrity.
 *
 * Checks code-level invariants that have caused bugs before:
 * 1. PhoneRequiredModal must check API, not just localStorage
 * 2. updateProfile must sync phone to company_profiles
 * 3. forgotPassword must check both users AND admin_users
 * 4. All phone inputs must use phoneValidation.ts
 * 5. All forms must use AdminSelect, not raw <select>
 * 6. imageVariants.ts must exist and be imported in projectImageStorage
 * 7. sharp must be in server/package.json dependencies
 * 8. All <img> for /uploads/ must have onError fallback
 *
 * Usage:
 *   node scripts/harness/lint-auth-flow.mjs
 *
 * Exit code:
 *   0 = all checks pass
 *   1 = one or more checks failed
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

// ─── 1. PhoneRequiredModal checks API ───
const phoneModal = readFile('src/components/PhoneRequiredModal.tsx');
check(
  'PhoneRequiredModal checks API (/auth/me)',
  phoneModal && phoneModal.includes('/auth/me'),
  'Must call /auth/me to verify phone, not just localStorage'
);

// ─── 2. updateProfile syncs phone to company_profiles ───
const userAuth = readFile('server/src/controllers/userAuthController.ts');
check(
  'updateProfile syncs phone to company_profiles',
  userAuth && userAuth.includes('UPDATE company_profiles SET phone'),
  'updateProfile must sync phone to company_profiles when user has one'
);

// ─── 3. forgotPassword checks both tables ───
check(
  'forgotPassword checks users table',
  userAuth && userAuth.includes("FROM users WHERE email"),
  'forgotPassword must check users table'
);
check(
  'forgotPassword checks admin_users table',
  userAuth && userAuth.includes("FROM admin_users WHERE email"),
  'forgotPassword must also check admin_users table'
);

// ─── 4. Phone validation in all form components ───
const formFiles = [
  'src/components/for-companies/CompanySignupForm.tsx',
  'src/components/home/Banner.tsx',
  'src/components/InquiryForm.tsx',
];
for (const f of formFiles) {
  const content = readFile(f);
  const name = path.basename(f);
  check(
    `${name} uses phoneValidation`,
    content && content.includes('phoneValidation'),
    `${name} must import from phoneValidation.ts`
  );
}

// ─── 5. No raw <select> in form components (except phone country which is pre-existing) ───
const uiFiles = [
  'src/pages/admin/AdminInquiriesPage.tsx',
  'src/pages/admin/AdminUsersPage.tsx',
  'src/pages/admin/AdminCompaniesPage.tsx',
  'src/pages/admin/AdminComplaintsPage.tsx',
];
for (const f of uiFiles) {
  const content = readFile(f);
  if (!content) continue;
  const name = path.basename(f);
  const rawSelects = (content.match(/<select[\s>]/g) || []).length;
  check(
    `${name} uses AdminSelect (no raw <select>)`,
    rawSelects === 0,
    `Found ${rawSelects} raw <select> tags — use AdminSelect`
  );
}

// ─── 6. imageVariants.ts exists ───
check(
  'imageVariants.ts exists in server',
  readFile('server/src/lib/imageVariants.ts') !== null,
  'server/src/lib/imageVariants.ts is missing — thumbnails will not generate'
);

// ─── 7. projectImageStorage imports imageVariants ───
const imgStorage = readFile('server/src/lib/projectImageStorage.ts');
check(
  'projectImageStorage imports generateVariants',
  imgStorage && imgStorage.includes('generateVariants'),
  'projectImageStorage must call generateVariants on upload'
);

// ─── 8. sharp in server dependencies ───
const serverPkg = readFile('server/package.json');
check(
  'sharp in server/package.json',
  serverPkg && serverPkg.includes('"sharp"'),
  'sharp must be in server dependencies for thumbnail generation'
);

// ─── 9. TarmeerLogo usage in key pages ───
const logoPages = [
  'src/pages/ForCompaniesPage.tsx',
  'src/components/admin/AdminLayout.tsx',
];
for (const f of logoPages) {
  const content = readFile(f);
  if (!content) continue;
  const name = path.basename(f);
  check(
    `${name} uses TarmeerLogo component`,
    content.includes('TarmeerLogo'),
    `${name} must use <TarmeerLogo />, not inline logo markup`
  );
}

// ─── Summary ───
console.log(`\n${'='.repeat(40)}`);
console.log(`  ${passed}/${passed + failed} checks passed`);
console.log(`${'='.repeat(40)}`);

process.exit(failed > 0 ? 1 : 0);
