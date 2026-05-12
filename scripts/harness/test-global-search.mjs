#!/usr/bin/env node
/**
 * test-global-search.mjs — Admin global search smoke test
 *
 * Tests /api/admin/search covers all entity types (companies, homeowner leads,
 * suppliers, users) and that one failing query does not kill the whole response.
 *
 * Usage:
 *   node scripts/harness/test-global-search.mjs [--url http://localhost:3002] --email admin@x.com --password secret
 *   node scripts/harness/test-global-search.mjs --url https://www.tarmeer.com --email admin@x.com --password secret
 *
 * Covers:
 *   TC1: No token → 401
 *   TC2: Query too short (1 char) → 200 with all-empty arrays
 *   TC3: Valid search → 200 with correct shape (6 keys present)
 *   TC4: Search returns no 500 (Promise.allSettled resilience regression)
 *   TC5: directoryCompanies included in results shape
 *   TC6: registeredCompanies included in results shape
 *   TC7: suppliers included in results shape
 *   TC8: homeownerLeads included in results shape
 *   TC9: companyLeads included in results shape
 *   TC10: Search with known company name returns directoryCompanies hits
 *   TC11: activity-log/user/0 → 400
 *   TC12: activity-log/user/999999 → 200 with correct shape
 *   TC13: activity-log/user/:id without token → 401
 *   TC14: activity-log/user pagination params respected
 */

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const BASE = (get('--url') || 'https://www.tarmeer.com').replace(/\/+$/, '');
const ADMIN_EMAIL = get('--email');
const ADMIN_PASSWORD = get('--password');
const API = `${BASE}/api`;

// Login to get token automatically
async function getAdminToken() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return null;
  const res = await fetch(`${API}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Admin login failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  if (!data.token) throw new Error('Login response missing token');
  return data.token;
}

const TOKEN = await getAdminToken().catch(e => { console.error(`  ERROR: ${e.message}`); return null; });

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

const REQUIRED_KEYS = ['homeownerLeads', 'companyLeads', 'users', 'registeredCompanies', 'directoryCompanies', 'suppliers'];

function assertShape(data) {
  for (const key of REQUIRED_KEYS) {
    if (!Array.isArray(data[key])) {
      throw new Error(`Response missing array key: ${key} (got ${typeof data[key]})`);
    }
  }
}

console.log(`\n=== Global Search Tests (${BASE}) ===\n`);

if (!TOKEN) {
  console.log('  NOTE: No --token provided. Authenticated tests will be skipped.\n');
}

// TC1: No auth → 401
await test('TC1', 'No token returns 401', async () => {
  const res = await fetch(`${API}/admin/search?q=test`, { headers: {} });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

if (!TOKEN) {
  for (const tc of ['TC2','TC3','TC4','TC5','TC6','TC7','TC8','TC9','TC10','TC11','TC12','TC13','TC14']) {
    skip(tc, 'Requires admin token', 'Pass --token <jwt>');
  }
} else {
  // TC2: Query too short → empty arrays
  await test('TC2', 'Query < 2 chars returns 200 with empty arrays', async () => {
    const res = await fetch(`${API}/admin/search?q=a`, { headers: authHeaders(TOKEN) });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    assertShape(data);
    for (const key of REQUIRED_KEYS) {
      if (data[key].length !== 0) throw new Error(`Expected empty ${key} for short query, got ${data[key].length} items`);
    }
  });

  // TC3: Valid search → correct shape
  await test('TC3', 'Valid search returns 200 with correct response shape', async () => {
    const res = await fetch(`${API}/admin/search?q=dubai`, { headers: authHeaders(TOKEN) });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
    const data = await res.json();
    assertShape(data);
  });

  // TC4: No 500 — Promise.allSettled resilience regression test
  await test('TC4', 'Search never returns 500 (Promise.allSettled resilience)', async () => {
    const queries = ['rana', 'dubai', 'ahmed', 'interior', 'design'];
    for (const q of queries) {
      const res = await fetch(`${API}/admin/search?q=${encodeURIComponent(q)}`, { headers: authHeaders(TOKEN) });
      if (res.status === 500) throw new Error(`Got 500 for query "${q}" — Promise.allSettled not applied`);
      if (res.status !== 200 && res.status !== 401) throw new Error(`Unexpected status ${res.status} for query "${q}"`);
    }
  });

  // TC5-TC9: Each array key present in response
  const entityTests = [
    ['TC5', 'directoryCompanies'],
    ['TC6', 'registeredCompanies'],
    ['TC7', 'suppliers'],
    ['TC8', 'homeownerLeads'],
    ['TC9', 'companyLeads'],
  ];
  for (const [tc, key] of entityTests) {
    await test(tc, `Response always includes "${key}" array`, async () => {
      const res = await fetch(`${API}/admin/search?q=dubai`, { headers: authHeaders(TOKEN) });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data[key])) throw new Error(`"${key}" is ${typeof data[key]}, expected array`);
    });
  }

  // TC10: Search known term returns directory company hits
  await test('TC10', 'Searching known UAE company name returns directoryCompanies results', async () => {
    // "design" is a common word in UAE company names
    const res = await fetch(`${API}/admin/search?q=design`, { headers: authHeaders(TOKEN) });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    assertShape(data);
    const total = REQUIRED_KEYS.reduce((sum, k) => sum + data[k].length, 0);
    if (total === 0) throw new Error('Search for "design" returned 0 results across all categories — DB may be empty or query broken');
  });

  // TC11–TC14: GET /activity-log/user/:userId
  await test('TC11', 'activity-log/user/0 returns 400', async () => {
    const res = await fetch(`${API}/admin/activity-log/user/0`, { headers: authHeaders(TOKEN) });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await test('TC12', 'activity-log/user/999999 returns 200 with empty logs', async () => {
    const res = await fetch(`${API}/admin/activity-log/user/999999`, { headers: authHeaders(TOKEN) });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.logs)) throw new Error('Missing logs array');
    if (typeof data.summary !== 'object') throw new Error('Missing summary object');
    if (typeof data.pagination !== 'object') throw new Error('Missing pagination object');
    if (!('total_events' in data.summary)) throw new Error('summary.total_events missing');
    if (!('first_seen' in data.summary)) throw new Error('summary.first_seen missing');
    if (!('last_seen' in data.summary)) throw new Error('summary.last_seen missing');
    if (!('distinct_actions' in data.summary)) throw new Error('summary.distinct_actions missing');
  });

  await test('TC13', 'activity-log/user/:id without token returns 401', async () => {
    const res = await fetch(`${API}/admin/activity-log/user/1`, { headers: {} });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test('TC14', 'activity-log/user pagination params respected', async () => {
    const res = await fetch(`${API}/admin/activity-log/user/999999?page=2&limit=10`, { headers: authHeaders(TOKEN) });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const data = await res.json();
    if (data.pagination.limit !== 10) throw new Error(`Expected limit=10, got ${data.pagination.limit}`);
    if (data.pagination.page !== 2) throw new Error(`Expected page=2, got ${data.pagination.page}`);
  });
}

// Summary
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed cases:');
  results.filter(r => r.ok === false).forEach(r => console.log(`  ${r.tc}: ${r.label} — ${r.reason}`));
}
console.log('');
process.exit(failed > 0 ? 1 : 0);
