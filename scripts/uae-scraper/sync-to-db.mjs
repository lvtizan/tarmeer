/**
 * Sync scraped portfolio data to MySQL database.
 *
 * Reads companies-data-final.json and updates the uae_companies table
 * with portfolio_categories stored in the portfolio_images JSON field.
 *
 * Usage:
 *   node scripts/uae-scraper/sync-to-db.mjs              # dry-run (show what would change)
 *   node scripts/uae-scraper/sync-to-db.mjs --apply       # actually update the database
 *   node scripts/uae-scraper/sync-to-db.mjs --slug algedra --apply  # update one company
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require('../../server/node_modules/mysql2/promise');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FINAL_JSON = path.join(__dirname, 'companies-data-final.json');

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply');
const SLUG_FILTER = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

// Database config - mirrors server/src/config/index.ts defaults
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tarmeer',
  charset: 'utf8mb4',
};

async function main() {
  const companies = JSON.parse(fs.readFileSync(FINAL_JSON, 'utf-8'));

  let targets = companies.filter(c => {
    if (SLUG_FILTER) return c.slug === SLUG_FILTER;
    // Only sync companies that have portfolio data
    return c.portfolio_categories && Object.keys(c.portfolio_categories).length > 0;
  });

  console.log(`=== Sync Portfolio Data to Database ===`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (use --apply to write)' : 'APPLY'}`);
  console.log(`Companies to sync: ${targets.length}`);
  if (SLUG_FILTER) console.log(`Filter: ${SLUG_FILTER}`);
  console.log('');

  let pool;
  if (!DRY_RUN) {
    pool = mysql.createPool(DB_CONFIG);
    // Test connection
    try {
      const [rows] = await pool.query('SELECT 1');
      console.log('Database connected.\n');
    } catch (err) {
      console.error('Failed to connect to database:', err.message);
      process.exit(1);
    }
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let inserted = 0;

  // Helper: get the image array regardless of whether a category entry is
  // the legacy array form or the new { items, description, year, location, sourceUrl } form.
  const getItems = (entry) => Array.isArray(entry) ? entry : (entry?.items || []);

  for (const company of targets) {
    const slug = company.slug;
    const categories = company.portfolio_categories || {};
    const categoryCount = Object.keys(categories).length;
    const imageCount = Object.values(categories).reduce((sum, entry) => sum + getItems(entry).length, 0);

    if (imageCount === 0) {
      skipped++;
      continue;
    }

    console.log(`${slug}: ${categoryCount} categories, ${imageCount} images`);

    if (DRY_RUN) {
      for (const [cat, entry] of Object.entries(categories)) {
        const items = getItems(entry);
        const meta = Array.isArray(entry) ? null : entry;
        const metaStr = meta && (meta.description || meta.year || meta.location)
          ? ` [${[meta.year, meta.location].filter(Boolean).join(', ')}]`
          : '';
        console.log(`  ${cat}: ${items.length} images${metaStr}`);
      }
      updated++;
      continue;
    }

    try {
      // Check if company exists in database
      const [existing] = await pool.query(
        'SELECT id, slug FROM uae_companies WHERE slug = ?',
        [slug]
      );

      const portfolioJson = JSON.stringify(categories);

      if (existing.length > 0) {
        // Update existing record
        await pool.query(
          'UPDATE uae_companies SET portfolio_images = ? WHERE slug = ?',
          [portfolioJson, slug]
        );
        console.log(`  Updated in database.`);
        updated++;
      } else {
        // Insert new record with basic info from scraped data
        await pool.query(
          `INSERT INTO uae_companies (
            name_en, name_ar, slug, logo_url,
            phone, email, website, whatsapp,
            city, area, address,
            services, specialties, year_established,
            google_rating, google_reviews_count, source_platform,
            instagram, facebook, linkedin,
            portfolio_images, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            company.name_en || '', company.name_ar || '', slug,
            company.logo_url || null,
            company.phone || null, company.email || null,
            company.website || null, company.whatsapp || null,
            company.city || 'Dubai', company.area || null,
            company.address || null,
            JSON.stringify(company.services || []),
            JSON.stringify(company.specialties || []),
            company.year_established || null,
            company.google_rating || null, company.google_reviews_count || 0,
            company.source_platform || 'official_website',
            company.instagram || null, company.facebook || null,
            company.linkedin || null,
            portfolioJson,
          ]
        );
        console.log(`  Inserted into database.`);
        inserted++;
      }
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      errors++;
    }
  }

  if (pool) {
    await pool.end();
  }

  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);

  if (DRY_RUN) {
    console.log(`\nThis was a dry run. Use --apply to write to database.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
