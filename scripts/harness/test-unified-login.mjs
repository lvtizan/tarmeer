#!/usr/bin/env node
/**
 * test-unified-login.mjs — 统一登录身份识别 harness
 *
 * 覆盖本次修复：
 *   - check-availability 能正确识别供应商邮箱（返回 emailAvailable: false）
 *   - 主站 POST /api/auth/login 用供应商邮箱登录 → 返回 accountType: 'supplier' + supplierUserId token
 *   - 主站 POST /api/auth/login 用业主/装企邮箱登录 → 无 accountType 字段（正常业主流程）
 *   - 主站 POST /api/auth/register 用供应商邮箱注册 → 400 拒绝
 *
 * Usage:
 *   # 只跑公共接口测试（不需要凭证，部分用例 SKIP）
 *   node scripts/harness/test-unified-login.mjs
 *
 *   # 完整测试（需要已存在的供应商账号 + 业主账号）
 *   node scripts/harness/test-unified-login.mjs \
 *     --url http://localhost:3099 \
 *     --supplier-email supplier@test.com \
 *     --supplier-password secret \
 *     --homeowner-email homeowner@test.com \
 *     --homeowner-password secret
 *
 * TC1:  POST /auth/check-availability 供应商邮箱 → emailAvailable: false
 * TC2:  POST /auth/check-availability 不存在的邮箱 → emailAvailable: true
 * TC3:  POST /auth/login 供应商邮箱+正确密码 → 200, accountType: 'supplier', token 含 supplierUserId
 * TC4:  POST /auth/login 供应商邮箱+错误密码 → 401
 * TC5:  POST /auth/login 业主邮箱+正确密码 → 200, 无 accountType 字段（或非 'supplier'）
 * TC6:  POST /auth/register 供应商邮箱 → 400 拒绝注册
 * TC7:  POST /auth/login 不存在邮箱 → 401
 * TC8:  token 结构验证：供应商 token 解码后含 supplierUserId 字段
 */

import { createDecipheriv } from 'crypto';

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const BASE = (get('--url') || 'http://localhost:3099').replace(/\/+$/, '');
const API = `${BASE}/api`;

const SUPPLIER_EMAIL = get('--supplier-email');
const SUPPLIER_PASSWORD = get('--supplier-password');
const HOMEOWNER_EMAIL = get('--homeowner-email');
const HOMEOWNER_PASSWORD = get('--homeowner-password');

// ─── Reporter ─────────────────────────────────────────────────────────────────

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

function skip(tc, label, reason) {
  results.push({ tc, label, ok: null });
  console.log(`  SKIP | ${tc}: ${label} — ${reason}`);
}

async function test(tc, label, fn) {
  try { await fn(); ok(tc, label); }
  catch (e) { fail(tc, label, e.message ?? String(e)); }
}

function jwtDecode(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n=== Unified Login Identity Detection Tests (${BASE}) ===\n`);

// ─── TC1: check-availability 供应商邮箱识别 ────────────────────────────────────

if (!SUPPLIER_EMAIL) {
  skip('TC1', 'check-availability 供应商邮箱 → emailAvailable: false', '需要 --supplier-email');
} else {
  await test('TC1', 'check-availability 供应商邮箱 → emailAvailable: false', async () => {
    const res = await fetch(`${API}/auth/check-availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SUPPLIER_EMAIL }),
    });
    if (!res.ok) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    if (data.emailAvailable !== false) {
      throw new Error(`Expected emailAvailable: false, got ${JSON.stringify(data.emailAvailable)}`);
    }
  });
}

// ─── TC2: check-availability 不存在邮箱 ────────────────────────────────────────

await test('TC2', 'check-availability 随机不存在邮箱 → emailAvailable: true', async () => {
  const randomEmail = `nonexistent_${Date.now()}@example-test-harness.com`;
  const res = await fetch(`${API}/auth/check-availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: randomEmail }),
  });
  if (!res.ok) throw new Error(`Expected 200, got ${res.status}`);
  const data = await res.json();
  if (data.emailAvailable !== true) {
    throw new Error(`Expected emailAvailable: true, got ${JSON.stringify(data.emailAvailable)}`);
  }
});

// ─── TC3: 供应商登录 → accountType: 'supplier' ──────────────────────────────────

if (!SUPPLIER_EMAIL || !SUPPLIER_PASSWORD) {
  skip('TC3', '主站 login 供应商邮箱 → accountType: supplier', '需要 --supplier-email 和 --supplier-password');
  skip('TC4', '主站 login 供应商邮箱+错误密码 → 401', '需要 --supplier-email');
  skip('TC8', 'supplier token 含 supplierUserId 字段', '需要 --supplier-email 和 --supplier-password');
} else {
  await test('TC3', '主站 login 供应商邮箱+正确密码 → 200, accountType: supplier', async () => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SUPPLIER_EMAIL, password: SUPPLIER_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (data.accountType !== 'supplier') {
      throw new Error(`Expected accountType: 'supplier', got '${data.accountType}'`);
    }
    if (!data.token) throw new Error('Response missing token');
    if (!data.user) throw new Error('Response missing user');
  });

  await test('TC4', '主站 login 供应商邮箱+错误密码 → 401', async () => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SUPPLIER_EMAIL, password: 'wrong-pw-for-testing-401' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('TC8', 'supplier token 解码后含 supplierUserId 字段', async () => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SUPPLIER_EMAIL, password: SUPPLIER_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status}`);
    const data = await res.json();
    const payload = jwtDecode(data.token);
    if (!payload) throw new Error('Cannot decode token');
    if (!payload.supplierUserId) {
      throw new Error(`Token payload missing supplierUserId: ${JSON.stringify(payload)}`);
    }
    if (payload.userId) {
      throw new Error(`Supplier token should NOT contain userId, but got: ${JSON.stringify(payload)}`);
    }
  });
}

