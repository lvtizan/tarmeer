#!/usr/bin/env node
/**
 * Re-scrape low-quality images: find small images on disk, revisit source pages,
 * attempt to download higher-resolution versions.
 *
 * Usage:
 *   node scripts/uae-scraper/rescrape-low-quality.mjs                    # scan only
 *   node scripts/uae-scraper/rescrape-low-quality.mjs --apply            # re-download
 *   node scripts/uae-scraper/rescrape-low-quality.mjs --apply --slug x   # single company
 *   node scripts/uae-scraper/rescrape-low-quality.mjs --min-edge 500     # custom threshold
 *   node scripts/uae-scraper/rescrape-low-quality.mjs --concurrency 8    # parallel workers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import puppeteer from 'puppeteer';
import {
  extractPortfolioImages,
  downloadFile,
  getExtension,
} from './scrape-logos-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_FILE = path.join(__dirname, 'companies-data-final.json');
const PORTFOLIO_DIR = path.join(ROOT, 'public/images/uae-companies/portfolio');

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const SLUG_FILTER = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
const MIN_LONG_EDGE = args.includes('--min-edge')
  ? Number(args[args.indexOf('--min-edge') + 1]) || 500
  : 500;
const CONCURRENCY = args.includes('--concurrency')
  ? Number(args[args.indexOf('--concurrency') + 1]) || 5
  : 5;

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Additional URL upgrade patterns beyond what scrape-logos-lib already handles
function upgradeImageUrl(url) {
  let upgraded = url;

  // WordPress: -NNNxNNN suffix → remove
  upgraded = upgraded.replace(/-\d{2,4}x\d{2,4}(\.\w+)(?:\?|$)/, '$1');

  // WordPress: ?resize=NNNxNNN or ?w=NNN → remove
  upgraded = upgraded.replace(/[?&](?:resize|fit|w|h|width|height)=[^&]*/g, '');
  // Clean trailing ? or &
  upgraded = upgraded.replace(/[?&]$/, '');

  // Next.js image optimizer → max quality
  if (upgraded.includes('/_next/image')) {
    upgraded = upgraded.replace(/[&?]w=\d+/, '&w=1920');
    upgraded = upgraded.replace(/[&?]q=\d+/, '&q=90');
  }

  // Cloudinary → high quality
  if (upgraded.includes('cloudinary.com')) {
    upgraded = upgraded.replace(/\/w_\d+/, '/w_1920');
    upgraded = upgraded.replace(/\/h_\d+,?/, '/');
    upgraded = upgraded.replace(/\/q_\d+/, '/q_auto');
    upgraded = upgraded.replace(/\/c_thumb/, '/c_fill');
    // Remove double slashes in transform path
    upgraded = upgraded.replace(/\/\/+/g, '/').replace(':/', '://');
  }

  // Squarespace: ?format=NNNw → remove or upgrade
  upgraded = upgraded.replace(/\?format=\d+w/, '?format=2500w');

  // imgix / similar CDNs
  if (/[?&](?:auto|fm|fit|crop|dpr)=/.test(upgraded)) {
    upgraded = upgraded.replace(/[&?]w=\d+/, '&w=1920');
    upgraded = upgraded.replace(/[&?]h=\d+/, '');
    upgraded = upgraded.replace(/[&?]q=\d+/, '&q=85');
  }

  // Wix: /v1/.../fill/w_NNN,h_NNN → upgrade dimensions
  if (upgraded.includes('wix') || upgraded.includes('wixstatic')) {
    upgraded = upgraded.replace(/\/w_\d+,h_\d+/, '/w_1920,h_1440');
  }

  // Generic thumbnail patterns
  upgraded = upgraded.replace(/[_-](?:thumb|thumbnail|small|sm|xs|150|200|300|320|400|480)(\.\w+)$/, '$1');

  return upgraded;
}

