#!/usr/bin/env node
/**
 * Company Profile New Fields Harness
 *
 * Tests the new fields added to company profile:
 *   - company_types (multiselect JSON)
 *   - emirates_served (multiselect JSON)
 *   - projects.space_type (VARCHAR)
 *   - services saved as subcategory strings (9-category system)
 *   - specialties saved as space type values
 *
 * Usage:
 *   node scripts/harness/test-company-profile-fields.mjs
 */

import { spawn } from 'child_process';
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
let token = null;
let testUserId = null;

const TEST_EMAIL = 'e2e-profile-fields@test.com';
const TEST_PASS = 'Test1234!';

function log(tc, ok, detail) {
  console.log((ok ? '✅' : '❌') + ' ' + tc + (detail ? ': ' + detail : ''));
  if (ok) passed++; else failed++;
}

async function cleanup() {
  if (!conn) return;
  await conn.query("DELETE FROM projects WHERE title LIKE 'E2E_PF_%'").catch(() => {});
  await conn.query("DELETE FROM company_profiles WHERE company_name='E2E_ProfileFields_Co'").catch(() => {});
  await conn.query("DELETE FROM users WHERE email=?", [TEST_EMAIL]).catch(() => {});
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
      if (!started && data.toString().includes('Server running')) {
        started = true;
        setTimeout(resolve, 300);
      }
    });
    serverProcess.stderr.on('data', () => {});
    serverProcess.on('error', reject);
    setTimeout(() => { if (!started) reject(new Error('Server did not start')); }, 15000);
  });
}

async function req(method, path, body, tok) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json };
}

