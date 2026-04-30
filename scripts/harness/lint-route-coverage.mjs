#!/usr/bin/env node
/**
 * lint-route-coverage.mjs
 *
 * 检查规则：前端 adminApi.ts 中调用的所有路径，必须在后端 routes/admin.ts 里注册。
 * 防止"controller 写了但路由没注册"这类静默 404。
 *
 * 用法: node scripts/harness/lint-route-coverage.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, condition, detail = '') {
  if (condition) {
    console.log(`  PASS  ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
    failures.push(name + (detail ? ` (${detail})` : ''));
  }
}

// ── 读取文件 ──
const adminApiSrc = readFileSync(resolve(ROOT, 'src/lib/adminApi.ts'), 'utf8');
const adminRoutesSrc = readFileSync(resolve(ROOT, 'server/src/routes/admin.ts'), 'utf8');

// ── 从 adminApi.ts 提取 this.request() 调用的路径 ──
// 匹配 this.request('/xxx') 或 this.request(`/xxx/${id}`) 的静态前缀
const requestPattern = /this\.request\(`?['"]([^'"`,\)]+)/g;
const frontendPaths = new Set();
let m;
while ((m = requestPattern.exec(adminApiSrc)) !== null) {
  // 取路径的静态前缀（去掉 ${...} 后面的部分）
  const path = m[1].split('$')[0].replace(/\/$/, '');
  if (path && path.startsWith('/')) frontendPaths.add(path);
}

// ── 从 routes/admin.ts 提取注册的路由路径 ──
// 匹配 router.get('/xxx') router.post('/xxx') 等
const routePattern = /router\.(get|post|put|patch|delete)\(['"`]([^'"`\)]+)/g;
const registeredRoutes = new Set();
while ((m = routePattern.exec(adminRoutesSrc)) !== null) {
  const path = m[2].replace(/\/$/, '');
  registeredRoutes.add(path);
  // 也加不带 :param 的前缀
  const prefix = path.split('/:')[0];
  if (prefix !== path) registeredRoutes.add(prefix);
}

console.log('\n══ lint-route-coverage ══\n');
console.log(`前端调用路径: ${frontendPaths.size} 条`);
console.log(`后端注册路由: ${registeredRoutes.size} 条\n`);

// ── 检查每个前端路径是否有对应后端路由 ──
// 排除特殊路径（export URL、非标准构造）
const EXCLUDE = ['/admin/', '/admin/activity-log/'];

for (const fp of [...frontendPaths].sort()) {
  if (EXCLUDE.some(e => fp === e.replace(/\/$/, ''))) continue;

  // 检查是否有匹配的后端路由（精确或前缀匹配）
  const matched = [...registeredRoutes].some(rp => {
    if (rp === fp) return true;
    // 后端路由可能带 :param，比较静态前缀
    const rPrefix = rp.split('/:')[0];
    return rPrefix === fp || fp.startsWith(rPrefix + '/');
  });

  ok(`路由覆盖: ${fp}`, matched, matched ? '' : `后端 routes/admin.ts 未注册`);
}

// ── 额外检查：已知必须存在的关键路由 ──
console.log('\n── 关键路由存在性检查 ──');

const CRITICAL_ROUTES = [
  '/staff',
  '/interviews',
  '/suppliers',
  '/inquiries',
  '/companies',
  '/designers',
  '/users',
  '/rejection-templates',
];

for (const route of CRITICAL_ROUTES) {
  const exists = [...registeredRoutes].some(r => r === route || r.startsWith(route + '/') || r.startsWith(route + '/:'));
  ok(`关键路由存在: ${route}`, exists, exists ? '' : `routes/admin.ts 未找到`);
}

// ── Summary ──
console.log(`\n══ 结果: ${passed} PASS, ${failed} FAIL ══`);
if (failures.length > 0) {
  console.log('\n失败项:');
  failures.forEach(f => console.log(`  ✗ ${f}`));
  process.exit(1);
}
