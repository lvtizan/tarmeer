#!/usr/bin/env node
/**
 * audit-service-migration.mjs
 *
 * Read-only audit: compares service values actually stored in company_profiles
 * and uae_companies against the canonical company_services master table.
 *
 * Reports:
 *   1. Canonical service list (company_services, active=1)
 *   2. Values in company data that DON'T match any canonical name (orphaned)
 *   3. Canonical services not used by any company (unused)
 *   4. Per-company breakdown of orphaned values
 *   5. Suggested UPDATE statements for manual review
 *
 * Usage: node scripts/harness/audit-service-migration.mjs [--apply]
 *   (without --apply: dry-run, prints report only)
 *   (with --apply: executes the suggested UPDATE statements — USE WITH CAUTION)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const APPLY = process.argv.includes('--apply');

const require = createRequire(import.meta.url);
const mysql = require(path.join(SERVER_DIR, 'node_modules/mysql2/promise'));

// Load .env if present (production RDS creds). Falls back to local MySQL (for dev).
const envPath = path.join(SERVER_DIR, '.env');
if (existsSync(envPath)) {
  const dotenv = require(path.join(SERVER_DIR, 'node_modules/dotenv'));
  dotenv.config({ path: envPath });
}

const DB_CONFIG = process.env.DB_HOST ? {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
} : {
  // Local dev fallback (matches other harness scripts)
  host: 'localhost', user: 'root', password: '', database: 'tarmeer',
};

function parseServices(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  const s = String(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try { return JSON.parse(s).filter(Boolean); } catch { return []; }
  }
  return s.split(',').map(v => v.trim()).filter(Boolean);
}

async function main() {
  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    // 1. Canonical list
    const [canonRows] = await conn.query(
      'SELECT name, active, sort_order FROM company_services ORDER BY sort_order, name'
    );
    const canonActive = canonRows.filter(r => r.active).map(r => String(r.name));
    const canonInactive = canonRows.filter(r => !r.active).map(r => String(r.name));
    const canonSet = new Set(canonActive);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  SERVICE MIGRATION AUDIT');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log(`📋 Canonical company_services (active): ${canonActive.length}`);
    canonActive.forEach((s, i) => console.log(`   ${String(i + 1).padStart(2)}. ${s}`));
    if (canonInactive.length) {
      console.log(`\n⚪ Inactive (hidden from UI): ${canonInactive.length}`);
      canonInactive.forEach(s => console.log(`      ${s}`));
    }

    // 2. Collect all service values from company_profiles
    const [cpRows] = await conn.query(
      `SELECT id, company_name, services FROM company_profiles WHERE services IS NOT NULL AND services != '[]' AND services != ''`
    );

    // 3. Collect all service values from uae_companies
    const [ucRows] = await conn.query(
      `SELECT id, name_en, services FROM uae_companies WHERE is_active = 1 AND services IS NOT NULL AND services != '[]' AND services != ''`
    );

    // Build: value → set of company ids using it
    const valueToCpIds = {};
    const valueToUcIds = {};
    const orphanedCpDetails = []; // { companyId, companyName, orphans }
    const orphanedUcDetails = [];

    for (const row of cpRows) {
      const svcs = parseServices(row.services);
      const orphans = svcs.filter(s => !canonSet.has(s));
      if (orphans.length > 0) {
        orphanedCpDetails.push({ id: row.id, name: row.company_name, orphans, allServices: svcs });
      }
      svcs.forEach(s => {
        if (!valueToCpIds[s]) valueToCpIds[s] = [];
        valueToCpIds[s].push(row.id);
      });
    }

    for (const row of ucRows) {
      const svcs = parseServices(row.services);
      const orphans = svcs.filter(s => !canonSet.has(s));
      if (orphans.length > 0) {
        orphanedUcDetails.push({ id: row.id, name: row.name_en, orphans, allServices: svcs });
      }
      svcs.forEach(s => {
        if (!valueToUcIds[s]) valueToUcIds[s] = [];
        valueToUcIds[s].push(row.id);
      });
    }

    // All unique values in use
    const allUsedValues = new Set([...Object.keys(valueToCpIds), ...Object.keys(valueToUcIds)]);
    const orphanedValues = [...allUsedValues].filter(v => !canonSet.has(v)).sort();
    const unusedCanon = canonActive.filter(s => !allUsedValues.has(s));

    // ── Report ───────────────────────────────────────────────────────────────

    console.log('\n───────────────────────────────────────────────────────');
    console.log('  ORPHANED VALUES (in company data but NOT in canon list)');
    console.log('───────────────────────────────────────────────────────');
    if (orphanedValues.length === 0) {
      console.log('  ✅ None — all company service values match canonical list');
    } else {
      console.log(`  ⚠️  ${orphanedValues.length} orphaned value(s) found:\n`);
      for (const v of orphanedValues) {
        const cpCount = (valueToCpIds[v] || []).length;
        const ucCount = (valueToUcIds[v] || []).length;
        console.log(`  "${v}"  — used by ${cpCount} company_profile(s), ${ucCount} uae_compan(ies)`);
      }
    }

    console.log('\n───────────────────────────────────────────────────────');
    console.log('  UNUSED CANONICAL SERVICES (no company uses them yet)');
    console.log('───────────────────────────────────────────────────────');
    if (unusedCanon.length === 0) {
      console.log('  ✅ All canonical services are used by at least 1 company');
    } else {
      console.log(`  ℹ️  ${unusedCanon.length} service(s) in canon but no company has selected them:`);
      unusedCanon.forEach(s => console.log(`    - ${s}`));
    }

    if (orphanedValues.length > 0) {
      console.log('\n───────────────────────────────────────────────────────');
      console.log('  COMPANY DETAILS WITH ORPHANED VALUES');
      console.log('───────────────────────────────────────────────────────');

      if (orphanedCpDetails.length) {
        console.log('\n  [company_profiles]');
        for (const c of orphanedCpDetails) {
          console.log(`    ID ${c.id}  "${c.name}"`);
          console.log(`      Orphaned: ${c.orphans.map(s => `"${s}"`).join(', ')}`);
          console.log(`      All services: ${c.allServices.map(s => `"${s}"`).join(', ')}`);
        }
      }

      if (orphanedUcDetails.length) {
        console.log('\n  [uae_companies]');
        for (const c of orphanedUcDetails) {
          console.log(`    ID ${c.id}  "${c.name}"`);
          console.log(`      Orphaned: ${c.orphans.map(s => `"${s}"`).join(', ')}`);
          console.log(`      All services: ${c.allServices.map(s => `"${s}"`).join(', ')}`);
        }
      }

      // ── Suggested migration ───────────────────────────────────────────────
      console.log('\n───────────────────────────────────────────────────────');
      console.log('  MIGRATION PLAN');
      console.log('───────────────────────────────────────────────────────');
      console.log('\n  Option A — Add orphaned values to company_services (preserves old names):');
      for (const v of orphanedValues) {
        console.log(`    INSERT IGNORE INTO company_services (name, sort_order, active) VALUES ('${v}', 999, 1);`);
      }

      console.log('\n  Option B — Remap orphaned values to closest canonical match (manual review needed):');
      console.log('  (No automatic mapping generated — too risky without human verification)');
      console.log('  Review the orphaned values above and decide which canonical service they map to.');
      console.log('  Then run UPDATE statements like:');
      console.log(`    UPDATE company_profiles`);
      console.log(`      SET services = JSON_REPLACE(services, '$[0]', 'NewName')`);
      console.log(`      WHERE JSON_CONTAINS(services, '"OldName"');`);

      if (APPLY) {
        console.log('\n⚡ --apply flag detected. Executing Option A (INSERT IGNORE) ...');
        let inserted = 0;
        for (const v of orphanedValues) {
          const [result] = await conn.query(
            'INSERT IGNORE INTO company_services (name, sort_order, active) VALUES (?, 999, 1)',
            [v]
          );
          if (result.affectedRows > 0) {
            console.log(`  ✅ Inserted: "${v}"`);
            inserted++;
          } else {
            console.log(`  ⚠️  Already exists (skipped): "${v}"`);
          }
        }
        console.log(`\n  Done. ${inserted} new service(s) added to company_services.`);
      } else {
        console.log('\n  Run with --apply to automatically add orphaned values to company_services (Option A).');
      }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  company_profiles scanned:  ${cpRows.length}`);
    console.log(`  uae_companies scanned:     ${ucRows.length}`);
    console.log(`  Canonical services:        ${canonActive.length} active, ${canonInactive.length} inactive`);
    console.log(`  Orphaned values:           ${orphanedValues.length}`);
    console.log(`  Unused canonical:          ${unusedCanon.length}`);
    console.log(`  Companies with orphans:    ${orphanedCpDetails.length + orphanedUcDetails.length}`);
    console.log('');

  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
