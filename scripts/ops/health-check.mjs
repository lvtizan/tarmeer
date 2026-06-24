#!/usr/bin/env node
/**
 * Tarmeer Health Check Worker v3
 * - Loads check definitions from site-checklist.json (embedded fallback if missing)
 * - Supports check_type: page_200 | api_data | api_auth | pm2_online
 * - api_data checks validate min_items against the json_path field
 * - v3: admin 登录态数据巡检 — 用专用账号登录后检查所有 admin 页面数据接口 × AE/VN 双国家视图
 *   （凭证在 /tarmeer/.health-check.env，HC_NO_MAIL=1 可跳过告警邮件用于手动测试）
 * - PM2 checks attempt auto-restart on failure
 * - Emails alert on any failure
 */
import { execSync } from 'child_process';
import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { get as httpGet, request as httpRequest } from 'http';
import { get as httpsGet, request as httpsRequest } from 'https';

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
const healthEnv = loadEnv('/tarmeer/.health-check.env');
const HEALTH_ADMIN_EMAIL    = process.env.HEALTH_ADMIN_EMAIL    || healthEnv.HEALTH_ADMIN_EMAIL    || '';
const HEALTH_ADMIN_PASSWORD = process.env.HEALTH_ADMIN_PASSWORD || healthEnv.HEALTH_ADMIN_PASSWORD || '';
const NO_MAIL = process.env.HC_NO_MAIL === '1';

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

// ── Admin 登录态数据巡检（v3）────────────────────────────────────────────────
// 检查所有 admin 页面的数据接口在 AE/VN 双视图下都返回 200 + 预期数据结构。
// min_items 仅对常驻非空的数据集开启，避免误报；其余只校验 json_path 存在（能抓住 500/结构回归）。
const ADMIN_DATA_CHECKS = [
  // path（{c} 会被替换为国家码）, json_path, min_items per country
  { name: '访谈记录',        path: '/api/admin/interviews?country={c}',                    json_path: 'interviews',       min: { ae: 0, vn: 0 } },
  { name: '业主列表',        path: '/api/admin/users?country={c}&limit=3',                 json_path: 'users',            min: { ae: 1, vn: 0 } },
  { name: '装企目录',        path: '/api/admin/companies?country={c}&limit=3',             json_path: 'companies',        min: { ae: 1, vn: 1 } },
  { name: '注册装企',        path: '/api/admin/roles/companies?country={c}&limit=3',       json_path: 'companies',        min: { ae: 1, vn: 0 } },
  { name: '询盘列表',        path: '/api/admin/inquiries?country={c}&limit=3',             json_path: 'inquiries',        min: { ae: 0, vn: 0 } },
  { name: '投诉列表',        path: '/api/admin/complaints?country={c}&limit=3',            json_path: 'complaints',       min: { ae: 0, vn: 0 } },
  { name: '供应商列表',      path: '/api/admin/suppliers?country={c}&limit=3',             json_path: 'suppliers',        min: { ae: 0, vn: 0 } },
  { name: '访客列表',        path: '/api/admin/visitors?country={c}&limit=3',              json_path: 'visitors',         min: { ae: 0, vn: 0 } },
  { name: '访客概览',        path: '/api/admin/visitors/overview?country={c}',             json_path: 'totalVisits',      min: { ae: 0, vn: 0 } },
  { name: '外勤人员',        path: '/api/admin/staff?country={c}',                         json_path: 'staff',            min: { ae: 0, vn: 0 } },
  { name: '签约公司',        path: '/api/admin/signed-companies?country={c}',              json_path: 'companies',        min: { ae: 0, vn: 0 } },
  { name: '数据分析-日统计', path: '/api/admin/stats/daily?days=7&country={c}',            json_path: 'data',             min: { ae: 0, vn: 0 } },
  { name: '数据分析-注册来源', path: '/api/admin/stats/registration-sources?country={c}',  json_path: 'signup_sources',   min: { ae: 0, vn: 0 } },
  { name: '数据分析-公司访客', path: '/api/admin/analytics/company-visitors?country={c}',  json_path: 'companies',        min: { ae: 0, vn: 0 } },
  { name: '今日新增',        path: '/api/admin/stats/today-new?country={c}',               json_path: 'homeowners',       min: { ae: 0, vn: 0 } },
];

