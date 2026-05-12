#!/usr/bin/env node
/**
 * test-tag-system.mjs
 *
 * End-to-end API tests for the Tag System Overhaul (Phase 1 + 2 + 3 + 4).
 *
 * Covers:
 *   1. tagTaxonomy.ts exports are complete (20 services, 4 L1 groups, correct L2 counts)
 *   2. POST /projects with service_tags — stored and returned correctly
 *   3. PUT /projects/:id with service_tags — updates correctly
 *   4. GET /auth/company/projects returns service_tags for each project
 *   5. GET /api/public/companies uses specialties flat array (no regression)
 *   6. CompanyProfileForm backward compat: specialties field stores flat L2 values
 *   7. Auth guards: 401 without token, 403 wrong user
 *   8. (Phase 3) POST /projects with {url, tag} image objects — tag persisted in DB
 *   9. (Phase 3) PUT /projects/:id with updated per-image tags
 *  10. (Phase 3) GET /auth/company/projects returns images with tag field
 *  11. (Phase 3) Plain-string images (no tag) are backward-compatible
 *  12. (Phase 4) GET /api/companies?space= filters by L2 specialties (JSON_OVERLAPS)
 *
 * Usage: node scripts/harness/test-tag-system.mjs
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

// Unique suffix per run to avoid conflicts with leftover test data
const RUN_ID = Date.now();
const TEST_EMAIL = `e2e-tagsystem-${RUN_ID}@test.com`;
const TEST_PHONE = `+9715${String(RUN_ID).slice(-8)}`;  // UAE mobile format (+971 5XXXXXXXX = 13 chars), unique per run

let conn;
let serverProcess;
let passed = 0;
let failed = 0;

/** Convert a DB column value to string (handles Buffer from mysql2) */
function dbStr(val) {
  if (val === null || val === undefined) return '';
  if (Buffer.isBuffer(val)) return val.toString('utf8');
  return String(val);
}

/** Safely parse a DB field that may be JSON array or legacy comma-separated string.
 *  mysql2 may already auto-parse JSON columns into JS arrays/objects. */
function parseDbArray(raw) {
  if (Array.isArray(raw)) return raw;      // already parsed by mysql2
  const s = dbStr(raw).trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try { return JSON.parse(s); } catch { return []; }
  }
  // Legacy CSV format
  return s.split(',').map(v => v.trim()).filter(Boolean);
}

/** Parse a DB JSON field that must be an array (images).
 *  mysql2 may already auto-parse JSON columns into JS arrays. */