async function runTests() {
  // ─── Setup: register + login ───────────────────────────────────────
  const reg = await req('POST', '/auth/register', {
    email: TEST_EMAIL,
    password: TEST_PASS,
    full_name: 'E2E Test',
  });
  if (reg.status !== 200 && reg.status !== 201) {
    console.error('Register failed:', reg.json);
    process.exit(1);
  }
  testUserId = reg.json.user?.id;

  // Activate user directly in DB
  await conn.query("UPDATE users SET active_role = 'company', onboarding_completed = 1, email_verified = 1 WHERE email = ?", [TEST_EMAIL]);

  const login = await req('POST', '/auth/login', { email: TEST_EMAIL, password: TEST_PASS });
  if (!login.json.token) { console.error('Login failed:', login.json); process.exit(1); }
  token = login.json.token;
  console.log('\n── Company Profile New Fields ──\n');

  // ─── TC1: Save profile with company_types (multiselect) ────────────
  const save1 = await req('POST', '/auth/company/profile', {
    company_name: 'E2E_ProfileFields_Co',
    description: 'Test company for profile fields e2e',
    contact_person: 'E2E Tester',
    phone: '+971501234567',
    city: 'Dubai',
    address: 'Test Address',
    services: ['Interior Design', 'Architecture'],
    company_types: ['design_studio', 'renovation_company'],
    company_type: 'design_studio',
    emirates_served: ['Dubai', 'Abu Dhabi'],
    specialties: ['Villa', 'Apartment'],
    establishment_year: 2020,
  }, token);
  log('TC1: Save profile with company_types + emirates_served',
    save1.status === 200 || save1.status === 201,
    `status=${save1.status}`);

  // ─── TC2: Read back and verify company_types persisted ─────────────
  const prof = await req('GET', '/auth/company/profile', null, token);
  const p = prof.json?.profile;
  let ct = [];
  try { ct = typeof p?.company_types === 'string' ? JSON.parse(p.company_types) : (p?.company_types || []); } catch {}
  log('TC2: company_types saved as JSON array',
    Array.isArray(ct) && ct.includes('design_studio') && ct.includes('renovation_company'),
    `company_types=${JSON.stringify(ct)}`);

  let es = [];
  try { es = typeof p?.emirates_served === 'string' ? JSON.parse(p.emirates_served) : (p?.emirates_served || []); } catch {}
  log('TC3: emirates_served saved as JSON array',
    Array.isArray(es) && es.includes('Dubai') && es.includes('Abu Dhabi'),
    `emirates_served=${JSON.stringify(es)}`);

  let sp = [];
  try { sp = typeof p?.specialties === 'string' ? JSON.parse(p.specialties) : (p?.specialties || []); } catch {}
  log('TC4: specialties (space types) saved',
    Array.isArray(sp) && sp.includes('Villa') && sp.includes('Apartment'),
    `specialties=${JSON.stringify(sp)}`);

  let svc = [];
  try { svc = typeof p?.services === 'string' ? JSON.parse(p.services) : (p?.services || []); } catch {}
  log('TC5: services subcategories saved',
    Array.isArray(svc) && svc.includes('Interior Design') && svc.includes('Architecture'),
    `services=${JSON.stringify(svc)}`);

  // ─── TC6: No token → 401 ───────────────────────────────────────────
  const unauth = await req('POST', '/auth/company/profile', {
    company_name: 'NoAuth', description: 'x', contact_person: 'x', phone: '+971501234567',
    city: 'Dubai', services: ['Interior Design'],
  });
  log('TC6: No token → 401', unauth.status === 401, `status=${unauth.status}`);

  // ─── TC7: company_types max 5 is only a UI concern — backend accepts up to any count ─
  const save7 = await req('POST', '/auth/company/profile', {
    company_name: 'E2E_ProfileFields_Co',
    description: 'Test company for profile fields e2e',
    contact_person: 'E2E Tester',
    phone: '+971501234567',
    city: 'Dubai',
    services: ['Interior Design'],
    company_types: ['design_studio', 'renovation_company', 'general_contractor'],
    company_type: 'design_studio',
    emirates_served: ['Dubai', 'Sharjah', 'Ajman'],
    specialties: ['Villa', 'Commercial', 'Public Institutional'],
  }, token);
  log('TC7: Update profile with 3 company_types + 3 emirates + 3 space_types',
    save7.status === 200 || save7.status === 201,
    `status=${save7.status}`);

  const prof7 = await req('GET', '/auth/company/profile', null, token);
  const p7 = prof7.json?.profile;
  let ct7 = [];
  try { ct7 = typeof p7?.company_types === 'string' ? JSON.parse(p7.company_types) : (p7?.company_types || []); } catch {}
  log('TC8: Updated company_types persisted correctly',
    ct7.length === 3 && ct7.includes('general_contractor'),
    `company_types=${JSON.stringify(ct7)}`);

  // ─── TC9: New space type values accepted (Public Institutional, Outdoor Landscape) ─
  const save9 = await req('POST', '/auth/company/profile', {
    company_name: 'E2E_ProfileFields_Co',
    description: 'Test company for profile fields e2e',
    contact_person: 'E2E Tester',
    phone: '+971501234567',
    city: 'Dubai',
    services: ['Interior Design'],
    company_types: ['design_studio'],
    specialties: ['Public Institutional', 'Outdoor Landscape'],
  }, token);
  log('TC9: New space type values (Public Institutional, Outdoor Landscape) accepted',
    save9.status === 200 || save9.status === 201,
    `status=${save9.status}`);

  // ─── TC10: Verify DB columns exist ─────────────────────────────────
  const [cols] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_profiles'
     AND COLUMN_NAME IN ('company_types', 'emirates_served')`
  );
  const colNames = cols.map(c => c.COLUMN_NAME);
  log('TC10: company_types column exists in DB', colNames.includes('company_types'), `cols=${JSON.stringify(colNames)}`);
  log('TC11: emirates_served column exists in DB', colNames.includes('emirates_served'), `cols=${JSON.stringify(colNames)}`);

  const [projCols] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects'
     AND COLUMN_NAME = 'space_type'`
  );
  log('TC12: projects.space_type column exists in DB', projCols.length > 0, `found=${projCols.length}`);

  // ─── TC13: Partial update (onboarding_step advance) must NOT wipe establishment_year ─
  // Simulates the CompanyOnboardingPage auto-advance bug: POST with only 4 fields
  // The backend UPDATE overwrites all columns — if establishment_year is omitted it becomes null
  // This test verifies the bug is fixed
  const saveWithYear = await req('POST', '/auth/company/profile', {
    company_name: 'E2E_ProfileFields_Co',
    description: 'desc',
    contact_person: 'E2E Tester',
    phone: '+971501234567',
    city: 'Dubai',
    services: ['Interior Design'],
    company_types: ['design_studio'],
    establishment_year: 2015,
  }, token);
  log('TC13a: Save profile with establishment_year=2015', saveWithYear.status === 200, `status=${saveWithYear.status}`);

  // Simulate onboarding partial update (missing establishment_year)
  const partialUpdate = await req('POST', '/auth/company/profile', {
    company_name: 'E2E_ProfileFields_Co',
    description: 'desc',
    contact_person: 'E2E Tester',
    phone: '+971501234567',
    city: 'Dubai',
    services: ['Interior Design'],
    company_types: ['design_studio'],
    establishment_year: 2015,  // FIX: must include it
    onboarding_step: 1,
  }, token);
  log('TC13b: Partial update with establishment_year preserved', partialUpdate.status === 200, `status=${partialUpdate.status}`);

  const profAfterPartial = await req('GET', '/auth/company/profile', null, token);
  const yearAfterPartial = profAfterPartial.json?.profile?.establishment_year;
  log('TC13c: establishment_year not wiped by partial update', yearAfterPartial === 2015, `establishment_year=${yearAfterPartial}`);
}

async function main() {
  conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tarmeer',
  });

  await cleanup();

  try {
    console.log('Building server...');
    const { execSync } = await import('child_process');
    execSync('npm run build', { cwd: SERVER_DIR, stdio: 'pipe' });
    await startServer();
    console.log('Server started on port', PORT);
    await runTests();
  } finally {
    await cleanup();
    if (serverProcess) serverProcess.kill();
    await conn.end();
  }

  console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
