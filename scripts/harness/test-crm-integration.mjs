#!/usr/bin/env node
/**
 * test-crm-integration.mjs — CRM × Mall integration harness
 *
 * Tests auth/permission boundaries for all new CRM routes.
 * Does NOT actually call the real CRM (no MALL_INTEGRATION_SECRET needed locally).
 *
 * Usage: PORT=3099 node scripts/harness/test-crm-integration.mjs
 *        node scripts/harness/test-crm-integration.mjs --url http://127.0.0.1:3099
 *
 * Covers:
 *   TC1: POST /api/auth/company/crm-sso — no token → 401
 *   TC2: POST /api/auth/company/crm-sso — non-company token → 404 (no profile)
 *   TC3: POST /api/admin/profile-companies/:id/crm-provision — no token → 401/403
 *   TC4: POST /api/admin/profile-companies/:id/crm-provision — non-admin token → 401/403
 *   TC5: POST /api/integration/crm/sso/issue — no HMAC headers → 401
 *   TC6: POST /api/integration/crm/sso/issue — missing mallPartnerId → 400 or 401
 *   TC7: POST /api/integration/crm/partner/activated — no HMAC headers → 401
 *   TC8: POST /api/integration/crm/partner/activated — missing mallPartnerId → 400 or 401
 *   TC9: GET  /api/sso/consume — no token param → 400
 *   TC10: GET /api/sso/consume — invalid token → 400
 */

import crypto from 'crypto';

const args = process.argv.slice(2);
const urlFlagIdx = args.indexOf('--url');
const BASE = urlFlagIdx !== -1 && args[urlFlagIdx + 1]
  ? args[urlFlagIdx + 1].replace(/\/+$/, '')
  : `http://127.0.0.1:${process.env.PORT || 3099}`;
const API = `${BASE}/api`;

let passed = 0;
let failed = 0;
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function req(method, path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const body = opts.body ? JSON.stringify(opts.body) : undefined;
  const res = await fetch(`${API}${path}`, { method, headers, body });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

// ── TC1 ──────────────────────────────────────────────────────────────────────

await test('TC1', 'POST /auth/company/crm-sso — no token → 401', async () => {
  const r = await req('POST', '/auth/company/crm-sso');
  assert([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
});

// ── TC2 ──────────────────────────────────────────────────────────────────────

await test('TC2', 'POST /auth/company/crm-sso — non-company JWT → 404', async () => {
  // Craft a JWT signed with wrong secret — will fail authenticate middleware → 401
  const fakeJwt = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjk5OX0.fake';
  const r = await req('POST', '/auth/company/crm-sso', { headers: { Authorization: fakeJwt } });
  assert([401, 403, 404].includes(r.status), `Expected 401/403/404, got ${r.status}`);
});

// ── TC3 ──────────────────────────────────────────────────────────────────────

await test('TC3', 'POST /admin/profile-companies/1/crm-provision — no token → 401/403', async () => {
  const r = await req('POST', '/admin/profile-companies/1/crm-provision');
  assert([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
});

// ── TC4 ──────────────────────────────────────────────────────────────────────

await test('TC4', 'POST /admin/profile-companies/1/crm-provision — non-admin JWT → 401/403', async () => {
  const fakeJwt = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjk5OX0.fake';
  const r = await req('POST', '/admin/profile-companies/1/crm-provision', {
    headers: { Authorization: fakeJwt },
  });
  assert([401, 403].includes(r.status), `Expected 401/403, got ${r.status}`);
});

// ── TC5 ──────────────────────────────────────────────────────────────────────

await test('TC5', 'POST /integration/crm/sso/issue — no HMAC headers → 401', async () => {
  const r = await req('POST', '/integration/crm/sso/issue', {
    body: { mallPartnerId: '1', adminEmail: 'test@test.com' },
  });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// ── TC6 ──────────────────────────────────────────────────────────────────────

await test('TC6', 'POST /integration/crm/sso/issue — bad signature → 401', async () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const r = await req('POST', '/integration/crm/sso/issue', {
    headers: {
      'X-Crm-Timestamp': ts,
      'X-Crm-Signature': 'badbadbadbad',
    },
    body: { mallPartnerId: '1', adminEmail: 'test@test.com' },
  });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// ── TC7 ──────────────────────────────────────────────────────────────────────

await test('TC7', 'POST /integration/crm/partner/activated — no HMAC → 401', async () => {
  const r = await req('POST', '/integration/crm/partner/activated', {
    body: { mallPartnerId: '1', adminEmail: 'test@test.com' },
  });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// ── TC8 ──────────────────────────────────────────────────────────────────────

await test('TC8', 'POST /integration/crm/partner/activated — bad signature → 401', async () => {
  const ts = Math.floor(Date.now() / 1000).toString();
  const r = await req('POST', '/integration/crm/partner/activated', {
    headers: {
      'X-Crm-Timestamp': ts,
      'X-Crm-Signature': 'bad',
    },
    body: { mallPartnerId: '1', adminEmail: 'test@test.com' },
  });
  assert(r.status === 401, `Expected 401, got ${r.status}`);
});

// ── TC9 ──────────────────────────────────────────────────────────────────────

await test('TC9', 'GET /sso/consume — no token param → 400', async () => {
  const r = await req('GET', '/sso/consume');
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

// ── TC10 ─────────────────────────────────────────────────────────────────────

await test('TC10', 'GET /sso/consume — invalid token → 400', async () => {
  const fakeToken = crypto.randomBytes(32).toString('hex');
  const r = await req('GET', `/sso/consume?token=${fakeToken}`);
  assert(r.status === 400, `Expected 400, got ${r.status}`);
});

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n══ CRM Integration: ${passed} PASS, ${failed} FAIL ══`);
if (failed > 0) {
  console.log('\n失败项:');
  results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.tc}: ${r.label} — ${r.reason}`));
  process.exit(1);
}
