#!/usr/bin/env node
/**
 * SEO/GEO render harness.
 *
 * Production:
 *   node scripts/harness/test-seo-geo-render.mjs
 *
 * Local backend render endpoint:
 *   cd server && PORT=3099 DEV_SKIP_EMAIL=true node dist/app.js
 *   node scripts/harness/test-seo-geo-render.mjs --local
 *
 * Custom:
 *   node scripts/harness/test-seo-geo-render.mjs --base https://www.tarmeer.com --mode direct
 *   node scripts/harness/test-seo-geo-render.mjs --base http://127.0.0.1:3099 --mode render
 */

import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const useLocal = args.includes('--local');

function argValue(name, fallback) {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const BASE_URL = argValue('--base', useLocal ? 'http://127.0.0.1:3099' : 'https://www.tarmeer.com').replace(/\/+$/, '');
const MODE = argValue('--mode', useLocal ? 'render' : 'direct');
const USER_AGENT = argValue('--ua', 'Googlebot');
const PROD_URL = 'https://www.tarmeer.com';

const pages = [
  {
    label: 'FAQ',
    path: '/faq',
    title: /FAQ/i,
    canonical: `${PROD_URL}/faq`,
    schema: 'FAQPage',
  },
  {
    label: 'Portfolio',
    path: '/portfolio',
    title: /Portfolio/i,
    canonical: `${PROD_URL}/portfolio`,
    schema: 'CollectionPage',
  },
  {
    label: 'Companies',
    path: '/companies',
    title: /Companies|Renovation/i,
    canonical: `${PROD_URL}/companies`,
    schema: 'CollectionPage',
  },
  {
    label: 'Company Detail',
    path: '/companies/algedra',
    title: /Algedra|Tarmeer/i,
    canonical: `${PROD_URL}/companies/algedra`,
    schema: 'LocalBusiness',
  },
  {
    label: 'Materials',
    path: '/materials',
    title: /Material|Supplier/i,
    canonical: `${PROD_URL}/materials`,
    schema: 'CollectionPage',
  },
  {
    label: 'New Home Design',
    path: '/services/new-home-design',
    title: /New Home Design/i,
    canonical: `${PROD_URL}/services/new-home-design`,
    schema: 'Service',
  },
];

const aiCrawlerNames = ['GPTBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Applebot'];

let passed = 0;
let failed = 0;
const failures = [];

function log(ok, label, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark.padEnd(4)} ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else {
    failed += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function pageUrl(path) {
  if (MODE === 'render') return `${BASE_URL}/api/seo-render?path=${encodeURIComponent(path)}`;
  return `${BASE_URL}${path}`;
}

async function fetchText(url) {
  const curlArgs = ['-sS', '-i', '--max-time', '30', '-A', USER_AGENT];
  if (/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
    curlArgs.push('--noproxy', '*');
  }
  curlArgs.push(url);

  const result = spawnSync('curl', curlArgs, { encoding: 'utf8' });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0 && !output.includes('HTTP/')) {
    throw new Error(output.trim() || `curl exited with ${result.status}`);
  }

  const matches = [...output.matchAll(/^HTTP\/[^\s]+\s+(\d+)[^\n]*\n/gm)];
  const status = matches.length > 0 ? Number(matches[matches.length - 1][1]) : 0;
  const lastHeaderStart = matches.length > 0 ? matches[matches.length - 1].index || 0 : 0;
  const responseText = output.slice(lastHeaderStart);
  const headerEnd = responseText.search(/\r?\n\r?\n/);
  const rawHeaders = headerEnd >= 0 ? responseText.slice(0, headerEnd) : '';
  const text = headerEnd >= 0 ? responseText.slice(headerEnd).replace(/^\r?\n\r?\n/, '') : responseText;
  const headers = new Map();
  for (const line of rawHeaders.split(/\r?\n/).slice(1)) {
    const idx = line.indexOf(':');
    if (idx > 0) headers.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
  }

  return {
    response: {
      status,
      headers: { get: (name) => headers.get(name.toLowerCase()) || null },
    },
    text,
  };
}

function parseHead(html) {
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] || '';
  const canonical = html.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] || '';
  const description = /<meta\s+name=["']description["'][^>]*content=["'][^"']+["'][^>]*>/i.test(html);
  const ogTitle = /<meta\s+property=["']og:title["'][^>]*content=["'][^"']+["'][^>]*>/i.test(html);
  const ogDescription = /<meta\s+property=["']og:description["'][^>]*content=["'][^"']+["'][^>]*>/i.test(html);
  const ogImage = html.match(/<meta\s+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1] || '';
  const twitterCard = /<meta\s+name=["']twitter:card["'][^>]*content=["'][^"']+["'][^>]*>/i.test(html);
  const twitterTitle = /<meta\s+name=["']twitter:title["'][^>]*content=["'][^"']+["'][^>]*>/i.test(html);
  const jsonLdTypes = [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
  return { title, canonical, description, ogTitle, ogDescription, ogImage, twitterCard, twitterTitle, jsonLdTypes };
}

async function checkPage(page) {
  const url = pageUrl(page.path);
  const { response, text } = await fetchText(url);
  const meta = parseHead(text);
  const missing = [];

  if (response.status !== 200) missing.push(`HTTP ${response.status}`);
  if (!page.title.test(meta.title)) missing.push(`title (${meta.title || 'missing'})`);
  if (!meta.description) missing.push('description');
  if (meta.canonical !== page.canonical) missing.push(`canonical (${meta.canonical || 'missing'})`);
  if (!meta.ogTitle) missing.push('og:title');
  if (!meta.ogDescription) missing.push('og:description');
  if (!meta.ogImage.startsWith(PROD_URL)) missing.push(`og:image (${meta.ogImage || 'missing'})`);
  if (!meta.twitterCard) missing.push('twitter:card');
  if (!meta.twitterTitle) missing.push('twitter:title');
  if (!meta.jsonLdTypes.includes(page.schema)) missing.push(`${page.schema} JSON-LD`);

  log(missing.length === 0, page.label, missing.join(', '));
}

async function checkMissingSlug() {
  const path = '/companies/not-a-real-company-slug-xyz';
  const { response } = await fetchText(pageUrl(path));
  const robots = response.headers.get('x-robots-tag') || '';
  log(response.status === 404 && /noindex/i.test(robots), 'Missing slug 404/noindex', `HTTP ${response.status}, X-Robots-Tag: ${robots || 'missing'}`);
}

async function checkSitemap() {
  const { response, text } = await fetchText(`${BASE_URL}/api/sitemap.xml`);
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const hasAtUrls = locs.some((url) => url.includes('/@'));
  const required = [
    `${PROD_URL}/faq`,
    `${PROD_URL}/portfolio`,
    `${PROD_URL}/services/new-home-design`,
  ];
  const missing = required.filter((url) => !locs.includes(url));
  log(response.status === 200 && locs.length > 0, 'Sitemap reachable', `${locs.length} URLs`);
  log(!hasAtUrls, 'Sitemap canonical company URLs', hasAtUrls ? 'contains legacy /@ URLs' : 'no /@ URLs');
  log(missing.length === 0, 'Sitemap static SEO URLs', missing.join(', '));
}

async function checkRobots() {
  const robotsPath = MODE === 'render' ? '/api/robots.txt' : '/robots.txt';
  const { response, text } = await fetchText(`${BASE_URL}${robotsPath}`);
  const missing = aiCrawlerNames.filter((name) => !text.includes(`User-agent: ${name}`));
  const allowsApiSitemap = text.includes('Allow: /api/sitemap.xml') || text.includes('Sitemap: https://www.tarmeer.com/api/sitemap.xml');
  log(response.status === 200, 'robots.txt reachable', `HTTP ${response.status}`);
  log(missing.length === 0, 'robots.txt AI crawlers', missing.join(', '));
  log(allowsApiSitemap, 'robots.txt sitemap access');
}

async function main() {
  console.log(`SEO/GEO render harness`);
  console.log(`Base: ${BASE_URL}`);
  console.log(`Mode: ${MODE}`);
  console.log(`UA:   ${USER_AGENT}`);
  console.log('');

  for (const page of pages) {
    await checkPage(page);
  }
  await checkMissingSlug();
  await checkSitemap();
  await checkRobots();

  console.log('');
  if (failed > 0) {
    console.log(`RESULT: ${passed} PASS, ${failed} FAIL`);
    console.log('Failures:');
    failures.forEach((item) => console.log(`- ${item}`));
    process.exit(1);
  }
  console.log(`RESULT: ${passed} PASS, 0 FAIL`);
}

main().catch((error) => {
  console.error(`FATAL ${error.message}`);
  process.exit(1);
});
