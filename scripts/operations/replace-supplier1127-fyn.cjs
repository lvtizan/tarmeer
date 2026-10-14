#!/usr/bin/env node
'use strict';

/*
 * Replaces only supplier #242's product rows with the reviewed FYN manifest.
 * Run on production through SSH:
 *   APP_ROOT=/tarmeer/tarmeer_api node replace-supplier1127-fyn.cjs --manifest /tmp/fyn.json
 * Then rerun with --apply --expected-before-sha <sha printed by the dry run>.
 * No files are deleted by this script.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const TARGET = Object.freeze({ id: 242, slug: 'supplier-1127', country: 'ae', company_name: 'Guangdong Quanshi Stone Supply Chain Management Co., Ltd.' });
const EXPECTED_PRODUCTS = 106;
const EXPECTED_OLD_PRODUCTS = 193;
const PENDING_APPLICATION_MODELS = new Set(['FYN39-1', 'FYN44-2', 'FYN60-1']);
const UPLOAD_PREFIX = '/uploads/suppliers/supplier-1127/fyn-20261014/';
const SERVER_UPLOAD_ROOT = '/tarmeer/tarmeer_api/public';
const INSERT_COLUMNS = Object.freeze(['supplier_profile_id', 'title', 'description', 'category', 'image_url', 'image_urls', 'video_url', 'sort_order', 'price', 'price_max', 'price_unit', 'price_currency', 'price_from', 'source', 'title_translated', 'description_translated', 'specs', 'certifications', 'application_scenes']);
const DELETE_SQL = 'DELETE FROM supplier_products WHERE supplier_profile_id = ?';
const REQUIRED_REFERENCE_COLUMNS = Object.freeze([
  ['sourcing_requests', 'product_id'],
  ['partner_sync_products', 'mapped_product_id'],
  ['supplier_project_materials', 'supplier_product_id'],
]);

function sha256(value) { return crypto.createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex'); }
function stableJson(value) {
  if (value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Buffer.isBuffer(value)) return JSON.stringify({ buffer_base64: value.toString('base64') });
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function q(identifier) {
  assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier), `Unsafe SQL identifier: ${identifier}`);
  return `\`${identifier}\``;
}
function parseArgs(argv) {
  const args = { apply: false, localTest: false, manifest: null, expectedBeforeSha: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--local-test') args.localTest = true;
    else if (arg === '--manifest') args.manifest = argv[++i];
    else if (arg === '--expected-before-sha') args.expectedBeforeSha = argv[++i];
    else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  if (!args.manifest) throw new Error('--manifest is required');
  if (args.apply && !args.expectedBeforeSha) throw new Error('--apply requires --expected-before-sha from an immediately preceding dry run');
  return args;
}
function isEnglishPublic(value) { return typeof value === 'string' && value.trim() && !/[\u3400-\u9fff\uf900-\ufaff]/u.test(value) && !/[<>]/.test(value); }
function validateUploadUrl(value, model, kind) {
  assert.equal(typeof value, 'string', `${model}: ${kind} URL must be a string`);
  assert(value.startsWith(UPLOAD_PREFIX), `${model}: ${kind} URL must stay under the FYN upload prefix`);
  assert(!value.includes('..') && !value.includes('\\') && !/[?#]/.test(value), `${model}: unsafe ${kind} URL`);
  assert(/^\/uploads\/suppliers\/supplier-1127\/fyn-20261014\/fyn\d+-\d+\/(products|applications)\/\d{2}\.webp$/.test(value), `${model}: invalid ${kind} URL format`);
  assert(value.includes(`/${model.toLowerCase()}/`), `${model}: URL must use its lowercase model directory`);
}
function validateManifest(manifest) {
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'Manifest must be an object');
  assert.deepEqual(manifest.supplier, TARGET, 'Manifest supplier must exactly match the authorized supplier');
  assert(Array.isArray(manifest.products) && manifest.products.length === EXPECTED_PRODUCTS, `Manifest must contain exactly ${EXPECTED_PRODUCTS} products`);
  const seen = new Set();
  manifest.products.forEach((product, index) => {
    const where = `products[${index}]`;
    assert(product && typeof product === 'object', `${where} must be an object`);
    assert(/^FYN\d+-\d+$/.test(product.model || ''), `${where}: model must be FYNx-y`);
    assert(!seen.has(product.model), `${where}: duplicate model ${product.model}`); seen.add(product.model);
    assert(typeof product.title === 'string' && product.title.trim(), `${product.model}: title is required`);
    assert(isEnglishPublic(product.title_translated), `${product.model}: title_translated must be English text without HTML/CJK`);
    assert(typeof product.description === 'string' && product.description.trim(), `${product.model}: description is required`);
    assert(isEnglishPublic(product.description_translated), `${product.model}: description_translated must be English text without HTML/CJK`);
    assert.equal(product.category, 'stone', `${product.model}: category must be stone`);
    assert(Array.isArray(product.image_urls), `${product.model}: image_urls must be an array`);
    product.image_urls.forEach((url) => validateUploadUrl(url, product.model, 'image'));
    assert.equal(new Set(product.image_urls).size, product.image_urls.length, `${product.model}: image URLs must be unique`);
    assert.equal(product.image_url, product.image_urls[0], `${product.model}: image_url must be the first product image`);
    assert(product.image_url.includes('/products/'), `${product.model}: image_url must be a product image`);
    const productImages = product.image_urls.filter((url) => url.includes('/products/'));
    const applicationImages = product.image_urls.filter((url) => url.includes('/applications/'));
    assert.equal(productImages.length, 1, `${product.model}: exactly one product image is required`);
    if (applicationImages.length === 0) {
      assert(PENDING_APPLICATION_MODELS.has(product.model), `${product.model}: 1–3 application images are required`);
      assert(/application images pending/i.test(product.description_translated), `${product.model}: pending application images require the public pending notice`);
      assert.equal(product.image_urls.length, 1, `${product.model}: pending application images may only retain the product image`);
    } else {
      assert(product.image_urls.length >= 2 && product.image_urls.length <= 4, `${product.model}: image_urls must contain 2–4 source images`);
      assert(applicationImages.length >= 1 && applicationImages.length <= 3, `${product.model}: 1–3 application images are required`);
    }
    assert(Array.isArray(product.specs), `${product.model}: specs must be an array`);
    assert(product.specs.every((item) => item && typeof item === 'object' && isEnglishPublic(item.label) && isEnglishPublic(item.value)), `${product.model}: spec labels and values must be public English strings without HTML/CJK`);
    assert.equal(new Set(product.specs.map((item) => item.label)).size, product.specs.length, `${product.model}: spec labels must be unique`);
    const specs = Object.fromEntries(product.specs.map((item) => [item && item.label, item && item.value]));
    assert.equal(specs.Model, product.model, `${product.model}: specs Model must exactly equal model`);
    for (const key of ['Collection', 'Material', 'Color', 'Display format']) assert(typeof specs[key] === 'string' && specs[key].trim(), `${product.model}: missing ${key} spec`);
    assert.equal(specs['Display format'], 'Full slab', `${product.model}: Display format must be Full slab`);
    for (const key of ['certifications', 'application_scenes']) {
      assert(Array.isArray(product[key]), `${product.model}: ${key} must be an array`);
      assert(product[key].every(isEnglishPublic), `${product.model}: ${key} must contain only public English strings without HTML/CJK`);
    }
    assert(Number.isInteger(product.sort_order) && product.sort_order >= 0, `${product.model}: sort_order must be a non-negative integer`);
    for (const key of ['price', 'price_max', 'price_unit', 'price_currency', 'video_url']) assert.equal(product[key], null, `${product.model}: ${key} must be null`);
  });
  return manifest;
}
function intendedRow(product) {
  return {
    supplier_profile_id: TARGET.id, title: product.title, description: product.description, category: 'stone', image_url: product.image_url,
    image_urls: JSON.stringify(product.image_urls), video_url: null, sort_order: product.sort_order, price: null, price_max: null, price_unit: null,
    price_currency: null, price_from: 0, source: 'manual', title_translated: product.title_translated, description_translated: product.description_translated,
    specs: JSON.stringify(product.specs), certifications: JSON.stringify(product.certifications), application_scenes: JSON.stringify(product.application_scenes),
  };
}
function normalizeDbValue(column, value) {
  if (['image_urls', 'specs', 'certifications', 'application_scenes'].includes(column) && typeof value === 'string') return JSON.parse(value);
  return value == null ? null : value;
}
function isIntendedDataset(rows, products) {
  if (rows.length !== products.length) return false;
  const byModel = new Map(products.map((product) => [product.model, intendedRow(product)]));
  const actualModels = new Set();
  const everyRowMatches = rows.every((row) => {
    const actualSpecs = typeof row.specs === 'string' ? JSON.parse(row.specs) : row.specs;
    const model = (actualSpecs || []).find((entry) => entry.label === 'Model')?.value;
    const intended = byModel.get(model);
    if (!model || actualModels.has(model)) return false;
    actualModels.add(model);
    return intended && INSERT_COLUMNS.every((column) => stableJson(normalizeDbValue(column, row[column])) === stableJson(normalizeDbValue(column, intended[column])));
  });
  return everyRowMatches && actualModels.size === byModel.size && [...byModel.keys()].every((model) => actualModels.has(model));
}
function assetVariantUrls(url) {
  assert(url.endsWith('.webp'), `Expected WebP asset URL: ${url}`);
  const base = url.slice(0, -'.webp'.length);
  return [`${base}-blur.webp`, `${base}-thumb.webp`, `${base}-medium.webp`, url];
}
function assertAssets(products, fileSystem = fs) {
  for (const product of products) for (const url of product.image_urls) {
    for (const variantUrl of assetVariantUrls(url)) {
      const absolute = path.join(SERVER_UPLOAD_ROOT, variantUrl.replace(/^\/uploads\//, 'uploads/'));
      assert(fileSystem.existsSync(absolute), `${product.model}: missing asset ${variantUrl}`);
      assert(fileSystem.statSync(absolute).size > 0, `${product.model}: empty asset ${variantUrl}`);
    }
  }
}
function makeSnapshot({ profile, oldProducts, projects, catalogs, otherProducts, references }) {
  return {
    target: TARGET, profile, old_products_sha256: sha256(oldProducts), old_product_count: oldProducts.length,
    projects_sha256: sha256(projects), project_count: projects.length, catalogs_sha256: sha256(catalogs), catalog_count: catalogs.length,
    other_suppliers_products_sha256: sha256(otherProducts), other_supplier_product_count: otherProducts.length, references,
  };
}
async function tableColumns(conn, table) {
  const [rows] = await conn.execute('SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION', [table]);
  assert(rows.length, `Required table missing: ${table}`); return rows.map((row) => row.COLUMN_NAME);
}
async function selectAll(conn, table, whereSql = '', params = [], lock = false) {
  const columns = await tableColumns(conn, table);
  assert(columns.includes('id'), `Required stable id missing from ${table}`);
  const sql = `SELECT ${columns.map(q).join(', ')} FROM ${q(table)}${whereSql ? ` WHERE ${whereSql}` : ''} ORDER BY \`id\` ASC${lock ? ' FOR UPDATE' : ''}`;
  const [rows] = await conn.execute(sql, params); return rows;
}
async function referenceCounts(conn, ids) {
  const counts = {};
  for (const [table, column] of REQUIRED_REFERENCE_COLUMNS) {
    const columns = await tableColumns(conn, table); assert(columns.includes(column), `Required reference column missing: ${table}.${column}`);
    const [rows] = await conn.execute(`SELECT COUNT(*) AS count FROM ${q(table)} WHERE ${q(column)} IN (${ids.map(() => '?').join(',')})`, ids);
    counts[`${table}.${column}`] = Number(rows[0].count);
  }
  assert(Object.values(counts).every((count) => count === 0), `Refusing replacement: old products are referenced: ${JSON.stringify(counts)}`);
  return counts;
}
async function runImport({ conn, manifest, apply, expectedBeforeSha, fileSystem = fs }) {
  validateManifest(manifest);
  // There are no FKs on the three reference columns. Serializable isolation keeps a
  // reference from appearing between the zero-reference assertion and the delete.
  await conn.execute('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
  await conn.beginTransaction();
  try {
    const profileRows = await selectAll(conn, 'supplier_profiles', 'id = ?', [TARGET.id], true);
    assert.equal(profileRows.length, 1, 'Target supplier profile must exist exactly once');
    const profile = profileRows[0];
    for (const [key, value] of Object.entries(TARGET)) assert.equal(profile[key], value, `Target supplier ${key} changed`);
    const oldProducts = await selectAll(conn, 'supplier_products', 'supplier_profile_id = ?', [TARGET.id], true);
    const alreadyApplied = isIntendedDataset(oldProducts, manifest.products);
    assert(alreadyApplied || oldProducts.length === EXPECTED_OLD_PRODUCTS, `Expected ${EXPECTED_OLD_PRODUCTS} old products, found ${oldProducts.length}`);
    const productColumns = await tableColumns(conn, 'supplier_products');
    for (const column of INSERT_COLUMNS) assert(productColumns.includes(column), `supplier_products.${column} is required; refusing schema drift`);
    const references = alreadyApplied ? {} : await referenceCounts(conn, oldProducts.map((row) => row.id));
    const projects = await selectAll(conn, 'supplier_projects', 'supplier_profile_id = ?', [TARGET.id]);
    const catalogs = await selectAll(conn, 'supplier_catalogs', 'supplier_profile_id = ?', [TARGET.id]);
    const otherProducts = await selectAll(conn, 'supplier_products', 'supplier_profile_id <> ?', [TARGET.id]);
    const snapshot = makeSnapshot({ profile, oldProducts, projects, catalogs, otherProducts, references });
    const manifestSha = sha256(manifest.products.map(intendedRow));
    const beforeSha = sha256({ snapshot, manifest_sha256: manifestSha });
    if (!apply) { await conn.rollback(); return { status: 'DRY_RUN_PASS', expected_before_sha: beforeSha, manifest_sha256: manifestSha, old_product_count: oldProducts.length, replacement_count: manifest.products.length, already_applied: alreadyApplied, snapshot }; }
    assert.equal(expectedBeforeSha, beforeSha, 'Expected-before SHA does not match the locked current snapshot');
    assertAssets(manifest.products, fileSystem);
    if (alreadyApplied) { await conn.rollback(); return { status: 'NO_OP_ALREADY_APPLIED', expected_before_sha: beforeSha, replacement_count: manifest.products.length }; }
    const backup = `/tmp/supplier-1127-fyn-before-${Date.now()}.json`;
    fileSystem.writeFileSync(backup, JSON.stringify({ created_at: new Date().toISOString(), snapshot, old_products: oldProducts }, null, 2), { mode: 0o600, flag: 'wx' });
    await conn.execute(DELETE_SQL, [TARGET.id]);
    const placeholders = `(${INSERT_COLUMNS.map(() => '?').join(',')})`;
    const insertSql = `INSERT INTO supplier_products (${INSERT_COLUMNS.map(q).join(', ')}) VALUES ${placeholders}`;
    for (const product of manifest.products) await conn.execute(insertSql, INSERT_COLUMNS.map((column) => intendedRow(product)[column]));
    const after = await selectAll(conn, 'supplier_products', 'supplier_profile_id = ?', [TARGET.id]);
    assert(isIntendedDataset(after, manifest.products), 'Post-write product dataset differs from manifest');
    const projectsAfter = await selectAll(conn, 'supplier_projects', 'supplier_profile_id = ?', [TARGET.id]);
    const catalogsAfter = await selectAll(conn, 'supplier_catalogs', 'supplier_profile_id = ?', [TARGET.id]);
    const otherAfter = await selectAll(conn, 'supplier_products', 'supplier_profile_id <> ?', [TARGET.id]);
    assert.equal(sha256(projectsAfter), snapshot.projects_sha256, 'Projects changed'); assert.equal(sha256(catalogsAfter), snapshot.catalogs_sha256, 'Catalogs changed'); assert.equal(sha256(otherAfter), snapshot.other_suppliers_products_sha256, 'Other suppliers products changed');
    await conn.commit(); return { status: 'APPLY_PASS', expected_before_sha: beforeSha, replaced: manifest.products.length, backup };
  } catch (error) { await conn.rollback(); throw error; }
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const appRoot = process.env.APP_ROOT || path.resolve(__dirname, '../../server');
  if (!args.localTest) assert.equal(appRoot, '/tarmeer/tarmeer_api', 'Run production imports only through SSH on /tarmeer/tarmeer_api; use --local-test only with local DB_HOST=localhost');
  const envPath = path.join(appRoot, '.env'); assert(fs.existsSync(envPath), `Missing server environment file: ${envPath}`);
  require(path.join(appRoot, 'node_modules/dotenv')).config({ path: envPath, quiet: true, override: true });
  if (args.localTest) assert.equal(process.env.DB_HOST, 'localhost', '--local-test server .env must have DB_HOST=localhost');
  const mysql = require(path.join(appRoot, 'node_modules/mysql2/promise'));
  const manifest = validateManifest(JSON.parse(fs.readFileSync(args.manifest, 'utf8')));
  const conn = await mysql.createConnection({ host: process.env.DB_HOST, port: process.env.DB_PORT || 3306, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4' });
  try {
    const result = await runImport({ conn, manifest, apply: args.apply, expectedBeforeSha: args.expectedBeforeSha });
    if (result.snapshot) {
      const { snapshot, ...summary } = result;
      console.log(JSON.stringify({ ...summary, snapshot_digests: {
        old_products_sha256: snapshot.old_products_sha256, project_count: snapshot.project_count, projects_sha256: snapshot.projects_sha256,
        catalog_count: snapshot.catalog_count, catalogs_sha256: snapshot.catalogs_sha256, other_supplier_product_count: snapshot.other_supplier_product_count,
        other_suppliers_products_sha256: snapshot.other_suppliers_products_sha256, references: snapshot.references,
      } }, null, 2));
    } else console.log(JSON.stringify(result, null, 2));
  }
  finally { await conn.end(); }
}

module.exports = { TARGET, EXPECTED_PRODUCTS, PENDING_APPLICATION_MODELS, UPLOAD_PREFIX, INSERT_COLUMNS, DELETE_SQL, sha256, stableJson, parseArgs, validateManifest, validateUploadUrl, isEnglishPublic, intendedRow, isIntendedDataset, assetVariantUrls, assertAssets, makeSnapshot, runImport };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
