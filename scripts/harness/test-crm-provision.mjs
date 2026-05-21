#!/usr/bin/env node
/**
 * test-crm-provision.mjs — CRM provision 凭据传递走查
 *
 * 核心问题：provision 时，不同类型装企用户的凭据是否正确传给 CRM？
 *
 * 测试方案：
 *   - 启动内嵌 mock CRM server（随机端口），捕获 provision 请求 payload
 *   - 以 CRM_BASE_URL=http://127.0.0.1:{mockPort} 启动后端
 *   - 注册三类用户，触发 provision，验证 mock CRM 收到的 payload
 *
 * 覆盖场景：
 *   TC1: provision 无 token → 401/403
 *   TC2: provision 非 admin token → 401/403
 *   TC3: 邮箱+密码用户 → adminPasswordHash 非空（bcrypt hash），adminGoogleId 空
 *   TC4: Google OAuth 用户（有 google_id，无 password）→ adminGoogleId 非空，adminPasswordHash 为 null
 *   TC5: 边缘用户（无 password，无 google_id）→ adminPasswordHash 非空（临时随机 hash），adminGoogleId 空
 *   TC6: provision 成功后 crm_tenant_id 写入 DB
 *   TC7: 已开通 CRM 的用户 SSO → mock CRM 收到正确 tenantId，返回 consumeUrl
 *   TC8: 未开通 CRM 的用户 SSO → 400
 *
 * Usage:
 *   cd <repo-root>
 *   node scripts/harness/test-crm-provision.mjs
 */

import crypto from 'crypto';
import http from 'http';
import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const require = createRequire(import.meta.url);
const mysql = require(path.join(SERVER_DIR, 'node_modules/mysql2/promise'));
const bcrypt = require(path.join(SERVER_DIR, 'node_modules/bcryptjs'));

// ── helpers ──────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const results = [];

function ok(tc, label) {
  passed++;
  results.push({ tc, label, ok: true });
  console.log(`  PASS | ${tc}: ${label}`);
}
function fail(tc, label, reason) {
  failed++;
  results.push({ tc, label, ok: false, reason });
  console.log(`  FAIL | ${tc}: ${label} — ${reason}`);
}
async function test(tc, label, fn) {
  try { await fn(); ok(tc, label); }
  catch (e) { fail(tc, label, e.message ?? String(e)); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

let BASE, API;
async function req(method, pathStr, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const body = opts.body != null ? JSON.stringify(opts.body) : undefined;
  const res = await fetch(`${API}${pathStr}`, { method, headers, body });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

// ── mock CRM server ───────────────────────────────────────────────────────────

const capturedRequests = [];

function startMockCrm() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(body); } catch {}
        capturedRequests.push({ path: req.url, body: parsed });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (req.url.includes('/provision')) {
          res.end(JSON.stringify({ code: 0, data: { tenantId: `mock-tenant-${parsed.mallPartnerId}` } }));
        } else if (req.url.includes('/sso/issue')) {
          res.end(JSON.stringify({ code: 0, data: { consumeUrl: `https://crm.mock/sso/consume?token=mocktoken-${parsed.mallPartnerId}` } }));
        } else {
          res.end(JSON.stringify({ code: 0, data: {} }));
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      console.log(`  mock CRM listening on :${port}`);
      resolve({ server, port });
    });
  });
}

// ── backend server ────────────────────────────────────────────────────────────

let serverProcess;
function startServer(crmPort) {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['dist/app.js'], {
      cwd: SERVER_DIR,
      env: {
        ...process.env,
        PORT: '3099',
        DEV_SKIP_EMAIL: 'true',
        NODE_ENV: 'development',
        CRM_BASE_URL: `http://127.0.0.1:${crmPort}`,
        MALL_INTEGRATION_SECRET: 'test-secret',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    serverProcess.stdout.on('data', (d) => {
      if (!started && d.toString().includes('Server running')) {
        started = true;
        setTimeout(resolve, 500);
      }
    });
    serverProcess.stderr.on('data', () => {});
    setTimeout(() => { if (!started) reject(new Error('Server start timeout')); }, 15000);
  });
}
function stopServer() {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
}

// ── DB setup ──────────────────────────────────────────────────────────────────

let conn;
const ADMIN_EMAIL = 'e2e-crm-prov-admin@test.com';
const ADMIN_PASS = 'Admin123456!';
const EMAIL_USER  = 'e2e-crm-prov-email@test.com';
const GOOGLE_USER = 'e2e-crm-prov-google@test.com';
const EDGE_USER   = 'e2e-crm-prov-edge@test.com';
const TEST_PASS = 'Test123456!';

