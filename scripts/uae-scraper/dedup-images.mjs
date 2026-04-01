/**
 * Pre-import image quality filter: dedup by fingerprint + remove dark/small images.
 *
 * Scans all portfolio images on disk, computes 16x16 grayscale fingerprint,
 * detects duplicates (>92% similarity) and dark images (brightness < 45),
 * then removes bad entries from companies-data-final.json.
 *
 * Usage:
 *   node scripts/uae-scraper/dedup-images.mjs                # dry-run
 *   node scripts/uae-scraper/dedup-images.mjs --apply         # update JSON
 *   node scripts/uae-scraper/dedup-images.mjs --slug algedra  # single company
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_FILE = path.join(__dirname, 'companies-data-final.json');
const PORTFOLIO_DIR = path.join(ROOT, 'public/images/uae-companies/portfolio');

const THUMB_SIZE = 16;
const DARK_THRESHOLD = 45;
const SIMILARITY_THRESHOLD = 0.92;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const MAX_ASPECT_RATIO = 3.5;
const MIN_ASPECT_RATIO = 0.25;

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const SLUG_FILTER = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

/**
 * Get 16x16 grayscale fingerprint + metadata for an image file.
 */
async function getFingerprint(filePath) {
  try {
    const meta = await sharp(filePath).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;

    // Size/ratio checks
    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      return { skip: true, reason: `too small (${width}x${height})` };
    }
    const ratio = width / height;
    if (ratio > MAX_ASPECT_RATIO || ratio < MIN_ASPECT_RATIO) {
      return { skip: true, reason: `bad ratio (${ratio.toFixed(1)})` };
    }

    // Generate 16x16 grayscale thumbnail
    const { data } = await sharp(filePath)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = Array.from(data);
    const brightness = pixels.reduce((s, v) => s + v, 0) / pixels.length;

    if (brightness < DARK_THRESHOLD) {
      return { skip: true, reason: `too dark (brightness ${brightness.toFixed(0)})` };
    }

    return { skip: false, pixels, brightness, width, height };
  } catch (err) {
    return { skip: true, reason: `read error: ${err.message}` };
  }
}

/**
 * Compare two pixel arrays, return similarity 0-1.
 */
function similarity(a, b) {
  if (a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += 1 - Math.abs(a[i] - b[i]) / 255;
  }
  return sum / a.length;
}

async function processCompany(company) {
  const pc = company.portfolio_categories;
  if (!pc || typeof pc !== 'object') return { removed: 0, kept: 0, details: [] };

  const fingerprints = []; // array of pixel arrays already accepted
  let totalRemoved = 0;
  let totalKept = 0;
  const details = [];

  for (const [cat, items] of Object.entries(pc)) {
    const kept = [];

    for (const item of items) {
      // Convert URL to file path
      const relPath = item.url.replace(/^\//, '');
      const filePath = path.join(ROOT, 'public', relPath);

      if (!fs.existsSync(filePath)) {
        details.push({ url: item.url, action: 'REMOVE', reason: 'file not found' });
        totalRemoved++;
        continue;
      }

      const fp = await getFingerprint(filePath);

      if (fp.skip) {
        details.push({ url: item.url, action: 'REMOVE', reason: fp.reason });
        totalRemoved++;
        continue;
      }

      // Check for duplicates
      let isDuplicate = false;
      for (const existing of fingerprints) {
        if (similarity(existing, fp.pixels) > SIMILARITY_THRESHOLD) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) {
        details.push({ url: item.url, action: 'REMOVE', reason: 'duplicate' });
        totalRemoved++;
        continue;
      }

      fingerprints.push(fp.pixels);
      kept.push(item);
      totalKept++;
    }

    pc[cat] = kept;
    if (kept.length === 0) {
      delete pc[cat];
    }
  }

  return { removed: totalRemoved, kept: totalKept, details };
}

async function main() {
  console.log('=== Image Dedup & Quality Filter ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  if (SLUG_FILTER) console.log(`Filter: ${SLUG_FILTER}`);
  console.log('');

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  let companies = data;
  if (SLUG_FILTER) {
    companies = data.filter(c => c.slug === SLUG_FILTER);
  }

  let grandRemoved = 0;
  let grandKept = 0;

  for (const company of companies) {
    const pc = company.portfolio_categories;
    if (!pc || Object.keys(pc).length === 0) continue;

    const imgsBefore = Object.values(pc).reduce((s, a) => s + a.length, 0);
    if (imgsBefore === 0) continue;

    const result = await processCompany(company);
    grandRemoved += result.removed;
    grandKept += result.kept;

    if (result.removed > 0) {
      console.log(`${company.slug}: ${imgsBefore} → ${result.kept} (removed ${result.removed})`);
      for (const d of result.details) {
        if (d.action === 'REMOVE') {
          console.log(`  ${d.reason}: ${d.url.split('/').pop()}`);
        }
      }
    } else {
      console.log(`${company.slug}: ${imgsBefore} OK`);
    }
  }

  if (!DRY_RUN) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('\nJSON updated.');
  }

  console.log(`\n=== Summary ===`);
  console.log(`Kept: ${grandKept}`);
  console.log(`Removed: ${grandRemoved}`);
  if (DRY_RUN) console.log('\nDry run. Use --apply to save changes.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
