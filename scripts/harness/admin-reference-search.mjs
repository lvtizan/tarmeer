#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const databasePath = require.resolve('../../server/dist/config/database.js');
let queries = [];
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: { execute: async (sql, params) => {
  queries.push({ sql, params });
  return [sql.includes('FROM supplier_profiles') ? [{ id: params[0], name: 'Original Supplier Name' }] : [{ id: params[0], title: 'Original Product Title', supplierId: 162, supplierName: 'Original Supplier Name' }]];
} } } };
const controller = require('../../server/dist/controllers/adminReferenceSearchController.js');

let passed = 0;
async function test(name, fn) { try { await fn(); passed += 1; console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; } }
function response() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
function request(q, admin = { role: 'super_admin', country: 'ae' }, country = 'ae') { return { query: { q, country }, admin }; }

await test('parses only exact safe reference forms', () => {
  assert.deepEqual(controller.parseReferenceQuery('1943'), { type: 'both', id: 1943 });
  assert.deepEqual(controller.parseReferenceQuery('Supplier #162'), { type: 'supplier', id: 162 });
  assert.deepEqual(controller.parseReferenceQuery('product 1943'), { type: 'product', id: 1943 });
  for (const input of ['Stone name', '+971501234567', '1943 stone', '0', '-1', '9007199254740992']) assert.equal(controller.parseReferenceQuery(input), null);
});
await test('bare ID performs parameterized supplier and product lookup in selected super-admin country', async () => {
  queries = []; const res = response(); await controller.adminReferenceSearch(request('1943', { role: 'super_admin' }, 'vn'), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.suppliers[0].name, 'Original Supplier Name'); assert.equal(res.body.products[0].title, 'Original Product Title');
  assert.equal(queries.length, 2); assert.deepEqual(queries.map((query) => query.params), [[1943, 'vn'], [1943, 'vn']]);
  assert(queries.every((query) => query.sql.includes('= ?') && !query.sql.includes('1943')));
});
await test('prefixed IDs only query their requested entity', async () => {
  queries = []; let res = response(); await controller.adminReferenceSearch(request('Supplier 162'), res); assert.equal(queries.length, 1); assert.equal(res.body.products.length, 0);
  queries = []; res = response(); await controller.adminReferenceSearch(request('Product #1943'), res); assert.equal(queries.length, 1); assert.equal(res.body.suppliers.length, 0);
});
await test('normal names and phones return empty without database queries', async () => {
  queries = []; const res = response(); await controller.adminReferenceSearch(request('Original Supplier Name'), res);
  assert.deepEqual(res.body, { suppliers: [], products: [] }); assert.equal(queries.length, 0);
});
await test('enforces non-super-admin country and fails closed for invalid scope', async () => {
  queries = []; let res = response(); await controller.adminReferenceSearch(request('162', { role: 'sub_admin', country: 'ae' }, 'vn'), res); assert.equal(res.statusCode, 403); assert.equal(queries.length, 0);
  res = response(); await controller.adminReferenceSearch(request('162', { role: 'sub_admin', country: 'xx' }, 'xx'), res); assert.equal(res.statusCode, 403);
  res = response(); await controller.adminReferenceSearch(request('162', { role: 'super_admin' }, 'xx'), res); assert.equal(res.statusCode, 403);
  res = response(); await controller.adminReferenceSearch(request('162', { role: 'super_admin' }, 'sa'), res); assert.equal(res.statusCode, 403);
});
await test('non-super staff use authenticated VN or SA scope without a UI country', async () => {
  for (const country of ['vn', 'sa']) {
    queries = []; const res = response();
    await controller.adminReferenceSearch({query:{q:'Product 1943'},admin:{role:'sub_admin',country}},res);
    assert.equal(res.statusCode,200);assert.deepEqual(queries[0].params,[1943,country]);
  }
});
await test('route is protected and supplier-only admins can reach its permission gate', () => {
  const route = fs.readFileSync(path.join(root, 'server/dist/routes/admin.js'), 'utf8');
  const protectedStart = route.indexOf('router.use(adminAuth_1.requireAdmin);');
  const endpoint = route.indexOf("router.get('/reference-search', (0, adminAuth_1.requirePermission)('can_view_suppliers')");
  assert(protectedStart >= 0 && endpoint > protectedStart); assert(route.includes("req.path === '/reference-search'"));
});

if (!process.exitCode) console.log(`${passed}/${passed} PASS`);
