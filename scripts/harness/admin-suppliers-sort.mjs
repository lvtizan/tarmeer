#!/usr/bin/env node
/**
 * Regression guard for /admin/suppliers sorting.
 *
 * The supplier list is intentionally loaded in one large page for admin export
 * workflows. Sorting that list must be a memoized derived value with null-safe
 * text/date helpers; otherwise one click on the time headers can trigger a
 * fragile full render or crash when legacy rows contain odd values.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const page = readFileSync(path.join(ROOT, 'src/app/admin/suppliers/page.tsx'), 'utf8');

let pass = 0;
let fail = 0;

function ok(label) {
  console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  pass++;
}

function ng(label, detail) {
  console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ''}`);
  fail++;
}

function check(label, condition, detail) {
  condition ? ok(label) : ng(label, detail);
}

console.log('\n[admin/suppliers] sort stability');

check(
  'uses memoized visibleSuppliers for filtering/sorting',
  /useMemo/.test(page) && /const\s+visibleSuppliers\s*=\s*useMemo/.test(page),
  'sorting should not run as an inline render IIFE',
);

check(
  'date comparisons use a null-safe sortable timestamp helper',
  /function\s+supplierSortTime/.test(page) && /Number\.isFinite/.test(page),
  'invalid or missing dates must not produce fragile Date comparator values',
);

check(
  'search/filter text is normalized before lowercasing',
  /function\s+supplierSearchText/.test(page) && !/s\.company_name\.toLowerCase\(\)/.test(page),
  'legacy null names/emails must not crash filtering after a sort re-render',
);

check(
  'fetch failures render an explicit admin error state',
  /const\s+\[loadError,\s*setLoadError\]/.test(page) && /setLoadError\([^)]/.test(page),
  'admin fetch errors must not be swallowed into a blank/empty state',
);

check(
  'tbody maps the memoized list directly',
  /visibleSuppliers\.map\(s\s*=>/.test(page),
  'table should render the guarded derived list',
);

const total = pass + fail;
console.log(`\n${'─'.repeat(40)}`);
if (fail === 0) {
  console.log(`\x1b[32m All ${total} checks passed\x1b[0m`);
} else {
  console.log(`\x1b[31m ${fail}/${total} checks FAILED\x1b[0m`);
  process.exit(1);
}
