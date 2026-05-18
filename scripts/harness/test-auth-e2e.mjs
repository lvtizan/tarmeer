#!/usr/bin/env node
/**
 * Auth E2E Harness Test
 *
 * Simulates real user registration/login/forgot-password flows against local server.
 * MUST pass before any deploy that touches auth code.
 *
 * Usage:
 *   node scripts/harness/test-auth-e2e.mjs
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const PORT = 3099;
const API = `http://localhost:${PORT}/api`;
const RUN_ID = Date.now().toString(36).slice(-7);
const HOMEOWNER_EMAIL = `e2e-homeowner-${RUN_ID}@test.com`;
const COMPANY_EMAIL = `e2e-company-${RUN_ID}@test.com`;
const ADMIN_EMAIL = `e2e-admin-${RUN_ID}@test.com`;
const LEGACY_EMAIL = `e2e-legacy-${RUN_ID}@test.com`;
const LEGACY_OAUTH_EMAIL = `e2e-legacy-oauth-${RUN_ID}@test.com`;
const LEGACY_UNVERIFIED_EMAIL = `e2e-legacy-unverified-${RUN_ID}@test.com`;
const UNKNOWN_EMAIL = `e2e-new-${RUN_ID}@test.com`;
const HOMEOWNER_PHONE = `+97150${String(Date.now() % 10000000).padStart(7, '0')}`;
const COMPANY_PHONE = `+97155${String((Date.now() + 137) % 10000000).padStart(7, '0')}`;
const PASSWORD_FIELD = 'password';
const TEST_PASSWORD = 'Test123456';
const LEGACY_PASSWORD = 'LegacyPass123';

// Dynamic import mysql2
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mysql = require(path.join(SERVER_DIR, 'node_modules/mysql2/promise'));

let conn;
let serverProcess;
let passed = 0;
let failed = 0;

function log(tc, ok, detail) {
  console.log((ok ? '✅' : '❌') + ' ' + tc + (detail ? ': ' + detail : ''));
  if (ok) passed++; else failed++;
}

async function cleanup() {
  if (conn) {
    await conn.query("DELETE FROM company_profiles WHERE company_name IN ('E2E_Homeowner','E2E_Company')").catch(() => {});
    await conn.query("DELETE FROM users WHERE email LIKE 'e2e-%@test.com'").catch(() => {});
    await conn.query("DELETE FROM designers WHERE email LIKE 'e2e-%@test.com'").catch(() => {});
    await conn.query("DELETE FROM company_leads WHERE company_name='E2E_Company'").catch(() => {});
    await conn.query("DELETE FROM admin_users WHERE email LIKE 'e2e-admin-%@test.com'").catch(() => {});
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
      if (!started && data.toString().includes('Server running')) {
        started = true;
        setTimeout(resolve, 500);
      }
    });
    serverProcess.stderr.on('data', () => {});
    setTimeout(() => { if (!started) reject(new Error('Server start timeout')); }, 15000);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function get(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { headers });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function main() {
  console.log('\n' + '='.repeat(50));
  console.log('  Auth E2E Harness Test');
  console.log('='.repeat(50) + '\n');

  // Build server
  console.log('Building server...');
  execSync('npx tsc --skipLibCheck', { cwd: SERVER_DIR, stdio: 'ignore' });

  // Connect DB
  conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'tarmeer' });
  await cleanup();

  // Start server
  console.log('Starting server on port ' + PORT + '...\n');
  await startServer();

  try {
    // ══════════════════════════════════════
    // TEST 1: Homeowner Registration
    // ══════════════════════════════════════
    console.log('── Homeowner Registration ──');

    const reg1 = await post('/auth/register', {
      email: HOMEOWNER_EMAIL, [PASSWORD_FIELD]: TEST_PASSWORD,
      full_name: 'E2E Homeowner', phone: HOMEOWNER_PHONE, city: 'Dubai', role: 'homeowner',
    });
    log('Register homeowner', reg1.status === 201, 'HTTP ' + reg1.status);

    // Check users table
    const [u1] = await conn.query('SELECT * FROM users WHERE email=?', [HOMEOWNER_EMAIL]);
    log('User in DB', u1.length > 0 && u1[0].role === 'homeowner', 'role=' + u1[0]?.role);
    log('Phone stored', u1[0]?.phone === HOMEOWNER_PHONE, 'phone=' + u1[0]?.phone);

    // Login without verification should fail
    const login1a = await post('/auth/login', { email: HOMEOWNER_EMAIL, [PASSWORD_FIELD]: TEST_PASSWORD });
    log('Login blocked (unverified)', login1a.status >= 400 || login1a.data?.error?.includes('verify'), login1a.data?.error || 'HTTP ' + login1a.status);

    // Simulate email verification
    await conn.query('UPDATE users SET email_verified=1 WHERE email=?', [HOMEOWNER_EMAIL]);

    // Login after verification should succeed
    const login1b = await post('/auth/login', { email: HOMEOWNER_EMAIL, [PASSWORD_FIELD]: TEST_PASSWORD });
    log('Login after verify', !!login1b.data?.token, login1b.data?.token ? 'token OK' : 'no token');

    // ══════════════════════════════════════
    // TEST 2: Company Registration (for-companies flow)
    // ══════════════════════════════════════
    console.log('\n── Company Registration ──');

    // Step 1: Submit lead
    const lead = await post('/company-leads', {
      contactName: 'E2E Tester', phone: COMPANY_PHONE,
      companyName: 'E2E_Company', city: 'Sharjah',
    });
    log('Submit company lead', lead.status === 201, 'HTTP ' + lead.status);

    // Step 2: Register
    const reg2 = await post('/auth/register', {
      email: COMPANY_EMAIL, [PASSWORD_FIELD]: TEST_PASSWORD,
      full_name: 'E2E Tester', phone: COMPANY_PHONE, city: 'Sharjah', role: 'company',
    });
    log('Register company', reg2.status === 201, 'HTTP ' + reg2.status);

    // Verify email
    await conn.query('UPDATE users SET email_verified=1 WHERE email=?', [COMPANY_EMAIL]);

    // Login
    const login2 = await post('/auth/login', { email: COMPANY_EMAIL, [PASSWORD_FIELD]: TEST_PASSWORD });
    const companyToken = login2.data?.token;
    log('Login company', !!companyToken, companyToken ? 'token OK' : 'no token');

    // Create company profile
    if (companyToken) {
      const prof = await post('/auth/company/profile', {
        company_name: 'E2E_Company', phone: COMPANY_PHONE, city: 'Sharjah',
        contact_person: 'E2E Tester', description: '', services: ['Interior Design'],
        company_type: 'renovation_company',
      }, companyToken);
      log('Create company profile', prof.status >= 200 && prof.status < 300, 'HTTP ' + prof.status);

      // Verify phone sync
      const [cp] = await conn.query("SELECT phone FROM company_profiles WHERE company_name='E2E_Company'");
      const [uu] = await conn.query('SELECT phone FROM users WHERE email=?', [COMPANY_EMAIL]);
      log('Phone sync users↔profiles', cp[0]?.phone === uu[0]?.phone, 'users=' + uu[0]?.phone + ' profiles=' + cp[0]?.phone);
    }

    // ══════════════════════════════════════
    // TEST 3: Duplicate Email
    // ══════════════════════════════════════
    console.log('\n── Duplicate Email ──');

    const dup = await post('/auth/register', {
      email: HOMEOWNER_EMAIL, [PASSWORD_FIELD]: 'X', full_name: '', phone: '', city: '', role: 'homeowner',
    });
    log('Duplicate email blocked', dup.status >= 400, 'HTTP ' + dup.status);

    // ══════════════════════════════════════
    // TEST 4: Forgot Password (users table)
    // ══════════════════════════════════════
    console.log('\n── Forgot Password ──');

    const forgot1 = await post('/auth/forgot-password', { email: HOMEOWNER_EMAIL });
    log('Forgot password (user)', forgot1.status === 200, 'HTTP ' + forgot1.status);

    // Check reset_token written
    await new Promise(r => setTimeout(r, 500)); // wait for async write
    const [rt1] = await conn.query('SELECT reset_token FROM users WHERE email=?', [HOMEOWNER_EMAIL]);
    log('Reset token in users', !!rt1[0]?.reset_token, rt1[0]?.reset_token ? 'token written' : 'NULL');

    // Non-existent email — same response (security)
    const forgot2 = await post('/auth/forgot-password', { email: 'nobody@nowhere.com' });
    log('Non-existent email same response', forgot2.status === 200, 'HTTP ' + forgot2.status);

    // ══════════════════════════════════════
    // TEST 5: Forgot Password (admin table)
    // ══════════════════════════════════════
    console.log('\n── Forgot Password (Admin) ──');

    // Create a test admin
    await conn.query('INSERT INTO admin_users (email, password, full_name, is_active) VALUES (?, ?, ?, 1)', [ADMIN_EMAIL, 'hash', 'E2E Admin']);

    const forgot3 = await post('/auth/forgot-password', { email: ADMIN_EMAIL });
    log('Forgot password (admin)', forgot3.status === 200, 'HTTP ' + forgot3.status);

    await new Promise(r => setTimeout(r, 500));
    const [rt2] = await conn.query('SELECT reset_token FROM admin_users WHERE email=?', [ADMIN_EMAIL]);
    log('Reset token in admin_users', !!rt2[0]?.reset_token, rt2[0]?.reset_token ? 'token written' : 'NULL');

    // ══════════════════════════════════════
    // TEST 6: check-availability edge cases
    // ══════════════════════════════════════
    console.log('\n── check-availability ──');

    // Known registered + verified user → unavailable
    const avail1 = await post('/auth/check-availability', { email: HOMEOWNER_EMAIL });
    log('Verified user → emailAvailable=false', avail1.data?.emailAvailable === false, JSON.stringify(avail1.data));

    // Unknown email → available
    const avail2 = await post('/auth/check-availability', { email: UNKNOWN_EMAIL });
    log('Unknown email → emailAvailable=true', avail2.data?.emailAvailable === true, JSON.stringify(avail2.data));

    // ══════════════════════════════════════
    // TEST 7: Legacy Designer Migration (verified + password)
    // ══════════════════════════════════════
    console.log('\n── Legacy Designer Migration ──');

    // Seed a verified designer with a password
    const { createRequire: cr2 } = await import('module');
    const req2 = cr2(import.meta.url);
    const bcrypt = req2(path.join(SERVER_DIR, 'node_modules/bcryptjs'));
    const legacyHash = await bcrypt.hash(LEGACY_PASSWORD, 10);
    await conn.query(
      "INSERT INTO designers (email, password, full_name, email_verified, status, is_approved) VALUES (?, ?, 'Legacy Designer', 1, 'approved', 1)",
      [LEGACY_EMAIL, legacyHash]
    );

    // check-availability must say "taken" (verified designer)
    const avail3 = await post('/auth/check-availability', { email: LEGACY_EMAIL });
    log('Legacy designer → emailAvailable=false', avail3.data?.emailAvailable === false, JSON.stringify(avail3.data));

    // Login with correct password → should auto-migrate and return token
    const legacyLogin = await post('/auth/login', { email: LEGACY_EMAIL, [PASSWORD_FIELD]: LEGACY_PASSWORD });
    log('Legacy designer login succeeds', !!legacyLogin.data?.token, legacyLogin.data?.error || (legacyLogin.data?.token ? 'token OK' : 'no token'));

    // users table should now have the migrated record
    const [migratedUser] = await conn.query('SELECT id, role FROM users WHERE email=?', [LEGACY_EMAIL]);
    log('Legacy designer migrated to users', migratedUser.length > 0, 'role=' + migratedUser[0]?.role);

    // designers.user_id should be updated
    const [linkedDesigner] = await conn.query('SELECT user_id FROM designers WHERE email=?', [LEGACY_EMAIL]);
    log('designers.user_id linked', !!linkedDesigner[0]?.user_id, 'user_id=' + linkedDesigner[0]?.user_id);

    // ══════════════════════════════════════
    // TEST 8: Legacy Designer — wrong password
    // ══════════════════════════════════════
    console.log('\n── Legacy Designer Wrong Password ──');

    const legacyBadPw = await post('/auth/login', { email: LEGACY_EMAIL, [PASSWORD_FIELD]: 'WrongPassword' });
    log('Wrong password → 401', legacyBadPw.status === 401, 'HTTP ' + legacyBadPw.status);

    // ══════════════════════════════════════
    // TEST 9: Legacy Designer — OAuth (no password)
    // ══════════════════════════════════════
    console.log('\n── Legacy Designer OAuth (no password) ──');

    await conn.query(
      "INSERT INTO designers (email, password, full_name, email_verified, status, is_approved) VALUES (?, NULL, 'OAuth Designer', 1, 'approved', 1)",
      [LEGACY_OAUTH_EMAIL]
    );

    // check-availability: verified, no password → still "taken" (email_verified=1)
    const avail4 = await post('/auth/check-availability', { email: LEGACY_OAUTH_EMAIL });
    log('OAuth designer → emailAvailable=false', avail4.data?.emailAvailable === false, JSON.stringify(avail4.data));

    // Login attempt → clear error about Google sign-in
    const oauthLogin = await post('/auth/login', { email: LEGACY_OAUTH_EMAIL, [PASSWORD_FIELD]: 'anything' });
    log('OAuth designer login → 401 + clear message', oauthLogin.status === 401 && oauthLogin.data?.error?.includes('Google'), oauthLogin.data?.error);

    // ══════════════════════════════════════
    // TEST 10: Legacy Designer — Unverified (can re-register)
    // ══════════════════════════════════════
    console.log('\n── Legacy Designer Unverified (re-register) ──');

    await conn.query(
      "INSERT INTO designers (email, password, full_name, email_verified, status) VALUES (?, 'hash', 'Unverified', 0, 'pending')",
      [LEGACY_UNVERIFIED_EMAIL]
    );

    // check-availability: NOT verified → treated as available
    const avail5 = await post('/auth/check-availability', { email: LEGACY_UNVERIFIED_EMAIL });
    log('Unverified designer → emailAvailable=true', avail5.data?.emailAvailable === true, JSON.stringify(avail5.data));

    // Can register fresh
    const reReg = await post('/auth/register', {
      email: LEGACY_UNVERIFIED_EMAIL, [PASSWORD_FIELD]: 'NewPass123',
      full_name: 'Re-Register', phone: '', city: 'Dubai', role: 'company',
    });
    log('Unverified designer can re-register', reReg.status === 201, 'HTTP ' + reReg.status + ' ' + (reReg.data?.error || ''));

    // ══════════════════════════════════════
    // TEST 11: Input Validation (was TEST 6)
    // ══════════════════════════════════════
    console.log('\n── Input Validation ──');

    const badEmail = await post('/auth/register', {
      email: '', [PASSWORD_FIELD]: TEST_PASSWORD, full_name: '', phone: '', city: '', role: 'homeowner',
    });
    log('Empty email rejected', badEmail.status >= 400, 'HTTP ' + badEmail.status);

    const shortPw = await post('/auth/register', {
      email: 'shortpw@test.com', [PASSWORD_FIELD]: '12', full_name: '', phone: '', city: '', role: 'homeowner',
    });
    log('Short password rejected', shortPw.status >= 400, 'HTTP ' + shortPw.status);

  } finally {
    await cleanup();
    if (conn) await conn.end();
    stopServer();
  }

  console.log('\n' + '='.repeat(50));
  console.log(`  RESULT: ${passed}/${passed + failed} PASS`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  stopServer();
  process.exit(1);
});