// Find all original images (skip variant files)
function findImages(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue;
      results.push(...findImages(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext) && !/-blur|-thumb|-medium/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

// Find low-quality images for a company
async function findLowQualityImages(companyDir) {
  const images = findImages(companyDir);
  const lowQuality = [];

  for (const imgPath of images) {
    try {
      const meta = await sharp(imgPath).metadata();
      const w = meta.width || 0;
      const h = meta.height || 0;
      const longEdge = Math.max(w, h);

      if (longEdge < MIN_LONG_EDGE && longEdge > 0) {
        lowQuality.push({
          path: imgPath,
          width: w,
          height: h,
          longEdge,
          relativePath: '/' + path.relative(path.join(ROOT, 'public'), imgPath),
        });
      }
    } catch {
      // unreadable
    }
  }

  return lowQuality;
}

// Try to find a higher-res version by visiting the source page
async function tryUpgradeFromPage(browser, sourceUrl, originalImageUrl) {
  if (!sourceUrl) return null;

  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.goto(sourceUrl, { waitUntil: 'networkidle2', timeout: 20000 });

    // Scroll to trigger lazy loading
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let total = 0;
        const timer = setInterval(() => {
          window.scrollBy(0, 400);
          total += 400;
          if (total >= document.body.scrollHeight) { clearInterval(timer); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(timer); resolve(); }, 8000);
      });
    });

    await new Promise(r => setTimeout(r, 1000));
    const html = await page.content();

    // Extract all image URLs from the page
    const baseUrl = new URL(sourceUrl).origin;
    const allImages = extractPortfolioImages(html, baseUrl);

    // Try to match the original image by filename pattern
    const originalBasename = path.basename(originalImageUrl)
      .replace(/-\d{2,4}x\d{2,4}/, '')
      .replace(/\.\w+$/, '');

    for (const imgUrl of allImages) {
      const upgraded = upgradeImageUrl(imgUrl);
      if (upgraded !== imgUrl || imgUrl.includes(originalBasename)) {
        return upgraded;
      }
    }

    // Return upgraded version of all found images for fuzzy matching
    return allImages.map(upgradeImageUrl);
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

// Download and verify an upgraded image is actually better
async function downloadAndVerify(url, destPath, minLongEdge) {
  const tmpPath = destPath + '.tmp';
  try {
    await downloadFile(url, tmpPath);

    const meta = await sharp(tmpPath).metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    const longEdge = Math.max(w, h);

    if (longEdge >= minLongEdge) {
      // Better! Replace old image
      fs.renameSync(tmpPath, destPath);
      // Delete old variant files
      const base = destPath.replace(/\.\w+$/, '');
      for (const suffix of ['-blur.webp', '-thumb.webp', '-medium.webp']) {
        try { fs.unlinkSync(base + suffix); } catch {}
      }
      return { success: true, width: w, height: h };
    } else {
      // Not better, discard
      try { fs.unlinkSync(tmpPath); } catch {}
      return { success: false, width: w, height: h, reason: `still small (${longEdge}px)` };
    }
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    return { success: false, reason: err.message };
  }
}

// Process a batch of companies concurrently
async function processCompanyBatch(browser, companies, data) {
  const results = { upgraded: 0, failed: 0, skipped: 0, removed: 0 };

  for (const company of companies) {
    const companyDir = path.join(PORTFOLIO_DIR, company.slug);
    if (!fs.existsSync(companyDir)) continue;

    const lowQuality = await findLowQualityImages(companyDir);
    if (lowQuality.length === 0) continue;

    const totalImages = findImages(companyDir).length;
    console.log(`\n${company.slug}: ${lowQuality.length}/${totalImages} low-quality (<${MIN_LONG_EDGE}px)`);

    // Find source URLs from the company data
    const companyData = data.find(c => c.slug === company.slug);
    const sourceUrl = companyData?.website?.replace(/\/+$/, '') || '';

    for (const img of lowQuality) {
      const basename = path.basename(img.path);
      const label = `  ${img.width}x${img.height} ${basename}`;

      if (img.longEdge < 100) {
        // Tiny images (< 100px) - just remove, they're placeholders/icons
        if (!DRY_RUN) {
          try { fs.unlinkSync(img.path); } catch {}
          // Remove variants too
          const base = img.path.replace(/\.\w+$/, '');
          for (const suffix of ['-blur.webp', '-thumb.webp', '-medium.webp']) {
            try { fs.unlinkSync(base + suffix); } catch {}
          }
        }
        console.log(`${label} → REMOVE (placeholder)`);
        results.removed++;
        continue;
      }

      // Try URL upgrade first (no network needed)
      const originalUrl = img.relativePath;
      // We don't have the original source URL per-image, so we try upgrading the filename pattern
      // The real fix is re-scraping from the source page

      if (DRY_RUN) {
        console.log(`${label} → WOULD RE-SCRAPE from ${sourceUrl || 'unknown'}`);
        results.skipped++;
        continue;
      }

      // Try to find higher-res from source page
      if (sourceUrl) {
        const upgraded = await tryUpgradeFromPage(browser, sourceUrl, originalUrl);
        if (upgraded && typeof upgraded === 'string') {
          const result = await downloadAndVerify(upgraded, img.path, MIN_LONG_EDGE);
          if (result.success) {
            console.log(`${label} → UPGRADED to ${result.width}x${result.height}`);
            results.upgraded++;
            continue;
          }
        }
      }

      // Could not upgrade - if very small, remove
      if (img.longEdge < 250) {
        try { fs.unlinkSync(img.path); } catch {}
        const base = img.path.replace(/\.\w+$/, '');
        for (const suffix of ['-blur.webp', '-thumb.webp', '-medium.webp']) {
          try { fs.unlinkSync(base + suffix); } catch {}
        }
        console.log(`${label} → REMOVE (too small, no upgrade found)`);
        results.removed++;
      } else {
        console.log(`${label} → KEEP (no better version found)`);
        results.failed++;
      }
    }
  }

  return results;
}

