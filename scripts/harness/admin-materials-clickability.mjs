#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');

const checks = [];
const check = (label, condition) => checks.push({ label, condition: Boolean(condition) });

const adminForgot = read('src/app/admin/forgot-password/page.tsx');
const hubFeatured = read('src/components/materials/HubFeatured.tsx');
const hubSearchResults = read('src/components/materials/HubSearchResults.tsx');

check(
  'admin forgot password uses the admin reset endpoint',
  adminForgot.includes('adminApi.forgotPassword') &&
    adminForgot.includes('setError(\'Failed to send reset email.\')') &&
    !adminForgot.includes('err instanceof Error ? err.message') &&
    !adminForgot.includes("fetch('/api/auth/forgot-password'") &&
    !adminForgot.includes('fetch("/api/auth/forgot-password"'),
);

check(
  'popular product cards validate supplier slugs before linking',
  /function isValidSupplierSlug\(slug: string \| null\): slug is string/.test(hubFeatured) &&
    /isValidSupplierSlug\(p\.supplier_slug\)/.test(hubFeatured),
);

check(
  'popular product cards use a full-card supplier link when supplier_slug exists',
  /if\s*\(supplierSlug\)\s*\{[\s\S]{0,500}<Link[\s\S]{0,220}href=\{`\/materials\/suppliers\/\$\{supplierSlug\}`\}/.test(hubFeatured) &&
    !hubFeatured.includes("href={p.supplier_slug ? `/materials/suppliers/${p.supplier_slug}` : '#'}"),
);

check(
  'popular product cards do not contain nested supplier links',
  !/href=\{`\/materials\/suppliers\/\$\{supplierSlug\}`\}[\s\S]{0,900}<Link/.test(hubFeatured),
);

check(
  'search product cards validate supplier slugs before linking',
  /function isValidSupplierSlug\(slug: string \| null\): slug is string/.test(hubSearchResults) &&
    /isValidSupplierSlug\(r\.supplier_slug\)/.test(hubSearchResults),
);

check(
  'search product cards use a full-card supplier link when supplier_slug exists',
  /if\s*\(supplierSlug\)\s*\{[\s\S]{0,500}<Link[\s\S]{0,220}href=\{`\/materials\/suppliers\/\$\{supplierSlug\}`\}/.test(hubSearchResults),
);

check(
  'search product cards do not contain nested supplier links',
  !/href=\{`\/materials\/suppliers\/\$\{r\.supplier_slug\}`\}/.test(hubSearchResults),
);

let passed = 0;
for (const item of checks) {
  if (item.condition) {
    passed++;
    console.log(`✓ ${item.label}`);
  } else {
    console.error(`✗ ${item.label}`);
  }
}

console.log(`\nadmin-materials-clickability: ${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);
