/**
 * Category-Aware Portfolio Scraper
 *
 * 1. Reads companies-data.json
 * 2. Visits each company's website with Puppeteer
 * 3. Discovers portfolio categories from navigation links
 * 4. Scrapes images from each category page
 * 5. Downloads images organized by category
 * 6. Updates JSON with categorized local paths
 * 7. Saves to companies-data-final.json
 */

import fs from 'fs';
import path from 'path';
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

const MAX_IMAGES_PER_CATEGORY = 20;
const MAX_IMAGES_PER_COMPANY = 100;
const REQUEST_DELAY_MS = 2000;
const PUPPETEER_TIMEOUT = 30000;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
async function processCompany(browser, company, idx, total) {
  const label = `[${idx + 1}/${total}] ${company.name_en}`;
  const baseUrl = company.website.replace(/\/+$/, '');
  console.log(`\n${label}: ${baseUrl}`);

  let homepageHtml;
  try {
    homepageHtml = await fetchRenderedHtml(browser, baseUrl);
    console.log(`  Homepage fetched (${homepageHtml.length} chars)`);
  } catch (err) {
    console.log(`  Failed to fetch homepage: ${err.message}`);
    return {};
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

  return portfolioCategories;
}

async function runAll() {
  const companies = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  console.log(`=== Category-Aware Portfolio Scraper ===\n`);
  console.log(`Processing ${companies.length} companies...\n`);

  // Ensure base portfolio directory exists
  fs.mkdirSync(PORTFOLIO_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];

      try {
        const portfolioCategories = await processCompany(browser, company, i, companies.length);
        company.portfolio_categories = portfolioCategories;
      } catch (err) {
        console.log(`  Fatal error for ${company.name_en}: ${err.message}`);
        company.portfolio_categories = {};
      }
    }
  } finally {
    await browser.close();
  }

  // Save updated JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(companies, null, 2));
  console.log(`\n=== Done! ===`);
  console.log(`Output: ${OUTPUT_JSON}`);
  console.log(`Images: ${PORTFOLIO_DIR}`);
}

runAll().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
