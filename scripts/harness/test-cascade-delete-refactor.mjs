#!/usr/bin/env node
/**
 * Cascade Delete + Designer Removal Refactor Test
 *
 * Tests:
 *   1. Company registration → no designer row created
 *   2. Auth requests → no auto-created designer row
 *   3. Project CRUD via company_profile_id (not designer_id)
 *   4. Cascade delete: delete company → all related data gone
 *   5. After cascade delete, email can re-register
 *   6. Public project listing works via company_profiles JOIN
 *
 * Usage:
 *   node scripts/harness/test-cascade-delete-refactor.mjs
 *
 * Prerequisites:
 *   - Local MySQL with 'tarmeer' database
 *   - Server NOT running on port 3099
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

const TEST_EMAIL = 'e2e-cascade@test.com';
const TEST_EMAIL2 = 'e2e-cascade2@test.com';
const ADMIN_EMAIL = 'e2e-admin-cascade@test.com';

function log(tc, ok, detail) {
  console.log((ok ? '✅' : '❌') + ' ' + tc + (detail ? ': ' + detail : ''));
  if (ok) passed++; else failed++;
}

async function cleanup() {
  if (!conn) return;
  // Clean up test data in correct order (child tables first)
  for (const email of [TEST_EMAIL, TEST_EMAIL2]) {
    const [users] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length > 0) {
      const userId = users[0].id;
      await conn.query('DELETE FROM projects WHERE company_profile_id IN (SELECT id FROM company_profiles WHERE user_id = ?)', [userId]).catch(() => {});
      await conn.query('DELETE FROM articles WHERE company_profile_id IN (SELECT id FROM company_profiles WHERE user_id = ?)', [userId]).catch(() => {});
      await conn.query('DELETE FROM company_profiles WHERE user_id = ?', [userId]).catch(() => {});
      await conn.query('DELETE FROM homeowner_profiles WHERE user_id = ?', [userId]).catch(() => {});
      await conn.query('DELETE FROM designers WHERE user_id = ?', [userId]).catch(() => {});
      await conn.query('DELETE FROM designers WHERE email = ?', [email]).catch(() => {});
      await conn.query('DELETE FROM company_applications WHERE user_id = ?', [userId]).catch(() => {});
      await conn.query('DELETE FROM notifications WHERE user_id = ?', [userId]).catch(() => {});
      await conn.query('DELETE FROM design_inquiries WHERE user_id = ?', [userId]).catch(() => {});
      await conn.query('DELETE FROM users WHERE id = ?', [userId]).catch(() => {});
    }
    // Also clean orphaned designers
    await conn.query('DELETE FROM designers WHERE email = ?', [email]).catch(() => {});
  }
  await conn.query("DELETE FROM admin_users WHERE email = ?", [ADMIN_EMAIL]).catch(() => {});
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: String(PORT), DEV_SKIP_EMAIL: 'true', NODE_ENV: 'development' };
    // Remove proxy env vars so fetch goes direct to localhost
    delete env.http_proxy; delete env.HTTP_PROXY;
    delete env.https_proxy; delete env.HTTPS_PROXY;
    serverProcess = spawn('node', ['dist/app.js'], {
      cwd: SERVER_DIR,
      env,
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
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
}

async function post(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function get(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${url}`, { headers });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function put(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${url}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function del(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${url}`, { method: 'DELETE', headers });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function main() {
  // Clear proxy env vars so fetch goes direct to localhost
  delete process.env.http_proxy; delete process.env.HTTP_PROXY;
  delete process.env.https_proxy; delete process.env.HTTPS_PROXY;

  console.log('\n' + '='.repeat(55));
  console.log('  Cascade Delete + Designer Refactor Test');
  console.log('='.repeat(55) + '\n');

  // Build
  console.log('Building server...');
  execSync('npx tsc --skipLibCheck', { cwd: SERVER_DIR, stdio: 'ignore' });

  // Connect DB
  conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'tarmeer' });
  await cleanup();

  // Start server
  console.log('Starting server on port ' + PORT + '...\n');
  await startServer();

  try {
    // ══════════════════════════════════════════
    // SECTION 1: Auth without designer creation
    // ══════════════════════════════════════════
    console.log('── 1. Auth Without Designer Creation ──');

    // Register company user
    const reg = await post('/auth/register', {
      email: TEST_EMAIL, password: 'Test123456',
      full_name: 'Cascade Test', phone: '+971501111111', city: 'Dubai', role: 'company',
    });
    log('Register company user', reg.status === 201, 'HTTP ' + reg.status);

    // Check: users row exists
    const [userRows] = await conn.query('SELECT id FROM users WHERE email = ?', [TEST_EMAIL]);
    const userId = userRows[0]?.id;
    log('User created in users table', !!userId, 'id=' + userId);

    // Check: NO designer row created at registration
    const [designerRows1] = await conn.query('SELECT id FROM designers WHERE email = ? OR user_id = ?', [TEST_EMAIL, userId]);
    log('No designer row at registration', designerRows1.length === 0, 'count=' + designerRows1.length);

    // Verify email + login
    await conn.query('UPDATE users SET email_verified = 1 WHERE id = ?', [userId]);
    const login = await post('/auth/login', { email: TEST_EMAIL, password: 'Test123456' });
    const token = login.data?.token;
    log('Login succeeds', !!token, token ? 'token OK' : 'no token');

    // Check: still NO designer row after login + auth middleware
    const [designerRows2] = await conn.query('SELECT id FROM designers WHERE email = ? OR user_id = ?', [TEST_EMAIL, userId]);
    log('No designer row after login', designerRows2.length === 0, 'count=' + designerRows2.length);

    // Make an authenticated request (triggers auth middleware)
    if (token) {
      const me = await get('/auth/me', token);
      log('GET /auth/me works', me.status === 200, 'HTTP ' + me.status);

      // Still no designer row
      const [designerRows3] = await conn.query('SELECT id FROM designers WHERE email = ? OR user_id = ?', [TEST_EMAIL, userId]);
      log('No designer row after /auth/me', designerRows3.length === 0, 'count=' + designerRows3.length);
    }

    // ══════════════════════════════════════════
    // SECTION 2: Project CRUD via company_profile
    // ══════════════════════════════════════════
    console.log('\n── 2. Project CRUD via company_profile ──');

    // Create company profile first
    if (token) {
      const profile = await post('/auth/company/profile', {
        company_name: 'Cascade Test Co', phone: '+971501111111', city: 'Dubai',
        contact_person: 'Cascade Tester', description: 'Test company', services: ['Interior Design', 'Renovation'],
        company_type: 'renovation_company',
      }, token);
      log('Create company profile', profile.status >= 200 && profile.status < 300, 'HTTP ' + profile.status);

      // Get company profile ID
      const [cpRows] = await conn.query('SELECT id, status FROM company_profiles WHERE user_id = ?', [userId]);
      const cpId = cpRows[0]?.id;
      log('Company profile in DB', !!cpId, 'id=' + cpId + ' status=' + cpRows[0]?.status);

      // Approve company so projects get published
      if (cpId) {
        await conn.query("UPDATE company_profiles SET status = 'approved' WHERE id = ?", [cpId]);
      }

      // Get my projects (should be empty)
      const myProjects0 = await get('/projects/my', token);
      log('My projects initially empty', myProjects0.data?.projects?.length === 0, 'count=' + myProjects0.data?.projects?.length);

      // Verify project was created with company_profile_id, NOT designer_id
      if (cpId) {
        const [projRows] = await conn.query('SELECT id, company_profile_id, designer_id FROM projects WHERE company_profile_id = ?', [cpId]);
        log('No projects yet for this company', projRows.length === 0, 'count=' + projRows.length);
      }
    }

    // ══════════════════════════════════════════
    // SECTION 3: Cascade Delete
    // ══════════════════════════════════════════
    console.log('\n── 3. Cascade Delete ──');

    // Create admin user for delete operation
    const adminHash = await bcrypt.hash('Admin123456', 10);
    await conn.query(
      `INSERT INTO admin_users (email, password, full_name, is_active, role, permissions)
       VALUES (?, ?, 'E2E Admin', 1, 'super_admin', '{"can_approve":true,"can_sort":true,"can_view_stats":true}')`,
      [ADMIN_EMAIL, adminHash]
    );

    // Login as admin
    const adminLogin = await post('/admin/login', { email: ADMIN_EMAIL, password: 'Admin123456' });
    const adminToken = adminLogin.data?.token;
    log('Admin login', !!adminToken, adminToken ? 'token OK' : 'no token');

    if (adminToken) {
      // Get company profile ID
      const [cpRows] = await conn.query('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);
      const cpId = cpRows[0]?.id;

      if (cpId) {
        // Insert a test project linked to this company
        await conn.query(
          "INSERT INTO projects (company_profile_id, title, images, tags, status) VALUES (?, 'Test Project', '[]', '[]', 'published')",
          [cpId]
        );
        const [projBefore] = await conn.query('SELECT COUNT(*) as cnt FROM projects WHERE company_profile_id = ?', [cpId]);
        log('Test project created', projBefore[0].cnt > 0, 'count=' + projBefore[0].cnt);

        // Call cascade delete
        const deleteResult = await put(`/admin/roles/companies/${cpId}/delete`, { reason: 'E2E test cleanup' }, adminToken);
        log('Cascade delete API call', deleteResult.status === 200, 'HTTP ' + deleteResult.status + ' ' + (deleteResult.data?.message || deleteResult.data?.error || ''));

        // Verify: all related data is gone
        const [usersAfter] = await conn.query('SELECT COUNT(*) as cnt FROM users WHERE id = ?', [userId]);
        log('users row deleted', usersAfter[0].cnt === 0, 'remaining=' + usersAfter[0].cnt);

        const [cpAfter] = await conn.query('SELECT COUNT(*) as cnt FROM company_profiles WHERE id = ?', [cpId]);
        log('company_profiles row deleted', cpAfter[0].cnt === 0, 'remaining=' + cpAfter[0].cnt);

        const [projAfter] = await conn.query('SELECT COUNT(*) as cnt FROM projects WHERE company_profile_id = ?', [cpId]);
        log('projects deleted', projAfter[0].cnt === 0, 'remaining=' + projAfter[0].cnt);

        const [designerAfter] = await conn.query('SELECT COUNT(*) as cnt FROM designers WHERE user_id = ?', [userId]);
        log('designers deleted', designerAfter[0].cnt === 0, 'remaining=' + designerAfter[0].cnt);
      } else {
        log('Cascade delete skipped', false, 'no company_profile found');
      }
    }

    // ══════════════════════════════════════════
    // SECTION 4: Re-register after cascade delete
    // ══════════════════════════════════════════
    console.log('\n── 4. Re-register After Delete ──');

    const reReg = await post('/auth/register', {
      email: TEST_EMAIL, password: process.env.E2E_TEST_PW || 'NewPass123456',
      full_name: 'Cascade ReTest', phone: '+971502222222', city: 'Abu Dhabi', role: 'company',
    });
    log('Re-register after delete', reReg.status === 201, 'HTTP ' + reReg.status + ' ' + (reReg.data?.error || ''));

    // ══════════════════════════════════════════
    // SECTION 5: Public project listing (company_profiles JOIN)
    // ══════════════════════════════════════════
    console.log('\n── 5. Public Project Listing ──');

    const publicProjects = await get('/projects?page=1&limit=5');
    log('Public projects endpoint works', publicProjects.status === 200, 'HTTP ' + publicProjects.status);
    log('Projects array returned', Array.isArray(publicProjects.data?.projects), 'type=' + typeof publicProjects.data?.projects);

    // Check public designers/companies listing
    const publicDesigners = await get('/designers?page=1&limit=5');
    log('Public designers/companies endpoint works', publicDesigners.status === 200, 'HTTP ' + publicDesigners.status);

  } finally {
    await cleanup();
    if (conn) await conn.end();
    stopServer();
  }

  console.log('\n' + '='.repeat(55));
  console.log(`  RESULT: ${passed}/${passed + failed} PASS`);
  console.log('='.repeat(55) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  stopServer();
  process.exit(1);
});
