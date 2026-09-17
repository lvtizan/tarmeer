import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { maskSupplierValue } = require('../../server/dist/lib/supplierRedact.js');

const masked = maskSupplierValue(
  [{ label: '系列', value: 'Acme Stone 系列' }, 'Acme Stone certified'],
  'Acme Stone',
  '艾克米石材',
);
assert.deepEqual(masked, [
  { label: '系列', value: 'our supplier 系列' },
  'our supplier certified',
]);

const [profileController, productController, projectController, supplierPage] = await Promise.all([
  readFile(new URL('../../server/dist/controllers/supplierProfileController.js', import.meta.url), 'utf8'),
  readFile(new URL('../../server/dist/controllers/supplierProductController.js', import.meta.url), 'utf8'),
  readFile(new URL('../../server/dist/controllers/supplierProjectController.js', import.meta.url), 'utf8'),
  readFile(new URL('../../src/app/materials/suppliers/[slug]/page.tsx', import.meta.url), 'utf8'),
]);

for (const field of ['title_translated', 'description_translated', 'specs', 'certifications', 'application_scenes']) {
  assert.match(profileController, new RegExp(`${field}: supplierRedact_1\\.maskSupplierValue\\(p\\.${field}`));
}
assert.match(productController, /title_translated:\s*__mask\(p\.title_translated\)/);
assert.match(productController, /description_translated:\s*__mask\(p\.description_translated\)/);
assert.match(projectController, /SELECT id, company_name, name_zh FROM supplier_profiles/);
assert.match(projectController, /maskSupplierValue\(p\.title, realName, profile\.name_zh\)/);
assert.match(projectController, /maskSupplierValue\(p\.description, realName, profile\.name_zh\)/);
assert.doesNotMatch(productController, /const maskArr =/);
assert.doesNotMatch(supplierPage, /supplier\.description\.slice/);
assert.doesNotMatch(supplierPage, /<p>\{supplier\.description\}<\/p>/);

console.log('supplier-public-redaction: 14/14 PASS');
