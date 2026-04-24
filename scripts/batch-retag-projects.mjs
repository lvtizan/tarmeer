#!/usr/bin/env node
/**
 * Batch re-tag approved projects using Gemini vision.
 * Runs on the server where images are stored.
 *
 * Usage: cd /tarmeer/tarmeer_api && node batch-retag-projects.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Load compiled server modules
const pool = require('./dist/config/database').default;
const { tagProjectImages } = require('./dist/services/visionTagging');

async function main() {
  console.log('Finding approved projects that need style tags...\n');

  const [rows] = await pool.execute(`
    SELECT p.id, p.title, p.tags
    FROM projects p
    JOIN company_profiles cp ON p.company_profile_id = cp.id
    WHERE cp.status = 'approved' AND cp.deleted_at IS NULL AND p.deleted_at IS NULL
      AND p.images IS NOT NULL AND p.images != '[]'
    ORDER BY p.id
  `);

  console.log(`Found ${rows.length} approved projects to process.\n`);

  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      console.log(`\n[${row.id}] "${row.title}" — tagging...`);
      await tagProjectImages(row.id);
      success++;
    } catch (err) {
      console.error(`[${row.id}] FAILED:`, err.message);
      failed++;
    }
  }

  console.log(`\n--- Done ---`);
  console.log(`Success: ${success}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed:  ${failed}`);

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
