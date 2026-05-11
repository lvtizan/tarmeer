#!/usr/bin/env node
/**
 * Service Linkage & Login Showcase Harness
 *
 * Tests:
 *   - GET /api/company/services        → DB-driven, not hardcoded 13
 *   - GET /api/site/showcase-images    → returns images array
 *   - GET /api/admin/enums/company-services → public read, structured rows
 *   - Write endpoints without token    → 401/403
 *   - Cache invalidation after CRUD    → requires ADMIN_TOKEN env var
 *
 * Usage:
 *   node scripts/harness/test-service-linkage.mjs
 *   ADMIN_TOKEN=xxx node scripts/harness/test-service-linkage.mjs
 */

const PORT = process.env.PORT || 3002;
const API   = `http://localhost:${PORT}/api`;
const TOKEN = process.env.ADMIN_TOKEN || '';

let passed = 0;
let failed = 0;

function ok(label, detail = '') {
  console.log(`  ✅ ${label}${detail ? ': ' + detail : ''}`);
  passed++;
}
function fail(label, detail = '') {
  console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

async function get(path, token = '') {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API}${path}`, { headers });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function post(path, body, token = '') {
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function del(path, token = '') {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API}${path}`, { method: 'DELETE', headers });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function put(path, body, token = '') {
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(`${API}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// ── TC-01: /api/auth/company/services ────────────────────────────────────────
console.log('\nTC-01: GET /api/auth/company/services (DB-driven)');
{
  const { status, body } = await get('/auth/company/services');
  if (status === 200) ok('returns 200'); else fail('returns 200', `got ${status}`);

  const svcs = body.services;
  if (Array.isArray(svcs)) ok('services is array'); else fail('services is array', JSON.stringify(svcs));

  if (Array.isArray(svcs) && svcs.length > 13) {
    ok('more than 13 services (from DB, not hardcoded)', `got ${svcs.length}`);
  } else {
    fail('more than 13 services', `got ${Array.isArray(svcs) ? svcs.length : 'not array'}`);
  }

  const mustHave = ['Renovation', 'Construction', 'Interior Design'];
  for (const s of mustHave) {
    if (Array.isArray(svcs) && svcs.includes(s)) ok(`contains "${s}"`);
    else fail(`contains "${s}"`, `found: ${JSON.stringify(svcs?.slice(0,5))}...`);
  }
}

// ── TC-02: /api/admin/enums/company-services ──────────────────────────────────
console.log('\nTC-02: GET /api/admin/enums/company-services');
{
  const { status, body } = await get('/admin/enums/company-services', TOKEN);
  if (status === 200) ok('returns 200 (with token)');
  else if (!TOKEN && [401,403].includes(status)) ok('returns 401/403 (no token, expected)');
  else fail('returns 200', `got ${status}`);

  if (status === 200) {
    const rows = body.services;
    if (Array.isArray(rows) && rows.length > 0) ok(`returns ${rows.length} rows`);
    else fail('returns non-empty rows', JSON.stringify(body));

    if (Array.isArray(rows) && rows[0]) {
      const hasFields = 'name' in rows[0] && 'sort_order' in rows[0] && 'active' in rows[0];
      if (hasFields) ok('rows have name/sort_order/active fields');
      else fail('rows have name/sort_order/active fields', JSON.stringify(rows[0]));
    }
  } else {
    console.log('  ⚠️  TC-02 structure checks skipped (no admin token)');
  }
}

// ── TC-03: All admin write/read endpoints require auth ───────────────────────
console.log('\nTC-03: Admin endpoints → 401/403 without token');
{
  const r0 = await get('/admin/enums/company-services');
  if ([401, 403].includes(r0.status)) ok('GET /admin/enums/company-services → 401/403 (router.use requireAdmin)');
  else fail('GET /admin/enums/company-services should be protected', `got ${r0.status}`);

  const r1 = await post('/admin/enums/company-services', { name: 'FAKE' });
  if ([401, 403].includes(r1.status)) ok('POST /admin/enums/company-services → 401/403');
  else fail('POST /admin/enums/company-services should be protected', `got ${r1.status}`);

  const r2 = await put('/admin/enums/company-services/Renovation', { sort_order: 0 });
  if ([401, 403].includes(r2.status)) ok('PUT /admin/enums/company-services/:name → 401/403');
  else fail('PUT /admin/enums/company-services/:name should be protected', `got ${r2.status}`);

  const r3 = await del('/admin/enums/company-services/Renovation');
  if ([401, 403].includes(r3.status)) ok('DELETE /admin/enums/company-services/:name → 401/403');
  else fail('DELETE should be protected', `got ${r3.status}`);

  const r4 = await post('/admin/showcase-images/optimize', { url: 'https://example.com/img.jpg' });
  if ([401, 403].includes(r4.status)) ok('POST /admin/showcase-images/optimize → 401/403');
  else fail('POST showcase optimize should be protected', `got ${r4.status}`);

  const r5 = await put('/admin/system-config', { configs: [] });
  if ([401, 403].includes(r5.status)) ok('PUT /admin/system-config → 401/403');
  else fail('PUT system-config should be protected', `got ${r5.status}`);
}

// ── TC-04: /api/site/showcase-images ─────────────────────────────────────────
console.log('\nTC-04: GET /api/site/showcase-images');
{
  const { status, body } = await get('/site/showcase-images');
  if (status === 200) ok('returns 200');
  else fail('returns 200', `got ${status}`);

  if (Array.isArray(body.images)) ok('images is array');
  else fail('images is array', JSON.stringify(body));
}

// ── TC-05: Cache invalidation (only if ADMIN_TOKEN provided) ──────────────────
if (TOKEN) {
  console.log('\nTC-05: Cache invalidation after CRUD (admin token provided)');
  const TEST_NAME = 'TEST_SVC_HARNESS_' + Date.now();

  const before = await get('/auth/company/services');
  const hadTest = before.body.services?.includes(TEST_NAME);
  if (!hadTest) ok('test service not present before create');
  else fail('test service should not pre-exist');

  const created = await post('/admin/enums/company-services', { name: TEST_NAME }, TOKEN);
  if (created.status === 201) ok('POST creates service → 201');
  else fail('POST creates service', `got ${created.status}: ${JSON.stringify(created.body)}`);

  const after = await get('/auth/company/services');
  if (after.body.services?.includes(TEST_NAME)) ok('new service appears after create (cache invalidated)');
  else fail('new service should appear after create', JSON.stringify(after.body.services?.slice(-5)));

  const deleted = await del(`/admin/enums/company-services/${encodeURIComponent(TEST_NAME)}`, TOKEN);
  if ([200, 204].includes(deleted.status)) ok('DELETE service → 200/204');
  else fail('DELETE service', `got ${deleted.status}`);

  const final = await get('/auth/company/services');
  if (!final.body.services?.includes(TEST_NAME)) ok('deleted service gone (cache invalidated)');
  else fail('deleted service should be gone');
} else {
  console.log('\nTC-05: Cache invalidation — SKIPPED (set ADMIN_TOKEN=xxx to run)');
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log('✅ ALL PASS');
  process.exit(0);
} else {
  console.log('❌ SOME TESTS FAILED');
  process.exit(1);
}
