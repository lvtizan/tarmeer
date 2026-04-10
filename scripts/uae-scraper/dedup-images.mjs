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
const TEXT_OVERLAY_THRESHOLD = 0.08; // >8% of pixels are near-white + high edge = likely text banner

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const SLUG_FILTER = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

/**
 * Detect text/banner overlays.
 * Strategy: text banners have bright white text → lots of near-white pixels (>240)
 * combined with sharp edges adjacent to them.
 * Returns true if image looks like a promotional banner with text overlay.
 */
async function hasTextOverlay(filePath) {
  try {
    const size = 64;
    const { data } = await sharp(filePath)
      .resize(size, size, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const totalPixels = size * size;
    let brightPixels = 0;    // near-white (>240)
    let brightEdges = 0;     // bright pixel next to dark pixel = text edge

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        const val = data[idx];

        if (val > 240) {
          brightPixels++;
          // Check if adjacent pixel is much darker (text edge)
          if (x > 0 && data[idx - 1] < 180) brightEdges++;
          if (x < size - 1 && data[idx + 1] < 180) brightEdges++;
          if (y > 0 && data[idx - size] < 180) brightEdges++;
          if (y < size - 1 && data[idx + size] < 180) brightEdges++;
        }
      }
    }

    const brightRatio = brightPixels / totalPixels;
    const edgeRatio = brightEdges / totalPixels;

    // Banner with text: >8% bright pixels AND >3% bright-edge transitions
    return brightRatio > TEXT_OVERLAY_THRESHOLD && edgeRatio > 0.03;
  } catch {
    return false;
  }
}

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

    // Check for text/banner overlay
    if (await hasTextOverlay(filePath)) {
      return { skip: true, reason: 'text/banner overlay' };
    }

    // Layer 6: Non-photo heuristic checks
    // Color poverty check (icons, flags, charts have few unique colors)
    {
      const size = 64;
      const { data } = await sharp(filePath)
        .resize(size, size, { fit: 'fill' })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const colors = new Set();
      for (let i = 0; i < data.length; i += 3) {
        // Quantize to reduce noise: group into 8-level buckets
        const r = Math.floor(data[i] / 32);
        const g = Math.floor(data[i + 1] / 32);
        const b = Math.floor(data[i + 2] / 32);
        colors.add(`${r},${g},${b}`);
      }

      if (colors.size < 20) {
        return { skip: true, reason: `color poverty (${colors.size} unique colors)` };
      }

      // Low saturation check (grayscale charts, wireframes)
      let totalSat = 0;
      const pixelCount = size * size;
      for (let i = 0; i < data.length; i += 3) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        totalSat += max === 0 ? 0 : (max - min) / max;
      }
      const avgSat = totalSat / pixelCount;

      if (avgSat < 0.08) {
        return { skip: true, reason: `low saturation (${(avgSat * 100).toFixed(1)}%)` };
      }
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
