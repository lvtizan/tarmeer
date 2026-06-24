#!/usr/bin/env node
/**
 * app-auth.mjs — App 鉴权（/api/v1/auth refresh token）回归用例
 * 用法: node scripts/harness/app-auth.mjs
 *
 * 前提:
 *   - 本地后端 localhost:3002 已启动（含 /api/v1）
 *   - 本地 MySQL tarmeer 库
 *   - 跑前重启后端（authRateLimit/checkAccountLock 内存计数会被本脚本的锁号用例污染）
 *
 * 覆盖: 登录 / access 与现有中间件兼容 / refresh 轮换 / 旧 token 重用检测+family 吊销 /
 *       并发轮换原子性(不误踢) / logout / 防枚举 / 暴力破解锁号 / supplier 路径。
 */
import { execSync } from 'child_process';

const API = 'http://localhost:3002/api';
const TS = Date.now();
let pass = 0, fail = 0;
const ok = (l) => { console.log(`  \x1b[32m✓\x1b[0m ${l}`); pass++; };
const ng = (l, d) => { console.log(`  \x1b[31m✗\x1b[0m ${l}${d ? ' — ' + d : ''}`); fail++; };
const sql = (q) => execSync(`mysql -uroot -proot123 tarmeer -N -e ${JSON.stringify(q)} 2>/dev/null`, { encoding: 'utf8' }).trim();
const j = async (r) => { try { return await r.json(); } catch { return null; } };
const post = (p, b, h) => fetch(`${API}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(h || {}) }, body: JSON.stringify(b) });

console.log('[App Auth] /api/v1/auth refresh token 回归\n');

// ── 准备 user ───────────────────────────────────────────────
const uEmail = `appauth_u${TS}@example.com`, pw = 'Appauth#123';
let r = await post('/auth/register', { email: uEmail, password: pw, full_name: 'AppAuth U', phone: '+971500000099' });
if (r.status !== 201) { console.error('user 注册失败', r.status); process.exit(1); }
sql(`UPDATE users SET email_verified=1 WHERE email='${uEmail}'`);
const uid = sql(`SELECT id FROM users WHERE email='${uEmail}'`);

// UC1 登录
let d = await j(await post('/v1/auth/login', { email: uEmail, password: pw }));
const acc1 = d?.accessToken, ref1 = d?.refreshToken;
if (acc1 && ref1 && d.accountType === 'user') ok('user 登录返回 access+refresh'); else ng('user 登录', JSON.stringify(d));

// UC2 access 与现有 authenticate 中间件兼容
r = await fetch(`${API}/notifications`, { headers: { Authorization: `Bearer ${acc1}` } });
if (r.status === 200) ok('user access 被现有 authenticate 接受'); else ng('access 兼容', r.status);

// UC3 并发轮换原子性：同 token 两个并发 → 一成一拒，且胜者 family 未被误吊销
const [a, b] = await Promise.all([post('/v1/auth/refresh', { refreshToken: ref1 }), post('/v1/auth/refresh', { refreshToken: ref1 })]);
const ss = [a.status, b.status].sort();
const winner = [a, b].find(x => x.status === 200);
const wd = winner ? await j(winner) : null;
const ref2 = wd?.refreshToken;
if (ss[0] === 200 && ss[1] === 401) ok('并发轮换一成一拒'); else ng('并发轮换', JSON.stringify(ss));
r = await post('/v1/auth/refresh', { refreshToken: ref2 });
if (r.status === 200) ok('胜者新 refresh 仍可用(family 未误吊销)'); else ng('胜者新 token', r.status);
const ref3 = (await j(r))?.refreshToken;

// UC4 真·重用检测：已轮换(吊销)的旧 token 再用 → 401 + 吊销整个 family
r = await post('/v1/auth/refresh', { refreshToken: ref2 }); // ref2 上一步已被轮换吊销
if (r.status === 401) ok('旧(已轮换)refresh 重用被拒'); else ng('重用检测', r.status);
r = await post('/v1/auth/refresh', { refreshToken: ref3 }); // 重用应吊销 family → ref3 也失效
if (r.status === 401) ok('重用触发 family 吊销(最新 token 同失效)'); else ng('family 吊销', r.status);

// UC5 logout
d = await j(await post('/v1/auth/login', { email: uEmail, password: pw }));
const ref4 = d?.refreshToken;
await post('/v1/auth/logout', { refreshToken: ref4 });
r = await post('/v1/auth/refresh', { refreshToken: ref4 });
if (r.status === 401) ok('logout 后 refresh 失效'); else ng('logout', r.status);

// UC6 防枚举：不存在邮箱 vs 密码错 → 同 401 同文案
const ne = await j(await post('/v1/auth/login', { email: `none${TS}@example.com`, password: 'whatever1' }));
const wpw = await j(await post('/v1/auth/login', { email: uEmail, password: 'WrongPw#1' }));
if (ne?.error === wpw?.error && ne?.error === 'Invalid email or password.') ok('防枚举(不存在==密码错 同文案)');
else ng('防枚举', `ne=${JSON.stringify(ne)} wp=${JSON.stringify(wpw)}`);

// UC7 暴力破解锁号：连续失败 5 次 → 第 6 次 423
const lockEmail = `lock${TS}@example.com`;
let lockStatus = 0;
for (let i = 0; i < 6; i++) lockStatus = (await post('/v1/auth/login', { email: lockEmail, password: 'bad' })).status;
if (lockStatus === 423) ok('暴力破解 6 次后锁号(423)'); else ng('锁号', lockStatus);

// ── supplier 路径 ───────────────────────────────────────────
const sEmail = `appauth_s${TS}@example.com`;
r = await post('/supplier/auth/register', { email: sEmail, password: pw, company_name: 'AppAuth S', contact_name: 'T', phone: '+8613800000099' });
sql(`UPDATE supplier_users SET email_verified=1 WHERE email='${sEmail}'`);
const sid = sql(`SELECT id FROM supplier_users WHERE email='${sEmail}'`);
d = await j(await post('/v1/auth/login', { email: sEmail, password: pw }));
const sAcc = d?.accessToken;
if (sAcc && d.accountType === 'supplier') ok('supplier 登录返回 access+refresh'); else ng('supplier 登录', JSON.stringify(d));
r = await fetch(`${API}/suppliers/me/linked-portals`, { headers: { Authorization: `Bearer ${sAcc}` } });
if (r.status === 200) ok('supplier access 被 authenticateSupplier 接受'); else ng('supplier access 兼容', r.status);

// ── 清理 ────────────────────────────────────────────────────
sql(`DELETE FROM app_refresh_tokens WHERE (subject_type='user' AND subject_id=${uid}) OR (subject_type='supplier' AND subject_id=${sid})`);
sql(`DELETE FROM users WHERE email='${uEmail}'`);
sql(`DELETE sp FROM supplier_profiles sp WHERE sp.supplier_user_id=${sid}`);
sql(`DELETE FROM supplier_users WHERE id=${sid}`);

console.log(`\n${'─'.repeat(50)}\n通过 ${pass} · 失败 ${fail}`);
process.exit(fail > 0 ? 1 : 0);
