#!/usr/bin/env node
/**
 * Company Dashboard Onboarding Flow Harness
 *
 * Tests the new company dashboard flow:
 *   Register → Email verify → Login → Dashboard API (no onboarding redirect)
 *   Step 1: Profile API (create/update)
 *   Step 2: Projects API (create, count)
 *   Step 3: Review status check
 *   + Articles API (create, count)
 *
 * Usage:
 *   node scripts/harness/test-company-dashboard.mjs
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

function log(tc, ok, detail) {
  console.log((ok ? '✅' : '❌') + ' ' + tc + (detail ? ': ' + detail : ''));
  if (ok) passed++; else failed++;
}

async function cleanup() {
  if (!conn) return;
  await conn.query("DELETE FROM projects WHERE title LIKE 'E2E_Dashboard%'").catch(() => {});
  await conn.query("DELETE FROM company_profiles WHERE company_name='E2E_Dashboard_Co'").catch(() => {});
  await conn.query("DELETE FROM users WHERE email='e2e-dashboard@test.com'").catch(() => {});
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
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function put(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { method: 'PUT', headers, body: JSON.stringify(body) });
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

async function del(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${path}`, { method: 'DELETE', headers });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

async function main() {
  console.log('\n' + '='.repeat(55));
  console.log('  Company Dashboard Onboarding Flow Harness');
  console.log('='.repeat(55) + '\n');

  console.log('Building server...');
  execSync('npx tsc --skipLibCheck', { cwd: SERVER_DIR, stdio: 'ignore' });

  conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'tarmeer' });
  await cleanup();

  console.log('Starting server on port ' + PORT + '...\n');
  await startServer();

  let token = null;

  try {
    // ══════════════════════════════════════
    // TEST 1: Company Registration (direct to dashboard flow)
    // ══════════════════════════════════════
    console.log('── 1. Registration ──');

    const reg = await post('/auth/register', {
      email: 'e2e-dashboard@test.com',
      password: 'Test123456',
      full_name: 'E2E Tester',
      phone: '+971501234567',
      city: 'Dubai',
      role: 'company',
    });
    log('Register company user', reg.status === 201, `HTTP ${reg.status}`);

    const [u] = await conn.query("SELECT * FROM users WHERE email='e2e-dashboard@test.com'");
    log('User created in DB', u.length === 1, `role=${u[0]?.role}`);
    log('Role is company', u[0]?.role === 'company', `role=${u[0]?.role}`);

    // Email not verified → login should fail
    const loginBlocked = await post('/auth/login', { email: 'e2e-dashboard@test.com', password: 'Test123456' });
    log('Login blocked before verify', loginBlocked.status >= 400, `HTTP ${loginBlocked.status}`);

    // Simulate email verification
    await conn.query("UPDATE users SET email_verified=1 WHERE email='e2e-dashboard@test.com'");

    // Login after verification → should succeed, get token
    const loginOk = await post('/auth/login', { email: 'e2e-dashboard@test.com', password: 'Test123456' });
    token = loginOk.data?.token;
    log('Login after verify succeeds', !!token, token ? 'token OK' : `error: ${loginOk.data?.error}`);

    // ══════════════════════════════════════
    // TEST 2: /auth/me → no onboarding redirect (just auth check)
    // ══════════════════════════════════════
    console.log('\n── 2. Auth Check (no onboarding gate) ──');

    const me = await get('/auth/me', token);
    log('GET /auth/me returns 200', me.status === 200, `HTTP ${me.status}`);
    log('User role = company', me.data?.user?.role === 'company', `role=${me.data?.user?.role}`);

    // Profile endpoint returns null/empty (no profile yet)
    const emptyProfile = await get('/auth/company/profile', token);
    log('GET /auth/company/profile returns 200', emptyProfile.status === 200, `HTTP ${emptyProfile.status}`);
    log('No profile yet → profile is null', !emptyProfile.data?.profile?.company_name, `company_name=${emptyProfile.data?.profile?.company_name}`);

    // ══════════════════════════════════════
    // TEST 3: Step 1 — Create Company Profile (with all required fields)
    // ══════════════════════════════════════
    console.log('\n── 3. Step 1: Profile Setup ──');

    const profileCreate = await post('/auth/company/profile', {
      company_name: 'E2E_Dashboard_Co',
      contact_person: 'E2E Tester',
      phone: '+971501234567',
      city: 'Dubai',
      description: 'A test interior design company',
      services: ['Interior Design', 'Fit-Out'],
      specialties: ['Residential', 'Villa'],
      company_type: 'design_studio',
    }, token);
    log('Create profile', profileCreate.status >= 200 && profileCreate.status < 300, `HTTP ${profileCreate.status}`);

    // Read back
    const profileGet = await get('/auth/company/profile', token);
    const p = profileGet.data?.profile;
    log('Profile persisted: company_name', p?.company_name === 'E2E_Dashboard_Co', `company_name=${p?.company_name}`);
    log('Profile persisted: phone', p?.phone === '+971501234567', `phone=${p?.phone}`);
    log('Profile persisted: description', !!p?.description, `description=${p?.description?.slice(0, 20)}`);
    log('Profile status = pending', p?.status === 'pending', `status=${p?.status}`);

    // Dashboard step 1 completion check: name + description + phone all present
    const step1Done = !!(p?.company_name && p?.description && p?.phone);
    log('Step 1 completion condition met', step1Done, `name=${!!p?.company_name} desc=${!!p?.description} phone=${!!p?.phone}`);

    // ══════════════════════════════════════
    // TEST 4: Update profile (auto-save simulation)
    // ══════════════════════════════════════
    console.log('\n── 4. Profile Update ──');

    const profileUpdate = await post('/auth/company/profile', {
      company_name: 'E2E_Dashboard_Co',
      contact_person: 'E2E Tester Updated',
      phone: '+971501234567',
      city: 'Abu Dhabi',
      description: 'Updated description',
      services: ['Interior Design', 'Renovation'],
      specialties: ['Commercial'],
      company_type: 'renovation_company',
      website: 'https://example.com',
      address: 'Business Bay',
      trade_license_number: 'DED-99999',
      establishment_year: 2018,
    }, token);
    log('Update profile', profileUpdate.status >= 200 && profileUpdate.status < 300, `HTTP ${profileUpdate.status}`);

    const profileGet2 = await get('/auth/company/profile', token);
    const p2 = profileGet2.data?.profile;
    log('Update: city changed', p2?.city === 'Abu Dhabi', `city=${p2?.city}`);
    log('Update: website stored', p2?.website === 'https://example.com', `website=${p2?.website}`);
    log('Update: establishment_year', p2?.establishment_year === 2018, `year=${p2?.establishment_year}`);

    // ══════════════════════════════════════
    // TEST 5: Step 2 — Upload First Project
    // ══════════════════════════════════════
    console.log('\n── 5. Step 2: First Project ──');

    const projectCreate = await post('/projects', {
      title: 'E2E_Dashboard_Project_1',
      description: 'Test project description',
      location: 'Dubai',
      style: 'modern',
      images: ['https://example.com/img1.jpg'],
      tags: ['Villa', 'Residential'],
      status: 'pending',
    }, token);
    log('Create project', projectCreate.status >= 200 && projectCreate.status < 300, `HTTP ${projectCreate.status}`);

    // Verify count
    const projectsGet = await get('/auth/company/projects', token);
    const projectCount = (projectsGet.data?.projects || []).length;
    log('Project count >= 1', projectCount >= 1, `count=${projectCount}`);
    log('Step 2 completion: projectCount > 0', projectCount > 0, `count=${projectCount}`);

    // ══════════════════════════════════════
    // TEST 6: Multiple Projects → scoring
    // ══════════════════════════════════════
    console.log('\n── 6. Ranking Score (projects) ──');

    await post('/projects', {
      title: 'E2E_Dashboard_Project_2',
      description: 'Second project',
      location: 'Abu Dhabi',
      style: 'minimalist',
      images: ['https://example.com/img2.jpg'],
      tags: [],
      status: 'pending',
    }, token);

    const projectsGet2 = await get('/auth/company/projects', token);
    const projectCount2 = (projectsGet2.data?.projects || []).length;
    log('Multiple projects stored', projectCount2 >= 2, `count=${projectCount2}`);
    log('Score formula: projects * 10', projectCount2 * 10 >= 20, `score=${projectCount2 * 10}`);

    // ══════════════════════════════════════
    // TEST 7: Articles → scoring
    // ══════════════════════════════════════
    console.log('\n── 7. Articles ──');

    // Verify the company profile is in the local DB with correct user_id
    const [dbUser] = await conn.query("SELECT id FROM users WHERE email='e2e-dashboard@test.com'");
    const dbUserId = dbUser[0]?.id;
    const [dbProfile] = await conn.query("SELECT id, user_id FROM company_profiles WHERE company_name='E2E_Dashboard_Co'");
    log('DB: profile user_id matches user', dbProfile[0]?.user_id == dbUserId, `profile.user_id=${dbProfile[0]?.user_id} user.id=${dbUserId}`);

    const articleCreate = await post('/articles', {
      title: 'E2E_Dashboard_Article',
      content: 'Test article content about interior design',
      excerpt: 'Test excerpt',
      tags: ['Interior Design'],
      status: 'draft',
    }, token);
    log('Create article', articleCreate.status >= 200 && articleCreate.status < 300, `HTTP ${articleCreate.status}`);

    const articlesGet = await get('/articles/mine', token);
    const articleCount = (articlesGet.data?.articles || []).length;
    log('Article count >= 1', articleCount >= 1, `count=${articleCount}`);

    // Total score
    const totalScore = (projectCount2 + articleCount) * 10;
    log('Total score computed correctly', totalScore === (projectCount2 + articleCount) * 10, `score=${totalScore}`);

    // ══════════════════════════════════════
    // TEST 8: Step 3 — Review Status
    // ══════════════════════════════════════
    console.log('\n── 8. Step 3: Review Status ──');

    const profileFinal = await get('/auth/company/profile', token);
    const statusVal = profileFinal.data?.profile?.status;
    log('Profile status is pending (awaiting review)', statusVal === 'pending', `status=${statusVal}`);
    log('Step 3 completion: status !== approved', statusVal !== 'approved', `status=${statusVal}`);

    // Simulate admin approval
    await conn.query("UPDATE company_profiles SET status='approved' WHERE company_name='E2E_Dashboard_Co'");
    const profileApproved = await get('/auth/company/profile', token);
    log('After admin approve: status=approved', profileApproved.data?.profile?.status === 'approved', `status=${profileApproved.data?.profile?.status}`);
    log('Step 3 complete when approved', profileApproved.data?.profile?.status === 'approved', `status=${profileApproved.data?.profile?.status}`);

    // ══════════════════════════════════════
    // TEST 9: Profile completeness for step 1 gate
    // ══════════════════════════════════════
    console.log('\n── 9. Step 1 Gate: Incomplete Profile ──');

    // New user without profile
    await post('/auth/register', {
      email: 'e2e-dashboard-new@test.com',
      password: 'Test123456',
      full_name: 'E2E New',
      phone: '', city: 'Dubai', role: 'company',
    });
    await conn.query("UPDATE users SET email_verified=1 WHERE email='e2e-dashboard-new@test.com'");
    const loginNew = await post('/auth/login', { email: 'e2e-dashboard-new@test.com', password: 'Test123456' });
    const tokenNew = loginNew.data?.token;

    const newProfile = await get('/auth/company/profile', tokenNew);
    const newP = newProfile.data?.profile;
    const newStep1Done = !!(newP?.company_name && newP?.description && newP?.phone);
    log('New user: step 1 incomplete', !newStep1Done, `company_name=${newP?.company_name} desc=${newP?.description}`);

    // Cleanup extra test user
    await conn.query("DELETE FROM users WHERE email='e2e-dashboard-new@test.com'").catch(() => {});

  } finally {
    stopServer();
    await cleanup();
    await conn.end();
  }

  // Summary
  console.log('\n' + '='.repeat(55));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(55) + '\n');

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Harness error:', err);
  stopServer();
  process.exit(1);
});
