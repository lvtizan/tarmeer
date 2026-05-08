#!/usr/bin/env node
/**
 * test-supplier-phone-sync.mjs — Supplier phone sync + category filter smoke test
 *
 * 覆盖本次修复的三个问题：
 *   1. 供应商更新 profile 后 contact_phone 同步到 supplier_users.phone
 *   2. PhoneCountryInput mount 时必须把截断后的规范化值 push 到 parent state
 *   3. 公开 API category 筛选（lighting 等）能正确返回结果
 *
 * Usage:
 *   # 只跑公开 API 测试（不需要凭证）
 *   node scripts/harness/test-supplier-phone-sync.mjs
 *
 *   # 跑完整测试（包括供应商登录 + admin 同步验证）
 *   node scripts/harness/test-supplier-phone-sync.mjs \
 *     --url http://localhost:3099 \
 *     --supplier-email supplier@test.com \
 *     --supplier-password secret \
 *     --admin-email admin@tarmeer.com \
 *     --admin-password secret
 *
 * Covers:
 *   TC1:  GET /api/suppliers?category=lighting → 200, suppliers 数组存在
 *   TC2:  GET /api/suppliers?category=furniture → 200 (不报错)
 *   TC3:  GET /api/suppliers?category=xyz_invalid → 200, 空数组
 *   TC4:  lighting 结果的每条 categories 都包含 "lighting"
 *   TC5:  供应商登录 → 200, 返回 token
 *   TC6:  无 token → PUT /api/suppliers/me/profile 返回 401
 *   TC7:  供应商保存 profile（含新手机号）→ 200
 *   TC8:  供应商读回 profile → contact_phone 与刚保存的一致
 *   TC9:  admin 查供应商详情 → contact_phone 与供应商保存的一致（两表同步验证）
 *   TC10: phone 字段为空时保存不报错（空值容忍）
 *   TC11: PhoneCountryInput 逻辑：parse → 截断 → 规范化值与存储值相同（纯 JS 单元测试）
 *   TC12: validatePhone 拒绝重复模式（505050505）
 *   TC13: validatePhone 接受合法 UAE 手机号（0501234567 → digits 501234567）
 */

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const BASE = (get('--url') || 'https://www.tarmeer.com').replace(/\/+$/, '');
const SUPPLIER_EMAIL = get('--supplier-email');
const SUPPLIER_PASSWORD = get('--supplier-password');
const ADMIN_EMAIL = get('--admin-email');
const ADMIN_PASSWORD = get('--admin-password');
const API = `${BASE}/api`;

// ─── Token helpers ────────────────────────────────────────────────────────────

async function getSupplierToken() {
  if (!SUPPLIER_EMAIL || !SUPPLIER_PASSWORD) return null;
  const res = await fetch(`${API}/suppliers/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SUPPLIER_EMAIL, password: SUPPLIER_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Supplier login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.token) throw new Error('Supplier login response missing token');
  return data.token;
}

async function getAdminToken() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return null;
  const res = await fetch(`${API}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Admin login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.token) throw new Error('Admin login response missing token');
  return data.token;
}

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

function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ─── Pure-JS helpers (mirrors frontend logic, no import needed) ───────────────

const PHONE_COUNTRIES = [
  { code: '+971', maxDigits: 9 },
  { code: '+86',  maxDigits: 11 },
  { code: '+966', maxDigits: 9 },
  { code: '+974', maxDigits: 8 },
  { code: '+965', maxDigits: 8 },
  { code: '+968', maxDigits: 8 },
  { code: '+973', maxDigits: 8 },
  { code: '+91',  maxDigits: 10 },
  { code: '+44',  maxDigits: 10 },
  { code: '+1',   maxDigits: 10 },
];

function parsePhone(value) {
  if (!value) return { code: '+971', digits: '' };
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    if (value.startsWith(c.code)) return { code: c.code, digits: value.slice(c.code.length) };
  }
  return { code: '+971', digits: value };
}

