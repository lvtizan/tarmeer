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
const hubProductCard = read('src/components/materials/HubProductCard.tsx');

check(
  'admin forgot password uses the admin reset endpoint',
  adminForgot.includes('adminApi.forgotPassword') &&
    adminForgot.includes('setError(\'Failed to send reset email.\')') &&
    !adminForgot.includes('err instanceof Error ? err.message') &&
    !adminForgot.includes("fetch('/api/auth/forgot-password'") &&
    !adminForgot.includes('fetch("/api/auth/forgot-password"'),
);

check('hub product card validates supplier slugs before linking',
  /function isValidSupplierSlug\(slug: string \| null\): slug is string/.test(hubProductCard) &&
    /isValidSupplierSlug\(product\.supplier_slug\)/.test(hubProductCard));

check(
  'shared product card uses a full-card supplier link when supplier_slug exists',
  /if\s*\(supplierSlug\)\s*\{[\s\S]{0,500}<Link[\s\S]{0,220}href=\{supplierFromProductsHref\(supplierSlug\)\}/.test(hubProductCard) &&
    !hubProductCard.includes("href={product.supplier_slug ? `/materials/suppliers/${product.supplier_slug}` : '#'}"),
);

check(
  'shared product card does not contain nested supplier links',
  (hubProductCard.match(/<Link/g) || []).length === 1,
);

check(
  'popular product cards use the shared card implementation',
  /import HubProductCard from ['"]\.\/HubProductCard['"]/.test(hubFeatured) &&
    /<HubProductCard key=\{product\.id\} product=\{product\}/.test(hubFeatured),
);

check(
  'search product cards use the shared card implementation',
  /import HubProductCard from ['"]\.\/HubProductCard['"]/.test(hubSearchResults) &&
    /<HubProductCard key=\{product\.id\} product=\{product\}/.test(hubSearchResults),
);

check(
  'shared product card has safe title and stable metadata slots',
  /product\.title\?\.trim\(\) \|\| 'Material'/.test(hubProductCard) &&
    /className="min-h-6 min-w-0 overflow-hidden \[&>p\]:truncate"/.test(hubProductCard) &&
    /flex min-h-5 min-w-0/.test(hubProductCard),
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
