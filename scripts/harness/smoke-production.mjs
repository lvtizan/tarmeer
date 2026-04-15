#!/usr/bin/env node

// Production smoke test — Node 20+ (built-in fetch, no deps)
// Usage: node scripts/harness/smoke-production.mjs [--url https://example.com]

const args = process.argv.slice(2);
const urlFlagIdx = args.indexOf('--url');
const BASE = urlFlagIdx !== -1 && args[urlFlagIdx + 1]
  ? args[urlFlagIdx + 1].replace(/\/+$/, '')
  : 'https://www.tarmeer.com';

let passed = 0;
let failed = 0;
const results = [];

function ok(section, label) {
  passed++;
  results.push({ section, label, ok: true });
}

function fail(section, label, reason) {
  failed++;
  results.push({ section, label, ok: false, reason });
}

async function test(section, label, fn) {
  try {
    await fn();
    ok(section, label);
  } catch (e) {
    fail(section, label, e.message ?? String(e));
  }
}

// ── Tests ────────────────────────────────────────────────────────────

await test('Page Access', 'Homepage returns 200', async () => {
  const res = await fetch(BASE, { redirect: 'follow' });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
});

await test('Page Access', 'tarmeer.com redirects to www', async () => {
  const bare = BASE.replace('://www.', '://');
  const res = await fetch(bare, { redirect: 'manual' });
  if (res.status !== 301 && res.status !== 302) {
    throw new Error(`Expected 301/302, got ${res.status}`);
  }
  const loc = res.headers.get('location') || '';
  if (!loc.includes('www.tarmeer.com')) {
    throw new Error(`Redirect location "${loc}" does not point to www.tarmeer.com`);
  }
});

await test('API Health', 'API /health returns 200', async () => {
  const res = await fetch(`${BASE}/api/health`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
});

let firstCompany = null;

await test('API Health', '/api/companies?limit=1 returns companies array', async () => {
  const res = await fetch(`${BASE}/api/companies?limit=1`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body.companies)) {
    throw new Error('Response missing "companies" array');
  }
  if (body.companies.length === 0) {
    throw new Error('Companies array is empty');
  }
  firstCompany = body.companies[0];
});

await test('API Health', 'First company has portfolio data', async () => {
  if (!firstCompany) throw new Error('No company data from previous test');
  const has = firstCompany.portfolio_images || firstCompany.portfolio_categories;
  if (!has) {
    throw new Error('First company missing portfolio_images and portfolio_categories');
  }
});

await test('Static Assets', '/images/tarmeer_logo.svg returns 200', async () => {
  const res = await fetch(`${BASE}/images/tarmeer_logo.svg`);
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
});

await test('Static Assets', 'Portfolio image returns 200', async () => {
  const res = await fetch(
    `${BASE}/images/uae-companies/portfolio/hba-hirsch-bedner/general/6.jpg`
  );
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
});

await test('Page Access', 'admin.tarmeer.com returns 200', async () => {
  const adminUrl = BASE.replace('://www.', '://admin.');
  const res = await fetch(adminUrl, { redirect: 'follow' });
  if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
});

await test('Cache Headers', 'index.html has no-cache directive', async () => {
  const res = await fetch(`${BASE}/index.html`, { redirect: 'follow' });
  const cc = res.headers.get('cache-control') || '';
  if (!cc.includes('no-cache') && !cc.includes('no-store')) {
    throw new Error(`Expected no-cache/no-store on index.html, got: "${cc}"`);
  }
});

await test('Cache Headers', '/assets/ JS bundle has immutable cache', async () => {
  // Fetch the HTML first to extract an actual asset URL
  const htmlRes = await fetch(BASE, { redirect: 'follow' });
  const html = await htmlRes.text();
  const match = html.match(/src="(\/assets\/[^"]+\.js)"/);
  if (!match) throw new Error('Could not find /assets/*.js reference in homepage HTML');
  const assetUrl = `${BASE}${match[1]}`;
  const assetRes = await fetch(assetUrl);
  if (assetRes.status !== 200) throw new Error(`Asset ${match[1]} returned ${assetRes.status}`);
  const cc = assetRes.headers.get('cache-control') || '';
  if (!cc.includes('immutable') && !cc.includes('max-age=31536000')) {
    throw new Error(`Expected immutable cache on asset, got: "${cc}"`);
  }
});

// ── Output ───────────────────────────────────────────────────────────

console.log(`\n🔍 Production Smoke Test: ${BASE}\n`);

const sections = [];
for (const r of results) {
  if (!sections.includes(r.section)) sections.push(r.section);
}

for (const section of sections) {
  console.log(`📋 ${section}:`);
  for (const r of results.filter(r => r.section === section)) {
    const icon = r.ok ? '✅' : '❌';
    const suffix = r.ok ? '' : ` — ${r.reason}`;
    console.log(`  ${icon} ${r.label}${suffix}`);
  }
  console.log();
}

console.log(`Total: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
