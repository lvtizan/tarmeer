/**
 * export-tarmeer-partnerships-for-mall.js
 *
 * Exports registered companies that need Mall partner IDs mapped.
 * Read-only — never modifies the database.
 *
 * Usage:
 *   node scripts/export-tarmeer-partnerships-for-mall.js
 *   node scripts/export-tarmeer-partnerships-for-mall.js --output partnerships.json
 *
 * Output JSON format (one entry per company):
 *   {
 *     "id": 123,                        // company_profiles.id  (= mallPartnerId on CRM side)
 *     "company_name": "...",
 *     "admin_email": "...",             // primary key for Mall's reverse lookup
 *     "crm_tenant_id": "...",           // null if not yet provisioned
 *     "crm_provisioned_at": "...",      // null if not yet provisioned
 *     "crm_mall_partner_id": "...",     // null if not yet mapped
 *     "created_at": "..."
 *   }
 *
 * Send this file to the Mall team. They match admin_email → their partner_id
 * and return a mapping JSON for backfill-mall-partner-mapping.js.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from server/
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../server/.env') });

const mysql = require('mysql2/promise');

const OUTPUT_FLAG = process.argv.indexOf('--output');
const outputFile = OUTPUT_FLAG !== -1 ? process.argv[OUTPUT_FLAG + 1] : null;

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    connectionLimit: 2,
  });

  try {
    const [rows] = await pool.query(
      `SELECT
         cp.id,
         cp.company_name,
         u.email AS admin_email,
         cp.crm_tenant_id,
         cp.crm_provisioned_at,
         cp.crm_mall_partner_id,
         cp.created_at
       FROM company_profiles cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.deleted_at IS NULL
       ORDER BY cp.id ASC`
    );

    const total = rows.length;
    const provisioned = rows.filter(r => r.crm_tenant_id).length;
    const mapped = rows.filter(r => r.crm_mall_partner_id).length;
    const needsMapping = rows.filter(r => !r.crm_mall_partner_id).length;

    console.error(`Summary:`);
    console.error(`  Total companies : ${total}`);
    console.error(`  CRM-provisioned : ${provisioned}`);
    console.error(`  Mall ID mapped  : ${mapped}`);
    console.error(`  Needs mapping   : ${needsMapping}`);
    console.error('');

    const output = JSON.stringify(rows, null, 2);

    if (outputFile) {
      fs.writeFileSync(outputFile, output, 'utf8');
      console.error(`✓ Written to ${outputFile}`);
    } else {
      process.stdout.write(output + '\n');
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
