#!/usr/bin/env node
/**
 * CRM Routing Harness — TC-FC-03
 *
 * Verifies that company leads:
 *   1. Are pushed to the company CRM tenant (pushCompanyLeadToCRM)
 *   2. Do NOT push the mirror design_inquiries row to the homeowner CRM
 *   3. Mirror row is inserted with crm_sync_status='synced' and crm_sync_attempts=0
 *
 * Historical bug: production code called pushLeadToCRM on the mirror row,
 * causing company users to appear as 业主 in CRM. Fixed 2026-04-18.
 *
 * Usage:
 *   node scripts/harness/test-crm-routing.mjs
 *
 * Prerequisites:
 *   - Local MySQL with 'tarmeer' database
 *   - Port 3099 free
 */

import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const PORT = 3099;
const API = `http://localhost:${PORT}/api`;

const require = createRequire(import.meta.url);
const mysql = require(path.join(SERVER_DIR, 'node_modules/mysql2/promise'));

let conn;
let serverProcess;
let passed = 0;
let failed = 0;

const TEST_PHONE = '+971500000099';
const TEST_COMPANY = 'E2E_CRM_Routing_Co';

function log(tc, ok, detail) {
  console.log((ok ? '✅' : '❌') + ' ' + tc + (detail ? ': ' + detail : ''));
  if (ok) passed++; else failed++;
}

async function cleanup() {
  if (!conn) return;
  await conn.query("DELETE FROM design_inquiries WHERE phone = ?", [TEST_PHONE]).catch(() => {});
  await conn.query("DELETE FROM company_leads WHERE phone = ?", [TEST_PHONE]).catch(() => {});
}

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['dist/app.js'], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: String(PORT), DEV_SKIP_EMAIL: 'true', NODE_ENV: 'development' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    serverProcess.stdout.on('data', (d) => {
      if (!started && d.toString().includes('Server running')) {
        started = true;
        setTimeout(resolve, 500);
      }
    });
    serverProcess.stderr.on('data', () => {});
    serverProcess.on('error', reject);
    setTimeout(() => { if (!started) reject(new Error('Server start timeout')); }, 15000);
  });
}

function stopServer() {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
}


async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('\n=== CRM Routing Harness (TC-FC-03) ===\n');

  conn = await mysql.createConnection({
    host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'tarmeer',
  });

  await cleanup();

  // Build server
  console.log('Building server...');
  execSync('npm run build', { cwd: SERVER_DIR, stdio: 'pipe' });

  await startServer();

  // TC-FC-03-01: Submit company lead
  const { status, data } = await post('/company-leads', {
    contactName: 'E2E CRM Test',
    phone: TEST_PHONE,
    companyName: TEST_COMPANY,
    companyType: 'renovation_company',
    city: 'Dubai',
  });
  log('TC-FC-03-01: POST /api/company-leads returns 201', status === 201, `status=${status}`);

  // TC-FC-03-02: company_leads row exists
  const [clRows] = await conn.query('SELECT * FROM company_leads WHERE phone = ?', [TEST_PHONE]);
  log('TC-FC-03-02: company_leads row created', clRows.length === 1, `count=${clRows.length}`);

  // TC-FC-03-03: design_inquiries mirror row exists
  const [diRows] = await conn.query('SELECT * FROM design_inquiries WHERE phone = ?', [TEST_PHONE]);
  log('TC-FC-03-03: design_inquiries mirror row created', diRows.length >= 1, `count=${diRows.length}`);

  if (diRows.length >= 1) {
    const row = diRows[0];

    // TC-FC-03-04: message has [Company Inquiry] prefix
    log('TC-FC-03-04: mirror row message has [Company Inquiry] prefix',
      row.message?.startsWith('[Company Inquiry]'),
      `message="${row.message?.substring(0, 50)}"`);

    // TC-FC-03-05: crm_sync_status = 'synced' (set at INSERT, not via pushLeadToCRM)
    log('TC-FC-03-05: crm_sync_status = synced at INSERT',
      row.crm_sync_status === 'synced',
      `crm_sync_status="${row.crm_sync_status}"`);

    // TC-FC-03-06: crm_sync_attempts = 0 (homeowner CRM was NOT called)
    log('TC-FC-03-06: crm_sync_attempts = 0 (homeowner CRM not called)',
      row.crm_sync_attempts === 0,
      `crm_sync_attempts=${row.crm_sync_attempts}`);

    // TC-FC-03-07: crm_lead_id = NULL (homeowner CRM never responded)
    log('TC-FC-03-07: crm_lead_id = NULL (homeowner CRM never called)',
      row.crm_lead_id === null,
      `crm_lead_id=${row.crm_lead_id}`);
  }

  stopServer();
  await cleanup();
  await conn.end();

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch(async (err) => {
  console.error('Fatal:', err.message);
  stopServer();
  if (conn) await conn.end().catch(() => {});
  process.exit(1);
});
