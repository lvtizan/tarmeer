#!/usr/bin/env node
/**
 * Harness: company-leads/check-phone 实时电话检测
 *
 * 用例覆盖:
 *   TC1: 无参数 → 400
 *   TC2: 全新号码 → exists=false
 *   TC3: 号码只在 company_leads → exists=true, hasAccount=false
 *   TC4: 号码在 users 表（有 company_profile）→ exists=true, hasAccount=true, hasCompanyProfile=true
 *   TC5: 号码在 users 表（无 company_profile）→ exists=true, hasAccount=true, hasCompanyProfile=false
 *   TC6: 号码同时在 company_leads 和 users → exists=true, hasAccount=true
 *   TC7: 已软删用户的号码 → 不算存在
 *
 * 用法: PORT=3099 node scripts/harness/test-phone-check.mjs
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url.replace('/scripts/harness/', '/server/'));
const mysql = require('mysql2/promise');

const API = `http://127.0.0.1:${process.env.PORT || 3099}/api`;
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

async function get(path) {
  const res = await fetch(`${API}${path}`);
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// ── Setup: seed test data ──
const PHONE_NEW       = `+971500000${TS % 10000}`;
const PHONE_LEAD_ONLY = `+971500001${TS % 10000}`;
const PHONE_USER_CP   = `+971500002${TS % 10000}`;
const PHONE_USER_NOCP = `+971500003${TS % 10000}`;
const PHONE_BOTH      = `+971500004${TS % 10000}`;
const PHONE_DELETED   = `+971500005${TS % 10000}`;

async function seed() {
  console.log('\n── Seeding test data ──');

  // Lead-only phone
  await pool.execute(
    'INSERT INTO company_leads (contact_name, phone, company_name, city) VALUES (?, ?, ?, ?)',
    [`test_lead_${TS}`, PHONE_LEAD_ONLY, `LeadCo_${TS}`, 'Dubai']
  );

  // User with company_profile
  const [r1] = await pool.execute(
    'INSERT INTO users (email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?)',
    [`cp_user_${TS}@test.local`, 'x', `CP User ${TS}`, PHONE_USER_CP, 'company']
  );
  const uid1 = r1.insertId;
  await pool.execute(
    `INSERT INTO company_profiles (user_id, company_name, status, description, contact_person, phone, city, address, services)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uid1, `CpCo_${TS}`, 'approved', 'test', 'test', PHONE_USER_CP, 'Dubai', 'test', '["Interior Design"]']
  );

  // User without company_profile
  const [r2] = await pool.execute(
    'INSERT INTO users (email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?)',
    [`nocp_user_${TS}@test.local`, 'x', `NoCP User ${TS}`, PHONE_USER_NOCP, 'company']
  );

  // Both in leads + users
  await pool.execute(
    'INSERT INTO company_leads (contact_name, phone, company_name, city) VALUES (?, ?, ?, ?)',
    [`both_lead_${TS}`, PHONE_BOTH, `BothCo_${TS}`, 'Dubai']
  );
  const [r3] = await pool.execute(
    'INSERT INTO users (email, password, full_name, phone, role) VALUES (?, ?, ?, ?, ?)',
    [`both_user_${TS}@test.local`, 'x', `Both User ${TS}`, PHONE_BOTH, 'company']
  );

  // Soft-deleted user
  const [r4] = await pool.execute(
    'INSERT INTO users (email, password, full_name, phone, role, deleted_at) VALUES (?, ?, ?, ?, ?, NOW())',
    [`del_user_${TS}@test.local`, 'x', `Del User ${TS}`, PHONE_DELETED, 'company']
  );

  console.log('  Seeded OK\n');
}

async function cleanup() {
  console.log('\n── Cleanup ──');
  await pool.execute('DELETE FROM company_profiles WHERE company_name LIKE ?', [`%_${TS}`]);
  await pool.execute('DELETE FROM users WHERE email LIKE ?', [`%_${TS}@test.local`]);
  await pool.execute('DELETE FROM company_leads WHERE contact_name LIKE ?', [`%_${TS}`]);
  await pool.end();
  console.log('  Done');
}

// ── Tests ──
async function run() {
  await seed();

  // TC1: no phone param → 400
  {
    const r = await get('/company-leads/check-phone');
    ok('TC1', 'Missing phone → 400', r.status === 400);
  }

  // TC2: brand new phone → exists=false
  {
    const r = await get(`/company-leads/check-phone?phone=${encodeURIComponent(PHONE_NEW)}`);
    ok('TC2', 'New phone → 200', r.status === 200);
    ok('TC2', 'New phone → exists=false', r.data.exists === false);
    ok('TC2', 'New phone → hasAccount=false', r.data.hasAccount === false);
  }

  // TC3: phone in company_leads only
  {
    const r = await get(`/company-leads/check-phone?phone=${encodeURIComponent(PHONE_LEAD_ONLY)}`);
    ok('TC3', 'Lead-only → 200', r.status === 200);
    ok('TC3', 'Lead-only → exists=true', r.data.exists === true);
    ok('TC3', 'Lead-only → hasAccount=false', r.data.hasAccount === false);
    ok('TC3', 'Lead-only → hasCompanyProfile=false', r.data.hasCompanyProfile === false);
  }

  // TC4: phone in users with company_profile
  {
    const r = await get(`/company-leads/check-phone?phone=${encodeURIComponent(PHONE_USER_CP)}`);
    ok('TC4', 'User+CP → exists=true', r.data.exists === true);
    ok('TC4', 'User+CP → hasAccount=true', r.data.hasAccount === true);
    ok('TC4', 'User+CP → hasCompanyProfile=true', r.data.hasCompanyProfile === true);
  }

  // TC5: phone in users without company_profile
  {
    const r = await get(`/company-leads/check-phone?phone=${encodeURIComponent(PHONE_USER_NOCP)}`);
    ok('TC5', 'User no CP → exists=true', r.data.exists === true);
    ok('TC5', 'User no CP → hasAccount=true', r.data.hasAccount === true);
    ok('TC5', 'User no CP → hasCompanyProfile=false', r.data.hasCompanyProfile === false);
  }

  // TC6: phone in both company_leads and users
  {
    const r = await get(`/company-leads/check-phone?phone=${encodeURIComponent(PHONE_BOTH)}`);
    ok('TC6', 'Both → exists=true', r.data.exists === true);
    ok('TC6', 'Both → hasAccount=true', r.data.hasAccount === true);
  }

  // TC7: soft-deleted user → should NOT count as existing account
  {
    const r = await get(`/company-leads/check-phone?phone=${encodeURIComponent(PHONE_DELETED)}`);
    ok('TC7', 'Deleted user → hasAccount=false', r.data.hasAccount === false);
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('  Failures:');
    failures.forEach(f => console.log(`    - ${f}`));
  }
  console.log(`${'═'.repeat(50)}\n`);

  await cleanup();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
