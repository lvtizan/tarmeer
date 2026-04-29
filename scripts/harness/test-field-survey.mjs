#!/usr/bin/env node
/**
 * Field Survey Harness Test
 *
 * Tests the full field survey flow: auth, draft, save, submit,
 * admin view, staff management, and role isolation.
 *
 * Usage:
 *   node scripts/harness/test-field-survey.mjs
 *
 * Prerequisites:
 *   - Local MySQL with 'tarmeer' database
 *   - Server NOT running on port 3099 (script starts its own)
 *
 * Exit code: 0 = all pass, 1 = failures
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
const bcrypt = require(path.join(SERVER_DIR, 'node_modules/bcryptjs'));

let conn;
let serverProcess;
let passed = 0;
let failed = 0;

function log(tc, ok, detail) {
  console.log((ok ? '✅' : '❌') + ' ' + tc + (detail ? ': ' + detail : ''));
  if (ok) passed++; else failed++;
}

async function cleanup() {
  if (!conn) return;
  await conn.query("DELETE FROM company_interviews WHERE company_name LIKE 'TEST_%' OR company_name = ''").catch(() => {});
  await conn.query("DELETE FROM admin_users WHERE email IN ('e2e-superadmin@field.test','e2e-fieldstaff@field.test','e2e-fieldstaff2@field.test')").catch(() => {});
}

async function ensureUaeCompanies() {
  // uae_companies uses name_en (not name) — just verify the table exists
  const [rows] = await conn.query("SHOW TABLES LIKE 'uae_companies'");
  if (rows.length === 0) {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS uae_companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name_en VARCHAR(255) NOT NULL DEFAULT '',
        city VARCHAR(128) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
}

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['dist/app.js'], {
      cwd: SERVER_DIR,
      env: { ...process.env, PORT: String(PORT), DEV_SKIP_EMAIL: 'true', NODE_ENV: 'development' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    serverProcess.stdout.on('data', (data) => {
      const s = data.toString();
      if (s.includes('error') || s.includes('Error')) process.stderr.write('[server-out] ' + s);
      if (!started && s.includes('Server running')) {
        started = true;
        setTimeout(resolve, 500);
      }
    });
    serverProcess.stderr.on('data', (d) => { const s = d.toString(); if (s.includes('error') || s.includes('Error')) process.stderr.write('[server] ' + s); });
    setTimeout(() => { if (!started) reject(new Error('Server start timeout (15s)')); }, 15000);
  });
}

function stopServer() {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
}

async function req(method, urlPath, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(`${API}${urlPath}`, opts);
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

const get  = (p, t)    => req('GET',   p, null, t);
const post = (p, b, t) => req('POST',  p, b,    t);
const patch= (p, b, t) => req('PATCH', p, b,    t);

async function main() {
  console.log('\n' + '='.repeat(55));
  console.log('  Field Survey Harness Test');
  console.log('='.repeat(55) + '\n');

  // Build server
  console.log('Building server...');
  execSync('npx tsc --skipLibCheck', { cwd: SERVER_DIR, stdio: 'ignore' });
  console.log('Build OK.\n');

  // Connect DB
  conn = await mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'tarmeer',
  });
  await cleanup();
  await ensureUaeCompanies();

  // Seed test super_admin directly (bypass install flow)
  const hash = await bcrypt.hash('SuperPass123', 12);
  await conn.query(
    `INSERT INTO admin_users (email, password, full_name, role, is_active) VALUES (?, ?, ?, 'super_admin', 1)
     ON DUPLICATE KEY UPDATE password=VALUES(password)`,
    ['e2e-superadmin@field.test', hash, 'E2E SuperAdmin']
  );
  const [adminRows] = await conn.query("SELECT id FROM admin_users WHERE email='e2e-superadmin@field.test'");
  const superAdminId = adminRows[0]?.id;
  log('Seed super_admin in DB', !!superAdminId, 'id=' + superAdminId);

  // Start server
  console.log('\nStarting server on port ' + PORT + '...\n');
  await startServer();

  let superToken, fieldToken, fieldStaffId, draftId;

  try {
    // ══════════════════════════════════════
    // T1: Super admin login
    // ══════════════════════════════════════
    console.log('── T1: Super admin login ──');
    const loginRes = await post('/admin/login', { email: 'e2e-superadmin@field.test', password: 'SuperPass123' });
    superToken = loginRes.data?.token;
    log('Super admin login', loginRes.status === 200 && !!superToken, 'HTTP ' + loginRes.status);

    if (!superToken) throw new Error('Cannot proceed without super_admin token');

    // ══════════════════════════════════════
    // T2: Create field_staff via admin API
    // ══════════════════════════════════════
    console.log('\n── T2: Create field_staff ──');
    const createStaff = await post('/admin/staff', {
      email: 'e2e-fieldstaff@field.test',
      password: 'FieldPass123',
      fullName: 'E2E FieldStaff',
    }, superToken);
    fieldStaffId = createStaff.data?.id;
    log('Create field_staff', createStaff.status === 201 && !!fieldStaffId, 'HTTP ' + createStaff.status + ' id=' + fieldStaffId);

    // Duplicate email rejected
    const dupStaff = await post('/admin/staff', {
      email: 'e2e-fieldstaff@field.test', password: 'FieldPass123', fullName: 'Dup',
    }, superToken);
    log('Duplicate staff email rejected', dupStaff.status === 409, 'HTTP ' + dupStaff.status);

    // Short password rejected
    const shortPw = await post('/admin/staff', {
      email: 'e2e-fieldstaff2@field.test', password: 'short', fullName: 'Short',
    }, superToken);
    log('Short password rejected', shortPw.status === 400, 'HTTP ' + shortPw.status);

    // ══════════════════════════════════════
    // T3: Field staff login
    // ══════════════════════════════════════
    console.log('\n── T3: Field staff login ──');
    const fieldLogin = await post('/admin/login', {
      email: 'e2e-fieldstaff@field.test', password: 'FieldPass123',
    });
    fieldToken = fieldLogin.data?.token;
    log('Field staff login', fieldLogin.status === 200 && !!fieldToken, 'HTTP ' + fieldLogin.status);
    log('Role is field_staff', fieldLogin.data?.admin?.role === 'field_staff', 'role=' + fieldLogin.data?.admin?.role);

    if (!fieldToken) throw new Error('Cannot proceed without field_staff token');

    // ══════════════════════════════════════
    // T4: Field staff blocked from admin-only routes
    // ══════════════════════════════════════
    console.log('\n── T4: Role isolation ──');
    const blockedAdmin = await get('/admin/staff', fieldToken);
    log('field_staff blocked from /admin/staff', blockedAdmin.status === 403, 'HTTP ' + blockedAdmin.status);

    const blockedInterviews = await get('/admin/interviews', fieldToken);
    log('field_staff blocked from /admin/interviews', blockedInterviews.status === 403, 'HTTP ' + blockedInterviews.status);

    // Unauthenticated blocked
    const noAuth = await get('/field/interviews/draft');
    log('Unauthenticated blocked from /field/*', noAuth.status === 401, 'HTTP ' + noAuth.status);

    // ══════════════════════════════════════
    // T5: Create draft interview
    // ══════════════════════════════════════
    console.log('\n── T5: Create draft ──');
    const createDraft = await post('/field/interviews', {
      company_name: 'TEST_CompanyABC',
    }, fieldToken);
    draftId = createDraft.data?.id;
    log('Create draft', createDraft.status === 201 && !!draftId, 'HTTP ' + createDraft.status + ' id=' + draftId);

    // Verify DB row (company_name is empty by default; set via saveDraft)
    const [draftRows] = await conn.query('SELECT * FROM company_interviews WHERE id=?', [draftId]);
    log('Draft in DB', draftRows.length > 0 && draftRows[0].status === 'draft', 'status=' + draftRows[0]?.status);
    log('Draft interviewer_id correct', draftRows[0]?.interviewer_id === fieldStaffId, 'interviewer_id=' + draftRows[0]?.interviewer_id);

    // ══════════════════════════════════════
    // T6: Get draft
    // ══════════════════════════════════════
    console.log('\n── T6: Get draft ──');
    const getDraft = await get('/field/interviews/draft', fieldToken);
    log('Get draft', getDraft.status === 200, 'HTTP ' + getDraft.status);
    // Controller returns { draft: {...} }
    log('Draft has correct id', getDraft.data?.draft?.id === draftId, 'id=' + getDraft.data?.draft?.id);

    // ══════════════════════════════════════
    // T7: Save sections (auto-save simulation)
    // ══════════════════════════════════════
    console.log('\n── T7: Save sections ──');
    const section1Data = { company_name: 'TEST_UpdatedName', business_type: 'Manufacturer', years_in_business: '5' };
    const saveRes = await patch(`/field/interviews/${draftId}`, {
      company_name: 'TEST_UpdatedName',
      section_1: section1Data,
      section_3: { main_products: ['Furniture', 'Lighting'], price_range: 'Mid' },
    }, fieldToken);
    log('Save sections', saveRes.status === 200 && saveRes.data?.ok === true, 'HTTP ' + saveRes.status);

    // Verify DB updated
    const [updatedRows] = await conn.query('SELECT * FROM company_interviews WHERE id=?', [draftId]);
    const s1Parsed = typeof updatedRows[0]?.section_1 === 'string'
      ? JSON.parse(updatedRows[0].section_1) : updatedRows[0]?.section_1;
    log('Section_1 persisted in DB', s1Parsed?.business_type === 'Manufacturer', JSON.stringify(s1Parsed));
    log('company_name updated', updatedRows[0]?.company_name === 'TEST_UpdatedName', updatedRows[0]?.company_name);

    // ══════════════════════════════════════
    // T8: Search companies
    // ══════════════════════════════════════
    console.log('\n── T8: Company search ──');
    const searchRes = await get('/field/companies/search?q=', fieldToken);
    log('Empty search returns empty', searchRes.status === 200 && Array.isArray(searchRes.data?.results) && searchRes.data.results.length === 0, 'count=' + searchRes.data?.results?.length);

    // Search with query — uae_companies table exists (created in setup)
    const searchRes2 = await get('/field/companies/search?q=test', fieldToken);
    if (searchRes2.status !== 200) console.log('  [debug] search error:', JSON.stringify(searchRes2.data));
    log('Search with query returns results array', searchRes2.status === 200 && Array.isArray(searchRes2.data?.results), 'HTTP ' + searchRes2.status + ' count=' + searchRes2.data?.results?.length);

    // ══════════════════════════════════════
    // T9: Submit interview
    // ══════════════════════════════════════
    console.log('\n── T9: Submit interview ──');
    const submitRes = await post(`/field/interviews/${draftId}/submit`, {}, fieldToken);
    log('Submit interview', submitRes.status === 200 && submitRes.data?.ok === true, 'HTTP ' + submitRes.status);

    // Verify DB status changed
    const [submitRows] = await conn.query('SELECT status, submitted_at FROM company_interviews WHERE id=?', [draftId]);
    log('Status changed to submitted', submitRows[0]?.status === 'submitted', 'status=' + submitRows[0]?.status);
    log('submitted_at set', !!submitRows[0]?.submitted_at, String(submitRows[0]?.submitted_at));

    // Cannot save after submit (returns 404 — draft not found since status is now 'submitted')
    const saveAfterSubmit = await patch(`/field/interviews/${draftId}`, { company_name: 'TEST_ShouldFail' }, fieldToken);
    log('Save blocked after submit', saveAfterSubmit.status === 404, 'HTTP ' + saveAfterSubmit.status);

    // ══════════════════════════════════════
    // T10: Admin can list + view interviews
    // ══════════════════════════════════════
    console.log('\n── T10: Admin view interviews ──');
    const listRes = await get('/admin/interviews', superToken);
    if (listRes.status !== 200) console.log('  [debug] listInterviews error:', JSON.stringify(listRes.data));
    log('Admin can list interviews', listRes.status === 200 && Array.isArray(listRes.data?.interviews), 'HTTP ' + listRes.status + ' count=' + listRes.data?.interviews?.length);

    const found = listRes.data?.interviews?.find(i => i.id === draftId);
    log('Submitted interview in list', !!found, 'found=' + !!found);
    log('List has interviewer_name', !!found?.interviewer_name, found?.interviewer_name);

    const detailRes = await get(`/admin/interviews/${draftId}`, superToken);
    log('Admin can get interview detail', detailRes.status === 200, 'HTTP ' + detailRes.status);
    log('Detail has section_1', !!detailRes.data?.interview?.section_1, String(!!detailRes.data?.interview?.section_1));

    // ══════════════════════════════════════
    // T11: Admin can list staff
    // ══════════════════════════════════════
    console.log('\n── T11: Admin staff management ──');
    const listStaff = await get('/admin/staff', superToken);
    log('Admin can list staff', listStaff.status === 200 && Array.isArray(listStaff.data?.staff), 'HTTP ' + listStaff.status);

    const staffEntry = listStaff.data?.staff?.find(s => s.id === fieldStaffId);
    log('Created staff in list', !!staffEntry, 'found=' + !!staffEntry);
    log('Staff is active', staffEntry?.is_active === 1, 'is_active=' + staffEntry?.is_active);

    // Toggle inactive
    const toggleOff = await patch(`/admin/staff/${fieldStaffId}`, { is_active: false }, superToken);
    log('Toggle staff inactive', toggleOff.status === 200 && toggleOff.data?.ok === true, 'HTTP ' + toggleOff.status);

    const [afterToggle] = await conn.query('SELECT is_active FROM admin_users WHERE id=?', [fieldStaffId]);
    log('is_active=0 in DB', afterToggle[0]?.is_active === 0, 'is_active=' + afterToggle[0]?.is_active);

    // Toggle back active
    const toggleOn = await patch(`/admin/staff/${fieldStaffId}`, { is_active: true }, superToken);
    log('Toggle staff active', toggleOn.status === 200, 'HTTP ' + toggleOn.status);

    // ══════════════════════════════════════
    // T12: Admin PATCH interview (edit)
    // ══════════════════════════════════════
    console.log('\n── T12: Admin edit interview ──');
    const editRes = await patch(`/admin/interviews/${draftId}`, {
      company_name: 'TEST_AdminEdited',
    }, superToken);
    log('Admin can edit interview', editRes.status === 200 && editRes.data?.ok === true, 'HTTP ' + editRes.status);

    const [editedRows] = await conn.query('SELECT company_name FROM company_interviews WHERE id=?', [draftId]);
    log('Edit persisted', editedRows[0]?.company_name === 'TEST_AdminEdited', editedRows[0]?.company_name);

  } catch (err) {
    console.error('\n💥 Fatal error:', err.message);
    failed++;
  } finally {
    await cleanup();
    await conn.end();
    stopServer();

    console.log('\n' + '='.repeat(55));
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(55) + '\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
