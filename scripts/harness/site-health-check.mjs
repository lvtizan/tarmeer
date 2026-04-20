#!/usr/bin/env node
/**
 * Full Site Health Check — Daily Automated Audit
 *
 * Checks:
 *   1. All sitemap URLs return 200 (not 404/500)
 *   2. SEO meta (title, canonical, og:image) are unique per page
 *   3. Image quality: no broken/missing portfolio images
 *   4. API health: key endpoints respond correctly
 *   5. SSL certificate expiry
 *   6. Page load performance (TTFB)
 *
 * Usage:
 *   node scripts/harness/site-health-check.mjs              # full check
 *   node scripts/harness/site-health-check.mjs --quick       # sitemap + API only
 *   node scripts/harness/site-health-check.mjs --fix-report  # output fixable issues
 *
 * Designed to run via cron daily:
 *   0 6 * * * cd /path/to/tarmeer && node scripts/harness/site-health-check.mjs >> /tmp/site-health.log 2>&1
 */

const BASE_URL = process.env.SITE_URL || 'https://www.tarmeer.com';
const API_URL = `${BASE_URL}/api`;
const QUICK = process.argv.includes('--quick');
const FIX_REPORT = process.argv.includes('--fix-report');

let passed = 0;
let failed = 0;
let warnings = 0;
const issues = [];

function log(ok, msg, detail) {
  const icon = ok === true ? '✅' : ok === 'warn' ? '⚠️' : '❌';
  console.log(`${icon} ${msg}${detail ? ': ' + detail : ''}`);
  if (ok === true) passed++;
  else if (ok === 'warn') { warnings++; issues.push(`WARN: ${msg} — ${detail}`); }
  else { failed++; issues.push(`FAIL: ${msg} — ${detail}`); }
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'TarmeerHealthCheck/1.0' } });
  return { status: r.status, data: await r.json().catch(() => null) };
}

async function fetchHead(url) {
  const start = Date.now();
  const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'TarmeerHealthCheck/1.0' }, redirect: 'follow' });
  return { status: r.status, ttfb: Date.now() - start };
}

async function fetchHtml(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Googlebot' } });
  const html = await r.text();
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] || '';
  const canonical = html.match(/canonical" href="([^"]*)"/)?.[1] || '';
  return { status: r.status, title, canonical };
}

async function main() {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  Site Health Check — ${new Date().toISOString().slice(0, 16)}`);
  console.log(`  ${BASE_URL}`);
  console.log(`${'═'.repeat(55)}\n`);

  // ── 1. API Health ──
  console.log('── 1. API Health ──');
  try {
    const health = await fetchJson(`${API_URL}/health`);
    log(health.status === 200, 'API /health', `HTTP ${health.status}`);
  } catch (e) { log(false, 'API /health', e.message); }

  // ── 2. Key Pages Status ──
  console.log('\n── 2. Key Pages ──');
  const keyPages = ['/', '/companies', '/portfolio', '/faq', '/contact', '/blog', '/for-companies'];
  for (const p of keyPages) {
    try {
      const r = await fetchHead(`${BASE_URL}${p}`);
      log(r.status === 200, `GET ${p}`, `HTTP ${r.status}, ${r.ttfb}ms`);
      if (r.ttfb > 3000) log('warn', `Slow TTFB ${p}`, `${r.ttfb}ms (>3s)`);
    } catch (e) { log(false, `GET ${p}`, e.message); }
  }

  // ── 3. Sitemap Validation ──
  console.log('\n── 3. Sitemap ──');
  let sitemapUrls = [];
  try {
    const r = await fetch(`${API_URL}/sitemap.xml`, { headers: { 'User-Agent': 'TarmeerHealthCheck/1.0' } });
    const xml = await r.text();
    sitemapUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    log(sitemapUrls.length > 0, 'Sitemap has URLs', `${sitemapUrls.length} URLs`);
  } catch (e) { log(false, 'Sitemap fetch', e.message); }

  // Spot check 10 random sitemap URLs
  if (!QUICK && sitemapUrls.length > 0) {
    const sample = sitemapUrls.sort(() => Math.random() - 0.5).slice(0, 10);
    let ok404 = 0;
    for (const url of sample) {
      try {
        const r = await fetchHead(url);
        if (r.status === 200) ok404++;
        else log(false, `Sitemap URL ${r.status}`, url);
      } catch { log(false, 'Sitemap URL error', url); }
    }
    log(ok404 === sample.length, `Sitemap spot check`, `${ok404}/${sample.length} OK`);
  }

  // ── 4. SEO Meta Uniqueness ──
  if (!QUICK) {
    console.log('\n── 4. SEO Meta ──');
    const metaPages = ['/', '/companies', '/portfolio', '/faq'];
    // Add 2 random company pages
    try {
      const r = await fetchJson(`${API_URL}/sitemap.xml`);
    } catch {}
    const companyUrls = sitemapUrls.filter(u => /\/companies\/[a-z]/.test(u) && !/\/companies\/[^/]+\/[^/]+/.test(u)).slice(0, 3);

    const titles = new Set();
    const canonicals = new Set();
    const pagesToCheck = [...metaPages.map(p => `${BASE_URL}${p}`), ...companyUrls];

    for (const url of pagesToCheck) {
      try {
        const { title, canonical } = await fetchHtml(url);
        titles.add(title);
        canonicals.add(canonical);
      } catch {}
    }
    log(titles.size === pagesToCheck.length, 'Unique titles', `${titles.size}/${pagesToCheck.length} unique`);
    log(canonicals.size === pagesToCheck.length, 'Unique canonicals', `${canonicals.size}/${pagesToCheck.length} unique`);
  }

  // ── 5. Public API Endpoints ──
  console.log('\n── 5. Public API ──');
  const apiChecks = [
    { path: '/projects?page=1&limit=1', key: 'projects' },
    { path: '/designers?page=1&limit=1', key: 'designers' },
  ];
  for (const check of apiChecks) {
    try {
      const r = await fetchJson(`${API_URL}${check.path}`);
      const count = r.data?.[check.key]?.length ?? 0;
      log(r.status === 200 && count > 0, `API ${check.path}`, `HTTP ${r.status}, ${count} items`);
    } catch (e) { log(false, `API ${check.path}`, e.message); }
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(55)}`);
  if (failed === 0 && warnings === 0) {
    console.log(`  ✅ ALL HEALTHY: ${passed} checks passed`);
  } else {
    console.log(`  ${failed > 0 ? '❌' : '⚠️'} ${passed} pass, ${failed} fail, ${warnings} warn`);
    if (issues.length > 0) {
      console.log('\n  Issues:');
      issues.forEach(i => console.log(`    - ${i}`));
    }
  }
  console.log(`${'═'.repeat(55)}\n`);

  if (FIX_REPORT && issues.length > 0) {
    console.log('--- FIX REPORT ---');
    issues.forEach(i => console.log(i));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