function parseDbJson(raw) {
  if (Array.isArray(raw)) return raw;      // already parsed by mysql2
  const s = dbStr(raw).trim();
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

function log(tc, ok, detail) {
  console.log((ok ? '✅' : '❌') + ' ' + tc + (detail ? ': ' + detail : ''));
  if (ok) passed++; else failed++;
}

async function cleanup() {
  if (!conn) return;
  try {
    const [cpRows] = await conn.query(`SELECT id FROM company_profiles WHERE company_name='E2E_TagSystem_Co_${RUN_ID}'`);
    const cpId = cpRows[0]?.id;
    if (cpId) {
      await conn.query(`DELETE FROM projects WHERE company_profile_id = ${cpId}`).catch(() => {});
    }
    // Cleanup any orphaned test projects by title (use LIKE pattern for this run)
    await conn.query(
      `DELETE FROM projects WHERE title IN ('E2E_PerImageTag_Project_${RUN_ID}','E2E_LegacyImages_Project_${RUN_ID}','E2E_Old_Project_${RUN_ID}')`
    ).catch(() => {});
    await conn.query(`DELETE FROM company_profiles WHERE company_name='E2E_TagSystem_Co_${RUN_ID}'`).catch(() => {});
    await conn.query(`DELETE FROM users WHERE email='${TEST_EMAIL}'`).catch(() => {});
  } catch { /* ignore */ }
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
  console.log('  Tag System Overhaul — API Harness');
  console.log('='.repeat(60) + '\n');

  // ═══════════════════════════════════════════
  // TC-0: Static taxonomy validation (no server needed)
  // ═══════════════════════════════════════════
  console.log('── TC-0: Taxonomy static validation ──');

  const { SPACE_TAXONOMY, SERVICE_GROUPS, ALL_SPACE_TAGS, ALL_SERVICES, getL1ForTag }
    = await import(path.join(ROOT, 'src/lib/tagTaxonomy.ts')).catch(() => ({}));

  if (!SPACE_TAXONOMY) {
    // Fallback: load via require with tsx or via transpiled output
    log('TC-0.0 tagTaxonomy.ts imports', false, 'Cannot import .ts directly — verify via tsc');
  } else {
    log('TC-0.1 SPACE_TAXONOMY has 4 L1 groups', SPACE_TAXONOMY.length === 4, `got ${SPACE_TAXONOMY.length}`);

    const l1Ids = SPACE_TAXONOMY.map(g => g.id);
    log('TC-0.2 L1 IDs correct', JSON.stringify(l1Ids) === JSON.stringify(['residential','commercial','public','outdoor']),
      `ids=${l1Ids.join(',')}`);

    const residentialTags = SPACE_TAXONOMY.find(g => g.id === 'residential')?.tags ?? [];
    log('TC-0.3 Residential has 4 L2 tags', residentialTags.length === 4, `count=${residentialTags.length}`);

    const commercialTags = SPACE_TAXONOMY.find(g => g.id === 'commercial')?.tags ?? [];
    log('TC-0.4 Commercial has 7 L2 tags', commercialTags.length === 7, `count=${commercialTags.length}`);

    log('TC-0.5 SERVICE_GROUPS has 6 groups', SERVICE_GROUPS.length === 6, `got ${SERVICE_GROUPS.length}`);

    const totalServices = SERVICE_GROUPS.reduce((s, g) => s + g.tags.length, 0);
    log('TC-0.6 Total service tags = 20', totalServices === 20, `got ${totalServices}`);

    log('TC-0.7 ALL_SPACE_TAGS is flat array', Array.isArray(ALL_SPACE_TAGS), `type=${typeof ALL_SPACE_TAGS}`);
    log('TC-0.8 ALL_SPACE_TAGS length = 25', ALL_SPACE_TAGS.length === 25,
      `got ${ALL_SPACE_TAGS.length} (4+7+8+6)`);

    log('TC-0.9 ALL_SERVICES length = 20', ALL_SERVICES.length === 20, `got ${ALL_SERVICES.length}`);

    log('TC-0.10 getL1ForTag("Villa") = residential', getL1ForTag('Villa') === 'residential',
      `got ${getL1ForTag('Villa')}`);
    log('TC-0.11 getL1ForTag("Restaurant") = commercial', getL1ForTag('Restaurant') === 'commercial',
      `got ${getL1ForTag('Restaurant')}`);
    log('TC-0.12 getL1ForTag("unknown") = null', getL1ForTag('unknown') === null,
      `got ${getL1ForTag('unknown')}`);

    // All service tag names are unique
    const serviceNames = SERVICE_GROUPS.flatMap(g => g.tags);
    const uniqueServiceNames = new Set(serviceNames);
    log('TC-0.13 All service tag names are unique', serviceNames.length === uniqueServiceNames.size,
      `${serviceNames.length} tags, ${uniqueServiceNames.size} unique`);

    // Check specific new tags exist
    log('TC-0.14 "Design & Planning" is a service tag', serviceNames.includes('Design & Planning'), '');
    log('TC-0.15 "Kitchen & Bath Renovation" is a service tag', serviceNames.includes('Kitchen & Bath Renovation'), '');
    log('TC-0.16 "Pools & Water Features" is a service tag', serviceNames.includes('Pools & Water Features'), '');
    log('TC-0.17 "Water Purification" is a service tag', serviceNames.includes('Water Purification'), '');
  }

  console.log('\nBuilding server...');
  execSync('npx tsc --skipLibCheck', { cwd: SERVER_DIR, stdio: 'ignore' });

  conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'tarmeer' });
  await cleanup();

  console.log('Starting server on port ' + PORT + '...\n');
  await startServer();

  let companyToken = null;
  let projectId = null;
  let companyProfileId = null;

  try {
    // ═══════════════════════════════════════════
    // SETUP: Company user + profile
    // ═══════════════════════════════════════════
    console.log('── Setup: Company user ──');

    const reg = await post('/auth/register', {
      email: TEST_EMAIL,
      password: 'Test123456',
      full_name: 'TagSystem Tester',
      phone: TEST_PHONE,
      city: 'Dubai',
      role: 'company',
    });
    log('Register company user', reg.status === 201, `HTTP ${reg.status}`);

    await conn.query(`UPDATE users SET email_verified=1 WHERE email='${TEST_EMAIL}'`);

    const login = await post('/auth/login', { email: TEST_EMAIL, password: 'Test123456' });
    companyToken = login.data?.token;
    log('Company login', !!companyToken, companyToken ? 'token OK' : `error: ${login.data?.error}`);

    const profileCreate = await post('/auth/company/profile', {
      company_name: `E2E_TagSystem_Co_${RUN_ID}`,
      contact_person: 'TagSystem Tester',
      phone: TEST_PHONE,
      city: 'Dubai',
      description: 'Test company for tag system harness',
      services: ['Interior Design', 'Renovation'],  // valid values from company_services table
      specialties: ['Villa', 'Residential'],  // valid VALID_SPECIALTIES values
      company_type: 'design_studio',
    }, companyToken);
    log('Create company profile with new services', profileCreate.status >= 200 && profileCreate.status < 300,
      profileCreate.status >= 400 ? `HTTP ${profileCreate.status} — ${JSON.stringify(profileCreate.data)}` : `HTTP ${profileCreate.status}`);

    const [cpRows] = await conn.query(`SELECT id FROM company_profiles WHERE company_name='E2E_TagSystem_Co_${RUN_ID}'`);
    companyProfileId = cpRows[0]?.id;
    log('Company profile in DB', !!companyProfileId, `id=${companyProfileId}`);

    // Verify specialties stored as flat array (no regression)
    const [cpData] = await conn.query(`SELECT specialties FROM company_profiles WHERE id = ?`, [companyProfileId]);
    const storedSpecialties = parseDbArray(cpData[0]?.specialties);
    log('Specialties stored as flat JSON array', Array.isArray(storedSpecialties), `type=${typeof storedSpecialties}`);
    log('Specialties contain L2 values (Villa, Residential)', storedSpecialties.includes('Villa') || storedSpecialties.includes('Residential'),
      `stored=${JSON.stringify(storedSpecialties)}`);

    // ═══════════════════════════════════════════
    // TC-1: POST /projects with service_tags
    // ═══════════════════════════════════════════
    console.log('\n── TC-1: Create project with service_tags ──');

    const SERVICE_TAGS = ['Design & Planning', 'Flooring & Carpet', 'Smart Home'];
    const SPACE_TAGS = ['Villa', 'Apartment'];

    const projectCreate = await post('/projects', {
      title: `E2E_TagSystem_Project_${RUN_ID}`,
      description: 'Project to test tag system',
      location: 'Dubai',
      style: 'modern',
      images: ['https://example.com/img1.jpg'],
      tags: SPACE_TAGS,
      service_tags: SERVICE_TAGS,
      status: 'pending',
    }, companyToken);

    log('TC-1.1 POST /projects with service_tags returns 2xx', projectCreate.status >= 200 && projectCreate.status < 300, `HTTP ${projectCreate.status}`);
    projectId = projectCreate.data?.project?.id ?? projectCreate.data?.id;
    log('TC-1.2 Project ID returned', !!projectId, `id=${projectId}`);

    const returnedProject = projectCreate.data?.project;
    if (returnedProject) {
      const returnedServiceTags = returnedProject.service_tags ?? [];
      log('TC-1.3 service_tags returned in create response', Array.isArray(returnedServiceTags), `type=${typeof returnedServiceTags}`);
      log('TC-1.4 service_tags contain all submitted values',
        SERVICE_TAGS.every(t => returnedServiceTags.includes(t)),
        `returned=${JSON.stringify(returnedServiceTags)}`);

      const returnedTags = returnedProject.tags ?? [];
      log('TC-1.5 space tags (tags) returned correctly',
        SPACE_TAGS.every(t => returnedTags.includes(t)),
        `returned=${JSON.stringify(returnedTags)}`);
    } else {
      log('TC-1.3 service_tags in create response', false, 'no project in response');
      log('TC-1.4 service_tags values', false, 'skipped');
      log('TC-1.5 space tags', false, 'skipped');
    }

    // Verify DB directly
    if (projectId) {
      if (companyProfileId) {
        await conn.query(`UPDATE projects SET company_profile_id = ${companyProfileId} WHERE id = ${projectId}`);
      }
      const [dbRows] = await conn.query(`SELECT tags, service_tags FROM projects WHERE id = ${projectId}`);
      const dbProject = dbRows[0];
      const dbTags = parseDbArray(dbProject?.tags);
      const dbServiceTags = parseDbArray(dbProject?.service_tags);

      log('TC-1.6 service_tags stored in DB as JSON', Array.isArray(dbServiceTags), `raw=${dbProject?.service_tags}`);
      log('TC-1.7 service_tags in DB match submitted',
        SERVICE_TAGS.every(t => dbServiceTags.includes(t)),
        `db=${JSON.stringify(dbServiceTags)}`);
      log('TC-1.8 space tags in DB match submitted',
        SPACE_TAGS.every(t => dbTags.includes(t)),
        `db=${JSON.stringify(dbTags)}`);
    }

    // ═══════════════════════════════════════════
    // TC-2: PUT /projects/:id updates service_tags
    // ═══════════════════════════════════════════
    console.log('\n── TC-2: Update project service_tags ──');

    if (projectId) {
      const UPDATED_SERVICE_TAGS = ['Joinery & Custom Cabinetry', 'Waterproofing'];
      const UPDATED_SPACE_TAGS = ['Office'];

      const projectUpdate = await put(`/projects/${projectId}`, {
        title: `E2E_TagSystem_Project_${RUN_ID}_Updated`,
        description: 'Updated',
        location: 'Dubai',
        style: 'modern',
        images: ['https://example.com/img1.jpg'],
        tags: UPDATED_SPACE_TAGS,
        service_tags: UPDATED_SERVICE_TAGS,
        status: 'draft',
      }, companyToken);

      log('TC-2.1 PUT /projects/:id with service_tags returns 2xx',
        projectUpdate.status >= 200 && projectUpdate.status < 300, `HTTP ${projectUpdate.status}`);

      const updatedProject = projectUpdate.data?.project;
      if (updatedProject) {
        const updatedServiceTags = updatedProject.service_tags ?? [];
        log('TC-2.2 Updated service_tags returned',
          UPDATED_SERVICE_TAGS.every(t => updatedServiceTags.includes(t)),
          `returned=${JSON.stringify(updatedServiceTags)}`);
        log('TC-2.3 Old service_tags removed',
          !updatedServiceTags.includes('Design & Planning'),
          `still has Design & Planning: ${updatedServiceTags.includes('Design & Planning')}`);
      } else {
        log('TC-2.2 Updated service_tags returned', false, 'no project in response');
        log('TC-2.3 Old service_tags removed', false, 'skipped');
      }

      // Verify DB
      const [dbRows2] = await conn.query(`SELECT service_tags, tags FROM projects WHERE id = ${projectId}`);
      const dbServiceTags2 = parseDbArray(dbRows2[0]?.service_tags);
      log('TC-2.4 service_tags updated in DB',
        UPDATED_SERVICE_TAGS.every(t => dbServiceTags2.includes(t)),
        `db=${JSON.stringify(dbServiceTags2)}`);
    } else {
      log('TC-2.1 Update project', false, 'no project to update');
      log('TC-2.2 service_tags updated', false, 'skipped');
      log('TC-2.3 Old service_tags removed', false, 'skipped');
      log('TC-2.4 DB check', false, 'skipped');
    }

    // ═══════════════════════════════════════════
    // TC-3: GET /auth/company/projects returns service_tags
    // ═══════════════════════════════════════════
    console.log('\n── TC-3: GET company projects includes service_tags ──');

    const myProjects = await get('/auth/company/projects', companyToken);
    log('TC-3.1 GET /auth/company/projects returns 200', myProjects.status === 200, `HTTP ${myProjects.status}`);

    const projectsList = myProjects.data?.projects ?? [];
    log('TC-3.2 Projects list is array', Array.isArray(projectsList), `type=${typeof projectsList}`);

    const myProject = projectsList.find(p => p.title === `E2E_TagSystem_Project_${RUN_ID}_Updated` || p.title === `E2E_TagSystem_Project_${RUN_ID}`);
    log('TC-3.3 Test project in list', !!myProject, `found=${!!myProject}, total=${projectsList.length}`);

    if (myProject) {
      log('TC-3.4 service_tags field present in list response',
        'service_tags' in myProject,
        `keys=${Object.keys(myProject).filter(k => k.includes('tag')).join(',')}`);
      log('TC-3.5 service_tags is array in list response',
        Array.isArray(myProject.service_tags),
        `type=${typeof myProject.service_tags}`);
    } else {
      log('TC-3.4 service_tags in list', false, 'project not found');
      log('TC-3.5 service_tags is array', false, 'skipped');
    }

    // ═══════════════════════════════════════════
    // TC-4: service_tags default to empty array for old projects
    // ═══════════════════════════════════════════
    console.log('\n── TC-4: service_tags defaults to [] for projects without it ──');

    // Insert a bare-minimum project row without service_tags
    const [insertResult] = await conn.query(
      `INSERT INTO projects (company_profile_id, title, description, style, location, images, tags, status)
       VALUES (?, 'E2E_Old_Project_${RUN_ID}', '', 'modern', 'Dubai', '["https://example.com/old.jpg"]', '[]', 'draft')`,
      [companyProfileId || null]
    );
    const oldProjectId = insertResult.insertId;

    const myProjects2 = await get('/auth/company/projects', companyToken);
    const oldProject = (myProjects2.data?.projects ?? []).find(p => p.id === oldProjectId);
    log('TC-4.1 Old project (no service_tags column) appears in list', !!oldProject, `id=${oldProjectId}`);
    if (oldProject) {
      console.log('DEBUG TC-4 full project:', JSON.stringify(oldProject));
      log('TC-4.2 service_tags field is empty array for old project',
        Array.isArray(oldProject.service_tags) && oldProject.service_tags.length === 0,
        `service_tags=${JSON.stringify(oldProject.service_tags)}`);
    } else {
      log('TC-4.2 service_tags default', false, 'old project not found in response');
    }

    // Cleanup old project
    await conn.query(`DELETE FROM projects WHERE id = ${oldProjectId}`).catch(() => {});

    // ═══════════════════════════════════════════
    // TC-5: Auth guards
    // ═══════════════════════════════════════════
    console.log('\n── TC-5: Auth guards ──');

    if (projectId) {
      const noToken = await put(`/projects/${projectId}`, {
        title: 'hack', description: '', location: 'Dubai', style: 'modern',
        images: ['https://example.com/img1.jpg'], tags: [], service_tags: [], status: 'draft',
      });
      log('TC-5.1 PUT /projects without token → 401', noToken.status === 401, `HTTP ${noToken.status}`);
    }

    const noTokenGet = await get('/auth/company/projects');
    log('TC-5.2 GET /auth/company/projects without token → 401', noTokenGet.status === 401, `HTTP ${noTokenGet.status}`);

    // ═══════════════════════════════════════════
    // TC-6: POST /projects with per-image tags ({url, tag} objects)
    // ═══════════════════════════════════════════
    console.log('\n── TC-6: POST /projects with per-image tags ──');

    const TAGGED_IMG_URL = 'https://example.com/living-room.jpg';
    const PLAIN_IMG_URL  = 'https://example.com/plain.jpg';
    const IMG_TAG        = 'Living Room';

    // Submit a mixed images array: one tagged object + one plain string
    const taggedProjectCreate = await post('/projects', {
      title: `E2E_PerImageTag_Project_${RUN_ID}`,
      description: 'Phase 3 per-image tag test',
      location: 'Dubai',
      style: 'modern',
      images: [
        { url: TAGGED_IMG_URL, tag: IMG_TAG },
        PLAIN_IMG_URL,
      ],
      tags: ['Villa'],
      service_tags: ['Design & Planning'],
      status: 'draft',
    }, companyToken);

    log('TC-6.1 POST with {url,tag} image object returns 2xx',
      taggedProjectCreate.status >= 200 && taggedProjectCreate.status < 300,
      `HTTP ${taggedProjectCreate.status}`);

    const taggedProjectId = taggedProjectCreate.data?.project?.id ?? taggedProjectCreate.data?.id;
    log('TC-6.2 Tagged project ID returned', !!taggedProjectId, `id=${taggedProjectId}`);

    if (taggedProjectId && companyProfileId) {
      await conn.query(`UPDATE projects SET company_profile_id = ${companyProfileId} WHERE id = ${taggedProjectId}`);
    }

    // Check response images
    const createdProject = taggedProjectCreate.data?.project;
    if (createdProject) {
      const respImages = createdProject.images ?? [];
      const taggedEntry = respImages.find(img =>
        (typeof img === 'object' && img.url === TAGGED_IMG_URL) ||
        (typeof img === 'string' && img === TAGGED_IMG_URL)
      );
      const plainEntry = respImages.find(img =>
        (typeof img === 'object' && img.url === PLAIN_IMG_URL) ||
        (typeof img === 'string' && img === PLAIN_IMG_URL)
      );

      log('TC-6.3 Tagged image present in response', !!taggedEntry,
        `images=${JSON.stringify(respImages)}`);
      log('TC-6.4 Tagged image has correct tag value',
        typeof taggedEntry === 'object' && taggedEntry?.tag === IMG_TAG,
        `entry=${JSON.stringify(taggedEntry)}`);
      log('TC-6.5 Plain-string image still in response', !!plainEntry,
        `plainEntry=${JSON.stringify(plainEntry)}`);
    } else {
      log('TC-6.3 Tagged image in response', false, 'no project object in response body');
      log('TC-6.4 Tag value correct', false, 'skipped');
      log('TC-6.5 Plain image in response', false, 'skipped');
    }

    // Verify DB stores the tag
    if (taggedProjectId) {
      const [taggedDbRows] = await conn.query(`SELECT images FROM projects WHERE id = ${taggedProjectId}`);
      const dbImages = parseDbJson(taggedDbRows[0]?.images);
      const dbTaggedEntry = dbImages.find(img =>
        (typeof img === 'object' && img.url === TAGGED_IMG_URL) ||
        (typeof img === 'string' && img === TAGGED_IMG_URL)
      );
      const dbPlainEntry = dbImages.find(img =>
        (typeof img === 'object' && img.url === PLAIN_IMG_URL) ||
        (typeof img === 'string' && img === PLAIN_IMG_URL)
      );

      log('TC-6.6 Tagged image object stored in DB',
        typeof dbTaggedEntry === 'object' && dbTaggedEntry?.tag === IMG_TAG,
        `db=${JSON.stringify(dbTaggedEntry)}`);
      log('TC-6.7 Plain image stored in DB (string or object without tag)',
        !!dbPlainEntry,
        `db=${JSON.stringify(dbPlainEntry)}`);
      log('TC-6.8 Plain image has no tag field in DB',
        !(typeof dbPlainEntry === 'object' && dbPlainEntry?.tag),
        `db=${JSON.stringify(dbPlainEntry)}`);
      log('TC-6.9 DB does NOT contain raw base64 for any image',
        dbImages.every(img => {
          const url = typeof img === 'string' ? img : img?.url ?? '';
          return !url.startsWith('data:');
        }),
        `images count=${dbImages.length}`);
    } else {
      log('TC-6.6 DB stores tag', false, 'no project ID');
      log('TC-6.7 Plain image in DB', false, 'skipped');
      log('TC-6.8 No spurious tag on plain image', false, 'skipped');
      log('TC-6.9 No base64 in DB', false, 'skipped');
    }

    // ═══════════════════════════════════════════
    // TC-7: PUT /projects/:id — update per-image tags
    // ═══════════════════════════════════════════
    console.log('\n── TC-7: PUT /projects/:id updates per-image tags ──');

    const UPDATED_IMG_TAG = 'Master Bedroom';

    if (taggedProjectId) {
      const taggedProjectUpdate = await put(`/projects/${taggedProjectId}`, {
        title: `E2E_PerImageTag_Project_${RUN_ID}`,
        description: 'Phase 3 per-image tag test (updated)',
        location: 'Dubai',
        style: 'modern',
        images: [
          { url: TAGGED_IMG_URL, tag: UPDATED_IMG_TAG },
          { url: PLAIN_IMG_URL, tag: 'Guest Room' },
        ],
        tags: ['Villa'],
        service_tags: ['Design & Planning'],
        status: 'draft',
      }, companyToken);

      log('TC-7.1 PUT with updated per-image tags returns 2xx',
        taggedProjectUpdate.status >= 200 && taggedProjectUpdate.status < 300,
        `HTTP ${taggedProjectUpdate.status}`);

      const updatedProject = taggedProjectUpdate.data?.project;
      if (updatedProject) {
        const updatedImages = updatedProject.images ?? [];
        const updatedEntry = updatedImages.find(img =>
          typeof img === 'object' && img.url === TAGGED_IMG_URL
        );
        log('TC-7.2 Updated tag reflected in response',
          updatedEntry?.tag === UPDATED_IMG_TAG,
          `entry=${JSON.stringify(updatedEntry)}`);
        const formerPlain = updatedImages.find(img =>
          typeof img === 'object' && img.url === PLAIN_IMG_URL
        );
        log('TC-7.3 Previously-plain image now has tag in response',
          formerPlain?.tag === 'Guest Room',
          `entry=${JSON.stringify(formerPlain)}`);
      } else {
        log('TC-7.2 Updated tag in response', false, 'no project object in response');
        log('TC-7.3 Formerly-plain image now tagged', false, 'skipped');
      }

      // DB check after update
      const [updatedDbRows] = await conn.query(`SELECT images FROM projects WHERE id = ${taggedProjectId}`);
      const updatedDbImages = parseDbJson(updatedDbRows[0]?.images);
      const updatedDbEntry = updatedDbImages.find(img =>
        typeof img === 'object' && img.url === TAGGED_IMG_URL
      );
      log('TC-7.4 Updated tag persisted to DB',
        updatedDbEntry?.tag === UPDATED_IMG_TAG,
        `db=${JSON.stringify(updatedDbEntry)}`);
    } else {
      log('TC-7.1 PUT with updated tags', false, 'no tagged project to update');
      log('TC-7.2 Updated tag in response', false, 'skipped');
      log('TC-7.3 Formerly-plain image now tagged', false, 'skipped');
      log('TC-7.4 Updated tag in DB', false, 'skipped');
    }

    // ═══════════════════════════════════════════
    // TC-8: GET /auth/company/projects returns images with tags
    // ═══════════════════════════════════════════
    console.log('\n── TC-8: GET /auth/company/projects returns images with tags ──');

    const projectsList2 = await get('/auth/company/projects', companyToken);
    log('TC-8.1 GET /auth/company/projects returns 200',
      projectsList2.status === 200, `HTTP ${projectsList2.status}`);

    const taggedProjectInList = (projectsList2.data?.projects ?? []).find(
      p => p.id === taggedProjectId
    );
    log('TC-8.2 Tagged project found in list', !!taggedProjectInList,
      `id=${taggedProjectId}, total=${projectsList2.data?.projects?.length}`);

    if (taggedProjectInList) {
      const listImages = taggedProjectInList.images ?? [];
      const listTaggedEntry = listImages.find(img =>
        typeof img === 'object' && img.url === TAGGED_IMG_URL
      );
      log('TC-8.3 Tagged image object in GET list response',
        typeof listTaggedEntry === 'object' && !!listTaggedEntry?.tag,
        `entry=${JSON.stringify(listTaggedEntry)}`);
      log('TC-8.4 Tag value correct in list response',
        listTaggedEntry?.tag === UPDATED_IMG_TAG,
        `tag=${listTaggedEntry?.tag}`);
    } else {
      log('TC-8.3 Tagged image in list response', false, 'project not found in list');
      log('TC-8.4 Tag value in list', false, 'skipped');
    }

    // ═══════════════════════════════════════════
    // TC-9: Backward compat — plain-string images survive round-trip
    // ═══════════════════════════════════════════
    console.log('\n── TC-9: Backward compat — plain-string images round-trip ──');

    // Insert a legacy project with images stored as a plain JSON string array (no tags)
    const [legacyInsert] = await conn.query(
      `INSERT INTO projects (company_profile_id, title, description, style, location, images, tags, service_tags, status)
       VALUES (?, ?, '', 'modern', 'Dubai',
               '["https://example.com/legacy1.jpg","https://example.com/legacy2.jpg"]',
               '[]', '[]', 'draft')`,
      [companyProfileId || null, `E2E_LegacyImages_Project_${RUN_ID}`]
    );
    const legacyProjectId = legacyInsert.insertId;

    // PUT to update (simulates designer re-saving without touching images)
    const legacyPut = await put(`/projects/${legacyProjectId}`, {
      title: `E2E_LegacyImages_Project_${RUN_ID}`,
      description: 'Updated description only',
      location: 'Dubai',
      style: 'modern',
      images: ['https://example.com/legacy1.jpg', 'https://example.com/legacy2.jpg'],
      tags: [],
      service_tags: [],
      status: 'draft',
    }, companyToken);

    log('TC-9.1 PUT with plain-string images (legacy) returns 2xx',
      legacyPut.status >= 200 && legacyPut.status < 300, `HTTP ${legacyPut.status}`);

    const [legacyDbAfter] = await conn.query(`SELECT images FROM projects WHERE id = ${legacyProjectId}`);
    const legacyDbImages = parseDbJson(legacyDbAfter[0]?.images);
    log('TC-9.2 Legacy images preserved after PUT (no data loss)',
      legacyDbImages.length === 2, `count=${legacyDbImages.length}`);
    log('TC-9.3 Legacy images have no spurious tag field',
      legacyDbImages.every(img => !(typeof img === 'object' && img?.tag)),
      `images=${JSON.stringify(legacyDbImages)}`);

    // GET list — legacy images appear without tag
    const legacyList = await get('/auth/company/projects', companyToken);
    const legacyInList = (legacyList.data?.projects ?? []).find(p => p.id === legacyProjectId);
    if (legacyInList) {
      const legacyListImages = legacyInList.images ?? [];
      log('TC-9.4 Legacy images in GET list have no tag field',
        legacyListImages.every(img => !(typeof img === 'object' && img?.tag)),
        `images=${JSON.stringify(legacyListImages)}`);
    } else {
      log('TC-9.4 Legacy images in GET list', false, 'legacy project not found in list');
    }

    // Cleanup tagged project and legacy project
    if (taggedProjectId) await conn.query(`DELETE FROM projects WHERE id = ${taggedProjectId}`).catch(() => {});
    await conn.query(`DELETE FROM projects WHERE id = ${legacyProjectId}`).catch(() => {});

    // ─────────────────────────────────────────────────────────────
    // TC-10: Phase 4 — GET /api/companies ?space= filter
    // ─────────────────────────────────────────────────────────────
    console.log('\n── TC-10: GET /api/companies ?space= filter (backend) ──');

    // Insert two test rows into uae_companies — one residential, one commercial
    const TS = `e2e_phase4_${RUN_ID}`;
    let testCompanyResId, testCompanyComId;
    try {
      const [resInsert] = await conn.query(
        `INSERT INTO uae_companies (slug, name_en, description, city, is_active, specialties, services, weight_score)
         VALUES (?, ?, 'E2E test residential', 'Dubai', 1, '["Villa","Apartment"]', '["Interior Design"]', 0)`,
        [`${TS}_res`, `E2E_Res_${RUN_ID}`]
      );
      testCompanyResId = resInsert.insertId;

      const [comInsert] = await conn.query(
        `INSERT INTO uae_companies (slug, name_en, description, city, is_active, specialties, services, weight_score)
         VALUES (?, ?, 'E2E test commercial', 'Dubai', 1, '["Office","Retail"]', '["Fit-Out"]', 0)`,
        [`${TS}_com`, `E2E_Com_${RUN_ID}`]
      );
      testCompanyComId = comInsert.insertId;
    } catch (e) {
      log('TC-10.0 Insert test uae_companies rows', false, e.message);
    }

    if (testCompanyResId && testCompanyComId) {
      // TC-10.1: baseline — no space filter returns 200
      const baseRes = await fetch(`${API}/companies?limit=200`);
      log('TC-10.1 GET /api/companies baseline 200', baseRes.ok, `HTTP ${baseRes.status}`);

      // TC-10.2: ?space=residential — returns residential company
      const resRes = await fetch(`${API}/companies?limit=200&space=residential`);
      const resData = await resRes.json();
      const resCompanies = resData.companies || [];
      const foundResidential = resCompanies.some(c => c.id === testCompanyResId || c.slug === `${TS}_res`);
      log('TC-10.2 ?space=residential returns residential company', foundResidential, `count=${resCompanies.length}`);

      // TC-10.3: ?space=residential — does NOT return commercial company
      const excludesCommercial = !resCompanies.some(c => c.id === testCompanyComId || c.slug === `${TS}_com`);
      log('TC-10.3 ?space=residential excludes commercial company', excludesCommercial, `commercial_found=${!excludesCommercial}`);

      // TC-10.4: ?space=commercial — returns commercial company
      const comRes = await fetch(`${API}/companies?limit=200&space=commercial`);
      const comData = await comRes.json();
      const comCompanies = comData.companies || [];
      const foundCommercial = comCompanies.some(c => c.id === testCompanyComId || c.slug === `${TS}_com`);
      log('TC-10.4 ?space=commercial returns commercial company', foundCommercial, `count=${comCompanies.length}`);

      // TC-10.5: ?space=commercial — does NOT return residential company
      const excludesResidential = !comCompanies.some(c => c.id === testCompanyResId || c.slug === `${TS}_res`);
      log('TC-10.5 ?space=commercial excludes residential company', excludesResidential, `residential_found=${!excludesResidential}`);

      // TC-10.6: ?space=unknown — no 500, returns 200 (acts like no filter, returns both)
      const unknownRes = await fetch(`${API}/companies?limit=200&space=unknown_garbage`);
      const unknownData = await unknownRes.json();
      const unknownCompanies = unknownData.companies || [];
      const unknownStatus = unknownRes.status;
      log('TC-10.6 ?space=unknown returns 200 (no crash)', unknownStatus === 200, `HTTP ${unknownStatus}`);
      const unknownHasBoth = unknownCompanies.some(c => c.id === testCompanyResId) && unknownCompanies.some(c => c.id === testCompanyComId);
      log('TC-10.7 ?space=unknown returns all companies (no filter)', unknownHasBoth, `has_res=${unknownCompanies.some(c => c.id === testCompanyResId)} has_com=${unknownCompanies.some(c => c.id === testCompanyComId)}`);

      // TC-10.8: ?space=outdoor — returns neither residential nor commercial test company
      const outRes = await fetch(`${API}/companies?limit=200&space=outdoor`);
      const outData = await outRes.json();
      const outCompanies = outData.companies || [];
      const outdoorExcludes = !outCompanies.some(c => c.id === testCompanyResId) && !outCompanies.some(c => c.id === testCompanyComId);
      log('TC-10.8 ?space=outdoor excludes non-outdoor companies', outdoorExcludes, `found_non_outdoor=${!outdoorExcludes}`);
    }

    // Cleanup test uae_companies rows
    if (testCompanyResId) await conn.query(`DELETE FROM uae_companies WHERE id = ${testCompanyResId}`).catch(() => {});
    if (testCompanyComId) await conn.query(`DELETE FROM uae_companies WHERE id = ${testCompanyComId}`).catch(() => {});

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
