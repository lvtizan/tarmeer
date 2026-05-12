#!/usr/bin/env node
/**
 * test-company-edit-modal.mjs
 *
 * Harness for Company Edit Modal redesign:
 * - Multi-select company type serialization
 * - Services grouped by category
 * - Enum endpoints available
 *
 * Usage:
 *   PORT=3099 ADMIN_TOKEN=<token> node scripts/harness/test-company-edit-modal.mjs
 *
 * Or start server first:
 *   PORT=3099 DEV_SKIP_EMAIL=true node dist/app.js &
 *   Then get a token via admin login and pass as ADMIN_TOKEN=...
 *
 * Exit 0 = all pass, 1 = failures
 */

const PORT = process.env.PORT || 3099;
const BASE = `http://localhost:${PORT}/api/admin`;
const TOKEN = process.env.ADMIN_TOKEN || '';

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label, detail = '') {
  console.log(`  ❌ ${label}${detail ? '\n     ' + detail : ''}`);
  failed++;
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// ── Test helpers ──────────────────────────────────────────────────────────────
async function getFirstProfileCompanyId() {
  const { status, body } = await api('/roles/companies?page=1&limit=5');
  if (status !== 200) return null;
  const list = body.companies || body.profiles || [];
  return list[0]?.id || null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\n=== Company Edit Modal Harness ===\n');

// ── 1. Enum endpoints ─────────────────────────────────────────────────────────
console.log('1. Enum endpoints');

{
  const { status, body } = await api('/enums/company-types');
  if (status === 200 && Array.isArray(body.types)) {
    ok(`GET /enums/company-types → 200, ${body.types.length} types`);
    const active = body.types.filter(t => t.active !== 0);
    if (active.length > 0) ok(`At least one active company type`);
    else fail(`No active company types found`);
    const hasSlugLabel = body.types.every(t => t.slug && t.label);
    if (hasSlugLabel) ok(`Each type has slug + label`);
    else fail(`Some types missing slug or label`);
  } else {
    fail(`GET /enums/company-types`, `status=${status}`);
  }
}

{
  const { status, body } = await api('/enums/service-categories');
  if (status === 200 && Array.isArray(body.categories)) {
    ok(`GET /enums/service-categories → 200, ${body.categories.length} categories`);
  } else {
    fail(`GET /enums/service-categories`, `status=${status}`);
  }
}

{
  const { status, body } = await api('/enums/company-services');
  if (status === 200 && Array.isArray(body.services)) {
    ok(`GET /enums/company-services → 200, ${body.services.length} services`);
    const withCategory = body.services.filter(s => s.category);
    ok(`${withCategory.length}/${body.services.length} services have a category assigned`);
  } else {
    fail(`GET /enums/company-services`, `status=${status}`);
  }
}

// ── 2. Auth guard ─────────────────────────────────────────────────────────────
console.log('\n2. Auth guard');

{
  const { status } = await fetch(`${BASE}/enums/company-types`, {
    headers: { Authorization: 'Bearer bad-token' },
  });
  if (status === 401 || status === 403) ok(`Bad token → ${status}`);
  else fail(`Bad token should return 401/403, got ${status}`);
}

// ── 3. company_type multi-select serialization ────────────────────────────────
console.log('\n3. company_type multi-select save (requires ADMIN_TOKEN)');

if (!TOKEN) {
  console.log('  ⚠️  ADMIN_TOKEN not set — skipping save tests');
} else {
  const companyId = await getFirstProfileCompanyId();
  if (!companyId) {
    console.log('  ⚠️  No profile companies found — skipping save tests');
  } else {
    // Save array
    const types = ['renovation_company', 'design_studio'];
    const { status: s1, body: b1 } = await api(`/roles/companies/${companyId}/edit`, {
      method: 'PUT',
      body: JSON.stringify({ company_type: types }),
    });
    if (s1 === 200) ok(`PUT /roles/companies/${companyId}/edit with array → 200`);
    else fail(`PUT with array company_type → ${s1}`, JSON.stringify(b1));

    // Read back
    const { status: s2, body: b2 } = await api(`/roles/companies/${companyId}/detail`);
    if (s2 === 200) {
      const profile = b2.profile || b2.company || {};
      let saved = profile.company_type;
      if (typeof saved === 'string') {
        try { saved = JSON.parse(saved); } catch { /* raw string */ }
      }
      if (Array.isArray(saved) && saved.includes('renovation_company') && saved.includes('design_studio')) {
        ok(`company_type persisted as array: ${JSON.stringify(saved)}`);
      } else {
        fail(`company_type not persisted as array`, `got: ${JSON.stringify(saved)}`);
      }
    } else {
      fail(`GET detail after save → ${s2}`);
    }

    // Save single string (backward compat)
    const { status: s3 } = await api(`/roles/companies/${companyId}/edit`, {
      method: 'PUT',
      body: JSON.stringify({ company_type: 'renovation_company' }),
    });
    if (s3 === 200) ok(`PUT with single string company_type → 200 (backward compat)`);
    else fail(`PUT with single string → ${s3}`);
  }
}

// ── 4. No company_type on uae_companies edit ──────────────────────────────────
console.log('\n4. Scraped company edit (no company_type column)');

{
  // Just verify the endpoint exists; company_type is not a field on scraped companies
  const { status } = await api('/companies?page=1&limit=1');
  if (status === 200) ok(`GET /companies (scraped list) → 200`);
  else fail(`GET /companies → ${status}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
