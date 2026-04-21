#!/usr/bin/env node
/**
 * Harness: Email verification polling
 * Covers docs/testing/email-verification-polling.md
 *
 * Usage: PORT=3099 node scripts/harness/test-verification-polling.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url.replace('/scripts/harness/', '/server/'));
const mysql = require('mysql2/promise');

const API = `http://127.0.0.1:${process.env.PORT || 3099}/api`;
const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'tarmeer' });

const TS = Date.now();
let passed = 0;
let failed = 0;
const failures = [];

function ok(tc, name, condition) {
  if (condition) { console.log(`  PASS  ${tc} | ${name}`); passed++; }
  else { console.log(`  FAIL  ${tc} | ${name}`); failed++; failures.push(`${tc}: ${name}`); }
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function get(path) {
  const res = await fetch(`${API}${path}`);
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

const EMAIL_HO = `harness-poll-ho-${TS}@test.com`;
const EMAIL_CO = `harness-poll-co-${TS}@test.com`;
const PASSWORD = process.env.TEST_PASSWORD || 'testpass' + '123456';

try {
  // ================================================================
  // TC-1: check-verified API 基本功能
  // ================================================================
  console.log('\n--- TC-1: check-verified API ---');

  // 缺少 email 参数
  let r = await get('/auth/check-verified');
  ok('TC-1', '缺少 email → 400', r.status === 400);

  // 不存在的邮箱
  r = await get(`/auth/check-verified?email=nonexistent-${TS}@test.com`);
  ok('TC-1', '不存在邮箱 → verified: false', r.data.verified === false);

  // 注册一个未验证的用户
  await post('/auth/register', { email: EMAIL_HO, password: PASSWORD, full_name: 'PollTest HO', role: 'homeowner' });

  // 未验证时查询
  r = await get(`/auth/check-verified?email=${encodeURIComponent(EMAIL_HO)}`);
  ok('TC-1', '未验证邮箱 → verified: false', r.data.verified === false);
  ok('TC-1', '未验证邮箱 → 无 token', !r.data.token);

  // 手动验证
  await pool.execute('UPDATE users SET email_verified = TRUE WHERE email = ?', [EMAIL_HO]);

  // 验证后查询
  r = await get(`/auth/check-verified?email=${encodeURIComponent(EMAIL_HO)}`);
  ok('TC-1', '已验证邮箱 → verified: true', r.data.verified === true);
  ok('TC-1', '已验证邮箱 → 返回 token', typeof r.data.token === 'string' && r.data.token.length > 20);
  ok('TC-1', '已验证邮箱 → 返回 user.email', r.data.user?.email === EMAIL_HO);
  ok('TC-1', '已验证邮箱 → 返回 user.active_role', r.data.user?.active_role !== undefined);

  // ================================================================
  // TC-2: 业主注册 → 验证 → 自动登录模拟
  // ================================================================
  console.log('\n--- TC-2: 业主注册 → 验证 → check-verified 返回 token ---');

  // token 可以用来调用 /auth/me
  const hoToken = r.data.token;
  const meRes = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${hoToken}` } });
  const meData = await meRes.json();
  ok('TC-2', 'token 有效 → /auth/me 返回 200', meRes.status === 200);
  ok('TC-2', '/auth/me 返回正确 email', meData.user?.email === EMAIL_HO);

  // ================================================================
  // TC-3: 装企注册 → 验证 → check-verified 返回 company role
  // ================================================================
  console.log('\n--- TC-3: 装企注册 → 验证 → check-verified ---');

  await post('/auth/register', { email: EMAIL_CO, password: PASSWORD, full_name: 'PollTest CO', role: 'company' });
  await pool.execute('UPDATE users SET email_verified = TRUE WHERE email = ?', [EMAIL_CO]);

  r = await get(`/auth/check-verified?email=${encodeURIComponent(EMAIL_CO)}`);
  ok('TC-3', 'verified: true', r.data.verified === true);
  ok('TC-3', '有 token', !!r.data.token);
  ok('TC-3', 'user.active_role = company', r.data.user?.active_role === 'company');

  // ================================================================
  // TC-4: 验证链接本身仍然正常（/verify-email 端点）
  // ================================================================
  console.log('\n--- TC-4: verify-email 端点仍然正常 ---');

  const EMAIL_VE = `harness-poll-ve-${TS}@test.com`;
  await post('/auth/register', { email: EMAIL_VE, password: PASSWORD, full_name: 'VerifyTest' });

  // 获取 verification token
  const [vtRows] = await pool.execute('SELECT verification_token FROM users WHERE email = ?', [EMAIL_VE]);
  const vToken = vtRows[0]?.verification_token;
  ok('TC-4', '注册后有 verification_token', !!vToken);

  if (vToken) {
    const vRes = await post('/auth/verify-email', { token: vToken });
    ok('TC-4', 'verify-email 返回 200', vRes.status === 200);
    ok('TC-4', 'verify-email 返回 token', !!vRes.data.token);
    ok('TC-4', 'verify-email 返回 user', !!vRes.data.user);
  }

  // ================================================================
  // TC-5: 连续轮询不报错
  // ================================================================
  console.log('\n--- TC-5: 连续轮询稳定性 ---');

  const results = await Promise.all([
    get(`/auth/check-verified?email=${encodeURIComponent(EMAIL_HO)}`),
    get(`/auth/check-verified?email=${encodeURIComponent(EMAIL_HO)}`),
    get(`/auth/check-verified?email=${encodeURIComponent(EMAIL_HO)}`),
  ]);
  ok('TC-5', '3 次并发轮询都返回 200', results.every(r => r.status === 200));
  ok('TC-5', '3 次都返回 verified: true', results.every(r => r.data.verified === true));

  // ================================================================
  // TC-6: 前端代码检查
  // ================================================================
  console.log('\n--- TC-6: 前端代码检查 ---');

  const { readFileSync } = await import('fs');
  const hook = readFileSync('src/hooks/useVerificationPoller.ts', 'utf-8');
  ok('TC-6', 'hook 存在 + 有 setInterval', hook.includes('setInterval'));
  ok('TC-6', 'hook 有 clearInterval 清理', hook.includes('clearInterval'));
  ok('TC-6', 'hook 轮询 check-verified', hook.includes('check-verified'));

  const authPage = readFileSync('src/pages/HomeownerAuthPage.tsx', 'utf-8');
  ok('TC-6', 'HomeownerAuthPage 使用 useVerificationPoller', authPage.includes('useVerificationPoller'));

  const companyForm = readFileSync('src/components/for-companies/CompanySignupForm.tsx', 'utf-8');
  ok('TC-6', 'CompanySignupForm 使用 useVerificationPoller', companyForm.includes('useVerificationPoller'));

  const joinPage = readFileSync('src/pages/CompanyAuthPage.tsx', 'utf-8');
  ok('TC-6', 'CompanyAuthPage 使用 useVerificationPoller', joinPage.includes('useVerificationPoller'));

  // ================================================================
  console.log('\n' + '='.repeat(60));
  console.log(`  RESULT: ${passed} PASS, ${failed} FAIL`);
  if (failures.length) {
    console.log('\n  FAILURES:');
    failures.forEach(f => console.log(`    - ${f}`));
  }
  console.log('='.repeat(60) + '\n');

} finally {
  // Cleanup
  console.log('--- Cleanup ---');
  await pool.execute("DELETE FROM designers WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'harness-poll%')");
  await pool.execute("DELETE FROM users WHERE email LIKE 'harness-poll%'");
  console.log('  done\n');
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}
