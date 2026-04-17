#!/usr/bin/env node
/**
 * Full Walkthrough — Designer Refactor + Cascade Delete
 *
 * Covers:
 *   1. Registration → login → no designer leakage
 *   2. Company profile creation → data integrity
 *   3. Project CRUD → images stored, company_profile_id linked, designer_id=NULL
 *   4. Ownership/permission check → can't edit others' projects
 *   5. Public API → company name/avatar correct (not designer fields)
 *   6. Admin approve → project auto-publish
 *   7. Admin list/detail → data shows correctly
 *   8. Cascade delete → all tables cleaned
 *   9. Re-register after delete → works
 *  10. Homeowner flow → no cross-contamination
 *  11. Legacy designer token → graceful handling
 *  12. My projects → returns correct data after refactor
 *
 * Usage: node scripts/harness/test-full-walkthrough.mjs
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
const failures = [];

const COMPANY_EMAIL = 'e2e-full-company@test.com';
const COMPANY2_EMAIL = 'e2e-full-company2@test.com';
const HOMEOWNER_EMAIL = 'e2e-full-homeowner@test.com';
const ADMIN_EMAIL = 'e2e-full-admin@test.com';

function log(tc, ok, detail) {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${tc}${detail ? ': ' + detail : ''}`);
  if (ok) passed++;
  else { failed++; failures.push(tc + (detail ? ' — ' + detail : '')); }
}

async function cleanTestData() {
  if (!conn) return;
  for (const email of [COMPANY_EMAIL, COMPANY2_EMAIL, HOMEOWNER_EMAIL]) {
    const [users] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    for (const u of users) {
      await conn.query('DELETE FROM projects WHERE company_profile_id IN (SELECT id FROM company_profiles WHERE user_id = ?)', [u.id]).catch(() => {});
      await conn.query('DELETE FROM articles WHERE company_profile_id IN (SELECT id FROM company_profiles WHERE user_id = ?)', [u.id]).catch(() => {});
      await conn.query('DELETE FROM company_profiles WHERE user_id = ?', [u.id]).catch(() => {});
      await conn.query('DELETE FROM homeowner_profiles WHERE user_id = ?', [u.id]).catch(() => {});
      await conn.query('DELETE FROM designers WHERE user_id = ?', [u.id]).catch(() => {});
      await conn.query('DELETE FROM designers WHERE email = ?', [email]).catch(() => {});
      await conn.query('DELETE FROM company_applications WHERE user_id = ?', [u.id]).catch(() => {});
      await conn.query('DELETE FROM notifications WHERE user_id = ?', [u.id]).catch(() => {});
      await conn.query('DELETE FROM design_inquiries WHERE user_id = ?', [u.id]).catch(() => {});
      await conn.query('UPDATE uae_companies SET owner_user_id = NULL WHERE owner_user_id = ?', [u.id]).catch(() => {});
      await conn.query('DELETE FROM users WHERE id = ?', [u.id]).catch(() => {});
    }
    await conn.query('DELETE FROM designers WHERE email = ?', [email]).catch(() => {});
  }
  await conn.query('DELETE FROM admin_users WHERE email = ?', [ADMIN_EMAIL]).catch(() => {});
}

async function startServer() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: String(PORT), DEV_SKIP_EMAIL: 'true', NODE_ENV: 'development' };
    delete env.http_proxy; delete env.HTTP_PROXY;
    delete env.https_proxy; delete env.HTTPS_PROXY;
    serverProcess = spawn('node', ['dist/app.js'], {
      cwd: SERVER_DIR, env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    let stderr = '';
    serverProcess.stdout.on('data', (d) => {
      const s = d.toString();
      if (s.includes('error') || s.includes('Error')) process.stderr.write('[SERVER] ' + s);
      if (!started && s.includes('Server running')) { started = true; setTimeout(resolve, 500); }
    });
    serverProcess.stderr.on('data', (d) => { stderr += d.toString(); process.stderr.write('[STDERR] ' + d.toString()); });
    setTimeout(() => { if (!started) reject(new Error('Server start timeout. stderr: ' + stderr.slice(0, 500))); }, 15000);
  });
}
function stopServer() { if (serverProcess) { serverProcess.kill(); serverProcess = null; } }

async function post(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function get(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${url}`, { headers });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function put(url, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${url}`, { method: 'PUT', headers, body: JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function del(url, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`${API}${url}`, { method: 'DELETE', headers });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

async function main() {
  delete process.env.http_proxy; delete process.env.HTTP_PROXY;
  delete process.env.https_proxy; delete process.env.HTTPS_PROXY;

  console.log('\n' + '═'.repeat(60));
  console.log('  FULL WALKTHROUGH — Designer Refactor + Cascade Delete');
  console.log('═'.repeat(60) + '\n');

  console.log('Building server...');
  execSync('npx tsc --skipLibCheck', { cwd: SERVER_DIR, stdio: 'ignore' });

  conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'tarmeer' });
  await cleanTestData();

  console.log('Starting server on port ' + PORT + '...\n');
  await startServer();

  // Create admin for later use
  const adminHash = await bcrypt.hash('Admin123456', 10);
  await conn.query(
    `INSERT INTO admin_users (email, password, full_name, is_active, role, permissions)
     VALUES (?, ?, 'E2E Admin', 1, 'super_admin', '{"can_approve":true,"can_sort":true,"can_view_stats":true}')`,
    [ADMIN_EMAIL, adminHash]
  );
  const adminLogin = await post('/admin/login', { email: ADMIN_EMAIL, password: 'Admin123456' });
  const adminToken = adminLogin.data?.token;

  try {
    // ══════════════════════════════════════════════════
    // SECTION 1: Company Registration + No Designer Leak
    // ══════════════════════════════════════════════════
    console.log('── 1. Company Registration ──');

    const reg = await post('/auth/register', {
      email: COMPANY_EMAIL, password: 'Test123456',
      full_name: 'Full Test Co', phone: '+971501234567', city: 'Dubai', role: 'company',
    });
    log('1.1 Register company', reg.status === 201, 'HTTP ' + reg.status);

    const [u1] = await conn.query('SELECT id, email, full_name, phone, role, email_verified FROM users WHERE email = ?', [COMPANY_EMAIL]);
    const userId = u1[0]?.id;
    log('1.2 User in DB', !!userId, `id=${userId} role=${u1[0]?.role}`);
    log('1.3 User data intact', u1[0]?.full_name === 'Full Test Co' && u1[0]?.phone === '+971501234567', `name=${u1[0]?.full_name} phone=${u1[0]?.phone}`);

    const [d1] = await conn.query('SELECT id FROM designers WHERE email = ? OR user_id = ?', [COMPANY_EMAIL, userId || 0]);
    log('1.4 No designer row created', d1.length === 0, 'count=' + d1.length);

    // Verify + login
    await conn.query('UPDATE users SET email_verified = 1 WHERE id = ?', [userId]);
    const login = await post('/auth/login', { email: COMPANY_EMAIL, password: 'Test123456' });
    const token = login.data?.token;
    log('1.5 Login succeeds', !!token, token ? 'token OK' : login.data?.error);

    // Auth middleware check
    const me = await get('/auth/me', token);
    log('1.6 /auth/me works', me.status === 200 && me.data?.user?.email === COMPANY_EMAIL, `email=${me.data?.user?.email}`);

    const [d2] = await conn.query('SELECT id FROM designers WHERE email = ? OR user_id = ?', [COMPANY_EMAIL, userId || 0]);
    log('1.7 Still no designer after auth requests', d2.length === 0, 'count=' + d2.length);

    // ══════════════════════════════════════════════════
    // SECTION 2: Company Profile + Data Integrity
    // ══════════════════════════════════════════════════
    console.log('\n── 2. Company Profile Creation ──');

    const prof = await post('/auth/company/profile', {
      company_name: 'Full Test Studio', phone: '+971501234567', city: 'Dubai',
      contact_person: 'Full Tester', description: 'Premium interior design studio',
      services: ['Interior Design', 'Renovation'], company_type: 'design_studio',
    }, token);
    log('2.1 Create company profile', prof.status >= 200 && prof.status < 300, 'HTTP ' + prof.status);

    const [cp1] = await conn.query('SELECT * FROM company_profiles WHERE user_id = ?', [userId]);
    const cpId = cp1[0]?.id;
    log('2.2 Profile in DB', !!cpId, `id=${cpId} status=${cp1[0]?.status}`);
    log('2.3 Company name correct', cp1[0]?.company_name === 'Full Test Studio', cp1[0]?.company_name);
    log('2.4 Phone synced', cp1[0]?.phone === '+971501234567', cp1[0]?.phone);
    log('2.5 City correct', cp1[0]?.city === 'Dubai', cp1[0]?.city);
    let services;
    try { services = typeof cp1[0]?.services === 'string' ? JSON.parse(cp1[0].services) : cp1[0]?.services; } catch { services = cp1[0]?.services; }
    log('2.6 Services stored', Array.isArray(services) && services.length > 0, `type=${typeof cp1[0]?.services} len=${Array.isArray(services) ? services.length : 'N/A'}`);

    // ══════════════════════════════════════════════════
    // SECTION 3: Project CRUD + Image Storage
    // ══════════════════════════════════════════════════
    console.log('\n── 3. Project CRUD ──');

    // Approve company first so projects get auto-published
    if (cpId && adminToken) {
      await post(`/admin/roles/companies/${cpId}/approve`, {}, adminToken);
    }
    const [cpApproved] = await conn.query('SELECT status FROM company_profiles WHERE id = ?', [cpId]);
    log('3.0 Company approved', cpApproved[0]?.status === 'approved', cpApproved[0]?.status);

    // Get my projects (should be empty)
    const myP0 = await get('/projects/my', token);
    log('3.1 My projects initially empty', myP0.data?.projects?.length === 0, 'count=' + myP0.data?.projects?.length);

    // Create project with image URLs (not base64 — using external URLs for test)
    const testImages = ['/images/uae-companies/test/cover-001.jpg', '/images/uae-companies/test/cover-002.jpg'];
    const createP = await post('/projects', {
      title: 'Luxury Villa Renovation',
      description: 'Complete renovation of a 5-bedroom villa',
      style: 'Modern',
      location: 'Palm Jumeirah',
      year: '2026',
      images: testImages,
      tags: ['luxury', 'villa', 'modern'],
      status: 'published',
    }, token);
    log('3.2 Create project', createP.status === 201, 'HTTP ' + createP.status + ' ' + (createP.data?.error || ''));

    const projectId = createP.data?.project?.id;

    if (projectId) {
      // Check DB directly
      const [projRow] = await conn.query('SELECT * FROM projects WHERE id = ?', [projectId]);
      const proj = projRow[0];
      log('3.3 Project in DB', !!proj, `id=${projectId}`);
      log('3.4 company_profile_id linked', proj?.company_profile_id === cpId, `cp_id=${proj?.company_profile_id} expected=${cpId}`);
      log('3.5 designer_id is NULL', proj?.designer_id == null, `designer_id=${proj?.designer_id}`);
      log('3.6 Status auto-published', proj?.status === 'published', proj?.status);

      // Check images stored
      let images;
      try { images = typeof proj?.images === 'string' ? JSON.parse(proj.images) : proj?.images; } catch { images = []; }
      log('3.7 Images stored', Array.isArray(images) && images.length === 2, `count=${images?.length}`);
      log('3.8 Image URLs intact', images?.[0]?.includes('cover-001') || false, images?.[0]);

      // Check title/description
      log('3.9 Title correct', proj?.title === 'Luxury Villa Renovation', proj?.title);
      log('3.10 Description correct', proj?.description?.includes('5-bedroom'), proj?.description?.slice(0, 30));

      // Get my projects (should have 1)
      const myP1 = await get('/projects/my', token);
      log('3.11 My projects has 1', myP1.data?.projects?.length === 1, 'count=' + myP1.data?.projects?.length);
      log('3.12 My project title matches', myP1.data?.projects?.[0]?.title === 'Luxury Villa Renovation', myP1.data?.projects?.[0]?.title);

      // Update project
      const updateP = await put(`/projects/${projectId}`, {
        title: 'Luxury Villa Renovation V2',
        description: 'Updated description',
        style: 'Contemporary',
        location: 'Palm Jumeirah',
        year: '2026',
        images: testImages,
        tags: ['luxury', 'villa', 'contemporary'],
      }, token);
      log('3.13 Update project', updateP.status === 200, 'HTTP ' + updateP.status + ' ' + (updateP.data?.error || ''));

      const [projUpdated] = await conn.query('SELECT title, style FROM projects WHERE id = ?', [projectId]);
      log('3.14 Update persisted', projUpdated[0]?.title === 'Luxury Villa Renovation V2', projUpdated[0]?.title);
    } else {
      log('3.3-3.14 Project CRUD', false, 'project creation failed, skipping');
    }

    // ══════════════════════════════════════════════════
    // SECTION 4: Permission / Ownership Check
    // ══════════════════════════════════════════════════
    console.log('\n── 4. Permission Check ──');

    // Register second company user
    await post('/auth/register', {
      email: COMPANY2_EMAIL, password: 'Test123456',
      full_name: 'Other Co', phone: '+971509999999', city: 'Sharjah', role: 'company',
    });
    const [u2] = await conn.query('SELECT id FROM users WHERE email = ?', [COMPANY2_EMAIL]);
    await conn.query('UPDATE users SET email_verified = 1 WHERE id = ?', [u2[0]?.id]);
    const login2 = await post('/auth/login', { email: COMPANY2_EMAIL, password: 'Test123456' });
    const token2 = login2.data?.token;
    log('4.1 Second user logged in', !!token2, token2 ? 'OK' : 'no token');

    if (projectId && token2) {
      // Try to update other's project
      const badUpdate = await put(`/projects/${projectId}`, {
        title: 'Hacked', description: 'x', style: 'x', location: 'x', year: '2026',
        images: testImages, tags: [],
      }, token2);
      log('4.2 Cannot update others project', badUpdate.status === 403, 'HTTP ' + badUpdate.status);

      // Try to delete other's project
      const badDelete = await del(`/projects/${projectId}`, token2);
      log('4.3 Cannot delete others project', badDelete.status === 403, 'HTTP ' + badDelete.status);
    }

    // ══════════════════════════════════════════════════
    // SECTION 5: Public API — Data Correctness
    // ══════════════════════════════════════════════════
    console.log('\n── 5. Public API Data ──');

    const pubProjects = await get('/projects?page=1&limit=50');
    log('5.1 Public projects endpoint', pubProjects.status === 200, 'HTTP ' + pubProjects.status);

    // Find our test project in public listing
    const ourPubProject = pubProjects.data?.projects?.find(p => p.id === projectId);
    if (ourPubProject) {
      log('5.2 Test project in public list', true, `id=${ourPubProject.id}`);
      // Check company name shows (not designer name)
      log('5.3 designer_name = company name', ourPubProject.designer_name === 'Full Test Studio', `got="${ourPubProject.designer_name}"`);
    } else {
      log('5.2 Test project in public list', false, 'not found in listing');
      log('5.3 designer_name check', false, 'skipped');
    }

    // Public designers/companies listing
    const pubDesigners = await get('/designers?page=1&limit=50');
    log('5.4 Public companies listing', pubDesigners.status === 200, 'HTTP ' + pubDesigners.status);

    // Check our company shows up
    const ourCompany = pubDesigners.data?.designers?.find(d =>
      d.full_name === 'Full Test Studio' || d.company_name === 'Full Test Studio'
    );
    log('5.5 Our company in public list', !!ourCompany, ourCompany ? `name=${ourCompany.full_name || ourCompany.company_name}` : 'not found');

    // ══════════════════════════════════════════════════
    // SECTION 6: Admin Operations
    // ══════════════════════════════════════════════════
    console.log('\n── 6. Admin Operations ──');

    if (adminToken && cpId) {
      // Admin list companies
      const adminList = await get('/admin/roles/companies?status=all', adminToken);
      log('6.1 Admin list companies', adminList.status === 200, 'HTTP ' + adminList.status);
      const ourInList = adminList.data?.companies?.find(c => c.id === cpId);
      log('6.2 Our company in admin list', !!ourInList, ourInList ? `name=${ourInList.company_name}` : 'not found');

      // Admin company detail
      const adminDetail = await get(`/admin/roles/companies/${cpId}/full-detail`, adminToken);
      log('6.3 Admin company detail', adminDetail.status === 200, 'HTTP ' + adminDetail.status);
      log('6.4 Detail has projects', adminDetail.data?.projects?.length > 0, 'count=' + adminDetail.data?.projects?.length);
      log('6.5 Detail user email correct', adminDetail.data?.company?.user_email === COMPANY_EMAIL, adminDetail.data?.company?.user_email);
    }

    // ══════════════════════════════════════════════════
    // SECTION 7: Cascade Delete — Full Verification
    // ══════════════════════════════════════════════════
    console.log('\n── 7. Cascade Delete ──');

    if (adminToken && cpId) {
      // Count records before delete
      const [beforeUsers] = await conn.query('SELECT COUNT(*) as c FROM users WHERE id = ?', [userId]);
      const [beforeCp] = await conn.query('SELECT COUNT(*) as c FROM company_profiles WHERE id = ?', [cpId]);
      const [beforeProj] = await conn.query('SELECT COUNT(*) as c FROM projects WHERE company_profile_id = ?', [cpId]);
      const [beforeDesigner] = await conn.query('SELECT COUNT(*) as c FROM designers WHERE user_id = ?', [userId]);
      console.log(`  Before: users=${beforeUsers[0].c} profiles=${beforeCp[0].c} projects=${beforeProj[0].c} designers=${beforeDesigner[0].c}`);

      // Execute cascade delete
      const deleteRes = await put(`/admin/roles/companies/${cpId}/delete`, { reason: 'E2E full test cleanup' }, adminToken);
      log('7.1 Delete API call', deleteRes.status === 200, 'HTTP ' + deleteRes.status + ' ' + (deleteRes.data?.message || deleteRes.data?.error || ''));

      // Verify each table
      const [afterUsers] = await conn.query('SELECT COUNT(*) as c FROM users WHERE id = ?', [userId]);
      log('7.2 users deleted', afterUsers[0].c === 0, 'remaining=' + afterUsers[0].c);

      const [afterCp] = await conn.query('SELECT COUNT(*) as c FROM company_profiles WHERE id = ?', [cpId]);
      log('7.3 company_profiles deleted', afterCp[0].c === 0, 'remaining=' + afterCp[0].c);

      const [afterProj] = await conn.query('SELECT COUNT(*) as c FROM projects WHERE company_profile_id = ?', [cpId]);
      log('7.4 projects deleted', afterProj[0].c === 0, 'remaining=' + afterProj[0].c);

      const [afterDesigner] = await conn.query('SELECT COUNT(*) as c FROM designers WHERE user_id = ?', [userId]);
      log('7.5 designers deleted', afterDesigner[0].c === 0, 'remaining=' + afterDesigner[0].c);

      const [afterNotif] = await conn.query('SELECT COUNT(*) as c FROM notifications WHERE user_id = ?', [userId]);
      log('7.6 notifications deleted', afterNotif[0].c === 0, 'remaining=' + afterNotif[0].c);

      const [afterApps] = await conn.query('SELECT COUNT(*) as c FROM company_applications WHERE user_id = ?', [userId]);
      log('7.7 company_applications deleted', afterApps[0].c === 0, 'remaining=' + afterApps[0].c);

      const [afterInq] = await conn.query('SELECT COUNT(*) as c FROM design_inquiries WHERE user_id = ?', [userId]);
      log('7.8 design_inquiries deleted', afterInq[0].c === 0, 'remaining=' + afterInq[0].c);

      const [afterUae] = await conn.query('SELECT COUNT(*) as c FROM uae_companies WHERE owner_user_id = ?', [userId]);
      log('7.9 uae_companies unlinked', afterUae[0].c === 0, 'remaining=' + afterUae[0].c);
    }

    // ══════════════════════════════════════════════════
    // SECTION 8: Re-register After Cascade Delete
    // ══════════════════════════════════════════════════
    console.log('\n── 8. Re-register After Delete ──');

    const reReg = await post('/auth/register', {
      email: COMPANY_EMAIL, password: process.env.E2E_TEST_PW || 'NewPass123456',
      full_name: 'Re-registered Co', phone: '+971503333333', city: 'Abu Dhabi', role: 'company',
    });
    log('8.1 Re-register succeeds', reReg.status === 201, 'HTTP ' + reReg.status + ' ' + (reReg.data?.error || ''));

    const [reUser] = await conn.query('SELECT id, full_name, phone, city FROM users WHERE email = ?', [COMPANY_EMAIL]);
    log('8.2 New user data correct', reUser[0]?.full_name === 'Re-registered Co', `name=${reUser[0]?.full_name}`);
    log('8.3 New phone correct', reUser[0]?.phone === '+971503333333', reUser[0]?.phone);
    log('8.4 New city correct', reUser[0]?.city === 'Abu Dhabi', reUser[0]?.city);

    // Old projects should NOT exist for new user
    const newUserId = reUser[0]?.id;
    const [oldProjects] = await conn.query('SELECT COUNT(*) as c FROM projects WHERE company_profile_id IN (SELECT id FROM company_profiles WHERE user_id = ?)', [newUserId || 0]);
    log('8.5 No orphan projects', oldProjects[0].c === 0, 'count=' + oldProjects[0].c);

    // ══════════════════════════════════════════════════
    // SECTION 9: Homeowner Flow — No Cross-contamination
    // ══════════════════════════════════════════════════
    console.log('\n── 9. Homeowner Flow ──');

    const regH = await post('/auth/register', {
      email: HOMEOWNER_EMAIL, password: 'Test123456',
      full_name: 'Test Homeowner', phone: '+971504444444', city: 'Ajman', role: 'homeowner',
    });
    log('9.1 Register homeowner', regH.status === 201, 'HTTP ' + regH.status);

    const [uH] = await conn.query('SELECT id, role FROM users WHERE email = ?', [HOMEOWNER_EMAIL]);
    const homeownerId = uH[0]?.id;
    log('9.2 Homeowner role correct', uH[0]?.role === 'homeowner', uH[0]?.role);

    // No designer row
    const [dH] = await conn.query('SELECT id FROM designers WHERE user_id = ?', [homeownerId || 0]);
    log('9.3 No designer for homeowner', dH.length === 0, 'count=' + dH.length);

    // No company profile
    const [cpH] = await conn.query('SELECT id FROM company_profiles WHERE user_id = ?', [homeownerId || 0]);
    log('9.4 No company profile for homeowner', cpH.length === 0, 'count=' + cpH.length);

    // Login + verify
    await conn.query('UPDATE users SET email_verified = 1 WHERE id = ?', [homeownerId]);
    const loginH = await post('/auth/login', { email: HOMEOWNER_EMAIL, password: 'Test123456' });
    log('9.5 Homeowner login', !!loginH.data?.token, loginH.data?.token ? 'OK' : loginH.data?.error);

    // Still no designer after login
    const [dH2] = await conn.query('SELECT id FROM designers WHERE user_id = ?', [homeownerId || 0]);
    log('9.6 Still no designer after homeowner login', dH2.length === 0, 'count=' + dH2.length);

    // ══════════════════════════════════════════════════
    // SECTION 10: Legacy Designer Token Handling
    // ══════════════════════════════════════════════════
    console.log('\n── 10. Legacy Designer Token ──');

    // Create a legacy designer directly in DB
    const legacyHash = await bcrypt.hash('Legacy123', 10);
    await conn.query(
      "INSERT INTO designers (email, password, full_name, email_verified, status, is_approved) VALUES ('e2e-legacy-full@test.com', ?, 'Legacy D', 1, 'approved', 1)",
      [legacyHash]
    );
    const [legacyD] = await conn.query("SELECT id FROM designers WHERE email = 'e2e-legacy-full@test.com'");
    const legacyDesignerId = legacyD[0]?.id;

    // Create a JWT with legacy format { id: designerId } (simulating old designer token)
    // We can't easily create a JWT here without the secret, so test via login which auto-migrates
    const legacyLogin = await post('/auth/login', { email: 'e2e-legacy-full@test.com', password: 'Legacy123' });
    log('10.1 Legacy designer login', !!legacyLogin.data?.token, legacyLogin.data?.token ? 'token OK' : legacyLogin.data?.error);

    // Verify migrated to users table
    const [migratedUser] = await conn.query("SELECT id, role FROM users WHERE email = 'e2e-legacy-full@test.com'");
    log('10.2 Migrated to users table', migratedUser.length > 0, 'id=' + migratedUser[0]?.id);

    // Clean up legacy data
    if (migratedUser[0]?.id) {
      await conn.query('DELETE FROM designers WHERE user_id = ?', [migratedUser[0].id]).catch(() => {});
      await conn.query("DELETE FROM designers WHERE email = 'e2e-legacy-full@test.com'").catch(() => {});
      await conn.query('DELETE FROM users WHERE id = ?', [migratedUser[0].id]).catch(() => {});
    } else {
      await conn.query("DELETE FROM designers WHERE email = 'e2e-legacy-full@test.com'").catch(() => {});
    }

    // ══════════════════════════════════════════════════
    // SECTION 11: Existing Production Data Sanity
    // ══════════════════════════════════════════════════
    console.log('\n── 11. Existing Data Sanity ──');

    // Check that existing approved companies still show in public API
    const pubAll = await get('/projects?page=1&limit=5');
    log('11.1 Public projects still work', pubAll.status === 200 && Array.isArray(pubAll.data?.projects), 'count=' + pubAll.data?.projects?.length);

    const pubCompanies = await get('/designers?page=1&limit=5');
    log('11.2 Public companies still work', pubCompanies.status === 200, 'count=' + pubCompanies.data?.designers?.length);

    // Admin endpoints
    if (adminToken) {
      const adminCompList = await get('/admin/roles/companies?status=all', adminToken);
      log('11.3 Admin company list works', adminCompList.status === 200, 'total=' + adminCompList.data?.total);
    }

  } finally {
    await cleanTestData();
    if (conn) await conn.end();
    stopServer();
  }

  console.log('\n' + '═'.repeat(60));
  if (failed === 0) {
    console.log(`  ✅ ALL PASS: ${passed}/${passed + failed}`);
  } else {
    console.log(`  ❌ RESULT: ${passed}/${passed + failed} PASS, ${failed} FAILED`);
    console.log('\n  Failed tests:');
    failures.forEach(f => console.log('    - ' + f));
  }
  console.log('═'.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  stopServer();
  process.exit(1);
});