async function main() {
  console.log('=== Low-Quality Image Re-scraper ===');
  console.log(`Mode: ${DRY_RUN ? 'SCAN ONLY' : 'APPLY'}`);
  console.log(`Min long edge: ${MIN_LONG_EDGE}px`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  if (SLUG_FILTER) console.log(`Filter: ${SLUG_FILTER}`);

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  let companies = data;
  if (SLUG_FILTER) {
    companies = data.filter(c => c.slug === SLUG_FILTER);
  }

  // Phase 1: Scan all companies for low-quality images
  console.log('\n--- Phase 1: Scanning for low-quality images ---');

  const companiesWithIssues = [];
  let totalLow = 0;
  let totalImages = 0;

  for (const company of companies) {
    const companyDir = path.join(PORTFOLIO_DIR, company.slug);
    if (!fs.existsSync(companyDir)) continue;

    const allImages = findImages(companyDir);
    const lowQuality = await findLowQualityImages(companyDir);
    totalImages += allImages.length;
    totalLow += lowQuality.length;

    if (lowQuality.length > 0) {
      companiesWithIssues.push({ ...company, lowCount: lowQuality.length, totalCount: allImages.length });
    }
  }

  console.log(`\nTotal images: ${totalImages}`);
  console.log(`Low quality (<${MIN_LONG_EDGE}px): ${totalLow} (${(totalLow/totalImages*100).toFixed(1)}%)`);
  console.log(`Companies affected: ${companiesWithIssues.length}`);

  // Show top offenders
  companiesWithIssues.sort((a, b) => b.lowCount - a.lowCount);
  console.log('\nTop offenders:');
  for (const c of companiesWithIssues.slice(0, 15)) {
    console.log(`  ${c.slug}: ${c.lowCount}/${c.totalCount} low-quality`);
  }

  if (DRY_RUN) {
    console.log('\nDry run. Use --apply to re-scrape and clean up.');
    return;
  }

  // Phase 2: Re-scrape with concurrent browser instances
  console.log('\n--- Phase 2: Re-scraping low-quality images ---');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    // Process in batches based on concurrency
    const batchSize = CONCURRENCY;
    const totalResults = { upgraded: 0, failed: 0, skipped: 0, removed: 0 };

    for (let i = 0; i < companiesWithIssues.length; i += batchSize) {
      const batch = companiesWithIssues.slice(i, i + batchSize);
      const batchResults = await processCompanyBatch(browser, batch, data);
      totalResults.upgraded += batchResults.upgraded;
      totalResults.failed += batchResults.failed;
      totalResults.skipped += batchResults.skipped;
      totalResults.removed += batchResults.removed;
    }

    console.log('\n=== Summary ===');
    console.log(`Upgraded: ${totalResults.upgraded}`);
    console.log(`Removed: ${totalResults.removed}`);
    console.log(`Failed (kept): ${totalResults.failed}`);

    // Phase 3: Regenerate thumbnails for upgraded images
    if (totalResults.upgraded > 0 || totalResults.removed > 0) {
      console.log('\nRegenerating thumbnails for changed images...');
      // Import dynamically since it's a .mjs module
      const { execSync } = await import('child_process');
      execSync('node scripts/generate-thumbnails.mjs --apply', {
        cwd: ROOT,
        stdio: 'inherit',
      });
    }
  } finally {
    await browser.close();
  }

  // Phase 4: Update companies-data-final.json to remove deleted images
  console.log('\nUpdating data file to remove deleted image references...');
  const updatedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  let removedRefs = 0;

  for (const company of updatedData) {
    const pc = company.portfolio_categories;
    if (!pc || typeof pc !== 'object') continue;

    for (const [cat, value] of Object.entries(pc)) {
      const items = Array.isArray(value) ? value : (value?.items || []);
      const filtered = items.filter(item => {
        const url = typeof item === 'string' ? item : item.url;
        const relPath = url.replace(/^\//, '');
        const filePath = path.join(ROOT, 'public', relPath);
        return fs.existsSync(filePath);
      });

      const removed = items.length - filtered.length;
      removedRefs += removed;

      if (Array.isArray(value)) {
        pc[cat] = filtered;
      } else if (value?.items) {
        value.items = filtered;
      }

      if (filtered.length === 0) delete pc[cat];
    }
  }

  if (removedRefs > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(updatedData, null, 2));
    console.log(`Removed ${removedRefs} dead references from data file.`);
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
