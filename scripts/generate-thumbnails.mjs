#!/usr/bin/env node
/**
 * Generate thumbnail variants (blur, thumb, medium WebP) for all existing images.
 *
 * Usage:
 *   node scripts/generate-thumbnails.mjs                           # dry-run
 *   node scripts/generate-thumbnails.mjs --apply                   # generate
 *   node scripts/generate-thumbnails.mjs --apply --dir public/images/uae-companies/portfolio
 *   node scripts/generate-thumbnails.mjs --apply --dir server/public/uploads/projects
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const DIR_ARG = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : null;

const VARIANTS = [
  { suffix: '-blur', maxLongEdge: 40, quality: 20 },
  { suffix: '-thumb', maxLongEdge: 400, quality: 75 },
  { suffix: '-medium', maxLongEdge: 800, quality: 80 },
];

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);

function isVariantFile(name) {
  return /-blur\.webp$|-thumb\.webp$|-medium\.webp$/.test(name);
}

function findImages(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('_')) continue;
      results.push(...findImages(fullPath));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext) && !isVariantFile(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

async function generateVariants(imagePath) {
  const ext = path.extname(imagePath);
  const base = imagePath.slice(0, -ext.length);
  let generated = 0;
  let skipped = 0;

  let metadata;
  try {
    metadata = await sharp(imagePath).metadata();
  } catch {
    return { generated: 0, skipped: 0, error: 'unreadable' };
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width === 0 || height === 0) return { generated: 0, skipped: 0, error: 'no dimensions' };

  for (const variant of VARIANTS) {
    const outPath = `${base}${variant.suffix}.webp`;

    if (fs.existsSync(outPath)) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      generated++;
      continue;
    }

    const longEdge = Math.max(width, height);
    const scale = longEdge > variant.maxLongEdge ? variant.maxLongEdge / longEdge : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    try {
      await sharp(imagePath)
        .resize(targetW, targetH, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: variant.quality })
        .toFile(outPath);
      generated++;
    } catch (err) {
      console.error(`  Error generating ${variant.suffix} for ${path.basename(imagePath)}: ${err.message}`);
    }
  }

  return { generated, skipped };
}

async function main() {
  const dirs = DIR_ARG
    ? [path.resolve(ROOT, DIR_ARG)]
    : [
        path.join(ROOT, 'public/images/uae-companies/portfolio'),
        path.join(ROOT, 'server/public/uploads/projects'),
      ];

  console.log('=== Thumbnail Generator ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  console.log(`Directories: ${dirs.join(', ')}\n`);

  let totalImages = 0;
  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const dir of dirs) {
    const images = findImages(dir);
    console.log(`${dir}: ${images.length} images found`);

    for (const imagePath of images) {
      const result = await generateVariants(imagePath);
      if (result.error) {
        totalErrors++;
        continue;
      }
      totalImages++;
      totalGenerated += result.generated;
      totalSkipped += result.skipped;

      if (result.generated > 0 && !DRY_RUN) {
        process.stdout.write('.');
      }
    }
    console.log('');
  }

  console.log('\n=== Summary ===');
  console.log(`Images processed: ${totalImages}`);
  console.log(`Variants generated: ${totalGenerated}`);
  console.log(`Variants skipped (exist): ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
  if (DRY_RUN) console.log('\nDry run. Use --apply to generate.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
