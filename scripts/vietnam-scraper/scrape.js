#!/usr/bin/env node
/**
 * Vietnam Company Scraper
 * Scrapes company info + portfolio images from Vietnamese building/interior sites
 * Output: vietnam-results.json (review before DB import)
 * Usage: node scrape.js [--limit N] [--start N]
 */

const SERVER_MODULES = '/Users/kp/Code/tarmeer-4.0-local/server/node_modules';
const axios = require(`${SERVER_MODULES}/axios`);
const cheerio = require(`${SERVER_MODULES}/cheerio`);
const https = require('https');

// Allow sites with self-signed or expired certs (scraping only)
const RELAXED_AGENT = new https.Agent({ rejectUnauthorized: false });
const fs = require('fs');
const path = require('path');

const URLS_FILE = path.join(__dirname, 'urls.json');
const OUTPUT_FILE = path.join(__dirname, 'vietnam-results.json');
const MANIFEST_FILE = path.join(__dirname, 'vietnam-manifest.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.5',
};

const SKIP_IMG = [
  /logo/i, /icon/i, /favicon/i, /avatar/i, /badge/i, /sprite/i,
  /arrow/i, /button/i, /social/i, /pixel/i, /tracking/i,
  /\.svg$/i, /\.gif$/i, /base64/i, /1x1/i, /spacer/i, /blank/i,
  /facebook|twitter|linkedin|youtube|pinterest|google/i,
  /^data:/i,  // filter out data: URIs (lazy-load SVG placeholders)
];

function isProjectImage(src) {
  return src && !SKIP_IMG.some(p => p.test(src));
}

function resolve(src, base) {
  try { return new URL(src, base).href; } catch { return ''; }
}

function extractPhone(text) {
  const m = text.match(/(\+84|0)[\s.-]?([0-9]{2,3})[\s.-]?([0-9]{3,4})[\s.-]?([0-9]{3,4})/);
  return m ? m[0].replace(/\s/g, '') : null;
}

function extractEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

function scrapeCompany(html, url) {
  const $ = cheerio.load(html);
  const text = $('body').text();

  const name = (
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text() ||
    $('title').text() || ''
  ).trim().slice(0, 200);

  const description = (
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') || ''
  ).trim().slice(0, 800);

  const phone = extractPhone(text);
  const email = extractEmail(text);

  // Address heuristics - look for common VN address patterns
  const addressMatch = text.match(/(Số\s*\d+|[0-9]+[\/\\][0-9A-Za-z]+)[^\.]{5,80}(Quận|Huyện|Phường|TP\.|Hà Nội|TP\.HCM|Đà Nẵng)/);
  const address = addressMatch ? addressMatch[0].trim().slice(0, 200) : null;

  // Images
  const imageSet = new Set();
  const ogImg = $('meta[property="og:image"]').attr('content');
  if (ogImg) { const r = resolve(ogImg, url); if (r && isProjectImage(r)) imageSet.add(r); }

  $('img').each((_, el) => {
    const candidates = [
      $(el).attr('src'), $(el).attr('data-src'), $(el).attr('data-lazy-src'),
      $(el).attr('data-original'), $(el).attr('data-defer-src'),
    ];
    for (const src of candidates) {
      if (!src) continue;
      const r = resolve(src, url);
      if (!r || !isProjectImage(r)) continue;
      const w = parseInt($(el).attr('width') || '0');
      const h = parseInt($(el).attr('height') || '0');
      if ((w > 0 && w < 200) || (h > 0 && h < 200)) continue;
      imageSet.add(r);
      break;
    }
  });

  $('[style*="background"]').each((_, el) => {
    const m = ($(el).attr('style') || '').match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (m) { const r = resolve(m[1], url); if (r && isProjectImage(r)) imageSet.add(r); }
  });

  return {
    company_name: name,
    description,
    website: url,
    phone,
    email,
    address,
    images: Array.from(imageSet).slice(0, 30),
    country: 'vn',
    scraped_at: new Date().toISOString(),
  };
}

const TLS_ERRORS = ['TLS', 'SSL', 'certificate', 'secure', 'ECONNRESET', 'socket disconnected'];

async function tryFetch(targetUrl, opts) {
  try {
    return await axios.get(targetUrl, { ...opts, headers: HEADERS, timeout: 15000, maxRedirects: 5 });
  } catch (e) {
    // If TLS error, retry with relaxed SSL verification
    if (TLS_ERRORS.some(t => e.message.includes(t))) {
      return await axios.get(targetUrl, { ...opts, headers: HEADERS, timeout: 15000, maxRedirects: 5, httpsAgent: RELAXED_AGENT });
    }
    throw e;
  }
}

async function tryWpMedia(siteUrl) {
  try {
    const apiUrl = siteUrl.replace(/\/$/, '') + '/wp-json/wp/v2/media?per_page=30&media_type=image';
    const res = await tryFetch(apiUrl, {});
    if (!Array.isArray(res.data) || res.data.length === 0) return [];
    return res.data
      .map(m => m.source_url || m.guid?.rendered || '')
      .filter(u => u && isProjectImage(u))
      .slice(0, 30);
  } catch { return []; }
}

async function scrapeUrl(entry) {
  const { url, category, note } = entry;
  console.log(`\n[→] ${url}`);
  try {
    const res = await tryFetch(url, {});
    const data = scrapeCompany(res.data, url);
    data.category = category;
    data.note = note;

    // If few images found (likely lazy-loaded WP site), try WP REST API
    if (data.images.length < 5) {
      const wpImages = await tryWpMedia(url);
      if (wpImages.length > data.images.length) {
        data.images = wpImages;
        console.log(`    [wp-api] found ${wpImages.length} imgs`);
      }
    }

    console.log(`    ✓ ${data.company_name} | ${data.images.length} imgs | phone: ${data.phone || '—'}`);
    return { ...data, ok: true };
  } catch (e) {
    console.log(`    ✗ Failed: ${e.message}`);
    return { url, category, note, ok: false, error: e.message, country: 'vn' };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const startIdx = args.indexOf('--start');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;
  const start = startIdx >= 0 ? parseInt(args[startIdx + 1]) : 0;

  const urls = JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));

  // Load existing manifest (skip already scraped)
  let manifest = {};
  if (fs.existsSync(MANIFEST_FILE)) {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  }

  // Load existing results
  let results = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
  }

  // Deduplicate URLs
  const seen = new Set();
  const toScrape = [];
  for (const entry of urls) {
    const key = entry.url.replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    if (manifest[key]) { console.log(`[skip] ${key} (already scraped)`); continue; }
    toScrape.push(entry);
  }

  const batch = toScrape.slice(start, start + limit);
  console.log(`\nScraping ${batch.length} sites (${start}..${start + batch.length - 1} of ${toScrape.length} pending)\n`);

  for (const entry of batch) {
    const result = await scrapeUrl(entry);
    results.push(result);
    const key = entry.url.replace(/\/$/, '');
    manifest[key] = { scraped_at: new Date().toISOString(), ok: result.ok };

    // Save after each site
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

    // Polite delay
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
  }

  const ok = results.filter(r => r.ok).length;
  const fail = results.filter(r => !r.ok).length;
  console.log(`\n✅ Done: ${ok} success, ${fail} failed`);
  console.log(`📄 Results: ${OUTPUT_FILE}`);
}

main().catch(console.error);
