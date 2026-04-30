#!/usr/bin/env node
/**
 * Harness: Supplier Dashboard & Onboarding
 *
 * 用例:
 *   TC1:  注册后自动创建 supplier_profiles (status=pending)
 *   TC2:  /suppliers/me/products 无 token → 401
 *   TC3:  /suppliers/me/catalogs 无 token → 401
 *   TC4:  /suppliers/me/products 有 token，空列表 → 200 + []
 *   TC5:  /suppliers/me/catalogs 有 token，空列表 → 200 + []
 *   TC6:  添加产品后 /suppliers/me/products 计数正确
 *   TC7:  添加 catalog 后 /suppliers/me/catalogs 计数正确
 *   TC8:  pending 状态下仍可读取 /suppliers/me/products (不限审核状态)
 *   TC9:  pending 状态下仍可读取 /suppliers/me/catalogs
 *   TC10: /suppliers/me/profile 返回 status=pending
 *
 * 用法: PORT=3099 node scripts/harness/test-supplier-dashboard.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url.replace('/scripts/harness/', '/server/'));
const mysql = require('mysql2/promise');

const API = `http://127.0.0.1:${process.env.PORT || 3099}/api`;
const TS = Date.now();
const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'tarmeer' });

let passed = 0, failed = 0;
const failures = [];

function ok(tc, name, condition) {
  if (condition) { console.log(`  PASS  ${tc} | ${name}`); passed++; }
  else           { console.log(`  FAIL  ${tc} | ${name}`); failed++; failures.push(`${tc}: ${name}`); }
}

async function post(path, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { method: 'POST', headers: h, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

async function get(path, token) {
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { headers: h });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

async function del(path, token) {
  const h = {};
  if (token) h['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { method: 'DELETE', headers: h });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

const EMAIL    = `dash_test_${TS}@test.local`;
const PASSWORD = 'test123456';
let supplierToken = '';
let profileId = 0;
let productId = 0;
let catalogId = 0;

async function cleanup() {
  console.log('\n── Cleanup ──');
  await pool.execute(`DELETE FROM supplier_products WHERE supplier_profile_id IN
    (SELECT id FROM supplier_profiles WHERE supplier_user_id IN
    (SELECT id FROM supplier_users WHERE email = ?))`, [EMAIL]);
  await pool.execute(`DELETE FROM supplier_catalogs WHERE supplier_profile_id IN
    (SELECT id FROM supplier_profiles WHERE supplier_user_id IN
    (SELECT id FROM supplier_users WHERE email = ?))`, [EMAIL]);
  await pool.execute(`DELETE FROM supplier_profiles WHERE supplier_user_id IN
    (SELECT id FROM supplier_users WHERE email = ?)`, [EMAIL]);
  await pool.execute('DELETE FROM supplier_users WHERE email = ?', [EMAIL]);
  await pool.end();
  console.log('  Done');
}

async function run() {
  console.log('\n══ Supplier Dashboard Harness ══\n');

  // ── Setup: register + bypass email verification ──
  console.log('── Setup ──');
  const regR = await post('/supplier/auth/register', { email: EMAIL, password: PASSWORD });
  ok('SETUP', 'Register → 201', regR.status === 201);

  // Manually verify email via DB (bypass email)
  await pool.execute('UPDATE supplier_users SET email_verified = 1 WHERE email = ?', [EMAIL]);

  const loginR = await post('/supplier/auth/login', { email: EMAIL, password: PASSWORD });
  ok('SETUP', 'Login after verify → 200', loginR.status === 200);
  supplierToken = loginR.data.token;

  // Get profile id
  const [profileRows] = await pool.execute(
    'SELECT id FROM supplier_profiles WHERE supplier_user_id = (SELECT id FROM supplier_users WHERE email = ?)',
    [EMAIL]
  );
  profileId = profileRows[0]?.id;

  // ── TC1: Profile auto-created on register ──
  console.log('\n── Profile ──');
  ok('TC1', 'supplier_profiles row created on register', !!profileId);

  const [statusRows] = await pool.execute('SELECT status FROM supplier_profiles WHERE id = ?', [profileId]);
  ok('TC1', 'Auto-created profile has status=pending', statusRows[0]?.status === 'pending');

  // ── TC2 & TC3: Unauthenticated → 401 ──
  console.log('\n── Auth Guards ──');
  {
    const r = await get('/suppliers/me/products');
    ok('TC2', '/suppliers/me/products no token → 401', r.status === 401);
  }
  {
    const r = await get('/suppliers/me/catalogs');
    ok('TC3', '/suppliers/me/catalogs no token → 401', r.status === 401);
  }

  // ── TC4 & TC5: Empty lists ──
  console.log('\n── Empty Lists ──');
  {
    const r = await get('/suppliers/me/products', supplierToken);
    ok('TC4', '/suppliers/me/products → 200', r.status === 200);
    ok('TC4', 'Returns products array', Array.isArray(r.data.products));
    ok('TC4', 'Initially empty', r.data.products?.length === 0);
  }
  {
    const r = await get('/suppliers/me/catalogs', supplierToken);
    ok('TC5', '/suppliers/me/catalogs → 200', r.status === 200);
    ok('TC5', 'Returns catalogs array', Array.isArray(r.data.catalogs));
    ok('TC5', 'Initially empty', r.data.catalogs?.length === 0);
  }

  // ── TC8 & TC9: Works while pending (no approved status required) ──
  console.log('\n── Pending Supplier Access ──');
  {
    const [st] = await pool.execute('SELECT status FROM supplier_profiles WHERE id = ?', [profileId]);
    ok('TC8', 'Profile is still pending', st[0]?.status === 'pending');
    const r = await get('/suppliers/me/products', supplierToken);
    ok('TC8', 'Pending supplier can read /me/products', r.status === 200);
  }
  {
    const r = await get('/suppliers/me/catalogs', supplierToken);
    ok('TC9', 'Pending supplier can read /me/catalogs', r.status === 200);
  }

  // ── TC10: /suppliers/me/profile returns status ──
  console.log('\n── Profile Status ──');
  {
    const r = await get('/suppliers/me/profile', supplierToken);
    ok('TC10', '/suppliers/me/profile → 200', r.status === 200);
    ok('TC10', 'Profile status = pending', r.data.profile?.status === 'pending');
  }

  // ── Add products/catalogs to test counting ──
  console.log('\n── Product & Catalog Counts ──');

  // Need to fill profile first (company_name required)
  await post('/suppliers/me/profile', {
    company_name: `Dash Test Co ${TS}`,
    description: 'Test',
    origin: 'china',
    categories: ['furniture'],
  }, supplierToken);

  const prodR = await post('/suppliers/me/products', {
    title: 'Test Product',
    image_url: 'https://example.com/img.jpg',
  }, supplierToken);
  productId = prodR.data.product?.id;

  const catR = await post('/suppliers/me/catalogs', {
    title: 'Test Catalog',
    file_url: 'https://example.com/cat.pdf',
  }, supplierToken);
  catalogId = catR.data.catalog?.id;

  // TC6: Product count
  {
    const r = await get('/suppliers/me/products', supplierToken);
    ok('TC6', '/me/products count = 1 after add', r.data.products?.length === 1);
    ok('TC6', 'Product title correct', r.data.products?.[0]?.title === 'Test Product');
  }

  // TC7: Catalog count
  {
    const r = await get('/suppliers/me/catalogs', supplierToken);
    ok('TC7', '/me/catalogs count = 1 after add', r.data.catalogs?.length === 1);
    ok('TC7', 'Catalog title correct', r.data.catalogs?.[0]?.title === 'Test Catalog');
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('  Failures:');
    failures.forEach(f => console.log(`    - ${f}`));
  }
  console.log(`${'═'.repeat(50)}\n`);

  await cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
