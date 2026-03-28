/**
 * Category-Aware Portfolio Scraper (Incremental)
 *
 * 1. Reads companies-data.json
 * 2. Checks crawl-manifest.json to skip already-crawled companies
 * 3. Visits each company's website with Puppeteer
 * 4. Discovers portfolio categories from navigation links
 * 5. Scrapes images from each category page
 * 6. Downloads images organized by category
 * 7. Updates crawl-manifest.json with crawl metadata
 * 8. Saves to companies-data-final.json
 *
 * Usage:
 *   node scrape-portfolio-categories.mjs              # incremental (skip fresh)
 *   node scrape-portfolio-categories.mjs --force      # re-crawl everything
 *   node scrape-portfolio-categories.mjs --max-age 7  # re-crawl if older than 7 days
 *   node scrape-portfolio-categories.mjs --slug algedra  # crawl only this company
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import {
  extractCategoryLinks,
  extractPortfolioImages,
  downloadFile,
  getExtension,
  fetchUrl,
} from './scrape-logos-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_FILE = path.join(__dirname, 'companies-data.json');
const PORTFOLIO_DIR = path.join(ROOT, 'public/images/uae-companies/portfolio');
const OUTPUT_JSON = path.join(__dirname, 'companies-data-final.json');
const MANIFEST_FILE = path.join(__dirname, 'crawl-manifest.json');

const MAX_IMAGES_PER_CATEGORY = 20;
const MAX_IMAGES_PER_COMPANY = 100;
const REQUEST_DELAY_MS = 2000;
const PUPPETEER_TIMEOUT = 30000;
const DEFAULT_MAX_AGE_DAYS = 14;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── CLI Args ────────────────────────────────────────────

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const SLUG_FILTER = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
const MAX_AGE_DAYS = args.includes('--max-age')
  ? Number(args[args.indexOf('--max-age') + 1]) || DEFAULT_MAX_AGE_DAYS
  : DEFAULT_MAX_AGE_DAYS;

// ─── Crawl Manifest ─────────────────────────────────────

function loadManifest() {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveManifest(manifest) {
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

function contentHash(html) {
  // Hash a simplified version (strip whitespace/scripts to reduce noise)
  const simplified = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return crypto.createHash('md5').update(simplified).digest('hex');
}

function shouldSkip(manifest, slug, force) {
  if (force) return { skip: false, reason: 'forced' };

  const entry = manifest[slug];
  if (!entry) return { skip: false, reason: 'never crawled' };

  const ageMs = Date.now() - new Date(entry.crawled_at).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays > MAX_AGE_DAYS) {
    return { skip: false, reason: `stale (${Math.round(ageDays)}d > ${MAX_AGE_DAYS}d)` };
  }

  if (entry.image_count === 0) {
    return { skip: false, reason: 'previous crawl found 0 images' };
  }

  return { skip: true, reason: `fresh (${Math.round(ageDays)}d old, ${entry.image_count} images)` };
}

function updateManifest(manifest, slug, data) {
  manifest[slug] = {
    crawled_at: new Date().toISOString(),
    content_hash: data.contentHash || null,
    image_count: data.imageCount || 0,
    category_count: data.categoryCount || 0,
    website: data.website || '',
  };
}

// Patterns that indicate a link may lead to a project/portfolio page
const PROJECT_PAGE_PATTERNS = [/\/project/i, /\/portfolio/i, /\/work/i, /\/case-study/i];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Use Puppeteer to fetch a page's fully-rendered HTML after scrolling.
 * Returns the page HTML string.
 */
async function fetchRenderedHtml(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: PUPPETEER_TIMEOUT });

    // Scroll to trigger lazy-loading
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 400;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 150);
      });
    });

    // Brief pause to let lazy-loaded images settle
    await sleep(800);

    return await page.content();
  } finally {
    await page.close();
  }
}

/**
 * Extract project-page links from HTML that match known portfolio URL patterns.
 * Returns an array of unique absolute URL strings.
 */
function extractProjectPageLinks(html, baseUrl) {
  const seen = new Set();
  const results = [];

  const anchorPattern = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1].trim();
    let normalized;
    try {
      normalized = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }

    if (seen.has(normalized)) continue;

    const pathname = new URL(normalized).pathname;
    if (PROJECT_PAGE_PATTERNS.some((re) => re.test(pathname))) {
      // Only include links from the same host
      if (new URL(normalized).hostname === new URL(baseUrl).hostname) {
        seen.add(normalized);
        results.push(normalized);
      }
    }
  }

  return results;
}

/**
 * Scrape images for a single category page. Returns an array of image URLs.
 */
async function scrapeImagesFromPage(browser, pageUrl, baseUrl) {
  let html;
  try {
    html = await fetchRenderedHtml(browser, pageUrl);
  } catch (err) {
    // Fallback to plain HTTP fetch if Puppeteer fails
    console.log(`    Puppeteer failed (${err.message}), falling back to fetchUrl`);
    try {
      const res = await fetchUrl(pageUrl);
      html = res.body.toString('utf-8');
    } catch (err2) {
      console.log(`    fetchUrl also failed: ${err2.message}`);
      return [];
    }
  }

  return extractPortfolioImages(html, baseUrl);
}

