#!/usr/bin/env node
/**
 * test-activity-log.mjs — Activity log API smoke tests
 *
 * Usage:
 *   node scripts/harness/test-activity-log.mjs [--url http://localhost:3002] --email admin@x.com --password secret
 *
 * Covers:
 *   TC1: No token → /activity-log → 401
 *   TC2: No token → /activity-log/stats → 401
 *   TC3: No token → /activity-log/top-users → 401
 *   TC4: Valid token → /activity-log → 200 with correct shape
 *   TC5: logs[] items have required fields (no undefined action/created_at)
 *   TC6: stats returns today/action_distribution/daily_trend
 *   TC7: top-users returns users[]
 *   TC8: /activity-log?role=company filter works
 *   TC9: /activity-log?action=login filter works
 *   TC10: metadata field is null or a valid JSON object (not crashing the frontend)
 */

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const BASE = (get('--url') || 'http://localhost:3002').replace(/\/+$/, '');
const API  = `${BASE}/api/admin`;
const ADMIN_EMAIL    = get('--email');
const ADMIN_PASSWORD = get('--password');

let passed = 0, failed = 0, skipped = 0;
function ok(tc, label)               { console.log(`  PASS  TC${tc}: ${label}`); passed++; }
function fail(tc, label, reason)     { console.error(`  FAIL  TC${tc}: ${label} — ${reason}`); failed++; }
function skip(tc, label, reason)     { console.log(`  SKIP  TC${tc}: ${label} — ${reason}`); skipped++; }

async function test(tc, label, fn) {
  try { await fn(); } catch (e) { fail(tc, label, e.message); }
}

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function getAdminToken() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return null;
  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.token;
  } catch (e) { console.error('Auth error:', e.message); return null; }
}

(async () => {
  console.log(`\n══ Activity Log API Tests → ${BASE} ══\n`);

  // TC1-3: Unauthenticated → 401
  await test(1, 'No token → /activity-log → 401', async () => {
    const res = await fetch(`${API}/activity-log`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    ok(1, 'No token → /activity-log → 401');
  });
  await test(2, 'No token → /activity-log/stats → 401', async () => {
    const res = await fetch(`${API}/activity-log/stats`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    ok(2, 'No token → /activity-log/stats → 401');
  });
  await test(3, 'No token → /activity-log/top-users → 401', async () => {
    const res = await fetch(`${API}/activity-log/top-users`);
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    ok(3, 'No token → /activity-log/top-users → 401');
  });

  const token = await getAdminToken();
  if (!token) {
    skip(4, 'Valid token tests', 'no --email/--password provided');
    skip(5, 'log entry field validation', 'no --email/--password provided');
    skip(6, 'stats shape', 'no --email/--password provided');
    skip(7, 'top-users shape', 'no --email/--password provided');
    skip(8, 'role filter', 'no --email/--password provided');
    skip(9, 'action filter', 'no --email/--password provided');
    skip(10, 'metadata field safety', 'no --email/--password provided');
  } else {
    // TC4: basic 200 + shape
    await test(4, 'Valid token → /activity-log → 200 with logs/pagination', async () => {
      const res = await fetch(`${API}/activity-log?limit=10`, { headers: authHeaders(token) });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (!Array.isArray(data.logs)) throw new Error('data.logs is not an array');
      if (!data.pagination) throw new Error('data.pagination missing');
      ok(4, `Valid token → /activity-log → 200 (${data.logs.length} entries)`);
    });

    // TC5: Entry field validation — each entry must have action + created_at
    await test(5, 'Log entries have required fields (no undefined crashes frontend)', async () => {
      const res = await fetch(`${API}/activity-log?limit=50`, { headers: authHeaders(token) });
      const data = await res.json();
      let nullCreatedAt = 0, nullAction = 0;
      for (const e of data.logs || []) {
        if (!e.created_at) nullCreatedAt++;
        if (!e.action)     nullAction++;
      }
      if (nullCreatedAt > 0) throw new Error(`${nullCreatedAt} entries have null/undefined created_at (frontend crash risk)`);
      if (nullAction > 0)    throw new Error(`${nullAction} entries have null/undefined action`);
      ok(5, `All ${data.logs.length} entries have created_at + action`);
    });

    // TC6: Stats shape
    await test(6, '/activity-log/stats returns today + distribution + trend', async () => {
      const res = await fetch(`${API}/activity-log/stats?days=7`, { headers: authHeaders(token) });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (!data.today) throw new Error('data.today missing');
      if (!Array.isArray(data.action_distribution)) throw new Error('action_distribution not array');
      if (!Array.isArray(data.daily_trend)) throw new Error('daily_trend not array');
      ok(6, `stats: today.total=${data.today.total}, dist=${data.action_distribution.length} types`);
    });

    // TC7: Top users shape
    await test(7, '/activity-log/top-users returns users[]', async () => {
      const res = await fetch(`${API}/activity-log/top-users?days=1`, { headers: authHeaders(token) });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (!Array.isArray(data.users)) throw new Error('data.users not array');
      ok(7, `top-users: ${data.users.length} users found`);
    });

    // TC8: role=company filter
    await test(8, '?role=company filter returns only company entries', async () => {
      const res = await fetch(`${API}/activity-log?role=company&limit=20`, { headers: authHeaders(token) });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const data = await res.json();
      const nonCompany = (data.logs || []).filter((e) => e.user_role && e.user_role !== 'company');
      if (nonCompany.length > 0) throw new Error(`${nonCompany.length} non-company entries returned with role=company filter`);
      ok(8, `role=company filter: ${data.logs.length} entries (0 non-company)`);
    });

    // TC9: action=login filter
    await test(9, '?action=login filter returns only login entries', async () => {
      const res = await fetch(`${API}/activity-log?action=login&limit=20`, { headers: authHeaders(token) });
      if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
      const data = await res.json();
      const nonLogin = (data.logs || []).filter((e) => e.action !== 'login');
      if (nonLogin.length > 0) throw new Error(`${nonLogin.length} non-login entries with action=login filter`);
      ok(9, `action=login filter: ${data.logs.length} entries (0 non-login)`);
    });

    // TC10: metadata is null OR parseable JSON (not malformed)
    await test(10, 'metadata field is null or parseable (no frontend crash)', async () => {
      const res = await fetch(`${API}/activity-log?limit=50`, { headers: authHeaders(token) });
      const data = await res.json();
      let bad = 0;
      for (const e of data.logs || []) {
        if (e.metadata === null || e.metadata === undefined) continue;
        if (typeof e.metadata === 'object') continue; // already parsed
        if (typeof e.metadata === 'string') {
          try { JSON.parse(e.metadata); } catch { bad++; }
        } else { bad++; }
      }
      if (bad > 0) throw new Error(`${bad} entries have malformed metadata (not null, not object, not valid JSON)`);
      ok(10, 'All metadata fields are null or valid');
    });
  }

  console.log(`\n══ 结果: ${passed} PASS, ${failed} FAIL, ${skipped} SKIP ══\n`);
  process.exit(failed > 0 ? 1 : 0);
})();
