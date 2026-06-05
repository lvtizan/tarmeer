#!/usr/bin/env node
/**
 * Tarmeer Health Check Worker v2
 * - Loads check definitions from site-checklist.json (embedded fallback if missing)
 * - Supports check_type: page_200 | api_data | api_auth | pm2_online
 * - api_data checks validate min_items against the json_path field
 * - PM2 checks attempt auto-restart on failure
 * - Emails alert on any failure
 */
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { get as httpGet } from 'http';
import { get as httpsGet } from 'https';

// nodemailer lives inside tarmeer_api's node_modules
const require = createRequire('/tarmeer/tarmeer_api/package.json');
const nodemailer = require('nodemailer');

// ── Config ──────────────────────────────────────────────────────────────────
const ENV_PATH      = '/tarmeer/tarmeer_api/.env';
const CHECKLIST_PATH = '/tarmeer/tarmeer_web_next/site-checklist.json';

function loadEnv(filePath) {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(l => l && !l.startsWith('#') && l.includes('='))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; })
    );
  } catch { return {}; }
}
const env = loadEnv(ENV_PATH);

const SMTP_HOST   = env.SMTP_HOST     || 'smtp.qq.com';
const SMTP_PORT   = parseInt(env.SMTP_PORT || '465');
const SMTP_USER   = env.SMTP_USER     || env.EMAIL_USER     || '';
const SMTP_PASS   = env.SMTP_PASS     || env.EMAIL_PASSWORD || '';
const ALERT_EMAIL = 'lvyiming@kp99.cn';
const FROM_EMAIL  = SMTP_USER;

const API_BASE  = 'http://localhost:3002/api';
const SITE_BASE = 'http://localhost:3001';

const PM2_PROCESSES = ['tarmeer-api', 'tarmeer-next'];

// ── Embedded fallback checklist (used if site-checklist.json is not found) ──
const FALLBACK_CHECKLIST = [
  // API core
  { id: 'api_health',                  check_type: 'api_data',   endpoint: '/api/health',                             expect: { status: 200, json_path: 'status',     min_items: 1 }, critical: true  },
  // Navbar data
  { id: 'navbar_service_categories',   check_type: 'api_data',   endpoint: '/api/public/service-categories',          expect: { status: 200, json_path: 'categories', min_items: 1 }, critical: true  },
  { id: 'navbar_supplier_categories',  check_type: 'api_data',   endpoint: '/api/public/supplier-categories',         expect: { status: 200, json_path: 'groups',     min_items: 1 }, critical: true  },
  // Homepage data
  { id: 'homepage_companies',          check_type: 'api_data',   endpoint: '/api/companies?limit=3',                  expect: { status: 200, json_path: 'companies',  min_items: 1 }, critical: true  },
  { id: 'homepage_registered_cos',     check_type: 'api_data',   endpoint: '/api/public/companies?limit=3',           expect: { status: 200, json_path: 'companies',  min_items: 1 }, critical: true  },
  { id: 'homepage_suppliers',          check_type: 'api_data',   endpoint: '/api/suppliers?limit=3',                  expect: { status: 200, json_path: 'suppliers',  min_items: 1 }, critical: true  },
  { id: 'homepage_blog',               check_type: 'api_data',   endpoint: '/api/articles/public?limit=3',            expect: { status: 200, json_path: 'articles',   min_items: 1 }, critical: false },
  // Field survey
  { id: 'field_survey_schema',         check_type: 'api_data',   endpoint: '/api/field/survey-schema',                expect: { status: 200, json_path: 'schema',     min_items: 1 }, critical: true  },
  // Admin auth guards
  { id: 'admin_companies_api',         check_type: 'api_auth',   endpoint: '/api/admin/companies?limit=3',            expect: { status: 401 },                                         critical: true  },
  { id: 'admin_suppliers_api',         check_type: 'api_auth',   endpoint: '/api/admin/suppliers?limit=3',            expect: { status: 401 },                                         critical: true  },
  { id: 'admin_users_api',             check_type: 'api_auth',   endpoint: '/api/admin/users?limit=3',                expect: { status: 401 },                                         critical: true  },
  { id: 'admin_applications_api',      check_type: 'api_auth',   endpoint: '/api/admin/company-applications?limit=3', expect: { status: 401 },                                         critical: true  },
  { id: 'admin_visit_records_api',     check_type: 'api_auth',   endpoint: '/api/admin/interviews?limit=3',           expect: { status: 401 },                                         critical: true  },
  // Frontend pages
  { id: 'page_homepage',               check_type: 'page_200',   endpoint: '/',                                       expect: { status: 200 },                                         critical: true  },
  { id: 'page_companies',              check_type: 'page_200',   endpoint: '/companies',                              expect: { status: 200 },                                         critical: true  },
  { id: 'page_portfolio',              check_type: 'page_200',   endpoint: '/portfolio',                              expect: { status: 200 },                                         critical: true  },
  { id: 'page_blog',                   check_type: 'page_200',   endpoint: '/blog',                                   expect: { status: 200 },                                         critical: true  },
  { id: 'page_materials',              check_type: 'page_200',   endpoint: '/materials',                              expect: { status: 200 },                                         critical: true  },
];