/**
 * Download images for a category, returning the saved local paths.
 */
async function downloadCategoryImages(imageUrls, destDir, categorySlug, companySlug) {
  fs.mkdirSync(destDir, { recursive: true });

  const saved = [];
  const limit = Math.min(imageUrls.length, MAX_IMAGES_PER_CATEGORY);

  for (let i = 0; i < limit; i++) {
    const imageUrl = imageUrls[i];
    const ext = getExtension(imageUrl);
    const n = i + 1;
    const fname = `${n}${ext}`;
    const destPath = path.join(destDir, fname);
    const localPath = `/images/uae-companies/portfolio/${companySlug}/${categorySlug}/${fname}`;

    try {
      await downloadFile(imageUrl, destPath);
      saved.push({ url: localPath, title: `${categorySlug} ${n}` });
    } catch (err) {
      console.log(`    Failed to download image ${n}: ${err.message}`);
    }
  }

  return saved;
}

/**
 * Process a single company: visit homepage, find categories, scrape each,
 * and return the portfolio_categories map.
 */
async function processCompany(browser, company, idx, total, manifest) {
  const label = `[${idx + 1}/${total}] ${company.name_en}`;
  const baseUrl = company.website.replace(/\/+$/, '');
  console.log(`\n${label}: ${baseUrl}`);

  let homepageHtml;
  try {
    homepageHtml = await fetchRenderedHtml(browser, baseUrl);
    console.log(`  Homepage fetched (${homepageHtml.length} chars)`);
  } catch (err) {
    console.log(`  Failed to fetch homepage: ${err.message}`);
    return { categories: {}, contentHash: null };
  }

  const pageHash = contentHash(homepageHtml);

  // Check if content actually changed since last crawl
  if (manifest && manifest[company.slug] && manifest[company.slug].content_hash === pageHash && !FORCE) {
    console.log(`  Content unchanged (hash: ${pageHash.slice(0, 8)}...), skipping`);
    return { categories: null, contentHash: pageHash }; // null = keep existing data
  }

  await sleep(REQUEST_DELAY_MS);

  // Step 1: Find category links from the homepage
  let categoryLinks = extractCategoryLinks(homepageHtml, baseUrl);
  console.log(`  Found ${categoryLinks.length} category link(s)`);

  const portfolioCategories = {};
  let totalImagesForCompany = 0;

  if (categoryLinks.length > 0) {
    // Process each category page
    for (const { url: catUrl, category } of categoryLinks) {
      if (totalImagesForCompany >= MAX_IMAGES_PER_COMPANY) {
        console.log(`  Reached max images per company (${MAX_IMAGES_PER_COMPANY}), stopping`);
        break;
      }

      console.log(`  Category "${category}": ${catUrl}`);
      const imageUrls = await scrapeImagesFromPage(browser, catUrl, baseUrl);
      console.log(`    Found ${imageUrls.length} image(s)`);

      await sleep(REQUEST_DELAY_MS);

      if (imageUrls.length === 0) continue;

      const categorySlug = slugify(category);
      const destDir = path.join(PORTFOLIO_DIR, company.slug, categorySlug);
      const remaining = MAX_IMAGES_PER_COMPANY - totalImagesForCompany;
      const capped = imageUrls.slice(0, Math.min(imageUrls.length, remaining));

      const saved = await downloadCategoryImages(capped, destDir, categorySlug, company.slug);
      console.log(`    Saved ${saved.length} image(s)`);

      if (saved.length > 0) {
        if (!portfolioCategories[category]) {
          portfolioCategories[category] = [];
        }
        portfolioCategories[category].push(...saved);
        totalImagesForCompany += saved.length;
      }
    }
  }

  // Step 2: Fallback — try project/portfolio page links
  if (Object.keys(portfolioCategories).length === 0) {
    console.log(`  No categories found, trying project page links...`);

    const projectLinks = extractProjectPageLinks(homepageHtml, baseUrl);
    console.log(`  Found ${projectLinks.length} project page link(s)`);

    for (const pageUrl of projectLinks.slice(0, 5)) {
      if (totalImagesForCompany >= MAX_IMAGES_PER_COMPANY) break;

      console.log(`  Project page: ${pageUrl}`);
      const imageUrls = await scrapeImagesFromPage(browser, pageUrl, baseUrl);
      console.log(`    Found ${imageUrls.length} image(s)`);

      await sleep(REQUEST_DELAY_MS);

      if (imageUrls.length === 0) continue;

      const category = 'Projects';
      const categorySlug = 'projects';
      const destDir = path.join(PORTFOLIO_DIR, company.slug, categorySlug);
      const remaining = MAX_IMAGES_PER_COMPANY - totalImagesForCompany;
      const capped = imageUrls.slice(0, Math.min(imageUrls.length, remaining));

      const saved = await downloadCategoryImages(capped, destDir, categorySlug, company.slug);
      console.log(`    Saved ${saved.length} image(s)`);

      if (saved.length > 0) {
        if (!portfolioCategories[category]) {
          portfolioCategories[category] = [];
        }
        portfolioCategories[category].push(...saved);
        totalImagesForCompany += saved.length;
      }
    }
  }

  // Step 3: Last-resort fallback — deep-scan homepage
  if (Object.keys(portfolioCategories).length === 0) {
    console.log(`  Still nothing, deep-scanning homepage...`);

    const imageUrls = extractPortfolioImages(homepageHtml, baseUrl);
    console.log(`  Found ${imageUrls.length} image(s) on homepage`);

    if (imageUrls.length > 0) {
      const category = 'General';
      const categorySlug = 'general';
      const destDir = path.join(PORTFOLIO_DIR, company.slug, categorySlug);
      const capped = imageUrls.slice(0, MAX_IMAGES_PER_CATEGORY);

      const saved = await downloadCategoryImages(capped, destDir, categorySlug, company.slug);
      console.log(`  Saved ${saved.length} image(s) from homepage`);

      if (saved.length > 0) {
        portfolioCategories[category] = saved;
      }
    }
  }

  const totalSaved = Object.values(portfolioCategories).reduce((sum, imgs) => sum + imgs.length, 0);
  console.log(`  Done: ${Object.keys(portfolioCategories).length} categories, ${totalSaved} images`);

  return { categories: portfolioCategories, contentHash: pageHash };
}