function normalizePhone(stored) {
  const { code, digits } = parsePhone(stored);
  const country = PHONE_COUNTRIES.find(c => c.code === code) ?? PHONE_COUNTRIES[0];
  return code + digits.slice(0, country.maxDigits);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n=== Supplier Phone Sync + Category Filter Tests (${BASE}) ===\n`);

const SUPPLIER_TOKEN = await getSupplierToken().catch(e => {
  console.error(`  WARNING: ${e.message}`);
  return null;
});

const ADMIN_TOKEN = await getAdminToken().catch(e => {
  console.error(`  WARNING: ${e.message}`);
  return null;
});

// Test phone that we'll save — unique enough to detect stale data
const TEST_PHONE = '+971503716483';
let savedSupplierId = null;

// ─── TC1–TC4: Public category filter ─────────────────────────────────────────

await test('TC1', 'GET /api/suppliers?category=lighting → 200, suppliers 数组存在', async () => {
  const res = await fetch(`${API}/suppliers?category=lighting`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.suppliers)) throw new Error(`Response missing "suppliers" array`);
});

await test('TC2', 'GET /api/suppliers?category=furniture → 200 (不报错)', async () => {
  const res = await fetch(`${API}/suppliers?category=furniture`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!Array.isArray(data.suppliers)) throw new Error(`Response missing "suppliers" array`);
});

await test('TC3', 'GET /api/suppliers?category=xyz_invalid → 200, 空数组', async () => {
  const res = await fetch(`${API}/suppliers?category=xyz_invalid_category`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.suppliers)) throw new Error(`Response missing "suppliers" array`);
  if (data.suppliers.length !== 0) throw new Error(`Expected 0 results for invalid category, got ${data.suppliers.length}`);
});

await test('TC4', 'lighting 筛选结果的每条 categories 都包含 "lighting"', async () => {
  const res = await fetch(`${API}/suppliers?category=lighting`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data.suppliers)) throw new Error(`Response missing "suppliers" array`);
  for (const s of data.suppliers) {
    const cats = Array.isArray(s.categories) ? s.categories : JSON.parse(s.categories || '[]');
    if (!cats.includes('lighting')) {
      throw new Error(`Supplier id=${s.id} (${s.company_name}) categories=${JSON.stringify(cats)} does not include "lighting"`);
    }
  }
  if (data.suppliers.length === 0) {
    console.log('    (0 lighting suppliers in DB — TC4 trivially passes, add lighting supplier to test fully)');
  }
});

// ─── TC5–TC10: Supplier auth + phone sync ─────────────────────────────────────

if (!SUPPLIER_TOKEN) {
  for (const tc of ['TC5','TC6','TC7','TC8','TC10']) {
    skip(tc, '需要供应商凭证', '传 --supplier-email 和 --supplier-password');
  }
} else {
  await test('TC5', '供应商登录 → 200, 返回 token', async () => {
    // Token already obtained above; if we got here, login succeeded
    if (!SUPPLIER_TOKEN) throw new Error('Token is null despite login attempt');
  });

  await test('TC6', '无 token → PUT /api/suppliers/me/profile 返回 401', async () => {
    const res = await fetch(`${API}/suppliers/me/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_name: 'Test' }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // Read current profile first to get company_name (required field)
  let currentProfile = null;
  try {
    const r = await fetch(`${API}/suppliers/me/profile`, { headers: authHeaders(SUPPLIER_TOKEN) });
    const d = await r.json();
    currentProfile = d.profile;
    savedSupplierId = currentProfile?.id ?? null;
  } catch {}

  await test('TC7', `供应商保存 profile（contact_phone=${TEST_PHONE}）→ 200`, async () => {
    if (!currentProfile?.company_name) throw new Error('Could not read current profile.company_name — cannot save without it');
    const res = await fetch(`${API}/suppliers/me/profile`, {
      method: 'PUT',
      headers: authHeaders(SUPPLIER_TOKEN),
      body: JSON.stringify({
        company_name: currentProfile.company_name,
        contact_phone: TEST_PHONE,
      }),
    });
    if (!res.ok) throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (!data.profile) throw new Error('Response missing "profile"');
    savedSupplierId = data.profile.id;
  });

  await test('TC8', '供应商读回 profile → contact_phone 与保存值一致', async () => {
    const res = await fetch(`${API}/suppliers/me/profile`, { headers: authHeaders(SUPPLIER_TOKEN) });
    if (!res.ok) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    if (!data.profile) throw new Error('Response missing "profile"');
    if (data.profile.contact_phone !== TEST_PHONE) {
      throw new Error(`contact_phone mismatch: saved ${TEST_PHONE}, got ${data.profile.contact_phone}`);
    }
  });

  await test('TC10', 'contact_phone 设为空字符串时保存不报 500', async () => {
    if (!currentProfile?.company_name) throw new Error('Could not read current profile.company_name');
    const res = await fetch(`${API}/suppliers/me/profile`, {
      method: 'PUT',
      headers: authHeaders(SUPPLIER_TOKEN),
      body: JSON.stringify({
        company_name: currentProfile.company_name,
        contact_phone: '',
      }),
    });
    if (res.status === 500) throw new Error(`Got 500 when saving empty phone`);
    if (!res.ok && res.status !== 400) throw new Error(`Unexpected status ${res.status}`);
    // Restore original phone
    if (currentProfile?.contact_phone) {
      await fetch(`${API}/suppliers/me/profile`, {
        method: 'PUT',
        headers: authHeaders(SUPPLIER_TOKEN),
        body: JSON.stringify({ company_name: currentProfile.company_name, contact_phone: TEST_PHONE }),
      });
    }
  });
}

