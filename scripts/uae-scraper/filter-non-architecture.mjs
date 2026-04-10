#!/usr/bin/env node
/**
 * Filter non-architecture images using CLIP zero-shot classification.
 *
 * Usage:
 *   node scripts/uae-scraper/filter-non-architecture.mjs                    # dry-run
 *   node scripts/uae-scraper/filter-non-architecture.mjs --apply            # move rejected
 *   node scripts/uae-scraper/filter-non-architecture.mjs --apply --slug algedra
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from '@xenova/transformers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const DATA_FILE = path.join(__dirname, 'companies-data-final.json');
const PORTFOLIO_DIR = path.join(ROOT, 'public/images/uae-companies/portfolio');

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const SLUG_FILTER = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

const ARCHITECTURE_LABELS = [
  'architecture building exterior photo',
  'interior design room photo',
  'construction project photo',
  'landscape with buildings and structures',
];

const NOT_ARCHITECTURE_LABELS = [
  'icon logo chart diagram graphic illustration',
  'flag emblem badge symbol',
  'food drink meal restaurant table',
  'portrait selfie headshot person face',
  'animal pet wildlife nature',
  'text document certificate award',
];

const ALL_LABELS = [...ARCHITECTURE_LABELS, ...NOT_ARCHITECTURE_LABELS];

const KEEP_THRESHOLD = 0.5;
const REVIEW_THRESHOLD = 0.3;

async function main() {
  console.log('=== Non-Architecture Image Filter (CLIP) ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`);
  if (SLUG_FILTER) console.log(`Filter: ${SLUG_FILTER}`);
  console.log('Loading CLIP model (first run downloads ~170MB)...\n');

  const classifier = await pipeline(
    'zero-shot-image-classification',
    'Xenova/clip-vit-base-patch16'
  );

  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  let companies = data;
  if (SLUG_FILTER) {
    companies = data.filter(c => c.slug === SLUG_FILTER);
  }

  let totalKept = 0;
  let totalRejected = 0;
  let totalReview = 0;

  for (const company of companies) {
    const pc = company.portfolio_categories;
    if (!pc || typeof pc !== 'object') continue;

    const companyDir = path.join(PORTFOLIO_DIR, company.slug);
    const rejectedDir = path.join(companyDir, '_rejected');
    const reviewDir = path.join(companyDir, '_review');

    let companyRejected = 0;
    let companyReview = 0;

    for (const [cat, items] of Object.entries(pc)) {
      const kept = [];

      for (const item of items) {
        const relPath = item.url.replace(/^\//, '');
        const filePath = path.join(ROOT, 'public', relPath);

        if (!fs.existsSync(filePath)) {
          kept.push(item);
          continue;
        }

        try {
          const result = await classifier(filePath, ALL_LABELS);

          let archScore = 0;
          for (const r of result) {
            if (ARCHITECTURE_LABELS.includes(r.label)) {
              archScore += r.score;
            }
          }

          if (archScore >= KEEP_THRESHOLD) {
            kept.push(item);
            totalKept++;
          } else if (archScore >= REVIEW_THRESHOLD) {
            totalReview++;
            companyReview++;
            if (!DRY_RUN) {
              fs.mkdirSync(reviewDir, { recursive: true });
              const dest = path.join(reviewDir, path.basename(filePath));
              fs.renameSync(filePath, dest);
            }
            console.log(`  REVIEW ${(archScore * 100).toFixed(0)}% ${item.url.split('/').pop()} -> ${result[0].label}`);
          } else {
            totalRejected++;
            companyRejected++;
            if (!DRY_RUN) {
              fs.mkdirSync(rejectedDir, { recursive: true });
              const dest = path.join(rejectedDir, path.basename(filePath));
              fs.renameSync(filePath, dest);
            }
            console.log(`  REJECT ${(archScore * 100).toFixed(0)}% ${item.url.split('/').pop()} -> ${result[0].label}`);
          }
        } catch (err) {
          kept.push(item);
          totalKept++;
        }
      }

      pc[cat] = kept;
      if (kept.length === 0) delete pc[cat];
    }

    if (companyRejected + companyReview > 0) {
      console.log(`${company.slug}: rejected ${companyRejected}, review ${companyReview}`);
    }
  }

  if (!DRY_RUN) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('\nJSON updated.');
  }

  console.log('\n=== Summary ===');
  console.log(`Kept: ${totalKept}`);
  console.log(`Rejected: ${totalRejected}`);
  console.log(`Review: ${totalReview}`);
  if (DRY_RUN) console.log('\nDry run. Use --apply to save.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
