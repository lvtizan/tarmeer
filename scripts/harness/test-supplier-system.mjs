#!/usr/bin/env node
/**
 * Harness: Supplier System 全流程走查
 *
 * 用例:
 *   TC1:  供应商注册
 *   TC2:  重复邮箱注册 → 400
 *   TC3:  供应商登录
 *   TC4:  错误密码登录 → 401
 *   TC5:  创建 profile（upsert）
 *   TC6:  更新 profile
 *   TC7:  公开列表 — 返回 approved 供应商
 *   TC8:  按 origin 筛选
 *   TC9:  按 category 筛选
 *   TC10: 公开详情页（by slug）
 *   TC11: 不存在 slug → 404
 *   TC12: 添加产品
 *   TC13: 更新产品
 *   TC14: 删除产品
 *   TC15: 产品列表
 *   TC16: 添加 catalog
 *   TC17: 删除 catalog
 *   TC18: 提交供应商线索
 *   TC19: 线索缺少必填字段 → 400
 *   TC20: Admin 列表
 *   TC21: Admin 详情
 *   TC22: Admin 审核（approve）
 *   TC23: Admin 审核（reject）
 *   TC24: Admin 删除（级联）
 *   TC25: 未 approved 的供应商不出现在公开列表
 *   TC26: check-availability
 *
 * 用法: PORT=3099 node scripts/harness/test-supplier-system.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url.replace('/scripts/harness/', '/server/'));
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const API = `http://127.0.0.1:${process.env.PORT || 3099}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_min_32_chars_for_local_testing_only';
const TS = Date.now();
const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'tarmeer' });

let passed = 0;
let failed = 0;
const failures = [];

function ok(tc, name, condition) {
  if (condition) {
    console.log(`  PASS  ${tc} | ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${tc} | ${name}`);
    failed++;
    failures.push(`${tc}: ${name}`);
  }
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function put(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function get(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { headers });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function del(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'DELETE', headers });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function makeAdminToken() {
  return jwt.sign({ adminId: 1, username: 'admin', role: 'super_admin', type: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
}

// ── Test data ──
const EMAIL = `supplier_test_${TS}@test.local`;
const PASSWORD = 'test123456';
let supplierToken = '';
let profileSlug = '';
let profileId = 0;
let productId = 0;
let catalogId = 0;

async function cleanup() {
  console.log('\n── Cleanup ──');
  await pool.execute('DELETE FROM supplier_products WHERE supplier_profile_id IN (SELECT id FROM supplier_profiles WHERE slug LIKE ?)', [`test-co-${TS}%`]);
  await pool.execute('DELETE FROM supplier_catalogs WHERE supplier_profile_id IN (SELECT id FROM supplier_profiles WHERE slug LIKE ?)', [`test-co-${TS}%`]);
  await pool.execute('DELETE FROM supplier_profiles WHERE slug LIKE ?', [`test-co-${TS}%`]);
  await pool.execute('DELETE FROM supplier_users WHERE email = ?', [EMAIL]);
  await pool.execute('DELETE FROM supplier_leads WHERE contact_name LIKE ?', [`test_lead_${TS}%`]);
  await pool.end();
  console.log('  Done');
}

async function run() {
  const adminToken = makeAdminToken();
  console.log('\n══ Supplier System Harness ══\n');

  // ── Auth ──
  console.log('── Auth ──');

  // TC1: Register
  {
    const r = await post('/supplier/auth/register', { email: EMAIL, password: PASSWORD, full_name: `Test Supplier ${TS}` });
    ok('TC1', 'Register → 201', r.status === 201);
  }

  // TC2: Duplicate register → 400
  {
    const r = await post('/supplier/auth/register', { email: EMAIL, password: PASSWORD });
    ok('TC2', 'Duplicate register → 400', r.status === 400);
  }

  // TC3: Login
  {
    const r = await post('/supplier/auth/login', { email: EMAIL, password: PASSWORD });
    ok('TC3', 'Login → 200', r.status === 200);
    ok('TC3', 'Login returns token', !!r.data.token);
    supplierToken = r.data.token;
  }

  // TC4: Wrong password → 401
  {
    const r = await post('/supplier/auth/login', { email: EMAIL, password: 'wrong' });
    ok('TC4', 'Wrong password → 401', r.status === 401);
  }

  // TC26: Check availability
  {
    const r1 = await post('/supplier/auth/check-availability', { email: EMAIL });
    ok('TC26', 'Existing email → isNewEmail=false', r1.data.isNewEmail === false);
    const r2 = await post('/supplier/auth/check-availability', { email: `new_${TS}@test.local` });
    ok('TC26', 'New email → isNewEmail=true', r2.data.isNewEmail === true);
  }

  // ── Profile ──
  console.log('\n── Profile ──');

  // TC5: Create profile
  {
    const r = await post('/suppliers/me/profile', {
      company_name: `Test Co ${TS}`,
      description: 'Test supplier company',
      origin: 'china',
      categories: ['furniture', 'lighting'],
      has_physical_store: true,
      store_address: 'Test Street 123',
      google_maps_url: 'https://maps.google.com/test',
      contact_phone: '+971501234567',
    }, supplierToken);
    ok('TC5', 'Create profile → 201', r.status === 201);
    ok('TC5', 'Profile has slug', !!r.data.profile?.slug);
    profileSlug = r.data.profile?.slug;
    profileId = r.data.profile?.id;
  }

  // TC6: Update profile
  {
    const r = await post('/suppliers/me/profile', {
      company_name: `Test Co ${TS}`,
      description: 'Updated description',
      origin: 'dubai',
      categories: ['stone'],
    }, supplierToken);
    ok('TC6', 'Update profile → 200', r.status === 200);
    ok('TC6', 'Origin updated to dubai', r.data.profile?.origin === 'dubai');
  }

  // TC25: Pending profile not in public list
  {
    const r = await get('/suppliers');
    const found = r.data.suppliers?.some(s => s.slug === profileSlug);
    ok('TC25', 'Pending profile not in public list', !found);
  }

  // Approve via admin for further tests
  await put(`/admin/suppliers/${profileId}/status`, { status: 'approved' }, adminToken);

  // ── Public listing ──
  console.log('\n── Public Listing ──');

  // TC7: Public list returns approved
  {
    const r = await get('/suppliers?limit=50');
    ok('TC7', 'Public list → 200', r.status === 200);
    const found = r.data.suppliers?.some(s => s.slug === profileSlug);
    ok('TC7', 'Approved supplier in list', found);
  }

  // TC8: Filter by origin
  {
    const r = await get('/suppliers?origin=dubai');
    const all = r.data.suppliers?.every(s => s.origin === 'dubai');
    ok('TC8', 'Origin filter — all dubai', all);
  }

  // TC9: Filter by category
  {
    const r = await get('/suppliers?category=stone');
    ok('TC9', 'Category filter → 200', r.status === 200);
    ok('TC9', 'Results include our supplier', r.data.suppliers?.some(s => s.slug === profileSlug));
  }

  // TC10: Public detail
  {
    const r = await get(`/suppliers/detail/${profileSlug}`);
    ok('TC10', 'Detail → 200', r.status === 200);
    ok('TC10', 'Correct company name', r.data.supplier?.company_name === `Test Co ${TS}`);
    ok('TC10', 'Has products array', Array.isArray(r.data.products));
    ok('TC10', 'Has catalogs array', Array.isArray(r.data.catalogs));
  }

  // TC11: Invalid slug → 404
  {
    const r = await get('/suppliers/detail/nonexistent-slug-xyz');
    ok('TC11', 'Bad slug → 404', r.status === 404);
  }

  // ── Products ──
  console.log('\n── Products ──');

  // TC12: Add product
  {
    const r = await post('/suppliers/me/products', {
      title: 'Test Product',
      description: 'A test product',
      image_url: 'https://example.com/img.jpg',
    }, supplierToken);
    ok('TC12', 'Add product → 201', r.status === 201);
    ok('TC12', 'Product has id', !!r.data.product?.id);
    productId = r.data.product?.id;
  }

  // TC13: Update product
  {
    const r = await put(`/suppliers/me/products/${productId}`, {
      title: 'Updated Product',
    }, supplierToken);
    ok('TC13', 'Update product → 200', r.status === 200);
    ok('TC13', 'Title updated', r.data.product?.title === 'Updated Product');
  }

  // TC15: List products (public)
  {
    const r = await get(`/suppliers/detail/${profileSlug}/products`);
    ok('TC15', 'List products → 200', r.status === 200);
    ok('TC15', 'Has product', r.data.products?.length >= 1);
  }

  // TC14: Delete product
  {
    const r = await del(`/suppliers/me/products/${productId}`, supplierToken);
    ok('TC14', 'Delete product → 200', r.status === 200);
  }

  // ── Catalogs ──
  console.log('\n── Catalogs ──');

  // TC16: Add catalog
  {
    const r = await post('/suppliers/me/catalogs', {
      title: 'Product Catalog 2026',
      file_url: 'https://example.com/catalog.pdf',
      file_size: 5242880,
    }, supplierToken);
    ok('TC16', 'Add catalog → 201', r.status === 201);
    ok('TC16', 'Catalog has id', !!r.data.catalog?.id);
    catalogId = r.data.catalog?.id;
  }

  // TC17: Delete catalog
  {
    const r = await del(`/suppliers/me/catalogs/${catalogId}`, supplierToken);
    ok('TC17', 'Delete catalog → 200', r.status === 200);
  }

  // ── Leads ──
  console.log('\n── Leads ──');

  // TC18: Submit lead
  {
    const r = await post('/suppliers/leads', {
      contact_name: `test_lead_${TS}`,
      phone: '+971501234567',
      company_name: 'Lead Co',
      category: 'furniture',
      origin: 'china',
    });
    ok('TC18', 'Submit lead → 201', r.status === 201);
  }

  // TC19: Missing required fields → 400
  {
    const r = await post('/suppliers/leads', { company_name: 'No phone' });
    ok('TC19', 'Missing fields → 400', r.status === 400);
  }

  // ── Admin ──
  console.log('\n── Admin ──');

  // TC20: Admin list
  {
    const r = await get('/admin/suppliers?limit=50', adminToken);
    ok('TC20', 'Admin list → 200', r.status === 200);
    ok('TC20', 'Has suppliers array', Array.isArray(r.data.suppliers));
    ok('TC20', 'Includes test supplier', r.data.suppliers?.some(s => s.slug === profileSlug));
  }

  // TC21: Admin detail
  {
    const r = await get(`/admin/suppliers/${profileId}`, adminToken);
    ok('TC21', 'Admin detail → 200', r.status === 200);
    ok('TC21', 'Correct company', r.data.supplier?.company_name === `Test Co ${TS}`);
  }

  // TC22: Admin approve
  {
    await put(`/admin/suppliers/${profileId}/status`, { status: 'pending' }, adminToken);
    const r = await put(`/admin/suppliers/${profileId}/status`, { status: 'approved' }, adminToken);
    ok('TC22', 'Approve → 200', r.status === 200);
  }

  // TC23: Admin reject
  {
    const r = await put(`/admin/suppliers/${profileId}/status`, { status: 'rejected' }, adminToken);
    ok('TC23', 'Reject → 200', r.status === 200);
  }

  // TC24: Admin delete (cascade)
  {
    // Re-approve first, add a product for cascade test
    await put(`/admin/suppliers/${profileId}/status`, { status: 'approved' }, adminToken);
    await post('/suppliers/me/products', { image_url: 'https://example.com/cascade.jpg', title: 'Cascade test' }, supplierToken);
    await post('/suppliers/me/catalogs', { file_url: 'https://example.com/cascade.pdf', title: 'Cascade PDF' }, supplierToken);

    const r = await del(`/admin/suppliers/${profileId}`, adminToken);
    ok('TC24', 'Admin delete → 200', r.status === 200);

    // Verify cascade
    const [users] = await pool.execute('SELECT id FROM supplier_users WHERE email = ?', [EMAIL]);
    ok('TC24', 'User deleted', users.length === 0);
    const [profiles] = await pool.execute('SELECT id FROM supplier_profiles WHERE slug = ?', [profileSlug]);
    ok('TC24', 'Profile deleted', profiles.length === 0);
    const [products] = await pool.execute('SELECT id FROM supplier_products WHERE supplier_profile_id = ?', [profileId]);
    ok('TC24', 'Products deleted', products.length === 0);
    const [catalogs] = await pool.execute('SELECT id FROM supplier_catalogs WHERE supplier_profile_id = ?', [profileId]);
    ok('TC24', 'Catalogs deleted', catalogs.length === 0);
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