// ── Load checklist ────────────────────────────────────────────────────────────
function loadChecklist() {
  if (existsSync(CHECKLIST_PATH)) {
    try {
      const raw = readFileSync(CHECKLIST_PATH, 'utf8');
      const list = JSON.parse(raw);
      console.log(`[health-check] Loaded ${list.length} checks from ${CHECKLIST_PATH}`);
      return list;
    } catch (e) {
      console.warn(`[health-check] Failed to parse checklist at ${CHECKLIST_PATH}: ${e.message} — using fallback`);
    }
  } else {
    console.warn(`[health-check] Checklist not found at ${CHECKLIST_PATH} — using embedded fallback`);
  }
  return FALLBACK_CHECKLIST;
}

// ── Resolve full URL from endpoint ───────────────────────────────────────────
function resolveUrl(check) {
  const ep = check.endpoint || '';
  if (ep.startsWith('http')) return ep;
  // api_data / api_auth endpoints start with /api/
  if (check.check_type === 'page_200') return `${SITE_BASE}${ep}`;
  return `${API_BASE.replace(/\/api$/, '')}${ep}`;
}

// ── HTTP fetch (returns body text for api_data checks) ───────────────────────
function fetchWithBody(url, timeoutMs) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? httpsGet : httpGet;
    const timer = setTimeout(() => resolve({ ok: false, status: 0, error: 'Timeout', body: '' }), timeoutMs);
    const chunks = [];
    const req = mod(url, (res) => {
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        clearTimeout(timer);
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: res.statusCode < 500, status: res.statusCode, error: null, body });
      });
    });
    req.on('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, status: 0, error: err.message, body: '' });
    });
  });
}

// ── Safely get a nested value via dot-notation path ──────────────────────────
function getJsonPath(obj, path) {
  return path.split('.').reduce((cur, key) => (cur != null ? cur[key] : undefined), obj);
}