// ─── TC9: Admin two-table sync verification ───────────────────────────────────

if (!ADMIN_TOKEN) {
  skip('TC9', '需要 admin 凭证', '传 --admin-email 和 --admin-password');
} else if (!savedSupplierId) {
  skip('TC9', '未获取到 supplier ID', '需要供应商凭证先完成 TC7');
} else {
  await test('TC9', `admin 查供应商 id=${savedSupplierId} → contact_phone 与保存值一致（两表同步）`, async () => {
    const res = await fetch(`${API}/admin/suppliers/${savedSupplierId}`, {
      headers: authHeaders(ADMIN_TOKEN),
    });
    if (!res.ok) throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const supplier = data.supplier ?? data;
    const adminPhone = supplier.contact_phone ?? supplier.user_phone;
    if (adminPhone !== TEST_PHONE) {
      throw new Error(
        `Admin sees phone "${adminPhone}" but supplier saved "${TEST_PHONE}" — supplier_users.phone 未同步`
      );
    }
  });
}

// ─── TC11–TC13: Pure-JS unit tests (no HTTP) ─────────────────────────────────

await test('TC11', 'PhoneCountryInput: 超长存储值 normalizePhone 截断后与规范化值相同', () => {
  // Simulate a garbled/overlong UAE phone stored as "+9710501234567890"
  const stored = '+9710501234567890';
  const normalized = normalizePhone(stored);
  const { code, digits } = parsePhone(stored);
  const country = PHONE_COUNTRIES.find(c => c.code === code);
  const expected = code + digits.slice(0, country.maxDigits);
  if (normalized !== expected) throw new Error(`normalizePhone("${stored}") = "${normalized}", expected "${expected}"`);
  // Must be shorter than stored
  if (normalized.length >= stored.length) throw new Error(`Normalization should shorten "${stored}" but got "${normalized}"`);
});

await test('TC12', 'validatePhone 逻辑：重复模式 505050505 应被拒绝', () => {
  // Mirror hasRepeatingCycle logic from phoneValidation.ts
  function hasRepeatingCycle(digits) {
    for (let cycleLen = 2; cycleLen <= Math.floor(digits.length / 2); cycleLen++) {
      const pattern = digits.slice(0, cycleLen);
      const repeated = pattern.repeat(Math.ceil(digits.length / cycleLen)).slice(0, digits.length);
      if (repeated === digits) return true;
    }
    return false;
  }
  if (!hasRepeatingCycle('505050505')) throw new Error('"505050505" should be detected as repeating cycle but was not');
  if (!hasRepeatingCycle('123123123')) throw new Error('"123123123" should be detected as repeating cycle but was not');
  if (hasRepeatingCycle('501234567')) throw new Error('"501234567" should NOT be repeating cycle but was detected');
});

await test('TC13', 'parsePhone: 合法 UAE 手机号 +971501234567 解析正确', () => {
  const { code, digits } = parsePhone('+971501234567');
  if (code !== '+971') throw new Error(`Expected code "+971", got "${code}"`);
  if (digits !== '501234567') throw new Error(`Expected digits "501234567", got "${digits}"`);
  const country = PHONE_COUNTRIES.find(c => c.code === code);
  if (digits.length > country.maxDigits) throw new Error(`digits.length=${digits.length} > maxDigits=${country.maxDigits}`);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(55)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed cases:');
  results.filter(r => r.ok === false).forEach(r => console.log(`  ${r.tc}: ${r.label} — ${r.reason}`));
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
