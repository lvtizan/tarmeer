/**
 * backfill-mall-partner-mapping.js
 *
 * Reads Mall team's partner ID mapping and writes crm_mall_partner_id
 * back to company_profiles. Always dry-run by default — add --execute to apply.
 *
 * Usage:
 *   node scripts/backfill-mall-partner-mapping.js --input <mall-mapping.json>
 *   node scripts/backfill-mall-partner-mapping.js --input <mall-mapping.json> --execute
 *
 * Input JSON format (Mall team provides this):
 *   [
 *     { "adminEmail": "company@example.com", "mallPartnerId": "M-00123" },
 *     ...
 *   ]
 *
 *   OR keyed by our company ID:
 *   [
 *     { "tarmeerCompanyId": 42, "mallPartnerId": "M-00123" },
 *     ...
 *   ]
 *
 * Summary output:
 *   toUpdate  — will set crm_mall_partner_id (was NULL or changed)
 *   skipped   — crm_mall_partner_id already matches, no change needed
 *   conflicts — crm_mall_partner_id already set to a DIFFERENT value (human review needed)
 *   errors    — email/id not found in our DB
 *
 * Rollback: backup/<timestamp>-rollback.json is written before --execute
 *   To rollback: node scripts/backfill-mall-partner-mapping.js --rollback backup/<file>
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const mysql = require('mysql2/promise');

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const hasFlag = (flag) => args.includes(flag);

const inputFile = getArg('--input');
const rollbackFile = getArg('--rollback');
const execute = hasFlag('--execute');

if (!inputFile && !rollbackFile) {
  console.error('Usage:');
  console.error('  node scripts/backfill-mall-partner-mapping.js --input <mall-mapping.json> [--execute]');
  console.error('  node scripts/backfill-mall-partner-mapping.js --rollback backup/<file>');
  process.exit(1);
}

// ── DB ────────────────────────────────────────────────────────────────────────

async function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    connectionLimit: 2,
  });
}

// ── Rollback ──────────────────────────────────────────────────────────────────

async function runRollback(pool, file) {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log(`Rolling back ${entries.length} entries from ${file}...`);
  let ok = 0, fail = 0;
  for (const { id, old_value } of entries) {
    try {
      await pool.execute(
        'UPDATE company_profiles SET crm_mall_partner_id = ? WHERE id = ?',
        [old_value, id]
      );
      ok++;
    } catch (err) {
      console.error(`  ✗ id=${id}: ${err.message}`);
      fail++;
    }
  }
  console.log(`\nRollback done: ${ok} restored, ${fail} failed`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pool = await createPool();

  try {
    if (rollbackFile) {
      await runRollback(pool, rollbackFile);
      return;
    }

    // Load mapping input
    const mapping = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    if (!Array.isArray(mapping) || mapping.length === 0) {
      console.error('✗ Input must be a non-empty JSON array');
      process.exit(1);
    }

    // Fetch all companies indexed by email and id
    const [allRows] = await pool.query(
      `SELECT cp.id, u.email, cp.crm_mall_partner_id
       FROM company_profiles cp JOIN users u ON u.id = cp.user_id
       WHERE cp.deleted_at IS NULL`
    );
    const byEmail = new Map(allRows.map(r => [r.email.toLowerCase(), r]));
    const byId = new Map(allRows.map(r => [r.id, r]));

    const toUpdate = [];
    const skipped = [];
    const conflicts = [];
    const errors = [];

    for (const entry of mapping) {
      const mallPartnerId = String(entry.mallPartnerId || '').trim();
      if (!mallPartnerId) {
        errors.push({ entry, reason: 'mallPartnerId empty' });
        continue;
      }

      let row = null;
      if (entry.tarmeerCompanyId) {
        row = byId.get(parseInt(entry.tarmeerCompanyId));
        if (!row) { errors.push({ entry, reason: `company id=${entry.tarmeerCompanyId} not found` }); continue; }
      } else if (entry.adminEmail) {
        row = byEmail.get(entry.adminEmail.toLowerCase());
        if (!row) { errors.push({ entry, reason: `email=${entry.adminEmail} not found` }); continue; }
      } else {
        errors.push({ entry, reason: 'need adminEmail or tarmeerCompanyId' });
        continue;
      }

      if (row.crm_mall_partner_id === mallPartnerId) {
        skipped.push({ id: row.id, email: row.email, mallPartnerId });
      } else if (row.crm_mall_partner_id && row.crm_mall_partner_id !== mallPartnerId) {
        conflicts.push({ id: row.id, email: row.email, existing: row.crm_mall_partner_id, incoming: mallPartnerId });
      } else {
        toUpdate.push({ id: row.id, email: row.email, old_value: row.crm_mall_partner_id, mallPartnerId });
      }
    }

    // Print summary
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  toUpdate   : ${toUpdate.length}`);
    console.log(`  skipped    : ${skipped.length}`);
    console.log(`  conflicts  : ${conflicts.length}  ← human review needed`);
    console.log(`  errors     : ${errors.length}`);
    console.log(`${'─'.repeat(60)}\n`);

    if (conflicts.length > 0) {
      console.log('CONFLICTS (existing vs incoming):');
      conflicts.forEach(c => console.log(`  id=${c.id} (${c.email}): "${c.existing}" → "${c.incoming}"`));
      console.log('');
    }
    if (errors.length > 0) {
      console.log('ERRORS:');
      errors.forEach(e => console.log(`  ${e.reason}`, JSON.stringify(e.entry)));
      console.log('');
    }

    if (!execute) {
      console.log(`Dry-run. Add --execute to apply ${toUpdate.length} update(s).`);
      return;
    }

    if (toUpdate.length === 0) {
      console.log('Nothing to update.');
      return;
    }

    // Save rollback file
    fs.mkdirSync(path.join(__dirname, '../backup'), { recursive: true });
    const rollbackPath = path.join(__dirname, `../backup/${Date.now()}-rollback.json`);
    fs.writeFileSync(rollbackPath, JSON.stringify(
      toUpdate.map(({ id, old_value }) => ({ id, old_value })),
      null, 2
    ));
    console.log(`Rollback saved to ${rollbackPath}`);

    // Apply updates
    let ok = 0, fail = 0;
    for (const { id, email, mallPartnerId } of toUpdate) {
      try {
        await pool.execute(
          'UPDATE company_profiles SET crm_mall_partner_id = ? WHERE id = ?',
          [mallPartnerId, id]
        );
        console.log(`  ✓ id=${id} (${email}) → ${mallPartnerId}`);
        ok++;
      } catch (err) {
        console.error(`  ✗ id=${id} (${email}): ${err.message}`);
        fail++;
      }
    }

    console.log(`\nDone: ${ok} updated, ${fail} failed`);
    if (fail > 0) {
      console.log(`To rollback: node scripts/backfill-mall-partner-mapping.js --rollback ${rollbackPath}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
