#!/usr/bin/env node
/**
 * One-time script: push pending company inquiries to CRM.
 * Run on server: cd /tarmeer/tarmeer_api && node sync-pending-company-leads.mjs
 */
const { default: pool } = await import('./dist/config/database.js');
const { pushLeadToCRM } = await import('./dist/lib/crmPush.js');

const [rows] = await pool.execute(
  `SELECT id, name, phone, city, message FROM design_inquiries
   WHERE message LIKE '[Company Inquiry]%' AND deleted_at IS NULL AND crm_sync_status = 'pending'
   ORDER BY id`
);

console.log(`Found ${rows.length} pending company inquiries to sync.\n`);

for (const row of rows) {
  const companyMatch = row.message?.match(/Company:\s*([^|]+)/);
  const companyName = companyMatch ? companyMatch[1].trim() : '';
  console.log(`[${row.id}] ${row.name} / ${companyName} — pushing...`);
  try {
    await pushLeadToCRM({
      inquiryId: row.id,
      externalId: `inquiry-${row.id}`,
      name: row.name || 'Anonymous',
      phone: row.phone,
      city: row.city || undefined,
      notes: `${companyName ? `Company: ${companyName}` : ''} | ${row.message || ''}`.trim(),
      page: '/join-as-company',
    });
    console.log(`  ✓ synced`);
  } catch (err) {
    console.error(`  ✗ failed:`, err.message);
  }
}

console.log('\nDone.');
await pool.end();