// ─── TC5: 业主登录 → 无 accountType ──────────────────────────────────────────

if (!HOMEOWNER_EMAIL || !HOMEOWNER_PASSWORD) {
  skip('TC5', '主站 login 业主邮箱 → 无 accountType (非 supplier)', '需要 --homeowner-email 和 --homeowner-password');
} else {
  await test('TC5', '主站 login 业主邮箱+正确密码 → 200, accountType 不是 supplier', async () => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: HOMEOWNER_EMAIL, password: HOMEOWNER_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (data.accountType === 'supplier') {
      throw new Error('Homeowner login should NOT return accountType: supplier');
    }
    if (!data.token && !data.isAdmin) throw new Error('Response missing token');
  });
}

// ─── TC6: 供应商邮箱注册被拒绝 ─────────────────────────────────────────────────

if (!SUPPLIER_EMAIL) {
  skip('TC6', '主站 register 供应商邮箱 → 400 拒绝', '需要 --supplier-email');
} else {
  await test('TC6', '主站 register 供应商邮箱 → 400 拒绝注册', async () => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: SUPPLIER_EMAIL,
        password: 'registration-blocked-test',
        full_name: 'Test User',
        role: 'homeowner',
      }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    const data = await res.json();
    if (!data.error?.toLowerCase().includes('supplier')) {
      throw new Error(`Error message should mention 'supplier', got: "${data.error}"`);
    }
  });
}

// ─── TC7: 不存在邮箱登录 → 401 ───────────────────────────────────────────────

await test('TC7', '不存在邮箱登录 → 401', async () => {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `ghost_${Date.now()}@harness.test`, password: 'whatever' }),
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

// ─── TC9: 供应商 token 在主站 /auth/me 被拒（401）── token 隔离验证 ─────────────

if (!SUPPLIER_EMAIL || !SUPPLIER_PASSWORD) {
  skip('TC9', '供应商 token → 主站 /auth/me → 401（token 不应被主站接受）', '需要 --supplier-email 和 --supplier-password');
} else {
  await test('TC9', '供应商 token → 主站 /auth/me → 401', async () => {
    // 先登录拿 token
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SUPPLIER_EMAIL, password: SUPPLIER_PASSWORD }),
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
    const loginData = await loginRes.json();
    if (loginData.accountType !== 'supplier') throw new Error(`Expected accountType: supplier, got: ${loginData.accountType}`);

    // 用 supplier token 访问主站 /auth/me — 必须被拒绝
    const meRes = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    if (meRes.status !== 401) {
      throw new Error(`Supplier token should NOT be accepted by main-site /auth/me — expected 401, got ${meRes.status}`);
    }
  });
}

// ─── TC10: 供应商 token 能访问供应商接口 ─────────────────────────────────────

if (!SUPPLIER_EMAIL || !SUPPLIER_PASSWORD) {
  skip('TC10', '供应商 token → /suppliers/me/profile → 200', '需要 --supplier-email 和 --supplier-password');
} else {
  await test('TC10', '供应商 token → /suppliers/me/profile → 200', async () => {
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: SUPPLIER_EMAIL, password: SUPPLIER_PASSWORD }),
    });
    if (!loginRes.ok) throw new Error(`Login failed: ${loginRes.status}`);
    const loginData = await loginRes.json();

    const profileRes = await fetch(`${API}/suppliers/me/profile`, {
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    if (!profileRes.ok) {
      throw new Error(`Supplier token should be accepted by /suppliers/me/profile — got ${profileRes.status}`);
    }
  });
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed cases:');
  results.filter(r => r.ok === false).forEach(r => console.log(`  ${r.tc}: ${r.label} — ${r.reason}`));
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
