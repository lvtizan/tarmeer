#!/usr/bin/env node
/**
 * smoke-test.mjs — 每次功能开发完毕后必须运行
 * 用法: node scripts/harness/smoke-test.mjs
 *
 * 覆盖范围:
 *   1. TypeScript 类型检查 (tsc --noEmit)
 *   2. 后端关键路由存在性 (期望 401，不接受 404 / 500)
 *   3. 后端已知方法支持 (GET/POST/PATCH/DELETE — CORS 方法覆盖)
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const BACKEND = 'http://localhost:3002';
const FRONTEND = 'http://localhost:5180';

let pass = 0, fail = 0;

function ok(label) { console.log(`  \x1b[32m✓\x1b[0m ${label}`); pass++; }
function ng(label, detail) { console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ' — ' + detail : ''}`); fail++; }

async function req(method, url) {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' } });
    return res.status;
  } catch {
    return null;
  }
}

// ─── 1. TypeScript ──────────────────────────────────────────────────────────
console.log('\n[1/3] TypeScript type check');
try {
  execSync('node_modules/.bin/tsc --noEmit', { cwd: ROOT, stdio: 'pipe' });
  ok('tsc --noEmit');
} catch (e) {
  const first = (e.stdout?.toString() || e.stderr?.toString() || '').split('\n')[0];
  ng('tsc --noEmit', first);
}

// ─── 2. Backend route existence (unauthenticated → expect 401, not 404/500) ─
console.log('\n[2/3] Backend route existence');

const ADMIN_ROUTES = [
  ['GET',    '/api/admin/companies'],
  ['GET',    '/api/admin/staff'],
  ['PATCH',  '/api/admin/staff/1/permissions'],   // was missing — caused 404/CORS fail
  ['GET',    '/api/admin/interviews'],
  ['GET',    '/api/admin/profile-companies'],
  ['GET',    '/api/admin/visit-records'],          // alias check
  ['DELETE', '/api/admin/interviews'],
  ['GET',    '/api/admin/sourcing-requests'],      // 中国新材料采购线索（2026-07 转型新增）
];

for (const [method, route] of ADMIN_ROUTES) {
  const status = await req(method, `${BACKEND}${route}`);
  if (status === null) {
    ng(`${method} ${route}`, 'backend unreachable — run: node server/dist/app.js');
  } else if (status === 404) {
    ng(`${method} ${route}`, `404 — route not registered`);
  } else if (status >= 500) {
    ng(`${method} ${route}`, `${status} — server error`);
  } else {
    ok(`${method} ${route} → ${status}`);
  }
}

// ─── 2b. service×city 服务匹配(防 hyphen slug 查空回归 2026-07-06) ───────────
// interior-design 等连字符 slug 曾因与公司存量 "Interior Design"(空格)不匹配而永远查空,
// 导致 6/8 服务落地页空转→被 Google 判"已抓取未索引"。
// 不变量:若 renovation 在 Dubai 有公司,则连字符 slug interior-design 也必须有(否则匹配层坏了)。
console.log('\n[2b] service×city 服务匹配');
{
  const countBySvc = async (service) => {
    try {
      const res = await fetch(`${BACKEND}/api/companies/by-service-city?service=${service}&city=Dubai`);
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data.companies) ? data.companies.length : null;
    } catch { return null; }
  };
  const reno = await countBySvc('renovation');
  const inter = await countBySvc('interior-design');
  if (reno === null || inter === null) {
    ng('service×city 匹配', 'by-service-city 不可达或返回异常');
  } else if (reno > 0 && inter === 0) {
    ng('service×city 匹配', `hyphen slug 查空回归: renovation=${reno} 但 interior-design=0`);
  } else {
    ok(`service×city 匹配: renovation=${reno}, interior-design=${inter}`);
  }
}

// ─── 2c. 中国新材料采购公开接口（2026-07 转型新增）────────────────────────────
console.log('\n[2c] 新材料采购公开接口');
{
  // 跨供应商产品 feed：应 200 且返回 products 数组
  try {
    const res = await fetch(`${BACKEND}/api/suppliers/products/public?limit=3`, { headers: { 'x-country': 'ae' } });
    if (!res.ok) ng('GET /api/suppliers/products/public', `${res.status}`);
    else {
      const data = await res.json();
      if (Array.isArray(data.products)) ok(`GET /api/suppliers/products/public → 200 (${data.products.length} 条)`);
      else ng('GET /api/suppliers/products/public', 'products 非数组');
    }
  } catch { ng('GET /api/suppliers/products/public', 'unreachable'); }
  // 采购线索提交：空 body 应 400（校验生效），不接受 404/500
  const srStatus = await req('POST', `${BACKEND}/api/sourcing-requests`);
  if (srStatus === 400) ok('POST /api/sourcing-requests 空body → 400 (校验生效)');
  else if (srStatus === 404) ng('POST /api/sourcing-requests', '404 — 路由未注册');
  else if (srStatus === null || srStatus >= 500) ng('POST /api/sourcing-requests', `${srStatus ?? 'unreachable'}`);
  else ok(`POST /api/sourcing-requests → ${srStatus}`);
}

// ─── 3. Frontend reachability ────────────────────────────────────────────────
console.log('\n[3/3] Frontend reachability');
const fStatus = await req('GET', FRONTEND);
if (fStatus === null) {
  ng('GET localhost:5180', 'frontend not running — run: next dev --port 5180');
} else if (fStatus >= 500) {
  ng('GET localhost:5180', `${fStatus}`);
} else {
  ok(`GET localhost:5180 → ${fStatus}`);
}

// ─── 3b. field 公司搜索鉴权回归(sub_admin 可搜,load 仍受限) ──────────────────
// 起因(2026-07-22): sub_admin 后台绑定访谈时公司搜索被 requireFieldOrSuperAdmin
// 403 拦掉,前端吞成"无匹配公司"。此回归守卫 field 路由中间件挂载顺序。
console.log('\n[3b] field 公司搜索鉴权 (sub_admin 可搜 / load 仍受限)');
try {
  execSync('node scripts/harness/field-search-access.mjs', { cwd: ROOT, stdio: 'pipe' });
  ok('field companies/search: sub_admin 开放, load 仍受限');
} catch (e) {
  ng('field companies/search 鉴权回归', (e.stdout?.toString() || e.message || '').trim().split('\n').slice(-6).join(' | '));
}

// ─── 3c. 转型新增页面可达性（本地默认 AE 站；500/404 都算失败——页面必须存在）───
console.log('\n[3c] 转型新增页面可达性');
for (const p of ['/materials', '/materials/showroom', '/services/china-sourcing', '/guarantee', '/for-designers', '/for-designers/china-tour']) {
  const st = await req('GET', `${FRONTEND}${p}`);
  if (st === 200) ok(`GET ${p} → 200`);
  else ng(`GET ${p}`, `${st ?? 'unreachable'}`);
}

// ─── 静态守卫: 禁止硬编码权威枚举(规则8) ──────────────────────────────────
// 用户侧展示的"分类/枚举"必须从权威源(后台管理的 DB,经 /api/public/... 接口)拉取,
// 不得硬编码,否则会与管理后台不一致(供应商品类踩坑 2026-06-30)。
// 这里静态扫描:相关页面若出现硬编码品类字面量数组 → 失败;并要求引用权威接口。
console.log('\n[4/4] 静态守卫: 禁止硬编码权威枚举');
import('fs').then(({ readFileSync, existsSync }) => {
  const guards = [
    {
      file: 'src/app/supplier/products/page.tsx',
      mustInclude: '/public/supplier-categories',
      forbid: /value:\s*['"](furniture|lighting|stone|curtains|hardware|flooring)['"]/,
      label: '供应商产品品类',
    },
  ];
  for (const g of guards) {
    const fp = path.join(ROOT, g.file);
    if (!existsSync(fp)) { ng(`${g.label}: 文件缺失`, g.file); continue; }
    const src = readFileSync(fp, 'utf8');
    if (g.forbid.test(src)) ng(`${g.label}: 检测到硬编码枚举`, '必须从权威接口拉取,禁止硬编码');
    else if (!src.includes(g.mustInclude)) ng(`${g.label}: 未引用权威接口`, g.mustInclude);
    else ok(`${g.label}: 从权威接口拉取,无硬编码`);
  }
  finish();
}).catch(() => finish());

function finish() {
// ─── Summary ─────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\n${'─'.repeat(40)}`);
if (fail === 0) {
  console.log(`\x1b[32m All ${total} checks passed\x1b[0m`);
} else {
  console.log(`\x1b[31m ${fail}/${total} checks FAILED\x1b[0m`);
  process.exit(1);
}
}
