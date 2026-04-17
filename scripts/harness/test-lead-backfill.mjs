#!/usr/bin/env node
/**
 * Harness: company_leads → company_profiles 自动回填
 * 覆盖 docs/testing/company-lead-backfill.md 全部用例
 *
 * 用法: PORT=3099 node scripts/harness/test-lead-backfill.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url.replace('/scripts/harness/', '/server/'));
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const API = `http://127.0.0.1:${process.env.PORT || 3099}/api`;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_min_32_chars_for_local_testing_only';
const TS = Date.now();

const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'tarmeer' });

let passed = 0;
let failed = 0;
const failures = [];

function ok(tc, name, condition) {
  if (condition) {
    console.log(`  PASS  ${tc} | ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${tc} | ${name}`);
    failed++;
    failures.push(`${tc}: ${name}`);
  }
}

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

async function get(path, token) {
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(`${API}${path}`, { headers });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function makeToken(userId, email) {
  return jwt.sign({ userId, email, role: 'company', active_role: 'company' }, JWT_SECRET, { expiresIn: '1h' });
}

// ===== Test Data =====
const P1 = `+971${TS.toString().slice(-9)}`;
const E1 = `harness-bf1-${TS}@test.com`;
const C1 = `HarnessLead-${TS}`;

const P2 = `+971${(TS + 1).toString().slice(-9)}`;
const E2 = `harness-bf2-${TS}@test.com`;
const C2 = `HarnessLead2-${TS}`;

const E5 = `harness-bf5-${TS}@test.com`;

const P8a = `+971${(TS + 80).toString().slice(-9)}`;
const E8a = `harness-bf8a-${TS}@test.com`;
const P8b = `+971${(TS + 81).toString().slice(-9)}`;
const E8b = `harness-bf8b-${TS}@test.com`;
const P8c = `+971${(TS + 82).toString().slice(-9)}`;
const E8c = `harness-bf8c-${TS}@test.com`;

try {
  // ================================================================
  // TC-1: Phone 匹配 (邮箱注册 + 验证后登录)
  // ================================================================
  console.log('\n--- TC-1: Phone 匹配 (邮箱注册 + 验证后登录) ---');

  const lead1 = await post('/company-leads', {
    contactName: 'Wang Wu', phone: P1, companyName: C1,
    companyType: 'design_studio', city: 'Abu Dhabi', yearEstablished: '2018',
  });
  ok('TC-1', 'POST /company-leads 返回 201', lead1.status === 201);

  const reg1 = await post('/auth/register', {
    email: E1, password: 'harness123', full_name: 'Wang Wu',
    phone: P1, role: 'company', signup_source: 'for-companies-landing',
  });
  ok('TC-1', 'POST /auth/register 返回 201', reg1.status === 201);

  // 模拟邮箱验证（新标签页点链接的效果）
  await pool.execute('UPDATE users SET email_verified = TRUE WHERE email = ?', [E1]);

  const login1 = await post('/auth/login', { email: E1, password: 'harness123' });
  ok('TC-1', '邮箱验证后登录返回 200 + token', login1.status === 200 && !!login1.data.token);

  const prof1 = await get('/auth/company/profile', login1.data.token);
  ok('TC-1', 'GET /api/auth/company/profile 返回 200', prof1.status === 200);
  const p1 = prof1.data.profile;
  ok('TC-1', 'profile 自动创建 (profile != null)', !!p1);
  ok('TC-1', 'company_name 带入', p1?.company_name === C1);
  ok('TC-1', 'contact_person 带入', p1?.contact_person === 'Wang Wu');
  ok('TC-1', 'phone 带入', p1?.phone === P1);
  ok('TC-1', 'city 带入', p1?.city === 'Abu Dhabi');
  ok('TC-1', 'company_type 带入', p1?.company_type === 'design_studio');
  ok('TC-1', 'establishment_year 带入', String(p1?.establishment_year) === '2018');
  ok('TC-1', "signup_source = 'company-lead-backfill'", p1?.signup_source === 'company-lead-backfill');

  const [leadsCheck] = await pool.execute('SELECT email FROM company_leads WHERE phone = ?', [P1]);
  ok('TC-1', 'company_leads.email 已回填为注册邮箱', leadsCheck[0]?.email === E1);

  // ================================================================
  // TC-2: Email Fallback (Google OAuth 场景 - 用户无 phone)
  // ================================================================
  console.log('\n--- TC-2: Email Fallback (无 phone → email 兜底) ---');

  await post('/company-leads', {
    contactName: 'Zhao Liu', phone: P2, companyName: C2,
    companyType: 'general_contractor', city: 'Sharjah',
  });
  // 手动回填 email（模拟注册时的自动回填）
  await pool.execute('UPDATE company_leads SET email = ? WHERE phone = ?', [E2, P2]);

  // 创建用户无 phone（模拟 Google OAuth phone 丢失）
  const [ins2] = await pool.execute(
    "INSERT INTO users (email, password, full_name, phone, role, active_role, email_verified, status) VALUES (?, '', 'Zhao Liu', NULL, 'company', 'company', TRUE, 'active')",
    [E2]
  );
  const token2 = makeToken(ins2.insertId, E2);

  const prof2 = await get('/auth/company/profile', token2);
  ok('TC-2', 'GET profile 返回 200', prof2.status === 200);
  const p2 = prof2.data.profile;
  ok('TC-2', 'profile 自动创建', !!p2);
  ok('TC-2', 'company_name 带入', p2?.company_name === C2);
  ok('TC-2', 'contact_person 带入', p2?.contact_person === 'Zhao Liu');
  ok('TC-2', 'city 带入', p2?.city === 'Sharjah');
  ok('TC-2', 'company_type 带入 (general_contractor)', p2?.company_type === 'general_contractor');

  // ================================================================
  // TC-3: 幂等性
  // ================================================================
  console.log('\n--- TC-3: 幂等性 ---');

  const prof1b = await get('/auth/company/profile', login1.data.token);
  ok('TC-3', '重复请求返回同一个 profile.id', prof1b.data.profile?.id === p1?.id);

  // ================================================================
  // TC-4: 已有 profile 不被覆盖
  // ================================================================
  console.log('\n--- TC-4: 已有 profile 不被覆盖 ---');

  const prof1c = await get('/auth/company/profile', login1.data.token);
  ok('TC-4', '已有 profile 数据不变', prof1c.data.profile?.company_name === C1 && prof1c.data.profile?.id === p1?.id);

  // ================================================================
  // TC-5: 无匹配 leads 时正常返回 null
  // ================================================================
  console.log('\n--- TC-5: 无匹配 leads → profile: null ---');

  const [ins5] = await pool.execute(
    "INSERT INTO users (email, password, full_name, phone, role, active_role, email_verified, status) VALUES (?, '', 'NoLead', '+971999999999', 'company', 'company', TRUE, 'active')",
    [E5]
  );
  const token5 = makeToken(ins5.insertId, E5);
  const prof5 = await get('/auth/company/profile', token5);
  ok('TC-5', 'profile 返回 200', prof5.status === 200);
  ok('TC-5', 'profile = null', prof5.data.profile === null);
  ok('TC-5', 'projectCount = 0', prof5.data.projectCount === 0);

  // ================================================================
  // TC-6: OAuth state 带 phone (前端代码检查)
  // ================================================================
  console.log('\n--- TC-6: OAuth state 带 phone (前端检查) ---');

  const { readFileSync } = await import('fs');
  const signupForm = readFileSync('src/components/for-companies/CompanySignupForm.tsx', 'utf-8');
  ok('TC-6', 'CompanySignupForm Google URL 包含 &phone=', signupForm.includes('&phone='));

  const authPage = readFileSync('src/pages/CompanyAuthPage.tsx', 'utf-8');
  ok('TC-6', 'CompanyAuthPage Google URL 包含 &phone=', authPage.includes('&phone='));

  const authCtrlFile = readFileSync('server/src/controllers/userAuthController.ts', 'utf-8');
  ok('TC-6', '后端解析 JSON state', authCtrlFile.includes('JSON.parse(rawState)'));
  ok('TC-6', '后端兼容旧版纯字符串 state', authCtrlFile.includes('Legacy plain string state'));

  // ================================================================
  // TC-7: OAuth 回调补写 users.phone (代码检查)
  // ================================================================
  console.log('\n--- TC-7: OAuth 回调补写 phone (代码检查) ---');

  const authCtrl = readFileSync('server/src/controllers/userAuthController.ts', 'utf-8');
  ok('TC-7', '已有用户无 phone → 补写 oauthPhone', authCtrl.includes('oauthPhone && !user.phone'));
  ok('TC-7', '新用户 INSERT 带 oauthPhone', authCtrl.includes('oauthPhone || null, passportUser.avatar_url'));

  // ================================================================
  // TC-8: company_type VARCHAR 兼容
  // ================================================================
  console.log('\n--- TC-8: company_type VARCHAR 兼容 ---');

  const types = ['general_contractor', 'mep_contractor', 'specialty_trade'];
  for (const ct of types) {
    const px = `+971${(TS + 80 + types.indexOf(ct)).toString().slice(-9)}`;
    const ex = `harness-bf8${types.indexOf(ct)}-${TS}@test.com`;
    await post('/company-leads', {
      contactName: `Type${ct}`, phone: px, companyName: `TypeTest-${ct}-${TS}`,
      companyType: ct, city: 'Dubai',
    });
    await pool.execute(
      "INSERT INTO users (email, password, full_name, phone, role, active_role, email_verified, status) VALUES (?, '', ?, ?, 'company', 'company', TRUE, 'active')",
      [ex, `Type${ct}`, px]
    );
    const [u] = await pool.execute('SELECT id FROM users WHERE email = ?', [ex]);
    const tk = makeToken(u[0].id, ex);
    const pr = await get('/auth/company/profile', tk);
    ok('TC-8', `company_type=${ct} 写入成功`, pr.status === 200 && pr.data.profile?.company_type === ct);
  }

  // ================================================================
  // Summary
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
  await pool.execute('DELETE FROM company_profiles WHERE signup_source = ? AND company_name LIKE ?', ['company-lead-backfill', 'HarnessLead%']);
  await pool.execute('DELETE FROM company_profiles WHERE signup_source = ? AND company_name LIKE ?', ['company-lead-backfill', 'TypeTest-%']);
  await pool.execute("DELETE FROM company_leads WHERE company_name LIKE 'HarnessLead%' OR company_name LIKE 'TypeTest-%'");
  await pool.execute("DELETE FROM designers WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'harness-bf%')");
  await pool.execute("DELETE FROM users WHERE email LIKE 'harness-bf%'");
  console.log('  done\n');
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}
