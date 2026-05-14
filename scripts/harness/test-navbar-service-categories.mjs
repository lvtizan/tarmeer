#!/usr/bin/env node
/**
 * Harness: Navbar Service Categories
 * Verifies /api/public/service-categories returns correct data for navbar rendering.
 *
 * TC1: API returns 200 with categories array
 * TC2: Design Only has all 5 services enabled (after production fix)
 * TC3: All categories have at least 1 sub-service
 * TC4: Tallest category has ≥5 sub-services (drives spacer height in navbar)
 * TC5: Admin toggle: disabling a service removes it from public API
 * TC6: Admin toggle: re-enabling restores it
 * TC7: No category has duplicate sub-service names
 */

const BASE = process.env.API_BASE || 'https://www.tarmeer.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'bbtizan@gmail.com';
const ADMIN_PASS  = process.env.ADMIN_PASS  || 'Tarmeer2026';

let passed = 0;
let failed = 0;

function pass(name) { console.log(`  PASS  ${name}`); passed++; }
function fail(name, reason) { console.log(`  FAIL  ${name}\n        → ${reason}`); failed++; }

async function getToken() {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  const d = await res.json();
  if (!d.token) throw new Error('Admin login failed: ' + JSON.stringify(d));
  return d.token;
}

async function getPublicCategories() {
  const res = await fetch(`${BASE}/api/public/service-categories`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function run() {
  console.log(`\nNavbar Service Categories — ${BASE}\n`);
  const token = await getToken();

  // TC1: API shape
  let data;
  try {
    data = await getPublicCategories();
    if (Array.isArray(data?.categories) && data.categories.length > 0) {
      pass('TC1: /api/public/service-categories returns categories array');
    } else {
      fail('TC1: /api/public/service-categories returns categories array', `got: ${JSON.stringify(data)}`);
      return;
    }
  } catch (e) { fail('TC1', e.message); return; }

  const cats = data.categories;

  // TC2: Design Only has all expected services
  const designOnly = cats.find(c => c.name === 'Design Only');
  const expectedDesignOnly = ['Interior Design', 'Architecture Design', 'Landscape & Outdoor Design', 'MEP & Technical Drawings'];
  if (!designOnly) {
    fail('TC2: Design Only category exists', 'not found in response');
  } else {
    const missing = expectedDesignOnly.filter(s => !designOnly.subs.includes(s));
    if (missing.length === 0) {
      pass(`TC2: Design Only has all expected services (${designOnly.subs.join(', ')})`);
    } else {
      fail('TC2: Design Only has all expected services', `missing: ${missing.join(', ')} | got: ${designOnly.subs.join(', ')}`);
    }
  }

  // TC3: All categories have at least 1 sub
  const emptyCats = cats.filter(c => !c.subs || c.subs.length === 0);
  if (emptyCats.length === 0) {
    pass(`TC3: All ${cats.length} categories have ≥1 sub-service`);
  } else {
    fail('TC3: All categories have ≥1 sub-service', `empty: ${emptyCats.map(c => c.name).join(', ')}`);
  }

  // TC4: Tallest category has ≥5 sub-services (drives spacer height)
  const tallest = cats.reduce((a, b) => b.subs.length > a.subs.length ? b : a, { name: '', subs: [] });
  if (tallest.subs.length >= 5) {
    pass(`TC4: Tallest category "${tallest.name}" has ${tallest.subs.length} services (drives spacer height)`);
  } else {
    fail('TC4: Tallest category has ≥5 sub-services', `tallest is "${tallest.name}" with only ${tallest.subs.length} services`);
  }

  // TC5: Disable a service → disappears from public API
  // Use "Custom Joinery" in "Interiors & Furniture" as the test service
  const testSvcName = 'Custom Joinery';
  const testSvcCat  = 'Interiors & Furniture';
  const testSvc = encodeURIComponent(testSvcName);
  await fetch(`${BASE}/api/admin/enums/company-services/${testSvc}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ active: false }),
  });
  const afterDisable = await getPublicCategories();
  const catAfterDisable = afterDisable.categories?.find(c => c.name === testSvcCat);
  if (!catAfterDisable?.subs.includes(testSvcName)) {
    pass('TC5: Disabling service removes it from public navbar API');
  } else {
    fail('TC5: Disabling service removes it from public navbar API', `${testSvcName} still visible after disable`);
  }

  // TC6: Re-enable → restored
  await fetch(`${BASE}/api/admin/enums/company-services/${testSvc}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ active: true }),
  });
  const afterEnable = await getPublicCategories();
  const catAfterEnable = afterEnable.categories?.find(c => c.name === testSvcCat);
  if (catAfterEnable?.subs.includes(testSvcName)) {
    pass('TC6: Re-enabling service restores it to public navbar API');
  } else {
    fail('TC6: Re-enabling service restores it to public navbar API', `${testSvcName} not restored`);
  }

  // TC7: No duplicate sub-service names within any category
  let hasDupes = false;
  for (const cat of cats) {
    const seen = new Set();
    for (const svc of cat.subs) {
      if (seen.has(svc)) { fail(`TC7: No duplicates in ${cat.name}`, `duplicate: ${svc}`); hasDupes = true; break; }
      seen.add(svc);
    }
  }
  if (!hasDupes) pass('TC7: No duplicate sub-service names in any category');

  console.log(`\n  ${passed} PASS  ${failed} FAIL\n`);
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
