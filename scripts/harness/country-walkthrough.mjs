#!/usr/bin/env node
/**
 * country-walkthrough.mjs — 各类注册/提交入口的国家归属用例走查
 * 用法: node scripts/harness/country-walkthrough.mjs
 *
 * 前提:
 *   - 本地后端 localhost:3002 已启动（server/.env DB_HOST=localhost）
 *   - 本地 MySQL tarmeer 库，admin_users 里有 harness-test@tarmeer.local
 *
 * 每个用例 = 模拟一次用户侧写入 → 用 admin 接口按 country=vn / country=ae
 * 分别查询，断言数据落入正确的国家桶。结束后清理测试数据。
 */

import { execSync } from 'child_process';

const API = 'http://localhost:3002/api';
const ADMIN_EMAIL = 'harness-test@tarmeer.local';
const ADMIN_PASSWORD = 'Harness#Local123';
// 测试夹具用的假密码（非真实凭证）
const TEST_PASSWORD = 'Walk#12345';
const TEST_STAFF_PASSWORD = 'Walk#12345678';
const TS = Date.now();
const MARK = `walk${TS}`;

let pass = 0, fail = 0, bug = 0;
const bugs = [];

function ok(label) { console.log(`  \x1b[32m✓\x1b[0m ${label}`); pass++; }
function ng(label, detail) { console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ' — ' + detail : ''}`); fail++; }
function knownBug(label, detail) {
  console.log(`  \x1b[33m⚠\x1b[0m ${label} — ${detail}`);
  bug++; bugs.push(`${label}: ${detail}`);
}

function sql(query) {
  return execSync(`mysql -u root -proot123 tarmeer -N -e ${JSON.stringify(query)} 2>/dev/null`, { encoding: 'utf8' }).trim();
}

async function req(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, body: json };
}

// ─── 准备: admin 登录 ────────────────────────────────────────────────────────
const login = await req('POST', '/admin/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
const adminToken = login.body?.token || login.body?.accessToken;
if (!adminToken) {
  console.error('admin 登录失败:', login.status, JSON.stringify(login.body));
  process.exit(1);
}
console.log(`admin 登录成功（${ADMIN_EMAIL}）\n`);

async function adminGet(path) {
  return req('GET', path, null, adminToken);
}

// 注册一个用户并登录拿 token（本地 SMTP 未配置时需手动置 email_verified）
async function registerAndLogin(email, password, phone, role) {
  const reg = await req('POST', '/auth/register', {
    email, password, full_name: `WALK ${email.split('@')[0]}`, phone, ...(role ? { role } : {}),
  });
  if (reg.status !== 201) return { error: `register ${reg.status}: ${JSON.stringify(reg.body)}` };
  sql(`UPDATE users SET email_verified=1 WHERE email='${email}'`);
  const lg = await req('POST', '/auth/login', { email, password });
  const token = lg.body?.token || lg.body?.accessToken;
  if (!token) return { error: `login ${lg.status}: ${JSON.stringify(lg.body)}` };
  return { token };
}

// ─── UC1/UC2 业主注册（手机号前缀定国家）─────────────────────────────────────
console.log('[UC1] VN 业主注册（+84 手机号）→ admin users country=vn');
{
  const email = `uc1_${MARK}@walk.local`;
  const reg = await req('POST', '/auth/register', {
    email, password: TEST_PASSWORD, full_name: 'WALK VN Homeowner', phone: `+84886${String(TS).slice(-6)}`,
  });
  if (reg.status !== 201) ng('注册请求', `${reg.status} ${JSON.stringify(reg.body)}`);
  else {
    const inVn = await adminGet(`/admin/users?country=vn&search=uc1_${MARK}`);
    const inAe = await adminGet(`/admin/users?country=ae&search=uc1_${MARK}`);
    const foundVn = (inVn.body?.users || []).some(u => u.email === email);
    const foundAe = (inAe.body?.users || []).some(u => u.email === email);
    if (foundVn && !foundAe) ok('落入 VN 桶，AE 不可见');
    else ng('国家归属', `vn=${foundVn} ae=${foundAe}（预期 vn=true ae=false）`);
  }
}

console.log('[UC2] AE 业主注册（+971 手机号）→ admin users country=ae');
{
  const email = `uc2_${MARK}@walk.local`;
  const reg = await req('POST', '/auth/register', {
    email, password: TEST_PASSWORD, full_name: 'WALK AE Homeowner', phone: `+97150${String(TS).slice(-7)}`,
  });
  if (reg.status !== 201) ng('注册请求', `${reg.status} ${JSON.stringify(reg.body)}`);
  else {
    const inVn = await adminGet(`/admin/users?country=vn&search=uc2_${MARK}`);
    const inAe = await adminGet(`/admin/users?country=ae&search=uc2_${MARK}`);
    const foundVn = (inVn.body?.users || []).some(u => u.email === email);
    const foundAe = (inAe.body?.users || []).some(u => u.email === email);
    if (foundAe && !foundVn) ok('落入 AE 桶，VN 不可见');
    else ng('国家归属', `vn=${foundVn} ae=${foundAe}（预期 ae=true vn=false）`);
  }
}

// ─── UC3/UC4 公司注册（users.phone 前缀 → company_profiles.country）─────────
let vnCompanyProfileId = null;
let vnCompanySlug = null;

console.log('[UC3] VN 公司注册（+84 手机号 → company profile）→ country=vn');
{
  const email = `uc3_${MARK}@walk.local`;
  const auth = await registerAndLogin(email, TEST_PASSWORD, `+84887${String(TS).slice(-6)}`, 'company');
  if (auth.error) ng('注册/登录', auth.error);
  else {
    const prof = await req('POST', '/auth/company/profile', {
      company_name: `WALK VN Company ${MARK}`, city: 'Hồ Chí Minh', phone: `+84887${String(TS).slice(-6)}`,
    }, auth.token);
    if (prof.status >= 400) ng('创建公司 profile', `${prof.status} ${JSON.stringify(prof.body)}`);
    else {
      const row = sql(`SELECT id, slug, country FROM company_profiles WHERE company_name='WALK VN Company ${MARK}'`);
      const [id, slug, country] = row.split('\t');
      vnCompanyProfileId = id; vnCompanySlug = slug;
      if (country === 'vn') ok(`company_profiles.country='vn'（slug=${slug}）`);
      else ng('company_profiles.country', `实际='${country}' 预期='vn'`);
    }
  }
}

console.log('[UC4] AE 公司注册（+971 手机号）→ country=ae');
{
  const email = `uc4_${MARK}@walk.local`;
  const auth = await registerAndLogin(email, TEST_PASSWORD, `+97152${String(TS).slice(-7)}`, 'company');
  if (auth.error) ng('注册/登录', auth.error);
  else {
    const prof = await req('POST', '/auth/company/profile', {
      company_name: `WALK AE Company ${MARK}`, city: 'Dubai', phone: `+97152${String(TS).slice(-7)}`,
    }, auth.token);
    if (prof.status >= 400) ng('创建公司 profile', `${prof.status} ${JSON.stringify(prof.body)}`);
    else {
      const country = sql(`SELECT country FROM company_profiles WHERE company_name='WALK AE Company ${MARK}'`);
      if (country === 'ae') ok("company_profiles.country='ae'");
      else ng('company_profiles.country', `实际='${country}' 预期='ae'`);
    }
  }
}

// ─── UC5 VN 首页 Banner 询盘（已知前端发 city='Hồ Chí Minh'）────────────────
console.log("[UC5] VN 首页 Banner 询盘（city='Hồ Chí Minh'）→ 应 201 且落 VN 桶");
{
  const phone = `+84888${String(TS).slice(-6)}`;
  const r = await req('POST', '/inquiries', {
    name: 'WALK VN Banner', phone, city: 'Hồ Chí Minh', area_range: '80m²', source_page: 'home-banner',
  });
  if (r.status === 201) {
    const inVn = await adminGet(`/admin/inquiries?country=vn&search=${encodeURIComponent(phone)}`);
    const foundVn = (inVn.body?.inquiries || []).some(i => i.phone === phone);
    if (foundVn) ok('提交成功且落入 VN 桶');
    else knownBug('VN Banner 询盘落桶', '提交成功但 country=vn 查不到（company_id 为空 → 归 AE）');
  } else {
    knownBug('VN Banner 询盘提交', `被拒 ${r.status}: ${r.body?.error}（后端 VALID_CITIES 只有阿联酋城市）`);
  }
}

// ─── UC6 AE 首页 Banner 询盘 ─────────────────────────────────────────────────
console.log("[UC6] AE 首页 Banner 询盘（city='Dubai'）→ 201 且落 AE 桶");
{
  const phone = `+97155${String(TS).slice(-7)}`;
  const r = await req('POST', '/inquiries', {
    name: 'WALK AE Banner', phone, city: 'Dubai', area_range: '120m²', source_page: 'home-banner',
  });
  if (r.status !== 201) ng('提交', `${r.status} ${JSON.stringify(r.body)}`);
  else {
    const inAe = await adminGet(`/admin/inquiries?country=ae&search=${encodeURIComponent(phone)}`);
    const inVn = await adminGet(`/admin/inquiries?country=vn&search=${encodeURIComponent(phone)}`);
    const foundAe = (inAe.body?.inquiries || []).some(i => i.phone === phone);
    const foundVn = (inVn.body?.inquiries || []).some(i => i.phone === phone);
    if (foundAe && !foundVn) ok('落入 AE 桶，VN 不可见');
    else ng('国家归属', `ae=${foundAe} vn=${foundVn}`);
  }
}

// ─── UC7 VN 公司详情页询盘（带 company_id，不带 city）──────────────────────
console.log('[UC7] VN 公司询盘（company_id 指向 VN 公司）→ 落 VN 桶');
if (!vnCompanyProfileId) {
  ng('前置条件', 'UC3 未创建出 VN 公司，跳过');
} else {
  const phone = `+84889${String(TS).slice(-6)}`;
  const r = await req('POST', '/inquiries', {
    name: 'WALK VN CompanyInquiry', phone, area_range: '95m²',
    company_id: Number(vnCompanyProfileId), source_company_name: `WALK VN Company ${MARK}`,
  });
  if (r.status !== 201) ng('提交', `${r.status} ${JSON.stringify(r.body)}`);
  else {
    const inVn = await adminGet(`/admin/inquiries?country=vn&search=${encodeURIComponent(phone)}`);
    const inAe = await adminGet(`/admin/inquiries?country=ae&search=${encodeURIComponent(phone)}`);
    const foundVn = (inVn.body?.inquiries || []).some(i => i.phone === phone);
    const foundAe = (inAe.body?.inquiries || []).some(i => i.phone === phone);
    if (foundVn && !foundAe) ok('落入 VN 桶，AE 不可见');
    else ng('国家归属', `vn=${foundVn} ae=${foundAe}`);
  }
}

// ─── UC8 投诉：vn- 前缀 slug（目录公司）→ VN 桶 ────────────────────────────
console.log('[UC8] 投诉 vn- 前缀目录公司 → 落 VN 桶');
{
  const r = await req('POST', '/complaints', {
    company_slug: `vn-walk-target-${MARK}`, reporter_name: `WALK Reporter ${MARK}`,
    reporter_email: `uc8_${MARK}@walk.local`, description: 'walkthrough test complaint',
  });
  if (r.status !== 201) ng('提交', `${r.status} ${JSON.stringify(r.body)}`);
  else {
    const inVn = await adminGet(`/admin/complaints?country=vn&search=${MARK}`);
    const foundVn = (inVn.body?.complaints || []).some(c => c.reporter_email === `uc8_${MARK}@walk.local`);
    if (foundVn) ok('落入 VN 桶');
    else ng('国家归属', 'country=vn 查不到');
  }
}

// ─── UC9 投诉：注册的 VN 公司（slug 无 vn- 前缀）→ 暴露归属漏洞 ─────────────
console.log('[UC9] 投诉注册的 VN 公司（email slug 无 vn- 前缀）→ 验证归属');
if (!vnCompanySlug) {
  ng('前置条件', 'UC3 未创建出 VN 公司，跳过');
} else {
  const r = await req('POST', '/complaints', {
    company_slug: vnCompanySlug, reporter_name: `WALK Reporter9 ${MARK}`,
    reporter_email: `uc9_${MARK}@walk.local`, description: 'walkthrough complaint against registered vn company',
  });
  if (r.status !== 201) ng('提交', `${r.status} ${JSON.stringify(r.body)}`);
  else {
    const inVn = await adminGet(`/admin/complaints?country=vn&search=Reporter9`);
    const inAe = await adminGet(`/admin/complaints?country=ae&search=Reporter9`);
    const foundVn = (inVn.body?.complaints || []).some(c => c.reporter_email === `uc9_${MARK}@walk.local`);
    const foundAe = (inAe.body?.complaints || []).some(c => c.reporter_email === `uc9_${MARK}@walk.local`);
    if (foundVn && !foundAe) ok('落入 VN 桶');
    else knownBug('注册 VN 公司的投诉落桶', `vn=${foundVn} ae=${foundAe}（slug='${vnCompanySlug}' 无 vn- 前缀 → 按 slug 推断归 AE）`);
  }
}

// ─── UC10 供应商注册 → supplier_profiles.country ────────────────────────────
console.log('[UC10] VN 供应商注册（+84 手机号）→ supplier_profiles.country');
{
  const email = `uc10_${MARK}@walk.local`;
  const r = await req('POST', '/supplier/auth/register', {
    email, password: TEST_PASSWORD, full_name: `WALK VN Supplier ${MARK}`, phone: `+84890${String(TS).slice(-6)}`,
  });
  if (r.status !== 201) ng('注册', `${r.status} ${JSON.stringify(r.body)}`);
  else {
    const country = sql(`SELECT sp.country FROM supplier_profiles sp JOIN supplier_users su ON sp.supplier_user_id=su.id WHERE su.email='${email}'`);
    if (country === 'vn') ok("supplier_profiles.country='vn'");
    else knownBug('VN 供应商落桶', `supplier_profiles.country='${country}'（注册时不写 country，落库默认值 → VN 后台看不到）`);
  }
}

// ─── UC11 实地调研 → company_interviews.country ─────────────────────────────
console.log('[UC11] 实地调研创建+提交（VN 公司）→ company_interviews.country');
{
  const draft = await req('POST', '/field/interviews', {}, adminToken);
  const interviewId = draft.body?.id || draft.body?.interviewId || draft.body?.interview?.id;
  if (!interviewId) ng('创建草稿', `${draft.status} ${JSON.stringify(draft.body)}`);
  else {
    await req('PATCH', `/field/interviews/${interviewId}`, {
      company_name: `WALK VN Survey ${MARK}`,
      company_ref_id: vnCompanyProfileId ? Number(vnCompanyProfileId) : null,
      company_ref_source: 'profile',
      section_1: { note: 'walkthrough' },
    }, adminToken);
    await req('POST', `/field/interviews/${interviewId}/submit`, {}, adminToken);
    const country = sql(`SELECT country FROM company_interviews WHERE id=${interviewId}`);
    if (country === 'vn') ok("company_interviews.country='vn'");
    else knownBug('VN 实地调研落桶', `company_interviews.country='${country}'（创建/提交链路从不写 country → VN 视图查不到）`);
  }
}

// ─── UC12 外勤人员创建（归入当前国家）────────────────────────────────────────
console.log('[UC12] VN 视图创建外勤人员 → staff?country=vn 可见、ae 不可见');
{
  const email = `uc12_${MARK}@walk.local`;
  const r = await req('POST', '/admin/staff', {
    email, password: TEST_STAFF_PASSWORD, fullName: `WALK VN Staff ${MARK}`, country: 'vn',
  }, adminToken);
  if (r.status !== 201) ng('创建', `${r.status} ${JSON.stringify(r.body)}`);
  else {
    const inVn = await adminGet('/admin/staff?country=vn');
    const inAe = await adminGet('/admin/staff?country=ae');
    const foundVn = (inVn.body?.staff || []).some(s => s.email === email);
    const foundAe = (inAe.body?.staff || []).some(s => s.email === email);
    if (foundVn && !foundAe) ok('落入 VN 桶，AE 不可见');
    else ng('国家归属', `vn=${foundVn} ae=${foundAe}`);
  }
}

// ─── 清理测试数据 ────────────────────────────────────────────────────────────
console.log('\n清理测试数据…');
sql(`DELETE FROM design_inquiries WHERE name LIKE 'WALK %'`);
sql(`DELETE FROM complaints WHERE reporter_email LIKE '%${MARK}@walk.local'`);
sql(`DELETE FROM company_interviews WHERE company_name LIKE 'WALK VN Survey %'`);
sql(`DELETE FROM company_profiles WHERE company_name LIKE 'WALK % Company ${MARK}'`);
sql(`DELETE sp FROM supplier_profiles sp JOIN supplier_users su ON sp.supplier_user_id=su.id WHERE su.email LIKE '%${MARK}@walk.local'`);
sql(`DELETE FROM supplier_users WHERE email LIKE '%${MARK}@walk.local'`);
sql(`DELETE FROM users WHERE email LIKE '%${MARK}@walk.local'`);
sql(`DELETE FROM admin_users WHERE email LIKE '%${MARK}@walk.local' AND role='field_staff'`);

// ─── 汇总 ────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`通过 ${pass} · 失败 ${fail} · 已知问题 ${bug}`);
if (bugs.length) {
  console.log('\n发现的问题：');
  bugs.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
}
process.exit(fail > 0 ? 1 : 0);