async function cleanup() {
  if (!conn) return;
  for (const email of [EMAIL_USER, GOOGLE_USER, EDGE_USER]) {
    const [rows] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows[0]) {
      await conn.query('DELETE FROM company_profiles WHERE user_id = ?', [rows[0].id]);
      await conn.query('DELETE FROM users WHERE id = ?', [rows[0].id]);
    }
  }
  await conn.query("DELETE FROM admin_users WHERE email = ?", [ADMIN_EMAIL]).catch(() => {});
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log('  CRM Provision Credentials Walk-through Harness');
console.log('='.repeat(60) + '\n');

console.log('Building server...');
execSync('npx tsc --skipLibCheck', { cwd: SERVER_DIR, stdio: 'ignore' });

conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tarmeer',
});
await cleanup();

const { server: mockCrmServer, port: mockCrmPort } = await startMockCrm();

console.log(`Starting backend (CRM_BASE_URL → :${mockCrmPort}) ...\n`);
await startServer(mockCrmPort);

BASE = 'http://127.0.0.1:3099';
API = `${BASE}/api`;

let adminToken, emailCompanyId, googleCompanyId, edgeCompanyId;

try {
  // ── 准备 admin ──────────────────────────────────────────────────────────────
  console.log('── Setup: admin + 3 company users ──');
  const adminHash = await bcrypt.hash(ADMIN_PASS, 10);
  await conn.query(
    `INSERT INTO admin_users (email, password, full_name, is_active, role, permissions)
     VALUES (?, ?, 'E2E CRM Prov Admin', 1, 'super_admin', '{"can_approve":true}')`,
    [ADMIN_EMAIL, adminHash]
  );
  const adminLogin = await req('POST', '/admin/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
  adminToken = adminLogin.data?.token;
  assert(adminToken, `Admin login failed: ${JSON.stringify(adminLogin.data)}`);

  // ── 注册三类用户 ─────────────────────────────────────────────────────────────

  // 1. 邮箱+密码用户
  const r1 = await req('POST', '/auth/register', { body: {
    email: EMAIL_USER, password: TEST_PASS, full_name: 'Email User', phone: '+971501111001', city: 'Dubai', role: 'company',
  }});
  assert(r1.status === 201, `Email user register failed: ${r1.status}`);
  await conn.query(`UPDATE users SET email_verified=1 WHERE email=?`, [EMAIL_USER]);
  const l1 = await req('POST', '/auth/login', { body: { email: EMAIL_USER, password: TEST_PASS } });
  const emailToken = l1.data?.token;
  assert(emailToken, 'Email user login failed');
  await req('POST', '/auth/company/profile', {
    headers: { Authorization: `Bearer ${emailToken}` },
    body: { company_name: 'E2E Prov Email Co', contact_person: 'Tester', phone: '+971501111001', city: 'Dubai', description: 'Test', services: ['Interior Design'], company_type: 'design_studio' },
  });
  const [r1rows] = await conn.query('SELECT cp.id FROM company_profiles cp JOIN users u ON u.id=cp.user_id WHERE u.email=?', [EMAIL_USER]);
  emailCompanyId = r1rows[0]?.id;
  assert(emailCompanyId, 'email company profile not found');
  await conn.query(`UPDATE company_profiles SET status='approved' WHERE id=?`, [emailCompanyId]);

  // 2. Google OAuth 用户（有 google_id，password 为空字符串——与真实 Google SSO 注册行为一致）
  // password='' → crmIntegrationService: '' || null = null → 走 adminGoogleId 路径
  const googleId = `google-test-${crypto.randomBytes(8).toString('hex')}`;
  await conn.query(
    `INSERT INTO users (email, password, full_name, phone, city, role, google_id, email_verified) VALUES (?,?,?,?,?,'company',?,1)`,
    [GOOGLE_USER, '', 'Google User', '+971501111002', 'Dubai', googleId]
  );
  const [googleUserRows] = await conn.query('SELECT id FROM users WHERE email=?', [GOOGLE_USER]);
  const googleUserId = googleUserRows[0].id;
  await conn.query(
    `INSERT INTO company_profiles (user_id, company_name, contact_person, phone, city, address, description, services, company_type, status) VALUES (?,?,?,?,?,?,?,?,?,'approved')`,
    [googleUserId, 'E2E Prov Google Co', 'Tester', '+971501111002', 'Dubai', '', 'Test', JSON.stringify(['Interior Design']), 'design_studio']
  );
  const [g1rows] = await conn.query('SELECT id FROM company_profiles WHERE user_id=?', [googleUserId]);
  googleCompanyId = g1rows[0]?.id;
  assert(googleCompanyId, 'google company profile not found');

  // 3. 边缘用户（password='', 无 google_id）→ crmIntegrationService 生成临时随机 bcrypt hash
  await conn.query(
    `INSERT INTO users (email, password, full_name, phone, city, role, google_id, email_verified) VALUES (?,?,?,?,?,'company',NULL,1)`,
    [EDGE_USER, '', 'Edge User', '+971501111003', 'Dubai']
  );
  const [edgeUserRows] = await conn.query('SELECT id FROM users WHERE email=?', [EDGE_USER]);
  const edgeUserId = edgeUserRows[0].id;
  await conn.query(
    `INSERT INTO company_profiles (user_id, company_name, contact_person, phone, city, address, description, services, company_type, status) VALUES (?,?,?,?,?,?,?,?,?,'approved')`,
    [edgeUserId, 'E2E Prov Edge Co', 'Tester', '+971501111003', 'Dubai', '', 'Test', JSON.stringify(['Interior Design']), 'design_studio']
  );
  const [e1rows] = await conn.query('SELECT id FROM company_profiles WHERE user_id=?', [edgeUserId]);
  edgeCompanyId = e1rows[0]?.id;
  assert(edgeCompanyId, 'edge company profile not found');

  console.log(`  ✓ admin ready, companies: email=${emailCompanyId} google=${googleCompanyId} edge=${edgeCompanyId}\n`);

  // ── TC1: 无 token → 401 ──────────────────────────────────────────────────────
  await test('TC1', 'POST /admin/profile-companies/:id/crm-provision — 无 token → 401/403', async () => {
    const r = await req('POST', `/admin/profile-companies/${emailCompanyId}/crm-provision`);
    assert([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
  });

  // ── TC2: 非 admin token → 401/403 ────────────────────────────────────────────
  await test('TC2', 'POST /admin/profile-companies/:id/crm-provision — 非 admin token → 401/403', async () => {
    const fakeJwt = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjk5OX0.fake';
    const r = await req('POST', `/admin/profile-companies/${emailCompanyId}/crm-provision`, {
      headers: { Authorization: fakeJwt },
    });
    assert([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
  });

  // ── TC3: 邮箱+密码用户 provision ─────────────────────────────────────────────
  await test('TC3', '邮箱+密码用户 provision → mock CRM 收到 adminPasswordHash(非空)，adminGoogleId(空)', async () => {
    capturedRequests.length = 0;
    const r = await req('POST', `/admin/profile-companies/${emailCompanyId}/crm-provision`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
    const provReq = capturedRequests.find(c => c.path.includes('/provision'));
    assert(provReq, 'Mock CRM 未收到 provision 请求');
    assert(provReq.body.adminPasswordHash, `adminPasswordHash 为空: ${JSON.stringify(provReq.body)}`);
    assert(provReq.body.adminPasswordHash.startsWith('$2'), `adminPasswordHash 不是 bcrypt hash: ${provReq.body.adminPasswordHash.slice(0,20)}`);
    assert(!provReq.body.adminGoogleId, `adminGoogleId 应为空，实际: ${provReq.body.adminGoogleId}`);
    assert(provReq.body.adminEmail === EMAIL_USER, `adminEmail 不匹配: ${provReq.body.adminEmail}`);
    assert(provReq.body.mallPartnerId === String(emailCompanyId), `mallPartnerId 不匹配: ${provReq.body.mallPartnerId}`);
  });

  // ── TC4: Google OAuth 用户 provision ─────────────────────────────────────────
  await test('TC4', 'Google OAuth 用户 provision → mock CRM 收到 adminGoogleId(非空)，adminPasswordHash(null)', async () => {
    capturedRequests.length = 0;
    const r = await req('POST', `/admin/profile-companies/${googleCompanyId}/crm-provision`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
    const provReq = capturedRequests.find(c => c.path.includes('/provision'));
    assert(provReq, 'Mock CRM 未收到 provision 请求');
    assert(provReq.body.adminGoogleId, `adminGoogleId 为空: ${JSON.stringify(provReq.body)}`);
    assert(!provReq.body.adminPasswordHash, `adminPasswordHash 应为 null，实际: ${provReq.body.adminPasswordHash}`);
    assert(provReq.body.adminEmail === GOOGLE_USER, `adminEmail 不匹配: ${provReq.body.adminEmail}`);
  });

  // ── TC5: 边缘用户（无 password，无 google_id）provision ───────────────────────
  await test('TC5', '边缘用户(无密码无googleId) provision → 生成临时 hash 传给 CRM', async () => {
    capturedRequests.length = 0;
    const r = await req('POST', `/admin/profile-companies/${edgeCompanyId}/crm-provision`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
    const provReq = capturedRequests.find(c => c.path.includes('/provision'));
    assert(provReq, 'Mock CRM 未收到 provision 请求');
    assert(provReq.body.adminPasswordHash, `adminPasswordHash 应为临时 hash，实际为空`);
    assert(provReq.body.adminPasswordHash.startsWith('$2'), `adminPasswordHash 不是 bcrypt hash`);
    assert(!provReq.body.adminGoogleId, `adminGoogleId 应为空`);
  });

  // ── TC6: provision 成功后 crm_tenant_id 写入 DB ────────────────────────────────
  await test('TC6', 'provision 成功 → crm_tenant_id 写入 DB', async () => {
    const [rows] = await conn.query(
      'SELECT crm_tenant_id FROM company_profiles WHERE id = ?', [emailCompanyId]
    );
    const tenantId = rows[0]?.crm_tenant_id;
    assert(tenantId, `crm_tenant_id 未写入 DB，actual: ${tenantId}`);
    assert(tenantId === `mock-tenant-${emailCompanyId}`, `tenantId 不匹配: ${tenantId}`);
  });

  // ── TC7: 已开通 CRM 的用户 SSO ─────────────────────────────────────────────────
  await test('TC7', '已开通 CRM 的用户 SSO → mock CRM 收到正确 tenantId，返回 consumeUrl', async () => {
    capturedRequests.length = 0;
    const r = await req('POST', '/auth/company/crm-sso', {
      headers: { Authorization: `Bearer ${(await req('POST', '/auth/login', { body: { email: EMAIL_USER, password: TEST_PASS } })).data.token}` },
    });
    assert(r.status === 200, `Expected 200, got ${r.status}: ${JSON.stringify(r.data)}`);
    assert(r.data.consumeUrl, `consumeUrl 为空: ${JSON.stringify(r.data)}`);
    const ssoReq = capturedRequests.find(c => c.path.includes('/sso/issue'));
    assert(ssoReq, 'Mock CRM 未收到 sso/issue 请求');
    assert(ssoReq.body.tenantId === `mock-tenant-${emailCompanyId}`, `tenantId 不匹配: ${ssoReq.body.tenantId}`);
  });

  // ── TC8: 未开通 CRM 的用户 SSO → 400 ──────────────────────────────────────────
  await test('TC8', '未开通 CRM 的用户 SSO → 400', async () => {
    // 新注册一个 company 用户，不做 provision
    const UNPROV_EMAIL = 'e2e-crm-unprov@test.com';
    await conn.query(`DELETE FROM users WHERE email=?`, [UNPROV_EMAIL]).catch(() => {});
    const r0 = await req('POST', '/auth/register', { body: {
      email: UNPROV_EMAIL, password: TEST_PASS, full_name: 'Unprov User', phone: '+971501111099', city: 'Dubai', role: 'company',
    }});
    assert(r0.status === 201, `Unprovisioned user register failed: ${r0.status}`);
    await conn.query(`UPDATE users SET email_verified=1 WHERE email=?`, [UNPROV_EMAIL]);
    const l0 = await req('POST', '/auth/login', { body: { email: UNPROV_EMAIL, password: TEST_PASS } });
    const unToken = l0.data?.token;
    assert(unToken, 'Unprovisioned user login failed');
    await req('POST', '/auth/company/profile', {
      headers: { Authorization: `Bearer ${unToken}` },
      body: { company_name: 'E2E Unprov Co', contact_person: 'T', phone: '+971501111099', city: 'Dubai', description: 'X', services: ['Interior Design'], company_type: 'design_studio' },
    });
    const r = await req('POST', '/auth/company/crm-sso', { headers: { Authorization: `Bearer ${unToken}` } });
    assert(r.status === 400, `Expected 400, got ${r.status}: ${JSON.stringify(r.data)}`);
    assert(r.data?.error, 'Response should have error field');
    await conn.query('DELETE FROM company_profiles WHERE company_name="E2E Unprov Co"').catch(() => {});
    await conn.query('DELETE FROM users WHERE email=?', [UNPROV_EMAIL]).catch(() => {});
  });

} finally {
  stopServer();
  mockCrmServer.close();
  await cleanup();
  await conn.end().catch(() => {});
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n══ CRM Provision: ${passed} PASS, ${failed} FAIL ══`);
if (failed > 0) {
  console.log('\n失败项:');
  results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.tc}: ${r.label} — ${r.reason}`));
  process.exit(1);
}