// ── Run a single check item ───────────────────────────────────────────────────
async function runCheck(item) {
  const { id, name, check_type, expect: exp } = item;
  const label = name || id;

  if (check_type === 'pm2_online') {
    return null; // handled separately in the PM2 section
  }

  const url = resolveUrl(item);
  const timeout = item.timeout || (check_type === 'page_200' ? 10000 : 6000);
  const result = await fetchWithBody(url, timeout);
  const statusStr = result.status ? String(result.status) : 'ERR';

  if (check_type === 'page_200') {
    const pass = result.status === 200;
    console.log(`[health-check] ${pass ? 'OK  ' : 'FAIL'} [page_200]  ${label} — HTTP ${statusStr} ${result.error || ''}`);
    if (!pass) return { name: label, status: statusStr, error: result.error || `HTTP ${result.status}`, action: '' };
    return null;
  }

  if (check_type === 'api_auth') {
    const allowed = [401, 403];
    const pass = allowed.includes(result.status);
    console.log(`[health-check] ${pass ? 'OK  ' : 'FAIL'} [api_auth]  ${label} — HTTP ${statusStr} ${result.error || ''}`);
    if (!pass) return { name: label, status: statusStr, error: result.error || `Expected 401/403, got ${result.status}`, action: '' };
    return null;
  }

  if (check_type === 'api_data') {
    // First check HTTP status
    if (result.status !== (exp.status || 200)) {
      const msg = result.error || `HTTP ${result.status}`;
      console.log(`[health-check] FAIL [api_data]  ${label} — HTTP ${statusStr} ${result.error || ''}`);
      return { name: label, status: statusStr, error: msg, action: '' };
    }

    // Parse JSON and validate json_path + min_items
    if (exp.json_path) {
      let parsed;
      try { parsed = JSON.parse(result.body); } catch (e) {
        console.log(`[health-check] FAIL [api_data]  ${label} — JSON parse error: ${e.message}`);
        return { name: label, status: statusStr, error: `JSON parse error: ${e.message}`, action: '' };
      }

      const value = getJsonPath(parsed, exp.json_path);
      const minItems = exp.min_items != null ? exp.min_items : 1;

      if (value == null) {
        console.log(`[health-check] FAIL [api_data]  ${label} — json_path "${exp.json_path}" missing`);
        return { name: label, status: statusStr, error: `json_path "${exp.json_path}" not found in response`, action: '' };
      }

      if (minItems > 0) {
        // For arrays check length; for objects/strings treat as truthy
        const count = Array.isArray(value) ? value.length : (value ? 1 : 0);
        if (count < minItems) {
          const detail = Array.isArray(value)
            ? `${exp.json_path}.length = ${count} (min: ${minItems})`
            : `${exp.json_path} is empty`;
          console.log(`[health-check] FAIL [api_data]  ${label} — ${detail}`);
          return { name: label, status: statusStr, error: detail, action: '' };
        }
      }
    }

    console.log(`[health-check] OK   [api_data]  ${label} — HTTP ${statusStr}`);
    return null;
  }

  // Unknown check_type — skip
  console.log(`[health-check] SKIP [${check_type}] ${label}`);
  return null;
}

// ── Data integrity spot-checks (always run, independent of checklist) ─────────
async function runDataIntegrityChecks() {
  const integrityFailures = [];

  const checks = [
    {
      name: 'Supplier categories empty',
      url: `${API_BASE.replace(/\/api$/, '')}/api/public/supplier-categories`,
      validate: (body) => {
        const data = JSON.parse(body);
        const groups = data.groups;
        if (!Array.isArray(groups) || groups.length === 0) return 'groups array is empty';
        return null;
      },
    },
    {
      name: 'Service categories empty',
      url: `${API_BASE.replace(/\/api$/, '')}/api/public/service-categories`,
      validate: (body) => {
        const data = JSON.parse(body);
        const cats = data.categories;
        if (!Array.isArray(cats) || cats.length === 0) return 'categories array is empty';
        return null;
      },
    },
    {
      name: 'Companies data empty',
      url: `${API_BASE.replace(/\/api$/, '')}/api/companies?limit=3`,
      validate: (body) => {
        const data = JSON.parse(body);
        const companies = data.companies;
        if (!Array.isArray(companies) || companies.length === 0) return 'companies array is empty';
        return null;
      },
    },
  ];

  for (const ic of checks) {
    const result = await fetchWithBody(ic.url, 8000);
    if (result.status !== 200) {
      console.log(`[health-check] FAIL [integrity] ${ic.name} — HTTP ${result.status} ${result.error || ''}`);
      integrityFailures.push({ name: `Integrity: ${ic.name}`, status: String(result.status || 'ERR'), error: result.error || `HTTP ${result.status}`, action: '' });
      continue;
    }
    let msg = null;
    try {
      msg = ic.validate(result.body);
    } catch (e) {
      msg = `Validation error: ${e.message}`;
    }
    if (msg) {
      console.log(`[health-check] FAIL [integrity] ${ic.name} — ${msg}`);
      integrityFailures.push({ name: `Integrity: ${ic.name}`, status: String(result.status), error: msg, action: '' });
    } else {
      console.log(`[health-check] OK   [integrity] ${ic.name}`);
    }
  }

  return integrityFailures;
}

// ── PM2 check ────────────────────────────────────────────────────────────────
function checkPM2(name) {
  try {
    const out = execSync('pm2 list --no-color 2>/dev/null', { timeout: 10000 }).toString();
    const lines = out.split('\n').filter(l => l.includes(name));
    if (lines.length === 0) return { ok: false, detail: 'Process not found in pm2 list' };
    const online = lines.some(l => l.includes('online'));
    if (!online) return { ok: false, detail: lines[0].trim().replace(/\s+/g, ' ') };
    return { ok: true, detail: 'online' };
  } catch (e) {
    return { ok: false, detail: `pm2 check error: ${e.message}` };
  }
}

