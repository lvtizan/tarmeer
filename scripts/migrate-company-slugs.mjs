#!/usr/bin/env node
/**
 * Migrate company_profiles slugs from company-name format to email-prefix format.
 *
 * Usage:
 *   node scripts/migrate-company-slugs.mjs                    # dry run
 *   node scripts/migrate-company-slugs.mjs --apply            # apply to DB
 *   node scripts/migrate-company-slugs.mjs --verify           # verify all slugs resolve via API (post-migrate check)
 *   node scripts/migrate-company-slugs.mjs --apply --verify   # apply then verify
 *
 * For production DB:
 *   DB_HOST=... DB_USER=... DB_PASSWORD=... DB_NAME=tarmeer node scripts/migrate-company-slugs.mjs --apply
 *
 * For verify against production API:
 *   API_URL=https://www.tarmeer.com node scripts/migrate-company-slugs.mjs --verify
 */

import mysql from 'mysql2/promise';

const dryRun = !process.argv.includes('--apply');
const doVerify = process.argv.includes('--verify');
const API_URL = (process.env.API_URL || 'http://localhost:3099').replace(/\/$/, '');

/** Mirrors server/src/lib/slugify.ts generateEmailHandle() */
function generateEmailHandle(email) {
  const local = email.split('@')[0] || email;
  return local
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 25);
}

async function migrate() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tarmeer',
  });

  console.log(`Mode: ${dryRun ? 'DRY RUN (use --apply to execute)' : 'APPLYING CHANGES'}\n`);

  const [rows] = await pool.query(`
    SELECT cp.id, cp.slug AS old_slug, u.email
    FROM company_profiles cp
    JOIN users u ON u.id = cp.user_id
    ORDER BY cp.id
  `);

  console.log(`Found ${rows.length} company profiles\n`);

  // Build a set of already-committed slugs so collision detection works
  // across the batch (not just against DB state before migration starts)
  const usedSlugs = new Set();

  // Seed with slugs of companies we are NOT updating (none here — we update all),
  // plus slugs already in uae_companies to avoid cross-table collisions.
  const [dirRows] = await pool.query('SELECT slug FROM uae_companies WHERE slug IS NOT NULL');
  for (const r of dirRows) usedSlugs.add(r.slug);

  const updates = [];

  for (const row of rows) {
    const base = generateEmailHandle(row.email);
    let slug = base;
    let suffix = 2;
    while (usedSlugs.has(slug) && slug !== row.old_slug) {
      slug = `${base}-${suffix++}`;
    }
    usedSlugs.add(slug);

    const changed = slug !== row.old_slug;
    console.log(
      `[${row.id}] ${row.email}\n  old: ${row.old_slug}\n  new: ${slug}${changed ? '' : '  (no change)'}\n`
    );

    if (changed) {
      updates.push({ id: row.id, slug });
    }
  }

  console.log(`${updates.length} slugs will change`);

  if (dryRun) {
    console.log('\nDry run complete. Run with --apply to execute.');
    await pool.end();
    return;
  }

  for (const { id, slug } of updates) {
    await pool.query('UPDATE company_profiles SET slug = ? WHERE id = ?', [slug, id]);
  }

  console.log(`\nUpdated ${updates.length} slugs.`);

  if (doVerify) {
    await verifyAllSlugs(pool);
  }

  await pool.end();
}

async function verifyAllSlugs(pool) {
  console.log(`\n--- Verifying approved company slugs resolve via API (${API_URL}) ---\n`);

  // Only verify approved profiles — pending/rejected won't return 200 by design
  const [rows] = await pool.query(
    "SELECT id, slug, company_name FROM company_profiles WHERE slug IS NOT NULL AND status = 'approved' ORDER BY id"
  );

  if (rows.length === 0) {
    console.log('No approved company profiles to verify.');
    return;
  }

  let pass = 0, fail = 0;

  for (const row of rows) {
    try {
      // Check by slug (the slug-based URL is what users actually visit)
      const res = await fetch(`${API_URL}/api/public/companies/${encodeURIComponent(row.slug)}`);
      if (res.status === 200) {
        pass++;
        console.log(`✅ [${row.id}] /@${row.slug}`);
      } else {
        fail++;
        console.log(`❌ [${row.id}] /@${row.slug} (${row.company_name}) → HTTP ${res.status}`);
      }
    } catch (e) {
      fail++;
      console.log(`❌ [${row.id}] /@${row.slug} → ${e.message}`);
    }
    // small delay to avoid rate-limit
    await new Promise(r => setTimeout(r, 50));
  }

  console.log(`\n${pass} OK, ${fail} FAIL out of ${rows.length} approved profiles`);
  if (fail > 0) process.exitCode = 1;
}

if (doVerify && dryRun) {
  // Verify-only mode: just check current DB slugs resolve
  (async () => {
    const pool = await mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tarmeer',
    });
    await verifyAllSlugs(pool);
    await pool.end();
  })().catch(err => { console.error(err); process.exit(1); });
} else {
  migrate().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
