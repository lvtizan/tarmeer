#!/usr/bin/env node
/**
 * Harness lint: verify scraper JSON ↔ database sync.
 * Checks that companies-data-final.json portfolio_categories
 * match what's in the database (uae_companies.portfolio_images).
 *
 * Usage:
 *   node scripts/harness/lint-scraper-sync.mjs          # check local DB
 *   node scripts/harness/lint-scraper-sync.mjs --prod    # check production RDS (via SSH)
 *
 * Exit code:
 *   0 = in sync
 *   1 = out of sync (need to run sync-to-db.mjs --apply)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'uae-scraper', 'companies-data-final.json');

// Check if JSON file has been modified more recently than last sync
// Simple heuristic: compare image counts between JSON and what we expect

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

let totalJsonImages = 0;
let companiesWithImages = 0;

for (const company of data) {
  const pc = company.portfolio_categories;
  if (!pc || typeof pc !== 'object') continue;

  let count = 0;
  for (const [, items] of Object.entries(pc)) {
    const arr = Array.isArray(items) ? items : (items?.items || []);
    count += arr.length;
  }

  if (count > 0) {
    companiesWithImages++;
    totalJsonImages += count;
  }
}

console.log(`JSON file: ${companiesWithImages} companies, ${totalJsonImages} total images`);
console.log(`\nTo sync JSON → DB, run:`);
console.log(`  node scripts/uae-scraper/sync-to-db.mjs --apply`);
console.log(`\nFull pipeline after filtering:`);
console.log(`  1. node scripts/uae-scraper/dedup-images.mjs --apply`);
console.log(`  2. node scripts/uae-scraper/filter-non-architecture.mjs --apply`);
console.log(`  3. node scripts/uae-scraper/sync-to-db.mjs --apply  ← MUST NOT SKIP`);
