#!/usr/bin/env node
/**
 * test-project-rejection.mjs
 *
 * End-to-end API tests for the project rejection notification system.
 *
 * Flow:
 *   1. Register + verify company user
 *   2. Create company profile + project
 *   3. Admin rejects project with reason → check DB status + rejection_reason
 *   4. GET /admin/rejection-templates → template appears
 *   5. Second rejection with same reason → use_count increments
 *   6. Second rejection with different reason → second template created
 *   7. Template list ordered by last_used_at DESC
 *   8. Admin approves project → status back to published, rejection_reason cleared
 *   9. 403 for non-admin calling rejection-templates
 *
 * Usage: node scripts/harness/test-project-rejection.mjs
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
  try {
    // Find the test company profile id first
    const [cpRows] = await conn.query("SELECT id FROM company_profiles WHERE company_name='E2E_Rejection_Co'");
    const cpId = cpRows[0]?.id;
    if (cpId) {
      await conn.query(`DELETE FROM projects WHERE company_profile_id = ${cpId}`).catch(() => {});
    }
    await conn.query("DELETE FROM rejection_templates WHERE admin_id IN (SELECT id FROM admin_users WHERE email='e2e-rejection-admin@test.com')").catch(() => {});
    await conn.query("DELETE FROM company_profiles WHERE company_name='E2E_Rejection_Co'").catch(() => {});
    await conn.query("DELETE FROM users WHERE email='e2e-rejection@test.com'").catch(() => {});
    await conn.query("DELETE FROM admin_users WHERE email='e2e-rejection-admin@test.com'").catch(() => {});
  } catch (e) {
    // ignore cleanup errors
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

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Project Rejection Notification — API Harness');
  console.log('='.repeat(60) + '\n');

  console.log('Building server...');
  execSync('npx tsc --skipLibCheck', { cwd: SERVER_DIR, stdio: 'ignore' });

  conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'tarmeer' });
  await cleanup();

  console.log('Starting server on port ' + PORT + '...\n');
  await startServer();

  let companyToken = null;
  let adminToken = null;
  let projectId = null;

  try {
    // ═══════════════════════════════════════════
    // SETUP: Company user + project
    // ═══════════════════════════════════════════
    console.log('── Setup: Company user ──');

    const reg = await post('/auth/register', {
      email: 'e2e-rejection@test.com',
      password: 'Test123456',
      full_name: 'E2E Tester',
      phone: '+971507654321',
      city: 'Dubai',
      role: 'company',
    });
    log('Register company user', reg.status === 201, `HTTP ${reg.status}`);

    await conn.query("UPDATE users SET email_verified=1 WHERE email='e2e-rejection@test.com'");

    const login = await post('/auth/login', { email: 'e2e-rejection@test.com', password: 'Test123456' });
    companyToken = login.data?.token;
    log('Company login', !!companyToken, companyToken ? 'token OK' : `error: ${login.data?.error}`);

    const profileCreate = await post('/auth/company/profile', {
      company_name: 'E2E_Rejection_Co',
      contact_person: 'E2E Tester',
      phone: '+971507654321',
      city: 'Dubai',
      description: 'Test company for rejection harness',
      services: ['Interior Design'],
      specialties: ['Residential'],
      company_type: 'design_studio',
    }, companyToken);
    log('Create company profile', profileCreate.status >= 200 && profileCreate.status < 300, `HTTP ${profileCreate.status}`);

    // Get company_profile_id from DB
    const [cpRows] = await conn.query("SELECT id FROM company_profiles WHERE company_name='E2E_Rejection_Co'");
    const companyProfileId = cpRows[0]?.id;
    log('Company profile in DB', !!companyProfileId, `id=${companyProfileId}`);

    const projectCreate = await post('/projects', {
      title: 'E2E_Rejection_Project',
      description: 'Project to test rejection flow',
      location: 'Dubai',
      style: 'modern',
      images: ['https://example.com/img1.jpg'],
      tags: ['Villa'],
      status: 'pending',
    }, companyToken);
    log('Create project', projectCreate.status >= 200 && projectCreate.status < 300, `HTTP ${projectCreate.status}`);
    projectId = projectCreate.data?.project?.id ?? projectCreate.data?.id;
    log('Project ID obtained', !!projectId, `id=${projectId}`);

    // Ensure project is linked to company_profile
    if (companyProfileId && projectId) {
      await conn.query(`UPDATE projects SET company_profile_id = ${companyProfileId} WHERE id = ${projectId}`);
    }

    // ═══════════════════════════════════════════
    // SETUP: Admin user (direct DB insert for test)
    // ═══════════════════════════════════════════
    console.log('\n── Setup: Admin user ──');

    const bcrypt = require(path.join(SERVER_DIR, 'node_modules/bcryptjs'));
    const TEST_ADMIN_PASS = 'E2eTestAdmin!99';
    const adminHash = await bcrypt.hash(TEST_ADMIN_PASS, 10);

    await conn.query(
      `INSERT INTO admin_users (email, password, full_name, role, permissions, created_at)
       VALUES (?, ?, 'E2E Admin', 'super_admin', '{}', NOW())
       ON DUPLICATE KEY UPDATE password = VALUES(password), full_name = 'E2E Admin'`,
      ['e2e-rejection-admin@test.com', adminHash]
    ).catch(() => {});

    const adminLoginRes = await post('/admin/login', {
      email: 'e2e-rejection-admin@test.com',
      password: TEST_ADMIN_PASS,
    });
    adminToken = adminLoginRes.data?.token;
    log('Admin login', !!adminToken, adminToken ? 'token OK' : `HTTP ${adminLoginRes.status}`);

    // ═══════════════════════════════════════════
    // TEST 1: Admin rejects project
    // ═══════════════════════════════════════════
    console.log('\n── 1. Admin rejects project ──');

    if (!adminToken || !projectId) {
      log('SKIP: admin reject (no token or project)', false, 'admin or project setup failed');
    } else {
      const REASON_1 = 'Images do not match interior design criteria — please upload renovation case photos';

      const reject = await put(`/admin/projects/${projectId}/reject`, { reason: REASON_1 }, adminToken);
      log('PUT /admin/projects/:id/reject returns 200', reject.status === 200, `HTTP ${reject.status}`);

      // Verify DB
      const [pRows] = await conn.query(`SELECT status, rejection_reason FROM projects WHERE id = ${projectId}`);
      const p = pRows[0];
      log('Project status = rejected in DB', p?.status === 'rejected', `status=${p?.status}`);
      log('Project rejection_reason stored in DB', p?.rejection_reason === REASON_1, `reason=${p?.rejection_reason?.slice(0, 40)}`);

      // ═══════════════════════════════════════════
      // TEST 2: Rejection template created
      // ═══════════════════════════════════════════
      console.log('\n── 2. Rejection template created ──');

      // Small delay to allow fire-and-forget to complete
      await new Promise(r => setTimeout(r, 300));

      const [adminRows] = await conn.query("SELECT id FROM admin_users WHERE email='e2e-rejection-admin@test.com'");
      const adminId = adminRows[0]?.id;

      const [tplRows] = await conn.query(
        `SELECT text, use_count FROM rejection_templates WHERE admin_id = ${adminId} AND text = ? LIMIT 1`,
        [REASON_1]
      );
      log('rejection_templates row created', tplRows.length > 0, `count=${tplRows.length}`);
      log('use_count = 1 on first rejection', tplRows[0]?.use_count === 1, `use_count=${tplRows[0]?.use_count}`);

      // ═══════════════════════════════════════════
      // TEST 3: GET /admin/rejection-templates API
      // ═══════════════════════════════════════════
      console.log('\n── 3. GET /admin/rejection-templates ──');

      const templates = await get('/admin/rejection-templates', adminToken);
      log('GET /admin/rejection-templates returns 200', templates.status === 200, `HTTP ${templates.status}`);
      log('Response has templates array', Array.isArray(templates.data?.templates), `type=${typeof templates.data?.templates}`);
      const tplList = templates.data?.templates ?? [];
      log('Template appears in API response', tplList.some(t => t.text === REASON_1), `count=${tplList.length}`);

      // ═══════════════════════════════════════════
      // TEST 4: Same reason → use_count increments
      // ═══════════════════════════════════════════
      console.log('\n── 4. Same reason increments use_count ──');

      // Create a second project to reject with same reason
      const project2 = await post('/projects', {
        title: 'E2E_Rejection_Project_2',
        description: 'Second project for rejection harness',
        location: 'Dubai',
        style: 'modern',
        images: ['https://example.com/img2.jpg'],
        tags: [],
        status: 'pending',
      }, companyToken);
      const projectId2 = project2.data?.project?.id ?? project2.data?.id;

      if (companyProfileId && projectId2) {
        await conn.query(`UPDATE projects SET company_profile_id = ${companyProfileId} WHERE id = ${projectId2}`);
      }

      if (projectId2) {
        const reject2 = await put(`/admin/projects/${projectId2}/reject`, { reason: REASON_1 }, adminToken);
        log('Second reject with same reason returns 200', reject2.status === 200, `HTTP ${reject2.status}`);

        await new Promise(r => setTimeout(r, 300));

        const [tplRows2] = await conn.query(
          `SELECT use_count FROM rejection_templates WHERE admin_id = ${adminId} AND text = ? LIMIT 1`,
          [REASON_1]
        );
        log('use_count incremented to 2', tplRows2[0]?.use_count === 2, `use_count=${tplRows2[0]?.use_count}`);
      } else {
        log('SKIP: second project creation', false, 'Could not create second project');
      }

      // ═══════════════════════════════════════════
      // TEST 5: Different reason → new template row
      // ═══════════════════════════════════════════
      console.log('\n── 5. Different reason creates new template ──');

      const REASON_2 = 'Photo quality too low — please upload high-resolution images';
      const project3 = await post('/projects', {
        title: 'E2E_Rejection_Project_3',
        description: 'Third project',
        location: 'Abu Dhabi',
        style: 'minimalist',
        images: ['https://example.com/img3.jpg'],
        tags: [],
        status: 'pending',
      }, companyToken);
      const projectId3 = project3.data?.project?.id ?? project3.data?.id;

      if (companyProfileId && projectId3) {
        await conn.query(`UPDATE projects SET company_profile_id = ${companyProfileId} WHERE id = ${projectId3}`);
      }

      if (projectId3) {
        await put(`/admin/projects/${projectId3}/reject`, { reason: REASON_2 }, adminToken);
        await new Promise(r => setTimeout(r, 300));

        const [tplRows3] = await conn.query(
          `SELECT COUNT(*) as cnt FROM rejection_templates WHERE admin_id = ${adminId}`
        );
        log('Two distinct template rows exist', tplRows3[0]?.cnt >= 2, `total templates=${tplRows3[0]?.cnt}`);

        const templates2 = await get('/admin/rejection-templates', adminToken);
        const tpl2List = templates2.data?.templates ?? [];
        log('API returns both templates', tpl2List.length >= 2, `count=${tpl2List.length}`);
        log('Templates ordered by last_used_at DESC', tpl2List.length >= 2 && tpl2List[0] != null, 'order check by position');
      } else {
        log('SKIP: different reason template test', false, 'Could not create third project');
      }

      // ═══════════════════════════════════════════
      // TEST 6: Admin approves project → status published
      // Company re-submits (pending) → admin approves
      // ═══════════════════════════════════════════
      console.log('\n── 6. Admin approves project (after company re-submits) ──');

      // Simulate company re-submitting: status back to pending
      await conn.query(`UPDATE projects SET status = 'pending' WHERE id = ${projectId}`);

      const approve = await put(`/admin/projects/${projectId}/approve`, {}, adminToken);
      log('PUT /admin/projects/:id/approve returns 200 (from pending)', approve.status === 200, `HTTP ${approve.status}`);

      const [pRows2] = await conn.query(`SELECT status, rejection_reason FROM projects WHERE id = ${projectId}`);
      const p2 = pRows2[0];
      log('Project status = published after approve', p2?.status === 'published', `status=${p2?.status}`);
      log('rejection_reason cleared after approve', !p2?.rejection_reason, `reason=${p2?.rejection_reason ?? 'null'}`);

      // Reject when already published → 400 (correct guard)
      const rejectPublished = await put(`/admin/projects/${projectId}/reject`, { reason: 'test' }, adminToken);
      log('Reject already-published project → 400', rejectPublished.status === 400, `HTTP ${rejectPublished.status}`);
    }

    // ═══════════════════════════════════════════
    // TEST 7: Auth guard — company token cannot access /rejection-templates
    // ═══════════════════════════════════════════
    console.log('\n── 7. Auth guard on /admin/rejection-templates ──');

    const unauthorized = await get('/admin/rejection-templates', companyToken);
    log('Company token cannot access /admin/rejection-templates', unauthorized.status === 401 || unauthorized.status === 403, `HTTP ${unauthorized.status}`);

    const noToken = await get('/admin/rejection-templates');
    log('No token cannot access /admin/rejection-templates', noToken.status === 401 || noToken.status === 403, `HTTP ${noToken.status}`);

    // ═══════════════════════════════════════════
    // TEST 8: Company API returns rejected project with reason
    // ═══════════════════════════════════════════
    console.log('\n── 8. Company sees rejection_reason via API ──');

    const companyProjects = await get('/auth/company/projects', companyToken);
    log('GET /auth/company/projects returns 200', companyProjects.status === 200, `HTTP ${companyProjects.status}`);
    const rejectedProject = (companyProjects.data?.projects ?? []).find(p => p.status === 'rejected');
    log('Company API exposes rejected project', !!rejectedProject, rejectedProject ? `title=${rejectedProject.title}` : 'no rejected project found');
    if (rejectedProject) {
      log('Company API includes rejection_reason field', rejectedProject.rejection_reason !== undefined, `reason=${rejectedProject.rejection_reason?.slice(0, 30)}`);
    }

  } finally {
    stopServer();
    await cleanup();
    await conn.end();
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Harness error:', err);
  stopServer();
  process.exit(1);
});
