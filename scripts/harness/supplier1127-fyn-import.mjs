#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const importer = require('../operations/replace-supplier1127-fyn.cjs');

let passed = 0;
function test(name, fn) { try { fn(); passed += 1; console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; } }
async function asyncTest(name, fn) { try { await fn(); passed += 1; console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}: ${error.message}`); process.exitCode = 1; } }
function product(index) {
  const model = `FYN${Math.floor(index / 10) + 1}-${(index % 10) + 1}`;
  const base = `/uploads/suppliers/supplier-1127/fyn-20261014/${model.toLowerCase()}`;
  return { model, title: `石材 ${index}`, title_translated: `FYN Stone ${index}`, description: `中文来源描述 ${index}`, description_translated: `A full English stone description for sample ${index}.`, category: 'stone', image_url: `${base}/products/01.webp`, image_urls: [`${base}/products/01.webp`, `${base}/applications/01.webp`, `${base}/applications/02.webp`, `${base}/applications/03.webp`], specs: [{ label: 'Model', value: model }, { label: 'Collection', value: 'FYN Collection' }, { label: 'Material', value: 'Natural stone' }, { label: 'Color', value: 'White' }, { label: 'Display format', value: 'Full slab' }], certifications: [], application_scenes: [], sort_order: index, price: null, price_max: null, price_unit: null, price_currency: null, video_url: null };
}
function manifest() { return { supplier: { ...importer.TARGET }, products: Array.from({ length: 106 }, (_, index) => product(index)) }; }
function rejects(name, mutate) { test(name, () => { const data = manifest(); mutate(data); assert.throws(() => importer.validateManifest(data)); }); }
function memoryFs(events, backups = []) {
  return {
    existsSync: () => true,
    statSync: () => ({ size: 1 }),
    writeFileSync: (file, body, options) => { events.push('backup'); backups.push({ file, body, options }); },
  };
}
function memoryConnection(options = {}) {
  const columns = {
    supplier_profiles: ['id', 'slug', 'country', 'company_name'], supplier_products: ['id', ...importer.INSERT_COLUMNS],
    supplier_projects: ['id', 'supplier_profile_id'], supplier_catalogs: ['id', 'supplier_profile_id'],
    sourcing_requests: ['product_id'], partner_sync_products: ['mapped_product_id'], supplier_project_materials: ['supplier_product_id'],
  };
  const initialRows = options.targetRows || Array.from({ length: 193 }, (_, index) => ({ id: index + 1, supplier_profile_id: 242, title: `old ${index}` }));
  const dbRows = (rows) => options.jsonArrays ? rows.map((row) => {
    const copy = { ...row };
    for (const key of ['image_urls', 'specs', 'certifications', 'application_scenes']) if (typeof copy[key] === 'string') copy[key] = JSON.parse(copy[key]);
    return copy;
  }) : rows;
  const conn = {
    events: [], inserts: [], commits: 0, rollbacks: 0,
    state: { profile: { ...importer.TARGET }, targetRows: structuredClone(initialRows), projects: Array.from({ length: 6 }, (_, index) => ({ id: index + 1, supplier_profile_id: 242 })), catalogs: [{ id: 1, supplier_profile_id: 242 }], otherRows: [{ id: 900, supplier_profile_id: 9, title: 'other' }] },
    async beginTransaction() { this.before = structuredClone(this.state); this.events.push('begin'); },
    async commit() { this.commits += 1; this.events.push('commit'); this.before = null; },
    async rollback() { this.rollbacks += 1; this.events.push('rollback'); if (this.before) this.state = structuredClone(this.before); this.before = null; },
    async execute(sql, params = []) {
      if (sql.startsWith('SET TRANSACTION')) return [[]];
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return [columns[params[0]].map((COLUMN_NAME) => ({ COLUMN_NAME }))];
      if (sql.includes('COUNT(*) AS count')) { const table = sql.match(/FROM `([^`]+)`/)[1]; return [[{ count: options.references?.[table] || 0 }]]; }
      if (sql.includes('FROM `supplier_profiles`')) return [[this.state.profile]];
      if (sql.includes('FROM `supplier_projects`')) return [this.state.projects];
      if (sql.includes('FROM `supplier_catalogs`')) return [this.state.catalogs];
      if (sql.includes('FROM `supplier_products`')) return [dbRows(sql.includes('supplier_profile_id <>') ? this.state.otherRows : this.state.targetRows)];
      if (sql === importer.DELETE_SQL) { assert.deepEqual(params, [242]); this.events.push('delete:242'); this.state.targetRows = []; return [{ affectedRows: initialRows.length }]; }
      if (sql.startsWith('INSERT INTO supplier_products')) {
        this.inserts.push(params); this.events.push('insert');
        if (options.throwAtInsert === this.inserts.length) throw new Error('injected insert failure');
        const row = Object.fromEntries(importer.INSERT_COLUMNS.map((column, index) => [column, params[index]]));
        row.id = 1000 + this.inserts.length; this.state.targetRows.push(row);
        if (this.inserts.length === 106 && options.afterAllInserts) options.afterAllInserts(this.state);
        return [{ affectedRows: 1, insertId: row.id }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  return conn;
}

test('accepts the complete authorized manifest', () => assert.equal(importer.validateManifest(manifest()).products.length, 106));
rejects('rejects wrong supplier', (data) => { data.supplier.id = 241; });
rejects('rejects wrong country', (data) => { data.supplier.country = 'vn'; });
rejects('rejects wrong product count', (data) => { data.products.pop(); });
rejects('rejects duplicate models', (data) => { data.products[1].model = data.products[0].model; data.products[1].specs[0].value = data.products[0].model; });
test('accepts two source images when product and application coverage exist', () => { const data = manifest(); data.products[0].image_urls = [data.products[0].image_urls[0], data.products[0].image_urls[2]]; assert.doesNotThrow(() => importer.validateManifest(data)); });
rejects('rejects more than four source images', (data) => { data.products[0].image_urls.push('/uploads/suppliers/supplier-1127/fyn-20261014/fyn1-1/products/03.webp'); });
rejects('rejects a product missing an application image', (data) => { const base = data.products[0].image_urls[0].replace('/01.webp', ''); data.products[0].image_urls = [data.products[0].image_urls[0], `${base}/02.webp`]; });
test('accepts only the three authorized pending-application models', () => {
  for (const model of importer.PENDING_APPLICATION_MODELS) {
    const data = manifest(); const item = data.products[0]; const image = item.image_urls[0].replace(/fyn1-1/, model.toLowerCase());
    item.model = model; item.specs[0].value = model; item.image_url = image; item.image_urls = [image];
    item.description_translated = 'A full English stone description. Application images pending.';
    assert.doesNotThrow(() => importer.validateManifest(data));
  }
});
rejects('requires the pending notice for an authorized model without scenes', (data) => { const item = data.products[0]; const image = item.image_urls[0].replace(/fyn1-1/, 'fyn39-1'); item.model = 'FYN39-1'; item.specs[0].value = item.model; item.image_url = image; item.image_urls = [image]; });
rejects('rejects a path outside the approved upload tree', (data) => { data.products[0].image_urls[0] = '/uploads/suppliers/other/fyn.webp'; data.products[0].image_url = data.products[0].image_urls[0]; });
rejects('rejects traversal in paths', (data) => { data.products[0].image_urls[0] = '/uploads/suppliers/supplier-1127/fyn-20261014/fyn1-1/products/../01.webp'; data.products[0].image_url = data.products[0].image_urls[0]; });
rejects('rejects Chinese public translations', (data) => { data.products[0].title_translated = '中文'; });
rejects('rejects HTML public translations', (data) => { data.products[0].description_translated = '<b>unsafe</b>'; });
rejects('rejects numeric prices', (data) => { data.products[0].price = 42; });
rejects('rejects product videos', (data) => { data.products[0].video_url = 'https://example.com/v'; });
rejects('rejects Chinese public specification values', (data) => { data.products[0].specs[1].value = '中文系列'; });
rejects('rejects HTML in application scenes', (data) => { data.products[0].application_scenes = ['<script>bad</script>']; });
test('requires an expected SHA for apply', () => assert.throws(() => importer.parseArgs(['--manifest', '/tmp/a.json', '--apply'])));
test('keeps destructive SQL scoped to supplier 242 parameter', () => assert.equal(importer.DELETE_SQL, 'DELETE FROM supplier_products WHERE supplier_profile_id = ?'));
test('recognizes an intended dataset regardless of row order', () => { const data = manifest(); const rows = data.products.map(importer.intendedRow).reverse(); assert.equal(importer.isIntendedDataset(rows, data.products), true); });
test('rejects an idempotency candidate with duplicate Models', () => { const data = manifest(); const rows = data.products.map(importer.intendedRow); rows[105] = { ...rows[0] }; assert.equal(importer.isIntendedDataset(rows, data.products), false); });
test('requires non-empty four-cache variants for every source image', () => { const data = manifest(); const files = new Map(data.products.flatMap((item) => item.image_urls.flatMap(importer.assetVariantUrls).map((url) => [`/tarmeer/tarmeer_api/public${url}`, 1]))); const virtualFs = { existsSync: (file) => files.has(file), statSync: (file) => ({ size: files.get(file) }) }; assert.doesNotThrow(() => importer.assertAssets(data.products, virtualFs)); files.set(`/tarmeer/tarmeer_api/public${importer.assetVariantUrls(data.products[0].image_urls[0])[1]}`, 0); assert.throws(() => importer.assertAssets(data.products, virtualFs), /empty asset/); });
test('snapshot hash changes when unrelated product digest changes', () => { const base = { profile: { id: 242 }, oldProducts: [], projects: [], catalogs: [], references: {} }; const one = importer.sha256(importer.makeSnapshot({ ...base, otherProducts: [{ id: 1 }] })); const two = importer.sha256(importer.makeSnapshot({ ...base, otherProducts: [{ id: 2 }] })); assert.notEqual(one, two); });
test('snapshot hash includes database timestamp values', () => assert.notEqual(importer.sha256({ updated_at: new Date('2026-10-14T00:00:00.000Z') }), importer.sha256({ updated_at: new Date('2026-10-15T00:00:00.000Z') })));
await asyncTest('rolls back when database preflight fails', async () => {
  let rollbacks = 0;
  const conn = { beginTransaction: async () => {}, rollback: async () => { rollbacks += 1; }, execute: async (sql) => { if (sql.startsWith('SET TRANSACTION')) return [[]]; throw new Error('stub query failure'); } };
  await assert.rejects(() => importer.runImport({ conn, manifest: manifest(), apply: false }), /stub query failure/);
  assert.equal(rollbacks, 1);
});
await asyncTest('rejects a stale expected-before SHA after acquiring locks', async () => {
  const productColumns = [...importer.INSERT_COLUMNS, 'id'];
  const columns = { supplier_profiles: ['id', 'slug', 'country', 'company_name'], supplier_products: productColumns, supplier_projects: ['id', 'supplier_profile_id'], supplier_catalogs: ['id', 'supplier_profile_id'], sourcing_requests: ['product_id'], partner_sync_products: ['mapped_product_id'], supplier_project_materials: ['supplier_product_id'] };
  let rollbacks = 0;
  const conn = {
    beginTransaction: async () => {}, rollback: async () => { rollbacks += 1; },
    execute: async (sql, params = []) => {
      if (sql.startsWith('SET TRANSACTION')) return [[]];
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return [columns[params[0]].map((COLUMN_NAME) => ({ COLUMN_NAME }))];
      if (sql.includes('COUNT(*) AS count')) return [[{ count: 0 }]];
      if (sql.includes('FROM `supplier_profiles`')) return [[{ ...importer.TARGET }]];
      if (sql.includes('FROM `supplier_projects`')) return [[{ id: 1, supplier_profile_id: 242 }]];
      if (sql.includes('FROM `supplier_catalogs`')) return [[{ id: 1, supplier_profile_id: 242 }]];
      if (sql.includes('FROM `supplier_products`')) return [sql.includes('<>') ? [{ id: 900, supplier_profile_id: 9 }] : Array.from({ length: 193 }, (_, id) => ({ id: id + 1, supplier_profile_id: 242 }))];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
  await assert.rejects(() => importer.runImport({ conn, manifest: manifest(), apply: true, expectedBeforeSha: '0'.repeat(64) }), /Expected-before SHA/);
  assert.equal(rollbacks, 1);
});
await asyncTest('binds the expected-before SHA to the exact manifest', async () => {
  const conn = memoryConnection(); const events = []; const first = manifest();
  const dry = await importer.runImport({ conn, manifest: first, apply: false, fileSystem: memoryFs(events) });
  const changed = manifest(); changed.products[0].description_translated = 'A changed but valid English public description.';
  await assert.rejects(() => importer.runImport({ conn, manifest: changed, apply: true, expectedBeforeSha: dry.expected_before_sha, fileSystem: memoryFs(events) }), /Expected-before SHA/);
  assert(!conn.events.includes('delete:242'));
});
await asyncTest('executes scoped DELETE, 106 explicit inserts, verification, backup, and commit', async () => {
  const conn = memoryConnection(); const backups = []; const data = manifest();
  const dry = await importer.runImport({ conn, manifest: data, apply: false, fileSystem: memoryFs(conn.events, backups) });
  const result = await importer.runImport({ conn, manifest: data, apply: true, expectedBeforeSha: dry.expected_before_sha, fileSystem: memoryFs(conn.events, backups) });
  assert.equal(result.status, 'APPLY_PASS'); assert.equal(conn.inserts.length, 106); assert.equal(conn.commits, 1);
  assert.equal(conn.state.targetRows.length, 106); assert.equal(conn.state.targetRows.every((row) => row.supplier_profile_id === 242 && row.source === 'manual'), true);
  assert.equal(conn.inserts.every((params) => params[0] === 242 && params[importer.INSERT_COLUMNS.indexOf('source')] === 'manual'), true);
  assert.equal(backups.length, 1); assert.equal(backups[0].options.mode, 0o600); assert(conn.events.indexOf('backup') < conn.events.indexOf('delete:242'));
});
await asyncTest('rolls back and restores rows when an insert fails', async () => {
  const conn = memoryConnection({ throwAtInsert: 37 }); const events = []; const data = manifest(); const before = structuredClone(conn.state.targetRows);
  const dry = await importer.runImport({ conn, manifest: data, apply: false, fileSystem: memoryFs(events) });
  await assert.rejects(() => importer.runImport({ conn, manifest: data, apply: true, expectedBeforeSha: dry.expected_before_sha, fileSystem: memoryFs(events) }), /injected insert failure/);
  assert.equal(conn.commits, 0); assert.equal(conn.rollbacks >= 2, true); assert.deepEqual(conn.state.targetRows, before);
});
await asyncTest('blocks references before the scoped delete', async () => {
  const conn = memoryConnection({ references: { sourcing_requests: 1 } }); const events = [];
  await assert.rejects(() => importer.runImport({ conn, manifest: manifest(), apply: true, expectedBeforeSha: 'x', fileSystem: memoryFs(events) }), /old products are referenced/);
  assert(!conn.events.includes('delete:242'));
});
await asyncTest('makes an already imported identical manifest a no-op', async () => {
  const data = manifest(); const rows = data.products.map((item, index) => ({ id: index + 1, ...importer.intendedRow(item) })); const conn = memoryConnection({ targetRows: rows }); const events = [];
  const dry = await importer.runImport({ conn, manifest: data, apply: false, fileSystem: memoryFs(events) });
  const result = await importer.runImport({ conn, manifest: data, apply: true, expectedBeforeSha: dry.expected_before_sha, fileSystem: memoryFs(events) });
  assert.equal(result.status, 'NO_OP_ALREADY_APPLIED'); assert.equal(conn.inserts.length, 0); assert(!conn.events.includes('delete:242'));
});
await asyncTest('accepts mysql2 JSON arrays after apply and on idempotent reapply', async () => {
  const conn = memoryConnection({ jsonArrays: true }); const data = manifest(); const files = memoryFs([]);
  const dry = await importer.runImport({ conn, manifest: data, apply: false, fileSystem: files });
  const applied = await importer.runImport({ conn, manifest: data, apply: true, expectedBeforeSha: dry.expected_before_sha, fileSystem: files });
  assert.equal(applied.status, 'APPLY_PASS');
  const secondDry = await importer.runImport({ conn, manifest: data, apply: false, fileSystem: files });
  const noOp = await importer.runImport({ conn, manifest: data, apply: true, expectedBeforeSha: secondDry.expected_before_sha, fileSystem: files });
  assert.equal(noOp.status, 'NO_OP_ALREADY_APPLIED');
});
await asyncTest('rejects a missing cache variant before DELETE', async () => {
  const conn = memoryConnection(); const data = manifest(); const dry = await importer.runImport({ conn, manifest: data, apply: false, fileSystem: memoryFs([]) });
  const brokenFs = { existsSync: (file) => !file.endsWith('-thumb.webp'), statSync: () => ({ size: 1 }), writeFileSync: () => { throw new Error('backup must not be created'); } };
  await assert.rejects(() => importer.runImport({ conn, manifest: data, apply: true, expectedBeforeSha: dry.expected_before_sha, fileSystem: brokenFs }), /missing asset/);
  assert(!conn.events.includes('delete:242'));
});
for (const [label, expectedError, mutate] of [
  ['projects', /Projects changed/, (state) => { state.projects[0].id = 999; }],
  ['catalogs', /Catalogs changed/, (state) => { state.catalogs[0].id = 999; }],
  ['other supplier products', /Other suppliers products changed/, (state) => { state.otherRows[0].title = 'drifted'; }],
]) await asyncTest(`rolls back when protected ${label} drift after product writes`, async () => {
  const conn = memoryConnection({ afterAllInserts: mutate }); const events = []; const data = manifest(); const before = structuredClone(conn.state.targetRows);
  const dry = await importer.runImport({ conn, manifest: data, apply: false, fileSystem: memoryFs(events) });
  await assert.rejects(() => importer.runImport({ conn, manifest: data, apply: true, expectedBeforeSha: dry.expected_before_sha, fileSystem: memoryFs(events) }), expectedError);
  assert.equal(conn.commits, 0); assert.deepEqual(conn.state.targetRows, before);
});

if (!process.exitCode) console.log(`${passed}/37 PASS`);
