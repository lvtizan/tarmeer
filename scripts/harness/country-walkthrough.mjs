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

// ─── UC4b 手机号查重：同号不能重复注册 ────────────────────────────────────────
console.log('[UC4b] 同手机号重复注册/提交 → 应被拦截');
{
  const dupPhone = `+97152${String(TS).slice(-7)}`; // UC4 已用此号注册（users.phone + company_profiles.phone）
  // (a) 顶层 phone 重复注册
  const r1 = await req('POST', '/auth/register', {
    email: `uc4b1_${MARK}@walk.local`, password: TEST_PASSWORD, full_name: 'WALK Dup1', phone: dupPhone, role: 'company',
  });
  if (r1.status === 400 && /phone/i.test(JSON.stringify(r1.body))) ok('顶层 phone 重复注册被拦截 400');
  else ng('顶层 phone 重复未拦截', `${r1.status} ${JSON.stringify(r1.body)}`);
  // (b) phone 藏在 pending_profile 里（原漏洞路径：注册时不落顶层 phone）
  const r2 = await req('POST', '/auth/register', {
    email: `uc4b2_${MARK}@walk.local`, password: TEST_PASSWORD, full_name: 'WALK Dup2', role: 'company',
    pending_profile: { company_name: 'WALK Dup2 Co', phone: dupPhone },
  });
  if (r2.status === 400 && /phone/i.test(JSON.stringify(r2.body))) ok('pending_profile 内 phone 重复注册被拦截 400');
  else ng('pending_profile phone 重复未拦截', `${r2.status} ${JSON.stringify(r2.body)}`);
  // (c) 已注册号提交装企线索 → 409 引导登录
  const r3 = await req('POST', '/company-leads', {
    contactName: 'WALK DupLead', phone: dupPhone, companyName: 'WALK DupLead Co', city: 'Dubai',
  });
  if (r3.status === 409 && r3.body?.phoneExists) ok('已注册号提交线索 → 409 引导登录');
  else ng('已注册号线索未拦截', `${r3.status} ${JSON.stringify(r3.body)}`);
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

// ─── UC13 手填公司名提交 → 同国家精确匹配自动绑定 ───────────────────────────
console.log('[UC13] 手填公司名提交调研 → 自动绑定同国家精确匹配的公司');
{
  const draft = await req('POST', '/field/interviews', {}, adminToken);
  const ivId = draft.body?.id;
  if (!ivId) ng('创建草稿', `${draft.status} ${JSON.stringify(draft.body)}`);
  else {
    await req('PATCH', `/field/interviews/${ivId}`, { company_name: `WALK AE Company ${MARK}`, section_1: { note: 'autobind' } }, adminToken);
    await req('POST', `/field/interviews/${ivId}/submit`, {}, adminToken);
    const row = sql(`SELECT company_ref_id, company_ref_source, country FROM company_interviews WHERE id=${ivId}`);
    const [refId, refSource, ivCountry] = row.split('\t');
    if (refSource === 'profile' && refId !== 'NULL' && ivCountry === 'ae') ok(`自动绑定 profile#${refId}，country='ae'`);
    else ng('自动绑定', `ref=${refSource}#${refId} country=${ivCountry}`);

    // ─ UC14 后台改绑到 VN 公司 → country 跟随同步
    console.log('[UC14] 后台改绑到 VN 公司 → 访谈 country 同步为 vn');
    if (!vnCompanyProfileId) ng('前置条件', 'UC3 未创建 VN 公司');
    else {
      const patch = await req('PATCH', `/admin/interviews/${ivId}`, {
        company_ref_id: Number(vnCompanyProfileId), company_ref_source: 'profile',
      }, adminToken);
      if (patch.status !== 200) ng('改绑', `${patch.status} ${JSON.stringify(patch.body)}`);
      else {
        const c = sql(`SELECT country FROM company_interviews WHERE id=${ivId}`);
        if (c === 'vn') ok("country 已同步为 'vn'");
        else ng('country 同步', `实际='${c}'`);
      }
    }
  }
}

// ─── UC15 访谈记录菜单计数 + 已读交互 ───────────────────────────────────────
console.log('[UC15] 提交调研 → notifications/counts 的 totalInterviews/newInterviews 增长 → mark-seen 归零');
{
  const before = await adminGet('/admin/notifications/counts?country=ae');
  const t0 = before.body?.totalInterviews ?? -1;
  const draft = await req('POST', '/field/interviews', {}, adminToken);
  const ivId = draft.body?.id;
  if (!ivId || t0 < 0) ng('前置', `draft=${ivId} total0=${t0}`);
  else {
    await req('PATCH', `/field/interviews/${ivId}`, { company_name: `WALK Count Test ${MARK}`, section_1: { note: 'count' } }, adminToken);
    await req('POST', `/field/interviews/${ivId}/submit`, {}, adminToken);
    const after = await adminGet('/admin/notifications/counts?country=ae');
    const t1 = after.body?.totalInterviews ?? -1;
    const n1 = after.body?.newInterviews ?? -1;
    if (t1 === t0 + 1 && n1 >= 1) ok(`totalInterviews ${t0}→${t1}，newInterviews=${n1}`);
    else ng('计数', `total ${t0}→${t1}，new=${n1}`);

    const seen = await req('PUT', '/admin/notifications/mark-seen?page=visit-records', null, adminToken);
    const cleared = await adminGet('/admin/notifications/counts?country=ae');
    const n2 = cleared.body?.newInterviews ?? -1;
    if (seen.status === 200 && n2 === 0) ok('mark-seen 后 newInterviews=0');
    else ng('已读清零', `seen=${seen.status} new=${n2}`);
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

// ─── UC16 认证开关（¥1000 普通认证，与 VIP 并存）────────────────────────────
console.log('[UC16] 目录公司认证开关 → 公开详情 is_certified 跟随变化');
let walkDirId = null;
{
  sql(`INSERT INTO uae_companies (name_en, slug, phone, country, is_active, is_published) VALUES ('WALK Dir Co ${MARK}', 'walk-dir-${MARK}', '+97150${String(TS).slice(-7)}', 'ae', 1, 1)`);
  walkDirId = sql(`SELECT id FROM uae_companies WHERE slug='walk-dir-${MARK}'`);
  if (!walkDirId) ng('建测试目录公司', 'INSERT 失败');
  else {
    const on = await req('PUT', `/admin/companies/${walkDirId}/toggle-certified`, { is_certified: true }, adminToken);
    const det1 = await req('GET', `/companies/walk-dir-${MARK}`);
    const off = await req('PUT', `/admin/companies/${walkDirId}/toggle-certified`, { is_certified: false }, adminToken);
    const det2 = await req('GET', `/companies/walk-dir-${MARK}`);
    const c1 = det1.body?.company?.is_certified;
    const c2 = det2.body?.company?.is_certified;
    if (on.status === 200 && off.status === 200 && c1 === true && c2 === false) ok('开→详情 true，关→详情 false');
    else ng('认证开关', `on=${on.status} off=${off.status} c1=${c1} c2=${c2}`);
  }
}

// ─── UC17 电话点击显隐 + 计数 + 去重 ────────────────────────────────────────
console.log('[UC17] 详情不返回电话 → reveal 返回完整号并计数 → 同 IP 当天去重 → 统计可见');
if (!walkDirId) {
  ng('前置条件', 'UC16 未建出目录公司');
} else {
  const det = await req('GET', `/companies/walk-dir-${MARK}`);
  const leaked = det.body?.company?.phone;
  const hasPhone = det.body?.company?.has_phone;
  if (leaked) ng('电话泄漏', `详情接口返回了完整电话 ${leaked}`);
  else if (!hasPhone) ng('has_phone 标志', '应为 true');
  else {
    const r1 = await req('POST', '/phone-reveals', { target_type: 'uae', target_id: Number(walkDirId) });
    const r2 = await req('POST', '/phone-reveals', { target_type: 'uae', target_id: Number(walkDirId) });
    const cnt = sql(`SELECT COUNT(*) FROM phone_reveals WHERE target_type='uae' AND target_id=${walkDirId}`);
    const ctry = sql(`SELECT country FROM phone_reveals WHERE target_type='uae' AND target_id=${walkDirId} LIMIT 1`);
    if (r1.status === 200 && r1.body?.phone && r2.status === 200 && cnt === '1' && ctry === 'ae') {
      ok(`reveal 返回电话，计数 1（去重生效），country='ae'`);
    } else ng('reveal/计数', `r1=${r1.status} phone=${!!r1.body?.phone} r2=${r2.status} cnt=${cnt} country=${ctry}`);
    const stats = await adminGet('/admin/analytics/phone-reveals?country=ae&days=7');
    const inTop = (stats.body?.top || []).some(t => t.target_type === 'uae' && String(t.target_id) === String(walkDirId));
    if (stats.status === 200 && inTop) ok('admin 统计排行可见');
    else ng('统计', `${stats.status} inTop=${inTop}`);
  }
}

// ─── UC18 注册 pending_profile → 邮箱验证后服务端自动建档 ───────────────────
console.log('[UC18] 公司注册带 pending_profile → verify-email 后自动建 company_profiles（type/country 正确）');
{
  const email = `uc18_${MARK}@walk.local`;
  const phone = `+84891${String(TS).slice(-6)}`;
  const reg = await req('POST', '/auth/register', {
    email, password: TEST_PASSWORD, full_name: 'WALK PA Contact', phone, role: 'company',
    pending_profile: {
      company_name: `WALK PA Company ${MARK}`, company_type: 'fitout_contractor',
      city: 'Hồ Chí Minh', phone, services: ['Interior Design'],
      contact_person: 'WALK PA Contact', establishment_year: 2021,
    },
  });
  if (reg.status !== 201) ng('注册请求', `${reg.status} ${JSON.stringify(reg.body)}`);
  else {
    const token = sql(`SELECT verification_token FROM users WHERE email='${email}'`);
    if (!token) ng('前置', '取不到 verification_token');
    else {
      const ver = await req('POST', '/auth/verify-email', { token });
      const row = sql(`SELECT cp.company_type, cp.country, cp.status FROM company_profiles cp JOIN users u ON u.id=cp.user_id WHERE u.email='${email}'`);
      const [ctype, country, status] = row.split('\t');
      if (ver.status === 200 && ctype === 'fitout_contractor' && country === 'vn' && status === 'pending') {
        ok(`verify 后自动建档：type='${ctype}' country='${country}' status='${status}'`);
      } else ng('自动建档', `verify=${ver.status} row='${row}'（预期 fitout_contractor/vn/pending）`);
      const cleared = sql(`SELECT pending_actions IS NULL FROM users WHERE email='${email}'`);
      if (cleared === '1') ok('pending_actions 已清空');
      else ng('pending_actions 清空', `IS NULL = '${cleared}'`);
    }
  }
}

// ─── UC19 lead-backfill：company_type 为 NULL 的线索不再 500 ────────────────
console.log('[UC19] 线索 company_type=NULL → 登录后 GET /auth/company/profile 自动建档（fallback type + country）');
{
  const email = `uc19_${MARK}@walk.local`;
  const phone = `+84892${String(TS).slice(-6)}`;
  sql(`INSERT INTO company_leads (contact_name, phone, company_name, city, email, company_type) VALUES ('WALK Lead Contact', '${phone}', 'WALK Lead Company ${MARK}', 'Hà Nội', '${email}', NULL)`);
  const auth = await registerAndLogin(email, TEST_PASSWORD, phone, 'company');
  if (auth.error) ng('注册/登录', auth.error);
  else {
    const prof = await req('GET', '/auth/company/profile', null, auth.token);
    const created = prof.body?.profile;
    if (prof.status !== 200) ng('getProfile', `${prof.status} ${JSON.stringify(prof.body)}（修复前此处 500）`);
    else if (!created) ng('自动建档', 'profile 为 null，lead-backfill 未生效');
    else if (created.company_type === 'renovation_company' && created.country === 'vn') {
      ok(`backfill 成功：type 兜底='${created.company_type}' country='${created.country}'`);
    } else ng('字段', `type='${created.company_type}'（预期 renovation_company）country='${created.country}'（预期 vn）`);
  }
}

// ─── UC20 专家全链路（注册落桶→审核→认证→电话点击→留言收件箱）──────────────
console.log('[UC20] VN 专家：注册→资料→审核→认证→电话 reveal→留言→收件箱/数据');
{
  const email = `uc20_${MARK}@walk.local`;
  const expPhone = `+84893${String(TS).slice(-6)}`;
  const auth = await registerAndLogin(email, TEST_PASSWORD, expPhone, 'expert');
  if (auth.error) ng('专家注册/登录', auth.error);
  else {
    const prof = await req('POST', '/experts/me', {
      full_name: `WALK VN Expert ${MARK}`, phone: expPhone, city: 'Hồ Chí Minh',
      services: ['Interior Design'], experience_years: 8, birth_year: 1990,
      bio: 'walkthrough expert', skills: ['Tiling'],
      work_history: [{ from: '2018', to: '2024', org: 'Test Co', role: 'Lead' }],
    }, auth.token);
    const slug = prof.body?.slug;
    const expertId = prof.body?.id;
    if (prof.status !== 201 || !slug) ng('创建专家资料', `${prof.status} ${JSON.stringify(prof.body)}`);
    else {
      const inVn = await adminGet('/admin/experts?country=vn');
      const inAe = await adminGet('/admin/experts?country=ae');
      const fVn = (inVn.body?.experts || []).some(e => e.id === expertId);
      const fAe = (inAe.body?.experts || []).some(e => e.id === expertId);
      if (fVn && !fAe) ok('专家落入 VN 桶，AE 不可见'); else ng('专家落桶', `vn=${fVn} ae=${fAe}`);

      const before = await req('GET', `/experts/${slug}`);
      await req('PUT', `/admin/experts/${expertId}/status`, { status: 'approved' }, adminToken);
      const after = await req('GET', `/experts/${slug}`);
      if (before.status === 404 && after.status === 200) ok('审核前 404，通过后公开可见');
      else ng('审核流转', `before=${before.status} after=${after.status}`);

      await req('PUT', `/admin/experts/${expertId}/toggle-certified`, { is_certified: true }, adminToken);
      const certed = await req('GET', `/experts/${slug}`);
      if (certed.body?.expert?.is_certified === true) ok('认证开关 → 公开详情 is_certified=true');
      else ng('专家认证', JSON.stringify(certed.body?.expert?.is_certified));

      const rev = await req('POST', '/phone-reveals', { target_type: 'expert', target_id: expertId });
      const revCount = sql(`SELECT COUNT(*) FROM phone_reveals WHERE target_type='expert' AND target_id=${expertId}`);
      const revCountry = sql(`SELECT country FROM phone_reveals WHERE target_type='expert' AND target_id=${expertId} LIMIT 1`);
      if (rev.status === 200 && rev.body?.phone === expPhone && revCount === '1' && revCountry === 'vn') {
        ok("reveal 返回电话，计数 1，country='vn'");
      } else ng('专家电话 reveal', `${rev.status} cnt=${revCount} country=${revCountry}`);

      const msgPhone = `+84894${String(TS).slice(-6)}`;
      const inq = await req('POST', '/inquiries', { name: 'WALK Expert Msg', phone: msgPhone, message: 'hello expert', expert_id: expertId, area_range: 'N/A' });
      const inbox = await req('GET', '/experts/me/inquiries', null, auth.token);
      const stats = await req('GET', '/experts/me/stats', null, auth.token);
      const inInbox = (inbox.body?.inquiries || []).some(i => i.phone === msgPhone);
      if (inq.status === 201 && inInbox && stats.body?.phoneReveals === 1 && stats.body?.inquiries === 1) {
        ok('留言进收件箱，我的数据（点击 1 / 留言 1）正确');
      } else ng('留言/数据', `inq=${inq.status} inbox=${inInbox} stats=${JSON.stringify(stats.body)}`);
    }
  }
}

// ─── UC21: 读侧国家隔离（portfolio / blog / 项目详情）────────────────────────
// 回归保护：sitemap + 公共内容页按国家取数，AE 视图不得出现 VN 内容（反之亦然）。
{
  console.log('\n[UC21] 读侧国家隔离：portfolio feed / articles / 项目详情跨国家 404');
  // 带 x-country header + ?country query 的公共读请求
  async function readC(path, country) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${API}${path}${sep}country=${country}`, { headers: { 'x-country': country } });
    let json = null; try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, body: json };
  }
  const companyCountry = (slug) => sql(`SELECT country FROM (SELECT slug, country FROM uae_companies UNION ALL SELECT slug, country FROM company_profiles) t WHERE slug=${JSON.stringify(slug)} LIMIT 1`);

  // 1) portfolio feed 按国家隔离：VN 取数全为 VN 公司，AE 取数无 VN 公司
  const pfVn = await readC('/companies/portfolio?page=1&limit=12', 'vn');
  const pfAe = await readC('/companies/portfolio?page=1&limit=12', 'ae');
  const vnProjects = pfVn.body?.projects || [];
  const aeProjects = pfAe.body?.projects || [];
  const vnLeak = vnProjects.map(p => p.companySlug).filter(s => s && companyCountry(s) === 'ae');
  const aeLeak = aeProjects.map(p => p.companySlug).filter(s => s && companyCountry(s) === 'vn');
  if (vnLeak.length === 0 && aeLeak.length === 0 && aeProjects.length > 0) {
    ok(`portfolio 国家隔离（VN ${vnProjects.length} 项 / AE ${aeProjects.length} 项，无跨国家泄漏）`);
  } else {
    ng('portfolio 跨国家泄漏', `vnLeak=${vnLeak.slice(0,3)} aeLeak=${aeLeak.slice(0,3)} aeN=${aeProjects.length}`);
  }

  // 2) articles 按国家隔离：AE 文章全部 country=ae，VN 仅 VN 文章
  const artAe = await readC('/articles/public?page=1&limit=50', 'ae');
  const artVn = await readC('/articles/public?page=1&limit=50', 'vn');
  const aeArts = artAe.body?.articles || [];
  const vnArts = artVn.body?.articles || [];
  const aeArtBad = aeArts.map(a => a.slug).filter(s => sql(`SELECT country FROM articles WHERE slug=${JSON.stringify(s)} LIMIT 1`) === 'vn');
  const vnArtBad = vnArts.map(a => a.slug).filter(s => sql(`SELECT country FROM articles WHERE slug=${JSON.stringify(s)} LIMIT 1`) === 'ae');
  if (aeArtBad.length === 0 && vnArtBad.length === 0) {
    ok(`articles 国家隔离（AE ${aeArts.length} 篇 / VN ${vnArts.length} 篇，无跨国家泄漏）`);
  } else {
    ng('articles 跨国家泄漏', `aeBad=${aeArtBad.slice(0,3)} vnBad=${vnArtBad.slice(0,3)}`);
  }

  // 3) 项目详情跨国家访问 → 404（VN 公司项目用 AE 视图打开应 404）
  if (vnProjects.length > 0) {
    const vp = vnProjects[0];
    const okView = await readC(`/companies/${vp.companySlug}/projects/${vp.slug}`, 'vn');
    const crossView = await readC(`/companies/${vp.companySlug}/projects/${vp.slug}`, 'ae');
    if (okView.status === 200 && crossView.status === 404) {
      ok('项目详情跨国家 404（VN 项目用 AE 视图 → 404，VN 视图 → 200）');
    } else {
      ng('项目详情跨国家隔离', `vnView=${okView.status} aeView=${crossView.status}`);
    }
  } else {
    knownBug('项目详情跨国家用例跳过', '本地无 VN portfolio 数据');
  }
}

// ─── UC22: 采购线索（sourcing_requests）国家归属（2026-07 转型新增写入口）──────
// 铁律第4条：用户侧写入口落库必须确定国家归属——phone +84/084 → vn，否则 req.country 兜底 ae。
{
  console.log('\n[UC22] 采购线索国家归属：+84 → vn / +971 → ae / 缺 name → 400');
  const vnPhone = `+84889${String(TS).slice(-6)}`;
  const aePhone = `+97155${String(TS).slice(-7)}`;
  const srVn = await req('POST', '/sourcing-requests', {
    request_type: 'visit', name: `WALK SR VN ${MARK}`, phone: vnPhone,
  });
  const srAe = await req('POST', '/sourcing-requests', {
    request_type: 'sourcing', name: `WALK SR AE ${MARK}`, phone: aePhone, city: 'Dubai',
  });
  const srBad = await req('POST', '/sourcing-requests', { request_type: 'visit', phone: aePhone });
  const vnCountry = sql(`SELECT country FROM sourcing_requests WHERE name='WALK SR VN ${MARK}' LIMIT 1`);
  const aeCountry = sql(`SELECT country FROM sourcing_requests WHERE name='WALK SR AE ${MARK}' LIMIT 1`);
  if (srVn.status === 201 && vnCountry === 'vn') ok(`+84 采购线索落 VN 桶（country=${vnCountry}）`);
  else ng('+84 采购线索国家归属', `status=${srVn.status} country=${vnCountry || '(missing)'}`);
  if (srAe.status === 201 && aeCountry === 'ae') ok(`+971 采购线索落 AE 桶（country=${aeCountry}）`);
  else ng('+971 采购线索国家归属', `status=${srAe.status} country=${aeCountry || '(missing)'}`);
  if (srBad.status === 400) ok('缺 name → 400（校验生效）');
  else ng('缺 name 校验', `status=${srBad.status}（预期 400）`);

  // admin 列表按 country 过滤：vn 视图见 VN 单，ae 视图不见
  const listVn = await adminGet(`/admin/sourcing-requests?country=vn&limit=50`);
  const listAe = await adminGet(`/admin/sourcing-requests?country=ae&limit=50`);
  const inVn = (listVn.body?.requests || []).some(r => r.name === `WALK SR VN ${MARK}`);
  const inAeWrong = (listAe.body?.requests || []).some(r => r.name === `WALK SR VN ${MARK}`);
  if (inVn && !inAeWrong) ok('admin 采购线索列表国家隔离（VN 单只在 VN 视图）');
  else ng('admin 采购线索列表国家隔离', `vn视图=${inVn} ae视图误现=${inAeWrong}`);
}

// ─── 清理测试数据 ────────────────────────────────────────────────────────────
console.log('\n清理测试数据…');
sql(`DELETE FROM sourcing_requests WHERE name LIKE 'WALK SR %'`);
sql(`DELETE FROM design_inquiries WHERE name LIKE 'WALK %'`);
sql(`DELETE FROM complaints WHERE reporter_email LIKE '%${MARK}@walk.local'`);
sql(`DELETE FROM company_interviews WHERE company_name LIKE 'WALK %'`);
sql(`DELETE FROM company_profiles WHERE company_name LIKE 'WALK % Company ${MARK}'`);
sql(`DELETE FROM company_leads WHERE company_name LIKE 'WALK Lead Company ${MARK}'`);
sql(`DELETE sp FROM supplier_profiles sp JOIN supplier_users su ON sp.supplier_user_id=su.id WHERE su.email LIKE '%${MARK}@walk.local'`);
sql(`DELETE FROM supplier_users WHERE email LIKE '%${MARK}@walk.local'`);
sql(`DELETE FROM users WHERE email LIKE '%${MARK}@walk.local'`);
sql(`DELETE FROM admin_users WHERE email LIKE '%${MARK}@walk.local' AND role='field_staff'`);
sql(`DELETE FROM phone_reveals WHERE target_type='uae' AND target_id IN (SELECT id FROM uae_companies WHERE slug LIKE 'walk-dir-%')`);
sql(`DELETE FROM uae_companies WHERE slug LIKE 'walk-dir-%'`);
sql(`DELETE FROM phone_reveals WHERE target_type='expert' AND target_id IN (SELECT id FROM expert_profiles WHERE full_name LIKE 'WALK %')`);
sql(`DELETE FROM expert_profiles WHERE full_name LIKE 'WALK %'`);

// ─── 汇总 ────────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`通过 ${pass} · 失败 ${fail} · 已知问题 ${bug}`);
if (bugs.length) {
  console.log('\n发现的问题：');
  bugs.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
}
process.exit(fail > 0 ? 1 : 0);