function postJson(url, payload, timeoutMs) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? httpsRequest : httpRequest;
    const body = JSON.stringify(payload);
    const timer = setTimeout(() => resolve({ status: 0, error: 'Timeout', body: '' }), timeoutMs);
    const req = mod({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, error: null, body: Buffer.concat(chunks).toString('utf8') }); });
    });
    req.on('error', (err) => { clearTimeout(timer); resolve({ status: 0, error: err.message, body: '' }); });
    req.write(body);
    req.end();
  });
}

function fetchWithAuth(url, token, timeoutMs) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? httpsRequest : httpRequest;
    const timer = setTimeout(() => resolve({ status: 0, error: 'Timeout', body: '' }), timeoutMs);
    const req = mod({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => { clearTimeout(timer); resolve({ status: res.statusCode, error: null, body: Buffer.concat(chunks).toString('utf8') }); });
    });
    req.on('error', (err) => { clearTimeout(timer); resolve({ status: 0, error: err.message, body: '' }); });
    req.end();
  });
}

async function runAdminDataChecks() {
  const failures = [];
  if (!HEALTH_ADMIN_EMAIL || !HEALTH_ADMIN_PASSWORD) {
    console.log('[health-check] SKIP [admin]     未配置巡检账号（/tarmeer/.health-check.env），跳过 admin 数据巡检');
    return failures;
  }
  const base = API_BASE.replace(/\/api$/, '');
  const login = await postJson(`${base}/api/admin/login`, { email: HEALTH_ADMIN_EMAIL, password: HEALTH_ADMIN_PASSWORD }, 8000);
  let token = null;
  try { token = JSON.parse(login.body)?.token; } catch { /* fallthrough */ }
  if (login.status !== 200 || !token) {
    console.log(`[health-check] FAIL [admin]     巡检账号登录失败 — HTTP ${login.status} ${login.error || ''}`);
    failures.push({ name: 'Admin: 巡检账号登录', status: String(login.status || 'ERR'), error: login.error || `HTTP ${login.status}（admin 登录链路异常）`, action: '' });
    return failures;
  }

  for (const check of ADMIN_DATA_CHECKS) {
    for (const c of ['ae', 'vn']) {
      const label = `${check.name} [${c}]`;
      const url = `${base}${check.path.replace('{c}', c)}`;
      const result = await fetchWithAuth(url, token, 8000);
      if (result.status !== 200) {
        console.log(`[health-check] FAIL [admin]     ${label} — HTTP ${result.status} ${result.error || ''}`);
        failures.push({ name: `Admin: ${label}`, status: String(result.status || 'ERR'), error: result.error || `HTTP ${result.status}（页面数据接口异常）`, action: '' });
        continue;
      }
      let parsed;
      try { parsed = JSON.parse(result.body); } catch (e) {
        console.log(`[health-check] FAIL [admin]     ${label} — JSON parse error`);
        failures.push({ name: `Admin: ${label}`, status: '200', error: `JSON parse error: ${e.message}`, action: '' });
        continue;
      }
      const value = getJsonPath(parsed, check.json_path);
      if (value === undefined || value === null) {
        console.log(`[health-check] FAIL [admin]     ${label} — 缺少字段 ${check.json_path}`);
        failures.push({ name: `Admin: ${label}`, status: '200', error: `响应缺少 "${check.json_path}" 字段（结构回归）`, action: '' });
        continue;
      }
      const minItems = (check.min && check.min[c]) || 0;
      if (minItems > 0) {
        const count = Array.isArray(value) ? value.length : (value ? 1 : 0);
        if (count < minItems) {
          console.log(`[health-check] FAIL [admin]     ${label} — ${check.json_path} 为空（应有数据）`);
          failures.push({ name: `Admin: ${label}`, status: '200', error: `${check.json_path} 为空，但该数据集应非空`, action: '' });
          continue;
        }
      }
      console.log(`[health-check] OK   [admin]     ${label}`);
    }
  }
  return failures;
}

