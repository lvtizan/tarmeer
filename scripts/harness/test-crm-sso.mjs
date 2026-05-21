#!/usr/bin/env node
/**
 * test-crm-sso.mjs — CRM SSO 流程 harness
 *
 * 覆盖场景：
 *   TC1: 无 token → 401
 *   TC2: 无效 JWT → 401
 *   TC3: 有效装企 token 但未开通 CRM → 400（crm not provisioned）
 *   TC4: GET /auth/company/profile → crm_tenant_id 为 null（未开通时）
 *   TC5: GET /sso/consume — 无 token 参数 → 400
 *   TC6: GET /sso/consume — 随机无效 token → 400
 *
 * TC3/TC4 需要真实登录，脚本会自动注册 + 邮箱验证 + 登录 + 清理。
 *
 * Usage:
 *   cd <repo-root>
 *   PORT=3099 node scripts/harness/test-crm-sso.mjs
 *   node scripts/harness/test-crm-sso.mjs --url http://127.0.0.1:3099
 */

import crypto from 'crypto';
import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SERVER_DIR = path.join(ROOT, 'server');

const args = process.argv.slice(2);
const urlFlagIdx = args.indexOf('--url');
const BASE = urlFlagIdx !== -1 && args[urlFlagIdx + 1]
  ? args[urlFlagIdx + 1].replace(/\/+$/, '')
  : `http://127.0.0.1:${process.env.PORT || 3099}`;
const API = `${BASE}/api`;

const require = createRequire(import.meta.url);
const mysql = require(path.join(SERVER_DIR, 'node_modules/mysql2/promise'));

const TEST_EMAIL = 'e2e-crm-sso@test.com';
const TEST_PASSWORD = 'Test123456!';

let conn;
let serverProcess;
let passed = 0;
let failed = 0;
const results = [];

// ── helpers ──────────────────────────────────────────────────────────────────

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function req(method, pathStr, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const body = opts.body != null ? JSON.stringify(opts.body) : undefined;
  const res = await fetch(`${API}${pathStr}`, { method, headers, body });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['dist/app.js'], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: String(new URL(BASE).port || 3099), DEV_SKIP_EMAIL: 'true', NODE_ENV: 'development' },
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

async function cleanup() {
  if (!conn) return;
  await conn.query("DELETE FROM company_profiles WHERE company_name='E2E_CRM_SSO_Co'").catch(() => {});
  await conn.query(`DELETE FROM users WHERE email='${TEST_EMAIL}'`).catch(() => {});
}

// ── main ──────────────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(55));
console.log('  CRM SSO Flow Harness');
console.log('='.repeat(55) + '\n');

console.log('Building server...');
execSync('npx tsc --skipLibCheck', { cwd: SERVER_DIR, stdio: 'ignore' });

conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tarmeer',
});
await cleanup();

console.log(`Starting server on ${BASE} ...\n`);
await startServer();

let companyToken = null;

try {
  // ── 注册装企用户，获取真实 token ────────────────────────────────────────────
  console.log('── Setup: register + verify + login ──');

  const reg = await req('POST', '/auth/register', {
    body: {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      full_name: 'E2E CRM SSO Tester',
      phone: '+971501234568',
      city: 'Dubai',
      role: 'company',
    },
  });
  assert(reg.status === 201, `Register failed: HTTP ${reg.status} ${JSON.stringify(reg.data)}`);

  // 模拟邮箱验证
  await conn.query(`UPDATE users SET email_verified=1 WHERE email='${TEST_EMAIL}'`);

  const login = await req('POST', '/auth/login', {
    body: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  companyToken = login.data?.token;
  assert(!!companyToken, `Login failed: HTTP ${login.status} ${JSON.stringify(login.data)}`);
  console.log('  ✓ company token obtained\n');

  // ── TC1 ──────────────────────────────────────────────────────────────────────
  await test('TC1', 'POST /auth/company/crm-sso — no token → 401', async () => {
    const r = await req('POST', '/auth/company/crm-sso');
    assert([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
  });

  // ── TC2 ──────────────────────────────────────────────────────────────────────
  await test('TC2', 'POST /auth/company/crm-sso — invalid JWT → 401', async () => {
    const r = await req('POST', '/auth/company/crm-sso', {
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjk5OX0.fake' },
    });
    assert([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
  });

  // ── TC3 ──────────────────────────────────────────────────────────────────────
  await test('TC3', 'POST /auth/company/crm-sso — valid token, CRM not provisioned → 400', async () => {
    const r = await req('POST', '/auth/company/crm-sso', {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    // 没有 company_profile 时 → 404；有 profile 但无 crm_tenant_id → 400
    // 两种都可接受（此用户没有创建 profile）
    assert([400, 404].includes(r.status), `Expected 400/404, got ${r.status}: ${JSON.stringify(r.data)}`);
    assert(r.data?.error, `Response should have error field, got: ${JSON.stringify(r.data)}`);
  });

  // ── TC4 ──────────────────────────────────────────────────────────────────────
  await test('TC4', 'GET /auth/company/profile — crm_tenant_id absent before provisioning', async () => {
    // 先创建 company profile
    const profCreate = await req('POST', '/auth/company/profile', {
      headers: { Authorization: `Bearer ${companyToken}` },
      body: {
        company_name: 'E2E_CRM_SSO_Co',
        contact_person: 'E2E Tester',
        phone: '+971501234568',
        city: 'Dubai',
        description: 'Test company for CRM SSO harness',
        services: ['Interior Design'],
        company_type: 'design_studio',
      },
    });
    assert([200, 201].includes(profCreate.status), `Profile create failed: HTTP ${profCreate.status} ${JSON.stringify(profCreate.data)}`);

    const r = await req('GET', '/auth/company/profile', {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    assert(r.status === 200, `Expected 200, got ${r.status}`);
    const profile = r.data?.profile ?? r.data;
    assert(!profile?.crm_tenant_id, `crm_tenant_id should be null/undefined before provisioning, got: ${profile?.crm_tenant_id}`);
  });

  // ── TC5 (re-confirm SSO after profile created, still no CRM) ────────────────
  await test('TC5', 'POST /auth/company/crm-sso — with profile but no crm_tenant_id → 400', async () => {
    const r = await req('POST', '/auth/company/crm-sso', {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    assert(r.status === 400, `Expected 400, got ${r.status}: ${JSON.stringify(r.data)}`);
    assert(r.data?.error, `Response should have error field`);
    // 验证错误信息包含 CRM 相关提示
    const errMsg = (r.data?.error || '').toLowerCase();
    assert(
      errMsg.includes('crm') || errMsg.includes('provision') || errMsg.includes('not'),
      `Error message should indicate CRM not provisioned, got: ${r.data?.error}`
    );
  });

  // ── TC6 ──────────────────────────────────────────────────────────────────────
  await test('TC6', 'GET /sso/consume — no token param → 400', async () => {
    const r = await req('GET', '/sso/consume');
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

  // ── TC7 ──────────────────────────────────────────────────────────────────────
  await test('TC7', 'GET /sso/consume — random invalid token → 400', async () => {
    const fakeToken = crypto.randomBytes(32).toString('hex');
    const r = await req('GET', `/sso/consume?token=${fakeToken}`);
    assert(r.status === 400, `Expected 400, got ${r.status}`);
  });

} finally {
  stopServer();
  await cleanup();
  await conn.end().catch(() => {});
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n══ CRM SSO: ${passed} PASS, ${failed} FAIL ══`);
if (failed > 0) {
  console.log('\n失败项:');
  results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.tc}: ${r.label} — ${r.reason}`));
  process.exit(1);
}
