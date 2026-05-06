/**
 * One-time backfill: push company_profiles that never entered CRM,
 * and insert them into company_leads so they appear in the admin leads list.
 *
 * Targets: company_profiles (any status) with no matching phone in company_leads.
 * Run on the production server (needs CRM_* env vars):
 *   node scripts/backfill-crm-company-profiles.js
 *   node scripts/backfill-crm-company-profiles.js --dry-run
 */

'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

const DRY_RUN = process.argv.includes('--dry-run');

const CRM_INBOUND_URL = process.env.CRM_INBOUND_URL;
const CRM_API_KEY = process.env.CRM_API_KEY;
const CRM_COMPANY_TENANT_ID = process.env.CRM_COMPANY_TENANT_ID;

if (!DRY_RUN && (!CRM_INBOUND_URL || !CRM_API_KEY || !CRM_COMPANY_TENANT_ID)) {
  console.error('Missing CRM env vars: CRM_INBOUND_URL, CRM_API_KEY, CRM_COMPANY_TENANT_ID');
  process.exit(1);
}

async function pushToCRM(profile) {
  const body = {
    source: 'tarmeer-mall',
    tenantId: CRM_COMPANY_TENANT_ID,
    externalId: `company-profile-${profile.id}`,
    name: profile.contact_person || profile.company_name,
    phone: profile.phone || undefined,
    city: profile.city || undefined,
    company: profile.company_name,
    notes: [
      profile.trade_license_number ? `License: ${profile.trade_license_number}` : '',
      profile.description || '',
    ].filter(Boolean).join('\n') || undefined,
    page: '/for-companies',
    channelPlatform: profile.signup_source || 'direct',
    channelAccountName: 'Tarmeer Mall',
  };

  const res = await fetch(CRM_INBOUND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': CRM_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.code !== 0) {
    throw new Error(`HTTP ${res.status} code=${data?.code} msg=${data?.message}`);
  }
  return data.data;
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tarmeer',
  });

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`);

  // Internal/test account ids to skip
  const EXCLUDE_IDS = [6, 8, 9, 13, 67, 76];

  const [rows] = await db.execute(`
    SELECT cp.id, cp.company_name, cp.contact_person, cp.phone, cp.city,
           cp.company_type, cp.trade_license_number, cp.description,
           cp.signup_source, cp.establishment_year, cp.created_at
    FROM company_profiles cp
    WHERE cp.deleted_at IS NULL
      AND cp.phone IS NOT NULL
      AND cp.phone != ''
      AND cp.status = 'pending'
      AND NOT EXISTS (
        SELECT 1 FROM company_leads cl
        WHERE cl.phone COLLATE utf8mb4_unicode_ci = cp.phone COLLATE utf8mb4_unicode_ci
      )
      AND NOT EXISTS (
        SELECT 1 FROM design_inquiries di
        WHERE di.phone COLLATE utf8mb4_unicode_ci = cp.phone COLLATE utf8mb4_unicode_ci
          AND di.crm_sync_status = 'synced'
      )
    ORDER BY cp.created_at ASC
  `);

  const filtered = rows.filter(r => !EXCLUDE_IDS.includes(r.id));

  console.log(`Found ${rows.length} profiles, ${filtered.length} after excluding test accounts.\n`);

  let ok = 0, fail = 0;

  for (const profile of filtered) {
    if (DRY_RUN) {
      console.log(`[DRY] #${profile.id} ${profile.company_name} (${profile.phone}) source=${profile.signup_source || 'direct'}`);
      continue;
    }

    try {
      // 1. Insert into company_leads
      await db.execute(
        `INSERT INTO company_leads
           (contact_name, phone, company_name, company_type, city, year_established, source_page, lang, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'en', 'new', ?)`,
        [
          profile.contact_person || profile.company_name,
          profile.phone,
          profile.company_name,
          profile.company_type || null,
          profile.city || null,
          profile.establishment_year ? String(profile.establishment_year) : null,
          `backfill-from-company-profile-${profile.id}`,
          profile.created_at,
        ]
      );

      // 2. Push to CRM
      const result = await pushToCRM(profile);
      console.log(`✓ #${profile.id} ${profile.company_name} → leadId=${result?.leadId} action=${result?.action}`);
      ok++;
    } catch (err) {
      console.error(`✗ #${profile.id} ${profile.company_name}: ${err.message}`);
      fail++;
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  await db.end();

  if (!DRY_RUN) {
    console.log(`\nDone: ${ok} succeeded, ${fail} failed.`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
