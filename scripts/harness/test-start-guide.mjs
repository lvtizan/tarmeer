#!/usr/bin/env node
/**
 * Harness: /start — Company Onboarding Guide Page
 * Tests route, content, SEO, images, and no "Free" mention.
 *
 * Usage:
 *   node scripts/harness/test-start-guide.mjs
 *   node scripts/harness/test-start-guide.mjs --base http://localhost:5173
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const BASE = process.argv.includes('--base')
  ? process.argv[process.argv.indexOf('--base') + 1]
  : 'http://localhost:5173';

let passed = 0;
let failed = 0;
const results = [];

function pass(label) {
  passed++;
  results.push({ ok: true, label });
  console.log(`  ✓ ${label}`);
}

function fail(label, detail = '') {
  failed++;
  results.push({ ok: false, label, detail });
  console.log(`  ✗ ${label}${detail ? `\n      ${detail}` : ''}`);
}

async function fetchText(url) {
  const res = await fetch(url);
  return { status: res.status, text: await res.text() };
}

async function fetchStatus(url) {
  const res = await fetch(url, { method: 'HEAD' }).catch(() => fetch(url));
  return res.status;
}

// ─── Source-level checks (fast, no server needed) ────────────────────────────
function checkSource() {
  console.log('\n[Source checks]');

  // Page file exists
  const pagePath = resolve('src/pages/StartGuidePage.tsx');
  if (!existsSync(pagePath)) {
    fail('StartGuidePage.tsx exists', pagePath);
    return;
  }
  pass('StartGuidePage.tsx exists');

  const src = readFileSync(pagePath, 'utf8');

  // Route registered in App.tsx
  const appSrc = readFileSync(resolve('src/App.tsx'), 'utf8');
  if (appSrc.includes("path=\"/start\"") && appSrc.includes('StartGuidePage')) {
    pass('Route /start registered in App.tsx');
  } else {
    fail('Route /start registered in App.tsx', 'path="/start" or StartGuidePage missing');
  }

  // No "Free" in page text
  // (check rendered strings, not import/variable names)
  const freeOccurrences = [...src.matchAll(/['">\s]Free['"<\s]/g)];
  if (freeOccurrences.length === 0) {
    pass('Word "Free" not used as content');
  } else {
    fail('Word "Free" not used as content', `Found ${freeOccurrences.length} occurrence(s)`);
  }

  // All 5 step images referenced
  for (let i = 1; i <= 5; i++) {
    const imgRef = `/images/guide/step${i}-`;
    if (src.includes(imgRef)) {
      pass(`Step ${i} image path referenced`);
    } else {
      fail(`Step ${i} image path referenced`, `Expected to find "${imgRef}" in source`);
    }
  }

  // TarmeerLogo used (not inline)
  if (src.includes('TarmeerLogo')) {
    pass('TarmeerLogo component used');
  } else {
    fail('TarmeerLogo component used', 'Must use <TarmeerLogo />, not inline markup');
  }

  // Helmet with title + description + canonical
  if (src.includes('<Helmet>') || src.includes('<Helmet ')) {
    pass('Helmet block present');
  } else {
    fail('Helmet block present');
  }
  if (src.includes('canonical') && src.includes('tarmeer.com/start')) {
    pass('Canonical URL correct');
  } else {
    fail('Canonical URL correct', 'Missing canonical pointing to /start');
  }

  // JSON-LD HowTo
  if (src.includes('"HowTo"') || src.includes("'HowTo'")) {
    pass('JSON-LD HowTo schema present');
  } else {
    fail('JSON-LD HowTo schema present');
  }

  // Link to /for-companies
  if ((src.match(/for-companies/g) || []).length >= 2) {
    pass('Multiple links to /for-companies');
  } else {
    fail('Multiple links to /for-companies', 'Hero CTA + step 4 + final CTA should link here');
  }

  // SEO lint file includes StartGuidePage
  const seoLint = readFileSync(resolve('scripts/harness/lint-seo.mjs'), 'utf8');
  if (seoLint.includes('StartGuidePage.tsx')) {
    pass('StartGuidePage.tsx in lint-seo PUBLIC_PAGES');
  } else {
    fail('StartGuidePage.tsx in lint-seo PUBLIC_PAGES');
  }

  // Public images exist on disk
  for (let i = 1; i <= 5; i++) {
    const names = ['register', 'verify', 'profile', 'upload', 'live'];
    const imgPath = resolve(`public/images/guide/step${i}-${names[i - 1]}.png`);
    if (existsSync(imgPath)) {
      pass(`public/images/guide/step${i}-${names[i - 1]}.png exists on disk`);
    } else {
      fail(`public/images/guide/step${i}-${names[i - 1]}.png exists on disk`, imgPath);
    }
  }
}

// ─── Runtime checks (requires dev server) ────────────────────────────────────
async function checkRuntime() {
  console.log(`\n[Runtime checks — ${BASE}]`);

  // Page loads (200)
  let html = '';
  try {
    const { status, text } = await fetchText(`${BASE}/start`);
    html = text;
    if (status === 200) {
      pass('GET /start returns 200');
    } else {
      fail('GET /start returns 200', `Got ${status}`);
      return; // no point checking content
    }
  } catch (e) {
    fail('GET /start returns 200', `Fetch failed: ${e.message}. Is dev server running?`);
    return;
  }

  // SPA — the HTML will be the shell; check script tags load properly
  if (html.includes('<!DOCTYPE html') || html.includes('<html')) {
    pass('Response is HTML document');
  } else {
    fail('Response is HTML document');
  }

  // Check guide images are served (200)
  const images = [
    '/images/guide/step1-register.png',
    '/images/guide/step2-verify.png',
    '/images/guide/step3-profile.png',
    '/images/guide/step4-upload.png',
    '/images/guide/step5-live.png',
  ];
  for (const img of images) {
    const status = await fetchStatus(`${BASE}${img}`);
    if (status === 200) {
      pass(`${img} → HTTP 200`);
    } else {
      fail(`${img} → HTTP 200`, `Got ${status}`);
    }
  }

  // /for-companies still works (linked from this page)
  const fcStatus = await fetchStatus(`${BASE}/for-companies`);
  if (fcStatus === 200) {
    pass('GET /for-companies returns 200 (linked from /start)');
  } else {
    fail('GET /for-companies returns 200', `Got ${fcStatus}`);
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────
console.log('━━ /start Guide Page — Harness Tests ━━');
checkSource();
await checkRuntime();

console.log(`\n${'━'.repeat(42)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => !r.ok).forEach(r => console.log(`  ✗ ${r.label}${r.detail ? ` — ${r.detail}` : ''}`));
  process.exit(1);
} else {
  console.log('All tests passed ✓');
}