async function runAll() {
  let companies = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const manifest = loadManifest();

  // Load existing final data to preserve previous crawl results
  let existingFinal = {};
  try {
    const finalData = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf-8'));
    for (const c of finalData) {
      if (c.slug && c.portfolio_categories) {
        existingFinal[c.slug] = c.portfolio_categories;
      }
    }
  } catch { /* no existing data */ }

  // Filter by slug if specified
  if (SLUG_FILTER) {
    companies = companies.filter((c) => c.slug === SLUG_FILTER);
    if (companies.length === 0) {
      console.log(`No company found with slug: ${SLUG_FILTER}`);
      process.exit(1);
    }
  }

  console.log(`=== Category-Aware Portfolio Scraper (Incremental) ===\n`);
  console.log(`Companies: ${companies.length}`);
  console.log(`Max age: ${MAX_AGE_DAYS} days`);
  console.log(`Force: ${FORCE}`);
  if (SLUG_FILTER) console.log(`Filter: ${SLUG_FILTER}`);
  console.log('');

  // Ensure base portfolio directory exists
  fs.mkdirSync(PORTFOLIO_DIR, { recursive: true });

  let crawled = 0;
  let skipped = 0;
  let unchanged = 0;
  let failed = 0;

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];

      // Check manifest for skip
      const { skip, reason } = shouldSkip(manifest, company.slug, FORCE);
      if (skip) {
        console.log(`[${i + 1}/${companies.length}] ${company.name_en}: SKIP (${reason})`);
        // Preserve existing portfolio_categories
        company.portfolio_categories = existingFinal[company.slug] || {};
        skipped++;
        continue;
      }

      console.log(`[${i + 1}/${companies.length}] ${company.name_en}: CRAWL (${reason})`);

      try {
        const result = await processCompany(browser, company, i, companies.length, manifest);

        if (result.categories === null) {
          // Content unchanged, keep existing data
          company.portfolio_categories = existingFinal[company.slug] || {};
          unchanged++;
        } else {
          company.portfolio_categories = result.categories;
          crawled++;
        }

        // Update manifest
        const imageCount = Object.values(company.portfolio_categories)
          .reduce((sum, imgs) => sum + imgs.length, 0);
        updateManifest(manifest, company.slug, {
          contentHash: result.contentHash,
          imageCount,
          categoryCount: Object.keys(company.portfolio_categories).length,
          website: company.website,
        });

        // Save manifest after each company (crash-safe)
        saveManifest(manifest);

      } catch (err) {
        console.log(`  Fatal error for ${company.name_en}: ${err.message}`);
        company.portfolio_categories = existingFinal[company.slug] || {};
        failed++;
      }
    }
  } finally {
    await browser.close();
  }

  // Merge back into full company list if we filtered by slug
  if (SLUG_FILTER) {
    const allCompanies = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    for (const c of allCompanies) {
      const updated = companies.find((u) => u.slug === c.slug);
      if (updated) {
        c.portfolio_categories = updated.portfolio_categories;
      } else {
        c.portfolio_categories = existingFinal[c.slug] || {};
      }
    }
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(allCompanies, null, 2));
  } else {
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(companies, null, 2));
  }

  console.log(`\n=== Summary ===`);
  console.log(`Crawled:   ${crawled}`);
  console.log(`Unchanged: ${unchanged}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);
  console.log(`\nOutput:   ${OUTPUT_JSON}`);
  console.log(`Manifest: ${MANIFEST_FILE}`);
  console.log(`Images:   ${PORTFOLIO_DIR}`);
}

runAll().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
