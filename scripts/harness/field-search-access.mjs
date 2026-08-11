#!/usr/bin/env node
// 回归用例：/api/field/companies/search 必须对任意已登录 admin（含 sub_admin）开放，
// 而 /interviews/:id/load 等敏感路由仍限 field_staff / super_admin。
//
// 起因（2026-07-22）：sub_admin 在后台访谈详情页点"绑定公司"搜索时被
// requireFieldOrSuperAdmin 403 拦掉，前端把错误吞成"无匹配公司"（company_profiles
// 明明有这家公司）。修复是把公司搜索的鉴权放宽到 requireAdmin，敏感路由保持不变。
//
// 本用例用桩替换 DB/鉴权，只验证 field 路由的中间件挂载顺序，无需数据库。
import { createRequire } from 'module';
import Module from 'module';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '../../server');
// server/package.json / server/node_modules 是本地运行资产，未纳入 git；隔离 worktree
// 需从主 checkout 复用依赖。git common dir 可移植地指回主 checkout，不绑定用户名路径。
let dependencyServerDir = serverDir;
if (!existsSync(path.join(dependencyServerDir, 'node_modules', 'express'))) {
  const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf8',
  }).trim();
  dependencyServerDir = path.join(path.dirname(path.resolve(path.resolve(__dirname, '../..'), commonDir)), 'server');
}
if (!existsSync(path.join(dependencyServerDir, 'node_modules', 'express'))) {
  throw new Error('server dependencies unavailable; install server/node_modules in the main checkout');
}
process.env.NODE_PATH = [
  path.join(dependencyServerDir, 'node_modules'),
  process.env.NODE_PATH,
].filter(Boolean).join(path.delimiter);
Module._initPaths();
const require = createRequire(path.join(serverDir, 'dist', 'app.js'));
const express = require('express');

// 用桩替换 field 路由的两个依赖，避免真连数据库
const origLoad = Module._load;
const stubAuth = {
  authenticateAdmin: (req, res, next) => { req.adminId = 1; next(); },
  requireAdmin: (req, res, next) => { req.admin = { role: req.headers['x-role'], country: 'ae' }; next(); },
  requireFieldOrSuperAdmin: (req, res, next) => {
    if (req.admin.role !== 'super_admin' && req.admin.role !== 'field_staff')
      return res.status(403).json({ error: 'blocked' });
    next();
  },
};
const stubCtrl = new Proxy({}, { get: () => (req, res) => res.json({ ok: true }) });
Module._load = function (request, ...rest) {
  if (request.includes('middleware/adminAuth')) return stubAuth;
  if (request.includes('Controller')) return stubCtrl;
  return origLoad.call(this, request, ...rest);
};
const router = require(path.join(serverDir, 'dist', 'routes', 'field.js')).default;
Module._load = origLoad;

const app = express();
app.use('/api/field', router);

function hit(role, p) {
  return new Promise((resolve) => {
    http.get({ port, path: p, headers: { 'x-role': role } }, (r) => {
      r.resume();
      resolve(r.statusCode);
    });
  });
}

let port;
const srv = app.listen(0);
await new Promise((r) => srv.once('listening', r));
port = srv.address().port;

const cases = [
  ['search sub_admin  开放',   () => hit('sub_admin', '/api/field/companies/search?q=x'),   200],
  ['search super_admin 开放',  () => hit('super_admin', '/api/field/companies/search?q=x'), 200],
  ['search field_staff 开放',  () => hit('field_staff', '/api/field/companies/search?q=x'), 200],
  ['load  sub_admin  仍受限',  () => hit('sub_admin', '/api/field/interviews/5/load'),      403],
];

let failed = 0;
for (const [name, fn, want] of cases) {
  const got = await fn();
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name} → ${got} (want ${want})`);
}
srv.close();

console.log('────────────────────────────────────────');
if (failed) {
  console.log(`\x1b[31m ${failed}/${cases.length} FAILED\x1b[0m`);
  process.exit(1);
}
console.log(`\x1b[32m All ${cases.length} checks passed\x1b[0m`);