function restartPM2(name) {
  try {
    execSync(`pm2 restart ${name} --update-env 2>/dev/null`, { timeout: 30000 });
    return true;
  } catch { return false; }
}

// ── Email ─────────────────────────────────────────────────────────────────────
async function sendAlert(failures) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.error('[health-check] SMTP not configured, cannot send alert');
    return;
  }
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  const rows = failures.map(f => `
    <tr>
      <td style="padding:6px 12px;border:1px solid #ddd;font-weight:bold;color:#c0392b">${f.name}</td>
      <td style="padding:6px 12px;border:1px solid #ddd">${f.status || '-'}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;color:#666;font-size:12px">${f.error || ''}</td>
      <td style="padding:6px 12px;border:1px solid #ddd;font-size:12px">${f.action || ''}</td>
    </tr>`).join('');

  const html = `
<html><body style="font-family:sans-serif;color:#333">
<h2 style="color:#c0392b">Tarmeer 巡检告警 — ${now}</h2>
<p>${failures.length} 个模块异常，详情如下：</p>
<table style="border-collapse:collapse;width:100%;font-size:13px">
  <thead>
    <tr style="background:#f5f5f5">
      <th style="padding:6px 12px;border:1px solid #ddd;text-align:left">模块</th>
      <th style="padding:6px 12px;border:1px solid #ddd;text-align:left">HTTP 状态</th>
      <th style="padding:6px 12px;border:1px solid #ddd;text-align:left">错误详情</th>
      <th style="padding:6px 12px;border:1px solid #ddd;text-align:left">已执行操作</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<p style="margin-top:16px;font-size:12px;color:#888">服务器 47.91.108.104 · tarmeer.com</p>
</body></html>`;

  await transport.sendMail({
    from: `"Tarmeer 巡检" <${FROM_EMAIL}>`,
    to: ALERT_EMAIL,
    subject: `[Tarmeer 告警] ${failures.length} 个模块异常 — ${now}`,
    html,
  });
  console.log(`[health-check] Alert sent to ${ALERT_EMAIL}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const ts = new Date().toISOString();
  console.log(`\n[health-check] === Run at ${ts} (v2) ===`);

  const checklist = loadChecklist();
  const failures = [];

  // 1. Run checklist-driven checks (skip pm2_online — handled below)
  for (const item of checklist) {
    if (item.check_type === 'pm2_online') continue;
    const failure = await runCheck(item);
    if (failure) failures.push(failure);
  }

  // 2. Data integrity spot-checks (always run, regardless of checklist)
  const integrityFailures = await runDataIntegrityChecks();
  failures.push(...integrityFailures);

  // 3. PM2 process checks
  // Use pm2_online entries from checklist if present, otherwise fall back to PM2_PROCESSES
  const pm2Names = checklist
    .filter(i => i.check_type === 'pm2_online')
    .map(i => i.expect?.process)
    .filter(Boolean);
  const pm2ToCheck = pm2Names.length > 0 ? pm2Names : PM2_PROCESSES;

  for (const proc of pm2ToCheck) {
    const { ok, detail } = checkPM2(proc);
    console.log(`[health-check] ${ok ? 'OK  ' : 'FAIL'} [pm2]       PM2: ${proc} — ${detail}`);
    if (!ok) {
      const restarted = restartPM2(proc);
      const action = restarted
        ? `已自动重启 (pm2 restart ${proc})`
        : `自动重启失败，请手动检查`;
      console.log(`[health-check]   -> ${action}`);
      failures.push({ name: `PM2: ${proc}`, status: 'DOWN', error: detail, action });
    }
  }

  // 4. Alert
  if (failures.length > 0) {
    console.log(`[health-check] ${failures.length} failure(s) detected — sending alert email...`);
    try { await sendAlert(failures); } catch (e) { console.error('[health-check] Email error:', e.message); }
  } else {
    console.log('[health-check] All checks passed.');
  }
}

main().catch(e => { console.error('[health-check] Fatal:', e); process.exit(1); });
