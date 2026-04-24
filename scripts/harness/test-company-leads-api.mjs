#!/usr/bin/env node
/**
 * test-company-leads-api.mjs — Production smoke test for /api/company-leads
 *
 * Tests the full company lead submission flow against live API.
 * Uses unique phone numbers (timestamp-based) to avoid collisions.
 *
 * Usage: node scripts/harness/test-company-leads-api.mjs [--url https://www.tarmeer.com]
 *
 * NOTE: Production rate limit = 5 POST /hour/IP. This test makes 6 POSTs.
 *       If you see 429 errors, wait 1 hour or test against local server instead:
 *       PORT=3099 node scripts/harness/test-company-leads-api.mjs --url http://127.0.0.1:3099
 *
 * Covers:
 *   TC1: Valid submission → 201
 *   TC2: Missing required fields → 400
 *   TC3: Duplicate phone → 409 with phoneExists flag
 *   TC4: Long sourcePage (>200 chars) → still 201 (regression: was 500)
 *   TC5: Long companyName / contactName → still 201 or graceful error
 *   TC6: Invalid year → client-side only, API should accept
 *   TC7: check-phone endpoint → fresh number returns exists=false
 *   TC8: check-phone endpoint → submitted number returns exists=true
 */

const args = process.argv.slice(2);
const urlFlagIdx = args.indexOf('--url');
const BASE = urlFlagIdx !== -1 && args[urlFlagIdx + 1]
  ? args[urlFlagIdx + 1].replace(/\/+$/, '')
  : 'https://www.tarmeer.com';
const API = `${BASE}/api`;

const TS = Date.now();
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

const uniquePhone = `+971${String(TS).slice(-9)}`;
const validPayload = {
  contactName: `Harness Test ${TS}`,
  phone: uniquePhone,
  companyName: `Test Company ${TS}`,
  city: 'Dubai',
  companyType: 'design_studio',
  sourcePage: `${BASE}/for-companies`,
};

console.log(`\n--- Company Leads API Tests (${BASE}) ---\n`);

// TC1: Valid submission
await test('TC1', 'Valid submission returns 201', async () => {
  const res = await fetch(`${API}/company-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${await res.text()}`);
  const data = await res.json();
  if (!data.lead?.id) throw new Error('Response missing lead.id');
});

// TC2: Missing required fields
await test('TC2', 'Missing contactName returns 400', async () => {
  const res = await fetch(`${API}/company-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+971500000001', companyName: 'X' }),
  });
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
});

// TC3: Duplicate phone in company_leads — allowed (409 only if phone in users table)
await test('TC3', 'Duplicate lead phone returns 201 (de-dup is users-only)', async () => {
  const res = await fetch(`${API}/company-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validPayload),
  });
  // 201 = allowed duplicate in company_leads; 409 = phone found in users table
  if (res.status !== 201 && res.status !== 409) throw new Error(`Expected 201 or 409, got ${res.status}`);
});

// TC4: Long sourcePage (regression test for VARCHAR(200) overflow → 500)
await new Promise(r => setTimeout(r, 1000));
await test('TC4', 'Long sourcePage (300+ chars) does NOT cause 500', async () => {
  const longPage = `${BASE}/for-companies?` + 'utm_campaign=' + 'a'.repeat(300);
  const phone2 = `+971${String(TS + 1).slice(-9)}`;
  const res = await fetch(`${API}/company-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...validPayload,
      phone: phone2,
      contactName: `Long URL Test ${TS}`,
      sourcePage: longPage,
    }),
  });
  if (res.status === 500) throw new Error('500 Internal Server Error — source_page column likely too small');
  if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}: ${await res.text()}`);
});

// TC5: Very long company name (boundary test)
await new Promise(r => setTimeout(r, 1000));
await test('TC5', 'Long companyName (255 chars) accepted or graceful error', async () => {
  const phone3 = `+971${String(TS + 2).slice(-9)}`;
  const res = await fetch(`${API}/company-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...validPayload,
      phone: phone3,
      companyName: 'X'.repeat(255),
    }),
  });
  if (res.status === 500) throw new Error('500 — column overflow, needs truncation or larger column');
});

// TC6: Year as string (frontend sends string, backend should handle)
// Add delay to avoid 429 rate limit
await new Promise(r => setTimeout(r, 3000));
await test('TC6', 'Year as string "2020" accepted', async () => {
  const phone4 = `+971${String(TS + 3).slice(-9)}`;
  const res = await fetch(`${API}/company-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...validPayload,
      phone: phone4,
      yearEstablished: '2020',
    }),
  });
  if (res.status === 500) throw new Error(`500 — year handling error`);
  if (res.status === 429) throw new Error(`429 — rate limited, retry later`);
  if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
});

// TC7: check-phone — fresh number
await test('TC7', 'check-phone: fresh number returns exists=false', async () => {
  const freshPhone = `+971${String(TS + 99).slice(-9)}`;
  const res = await fetch(`${API}/company-leads/check-phone?phone=${encodeURIComponent(freshPhone)}`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const data = await res.json();
  if (data.exists !== false) throw new Error(`Expected exists=false, got ${data.exists}`);
});

// TC8: check-phone — submitted number
await test('TC8', 'check-phone: submitted number returns exists=true', async () => {
  const res = await fetch(`${API}/company-leads/check-phone?phone=${encodeURIComponent(uniquePhone)}`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const data = await res.json();
  if (data.exists !== true) throw new Error(`Expected exists=true, got ${data.exists}`);
});

// Summary
console.log(`\n${'='.repeat(55)}`);
console.log(`  RESULT: ${passed} PASS, ${failed} FAIL (${BASE})`);
console.log(`${'='.repeat(55)}\n`);

process.exit(failed > 0 ? 1 : 0);