// ── 页面图片 404 巡检 ─────────────────────────────────────────────────────────
// page_200 只证明页面 HTML 返回 200，不代表页内图片都在（作品集图缺文件 → 控制台 404，
// 但页面靠前端兜底仍正常渲染，巡检看不见）。这里抓页面 HTML → 提取 /images、/uploads 引用
// → 直接在服务器磁盘上验在否（路径映射同 nginx，比 HTTP HEAD 快且准）。
const IMAGE_PAGES = ['/', '/companies', '/portfolio'];
const IMAGE_DISK_MAP = [
  { prefix: '/images/',  dir: '/tarmeer/tarmeer_web_portal/images/' },
  { prefix: '/uploads/', dir: '/tarmeer/tarmeer_api/public/uploads/' },
];
const MAX_IMAGE_CHECK = 200;

function extractImageRefs(html) {
  const refs = new Set();
  const re = /\/(?:images|uploads)\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|gif)/gi;
  let m;
  while ((m = re.exec(html)) !== null) refs.add(m[0]);
  return [...refs];
}

function imageToDiskPath(ref) {
  for (const { prefix, dir } of IMAGE_DISK_MAP) {
    if (ref.startsWith(prefix)) return dir + ref.slice(prefix.length);
  }
  return null;
}

async function runImageAssetChecks() {
  const seen = new Set();
  const missingRefs = [];
  let checked = 0, capped = false;
  for (const page of IMAGE_PAGES) {
    const res = await fetchWithBody(`${SITE_BASE}${page}`, 12000);
    if (res.status !== 200 || !res.body) continue;
    for (const ref of extractImageRefs(res.body)) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      if (checked >= MAX_IMAGE_CHECK) { capped = true; break; }
      const disk = imageToDiskPath(ref);
      if (!disk) continue;
      checked++;
      if (!existsSync(disk)) missingRefs.push(ref);
    }
    if (capped) break;
  }
  const missing = missingRefs.length;
  console.log(`[health-check] ${missing ? 'FAIL' : 'OK  '} [image]     检查 ${checked} 张页面图片${capped ? `(已达上限 ${MAX_IMAGE_CHECK})` : ''} — 缺失 ${missing}`);
  if (missing === 0) return [];
  // 单条汇总告警，避免一堆死图刷爆邮件
  const examples = missingRefs.slice(0, 6).join('  ');
  return [{ name: `页面图片 404 (${missing} 张)`, status: '404', error: `磁盘缺失，示例: ${examples}`, action: '' }];
}

// ── PM2 check ────────────────────────────────────────────────────────────────
// cron 环境 PATH 极简：pm2 的 shebang (#!/usr/bin/env node) 也找不到 node。
// 解法：用当前 node 进程自身 (process.execPath) 直接执行 pm2 的 JS 入口，完全不依赖 PATH。
const PM2_BIN = existsSync('/usr/local/bin/pm2') ? '/usr/local/bin/pm2' : 'pm2';
const PM2_CMD = `"${process.execPath}" ${PM2_BIN}`;
function checkPM2(name) {
  try {
    const out = execSync(`${PM2_CMD} list --no-color 2>/dev/null`, { timeout: 10000 }).toString();
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
    execSync(`${PM2_CMD} restart ${name} --update-env 2>/dev/null`, { timeout: 30000 });
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

  // 2.5 Admin 登录态数据巡检（所有 admin 页面接口 × AE/VN）
  const adminFailures = await runAdminDataChecks();
  failures.push(...adminFailures);

  // 2.6 页面图片 404 巡检（page_200 抓不到的图片缺失）
  const imageFailures = await runImageAssetChecks();
  failures.push(...imageFailures);

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
    if (NO_MAIL) {
      console.log(`[health-check] ${failures.length} failure(s) detected — HC_NO_MAIL=1，跳过告警邮件`);
    } else {
      console.log(`[health-check] ${failures.length} failure(s) detected — sending alert email...`);
      try { await sendAlert(failures); } catch (e) { console.error('[health-check] Email error:', e.message); }
    }
    process.exitCode = 1;
  } else {
    console.log('[health-check] All checks passed.');
  }
}

main().catch(e => { console.error('[health-check] Fatal:', e); process.exit(1); });
