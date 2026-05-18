#!/usr/bin/env node
/**
 * scripts/harness/backfill-crm-mall-ids.mjs
 *
 * 一次性脚本：把 CRM JSON 里的 crmTenantId 写入我们的 company_profiles，
 * 让装企后台出现「Open CRM」入口。
 *
 * 前提：先把我们生成的 crm-mall-mappings-2026-05-15.json 发给 CRM，
 *       等 CRM 确认他们那边已更新 mallPartnerId 后再跑此脚本。
 *
 * 在生产服务器上运行：
 *   cd /tarmeer/tarmeer_api
 *   node scripts/harness/backfill-crm-mall-ids.mjs [--dry-run]
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const serverDir = join(__dirname, '../../server');
const dotenvPath = existsSync(join(serverDir, 'node_modules/dotenv'))
  ? join(serverDir, 'node_modules/dotenv')
  : 'dotenv';
const envPath = existsSync(join(serverDir, '.env'))
  ? join(serverDir, '.env')
  : join(__dirname, '../../.env');
require(dotenvPath).config({ path: envPath });

const mysqlPath = existsSync(join(serverDir, 'node_modules/mysql2'))
  ? join(serverDir, 'node_modules/mysql2/promise')
  : 'mysql2/promise';
const mysql = require(mysqlPath);

// 18 家尚未有 crm_tenant_id 的装企（来自 2026-05-15 CRM JSON）
const MAPPINGS = [
  { cpId: 64,  crmTenantId: 'cf2111d9-6303-40df-8006-e3e92a8f43cf' },
  { cpId: 77,  crmTenantId: 'd63fa405-6ff9-4968-82cc-4f34c89f570c' },
  { cpId: 80,  crmTenantId: 'b708b129-9db4-4000-8779-1a7bf312f0bc' },
  { cpId: 84,  crmTenantId: 'f438986e-d331-4cf0-98c1-dc85e941b1d6' },
  { cpId: 125, crmTenantId: '11c70676-6822-4ac9-a3a1-38ec1c81c1ff' },
  { cpId: 138, crmTenantId: 'df2fbf78-d769-4db5-820a-5251e116e5ae' },
  { cpId: 149, crmTenantId: '19d98eeb-d7ca-413a-8929-6888f0e630d1' },
  { cpId: 154, crmTenantId: 'd756181b-2429-47b6-813d-a16861619e2f' },
  { cpId: 155, crmTenantId: '6e876d1f-ff7c-46aa-949a-8e47b5615b11' },
  { cpId: 162, crmTenantId: '29af678e-05f2-4be7-b441-f76a84103a12' },
  { cpId: 163, crmTenantId: '2c568272-1e84-482a-b277-030c7f4de001' },
  { cpId: 164, crmTenantId: '800bf6ee-4eb6-48c0-bddc-074393b20efb' },
  { cpId: 167, crmTenantId: '35ab4255-b683-4f4d-9d84-77bc5e833545' },
  { cpId: 169, crmTenantId: '5ad58f30-8888-4e11-9ae4-789c034cbc06' },
  { cpId: 173, crmTenantId: '4a56f23a-5a10-489b-8c30-ccb7dcb961f0' },
  { cpId: 184, crmTenantId: '99b34ad1-dc58-4108-9108-2c13378565d4' },
  { cpId: 186, crmTenantId: 'd144704b-095a-4d28-ae9a-00673275550a' },
  { cpId: 191, crmTenantId: '19e971fd-2548-4b79-8da4-bb5ccad2b8f2' },
];

const isDryRun = process.argv.includes('--dry-run');
console.log(`Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'} | DB: ${process.env.DB_HOST}/${process.env.DB_NAME}`);

const pool = mysql.createPool({
  host: process.env.DB_HOST, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306'),
});

let ok = 0, skip = 0, fail = 0;

for (const { cpId, crmTenantId } of MAPPINGS) {
  const [rows] = await pool.query(
    'SELECT id, company_name, crm_tenant_id FROM company_profiles WHERE id = ?',
    [cpId]
  );
  const row = rows[0];
  if (!row) { console.warn(`[SKIP] cp ${cpId}: not found`); skip++; continue; }

  if (row.crm_tenant_id === crmTenantId) {
    console.log(`[SKIP] cp ${cpId} (${row.company_name}): already set`);
    skip++; continue;
  }

  if (isDryRun) {
    console.log(`[DRY]  cp ${cpId} (${row.company_name}): crm_tenant_id ← ${crmTenantId}`);
    ok++; continue;
  }

  try {
    await pool.query(
      `UPDATE company_profiles
         SET crm_tenant_id = ?, crm_provisioned_at = NOW(), crm_mall_partner_id = ?
       WHERE id = ?`,
      [crmTenantId, String(cpId), cpId]
    );
    console.log(`[OK]   cp ${cpId} (${row.company_name})`);
    ok++;
  } catch (err) {
    console.error(`[FAIL] cp ${cpId}: ${err.message}`);
    fail++;
  }
}

console.log(`\nDone: ${ok} updated, ${skip} skipped, ${fail} failed`);
await pool.end();
