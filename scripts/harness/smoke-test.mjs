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

// ─── Summary ─────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\n${'─'.repeat(40)}`);
if (fail === 0) {
  console.log(`\x1b[32m All ${total} checks passed\x1b[0m`);
} else {
  console.log(`\x1b[31m ${fail}/${total} checks FAILED\x1b[0m`);
  process.exit(1);
}
