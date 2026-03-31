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
  extractPortfolioPageLinks,
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
const PROJECT_PAGE_PATTERNS = [
  /\/projects?/i, /\/portfolio/i, /\/works?/i, /\/case-stud/i,
  /\/gallery/i, /\/our-work/i, /\/our-project/i, /\/design-work/i,
  /\/fitout-project/i, /\/sectors?\//i, /\/expertise\//i,
  /projects?\.php/i, /portfolio\.php/i, /gallery\.php/i,
];

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
 * Returns the page HTML string. Tries networkidle2 first, falls back to domcontentloaded.
 */
async function fetchRenderedHtml(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.setExtraHTTPHeaders({ Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' });

    // Try networkidle2 first, fall back to domcontentloaded for slow sites
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: PUPPETEER_TIMEOUT });
    } catch (err) {
      if (err.message.includes('timeout') || err.message.includes('Timeout')) {
        console.log(`    networkidle2 timed out, retrying with domcontentloaded...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PUPPETEER_TIMEOUT });
        await sleep(3000); // extra wait for JS to render
      } else {
        throw err;
      }
    }

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
        // Safety: resolve after 10s regardless
        setTimeout(() => { clearInterval(timer); resolve(); }, 10000);
      });
    });

    // Brief pause to let lazy-loaded images settle
    await sleep(1000);

    return await page.content();
  } finally {
    await page.close();
  }
}

/**
 * Use Puppeteer to extract all links from rendered page (handles SPA navigation).
 * Returns array of {url, text} objects.
 */
async function extractRenderedLinks(browser, url) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: PUPPETEER_TIMEOUT });
    } catch {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PUPPETEER_TIMEOUT });
      await sleep(2000);
    }

    return await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.href;
        const text = a.textContent?.trim() || '';
        if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
          links.push({ url: href, text });
        }
      });
      return links;
    });
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

  // Deduplicate: prefer deeper URLs (leaf categories have more images).
  // Group by parent category (first path segment after prefix) and keep max 15 categories.
  if (categoryLinks.length > 15) {
    // Score: prefer leaf pages (deeper paths) that likely have actual project images
    const scored = categoryLinks.map(link => {
      const pathSegments = new URL(link.url).pathname.split('/').filter(Boolean);
      return { ...link, depth: pathSegments.length };
    });
    // Sort by depth descending (deepest = most specific = most images)
    scored.sort((a, b) => b.depth - a.depth);
    // Take top 15 unique categories
    const seen = new Set();
    categoryLinks = [];
    for (const link of scored) {
      const key = slugify(link.category);
      if (!seen.has(key) && categoryLinks.length < 15) {
        seen.add(key);
        categoryLinks.push(link);
      }
    }
    console.log(`  Trimmed to ${categoryLinks.length} unique category link(s)`);
  }

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

  // Step 2: Fallback — try project/portfolio page links from HTML
  if (Object.keys(portfolioCategories).length === 0) {
    console.log(`  No categories found, trying project page links...`);

    let projectLinks = extractProjectPageLinks(homepageHtml, baseUrl);

    // If static HTML found nothing, try rendered links from Puppeteer (SPA fallback)
    if (projectLinks.length === 0) {
      console.log(`  Static HTML had no project links, trying Puppeteer rendered links...`);
      try {
        const renderedLinks = await extractRenderedLinks(browser, baseUrl);
        const baseHost = new URL(baseUrl).hostname;
        projectLinks = renderedLinks
          .filter(l => {
            try {
              const u = new URL(l.url);
              return u.hostname === baseHost &&
                PROJECT_PAGE_PATTERNS.some(p => p.test(u.pathname));
            } catch { return false; }
          })
          .map(l => l.url);
        // Deduplicate
        projectLinks = [...new Set(projectLinks)];
        console.log(`  Found ${projectLinks.length} rendered project link(s)`);
      } catch (err) {
        console.log(`  Rendered link extraction failed: ${err.message}`);
      }
    } else {
      console.log(`  Found ${projectLinks.length} project page link(s)`);
    }

    // Also try extractPortfolioPageLinks for listing pages
    const listingPages = extractPortfolioPageLinks(homepageHtml, baseUrl);
    if (listingPages.length > 0) {
      console.log(`  Found ${listingPages.length} portfolio listing page(s)`);
      // Crawl listing pages to find deeper project links
      for (const listingUrl of listingPages.slice(0, 3)) {
        console.log(`  Crawling listing page: ${listingUrl}`);
        try {
          const listingHtml = await fetchRenderedHtml(browser, listingUrl);
          await sleep(REQUEST_DELAY_MS);

          // Extract category links from listing page
          const subCategoryLinks = extractCategoryLinks(listingHtml, baseUrl);
          if (subCategoryLinks.length > 0) {
            console.log(`    Found ${subCategoryLinks.length} category link(s) on listing page`);
            for (const { url: catUrl, category } of subCategoryLinks) {
              if (totalImagesForCompany >= MAX_IMAGES_PER_COMPANY) break;

              console.log(`    Category "${category}": ${catUrl}`);
              const imageUrls = await scrapeImagesFromPage(browser, catUrl, baseUrl);
              console.log(`      Found ${imageUrls.length} image(s)`);
              await sleep(REQUEST_DELAY_MS);

              if (imageUrls.length === 0) continue;
              const categorySlug = slugify(category);
              const destDir = path.join(PORTFOLIO_DIR, company.slug, categorySlug);
              const remaining = MAX_IMAGES_PER_COMPANY - totalImagesForCompany;
              const capped = imageUrls.slice(0, Math.min(imageUrls.length, remaining));
              const saved = await downloadCategoryImages(capped, destDir, categorySlug, company.slug);
              console.log(`      Saved ${saved.length} image(s)`);

              if (saved.length > 0) {
                if (!portfolioCategories[category]) portfolioCategories[category] = [];
                portfolioCategories[category].push(...saved);
                totalImagesForCompany += saved.length;
              }
            }
          }

          // Also grab images directly from listing page
          if (Object.keys(portfolioCategories).length === 0) {
            const listingImages = extractPortfolioImages(listingHtml, baseUrl);
            if (listingImages.length > 0) {
              console.log(`    Found ${listingImages.length} images on listing page`);
              const categorySlug = 'projects';
              const destDir = path.join(PORTFOLIO_DIR, company.slug, categorySlug);
              const remaining = MAX_IMAGES_PER_COMPANY - totalImagesForCompany;
              const capped = listingImages.slice(0, Math.min(listingImages.length, remaining));
              const saved = await downloadCategoryImages(capped, destDir, categorySlug, company.slug);
              if (saved.length > 0) {
                portfolioCategories['Projects'] = saved;
                totalImagesForCompany += saved.length;
              }
            }
          }

          // Find deeper project detail links from listing
          const deeperLinks = extractProjectPageLinks(listingHtml, baseUrl);
          projectLinks.push(...deeperLinks.filter(l => !projectLinks.includes(l)));
        } catch (err) {
          console.log(`    Failed: ${err.message}`);
        }
      }
    }

    // Crawl individual project pages
    if (Object.keys(portfolioCategories).length === 0 || totalImagesForCompany < 10) {
      const dedupedLinks = [...new Set(projectLinks)];
      for (const pageUrl of dedupedLinks.slice(0, 10)) {
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
