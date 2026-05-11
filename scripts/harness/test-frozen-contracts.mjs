#!/usr/bin/env node
/**
 * Harness: Frozen Contracts 验证
 *
 * 检查所有已定好的功能规范是否仍然完整。
 * 任何 FAIL 都表示代码发生了非预期的返祖，需要立即修复或获得用户明确许可。
 *
 * Usage: node scripts/harness/test-frozen-contracts.mjs
 */

import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;

function ok(tc, name, condition) {
  if (condition) {
    console.log(`  PASS  ${tc} | ${name}`);
    passed++;
  } else {
    console.log(`  FAIL  ${tc} | ${name}`);
    failed++;
  }
}

function read(path) {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    console.log(`  ERROR  Cannot read ${path}`);
    return '';
  }
}

// ─────────────────────────────────────────────
// A1. 目录装企详情 — 注册装企分支必须返回 is_claimed + projects[]
// ─────────────────────────────────────────────
console.log('\n--- A1: 目录装企详情 API — 注册装企分支 (companyController.ts) ---\n');
const compCtrl = read('server/src/controllers/companyController.ts');

ok('A1', 'is_claimed: true 出现在响应中', compCtrl.includes('is_claimed: true'));
ok('A1', 'projects: 出现在响应中（不是空数组）',
  compCtrl.includes('projects:') && compCtrl.includes('_registeredProjects'));
ok('A1', '不得将 owner_user_id 设为 null',
  !compCtrl.includes('owner_user_id = null') && !compCtrl.includes("owner_user_id: null"));
ok('A1', 'projects[] 包含 title 字段', compCtrl.includes("title: row.title"));
ok('A1', 'projects[] 包含 slug 字段', compCtrl.includes("slug: row.slug"));
ok('A1', 'projects[] 包含 images 字段', compCtrl.includes('images: imageUrls'));

// ─────────────────────────────────────────────
// A2/A3. 注册装企 — 联系方式隐藏 (publicCompanyController.ts)
// ─────────────────────────────────────────────
console.log('\n--- A2/A3: 注册装企 API 联系方式隐藏 (publicCompanyController.ts) ---\n');
const pubCtrl = read('server/src/controllers/publicCompanyController.ts');

// A2: 注册装企联系方式不出现在响应对象中（字段被省略而非 null）
const listFormatBlock = pubCtrl.slice(pubCtrl.indexOf('formattedCompanies'), pubCtrl.indexOf('res.json({', pubCtrl.indexOf('formattedCompanies')));
const detailFormatBlock = pubCtrl.slice(pubCtrl.indexOf('formattedCompany = {'), pubCtrl.indexOf('res.json({ company', pubCtrl.indexOf('formattedCompany = {')));
ok('A2', '列表响应对象不含 phone 字段', !listFormatBlock.includes('phone:'));
ok('A2', '列表响应对象不含 contact_person 字段', !listFormatBlock.includes('contact_person:'));
ok('A2', '列表响应对象不含 website 字段', !listFormatBlock.includes('website:'));
ok('A2', 'is_claimed: true 出现在详情', pubCtrl.includes('is_claimed: true'));
ok('A3', 'is_registered: true 出现在列表+详情 (≥2处)', (pubCtrl.match(/is_registered: true/g) || []).length >= 2);

// ─────────────────────────────────────────────
// A4. 目录装企序列化 — phone 永远隐藏，email 未认领时返回
// 业务决策 2026-05-11：所有公司 WA/电话号全部隐藏，引导走平台询价留资
// ─────────────────────────────────────────────
console.log('\n--- A4: 目录装企序列化 — phone 永远隐藏 (publicCompaniesSerialization.ts) ---\n');
const serial = read('server/src/lib/publicCompaniesSerialization.ts');

ok('A4', 'sanitizePublicCompany phone 永远返回空字符串', serial.includes("phone: '',"));
ok('A4', 'sanitizePublicCompany 返回 email（未认领时）', serial.includes("email: isClaimed ? '' : toPublicString(company.email)"));
ok('A4', 'is_claimed 基于 owner_user_id 计算', serial.includes('const isClaimed = !!(company.owner_user_id)'));
ok('A4', 'is_claimed 字段写入响应', serial.includes('is_claimed: isClaimed'));
ok('A4', '不得硬编码 is_claimed: false', !serial.includes('is_claimed: false'));

// ─────────────────────────────────────────────
// A5. VIP is_signed 契约 (companyController.ts + publicCompaniesSerialization.ts)
// ─────────────────────────────────────────────
console.log('\n--- A5: VIP is_signed 契约 (companyController.ts) ---\n');

ok('A5', 'getCompanyBySlug SELECT 包含 cp.is_signed', compCtrl.includes('cp.is_signed'));
ok('A5', 'getCompanyBySlug 不硬编码 is_signed = false', !compCtrl.includes('company.is_signed = false'));
ok('A5', 'getCompanyBySlug 正确用 !!() 转换', compCtrl.includes('company.is_signed = !!(company.is_signed)'));
ok('A5', 'serialization 返回 is_signed 字段', serial.includes('is_signed: !!(company.is_signed)'));
const adminRoutes = read('server/src/routes/admin.ts');
ok('A5', 'toggle-signed 路由不含 requireSuperAdmin',
  adminRoutes.includes("toggle-signed'") && !adminRoutes.includes("toggle-signed', requireSuperAdmin"));

// ─────────────────────────────────────────────
// A6. CRM 推送隔离 (companyLeadController.ts)
// ─────────────────────────────────────────────
console.log('\n--- A6: CRM 推送隔离 (companyLeadController.ts) ---\n');
const crmCtrl = read('server/src/controllers/companyLeadController.ts');

ok('A6', '只调用 pushCompanyLeadToCRM（装企 tenant）', crmCtrl.includes('pushCompanyLeadToCRM('));
ok('A6', 'mirror inquiry 不调用 pushLeadToCRM', !crmCtrl.includes('pushLeadToCRM('));
ok('A6', 'mirror inquiry 标记 crm_sync_status = synced',
  crmCtrl.includes('crm_sync_status') && crmCtrl.includes("'synced'"));
ok('A6', 'submitCompanyLead 有字段截断保护', crmCtrl.includes('.slice(0,'));

// ─────────────────────────────────────────────
// B1/B2/B3. 公司详情页 — 项目展示契约
// B2 布局已提取到 CompanyProjectsSection 组件，同时检查两个文件
// ─────────────────────────────────────────────
console.log('\n--- B1/B2/B3: 公司详情页 项目展示契约 (CompanyDetailPage + CompanyProjectsSection) ---\n');
const detailPage = read('src/pages/CompanyDetailPage.tsx');
const projectsSection = (() => { try { return read('src/components/CompanyProjectsSection.tsx'); } catch { return ''; } })();

ok('B1', "portfolioMode 初始值为 'project'",
  detailPage.includes("useState<'project' | 'style'>('project')"));
ok('B1', '项目卡片触发条件: isClaimed && projects && projects.length > 0',
  detailPage.includes('company.isClaimed && company.projects && company.projects.length > 0'));
ok('B2', '项目卡片布局: grid-cols-1 sm:grid-cols-2',
  detailPage.includes('grid-cols-1 sm:grid-cols-2') || projectsSection.includes('grid-cols-1 sm:grid-cols-2'));
ok('B2', '卡片封面图比例: aspect-video',
  detailPage.includes('aspect-video') || projectsSection.includes('aspect-video'));
ok('B2', '多图角标显示图片数量',
  detailPage.includes('proj.images.length > 1') || projectsSection.includes('proj.images.length > 1'));
ok('B3', '图片点击跳转项目详情页',
  detailPage.includes('navigate(`/companies/${company.id}/${proj.slug}`)') ||
  detailPage.includes("navigate(`/companies/${company.id}/${projectSlug}`)"));
ok('B3', 'isClaimed + projects → 跳转而非 Lightbox',
  detailPage.includes("company?.isClaimed && company.projects?.length"));

// ─────────────────────────────────────────────
// B5. 公司列表数据合并顺序 (publicApi.ts)
// ─────────────────────────────────────────────
console.log('\n--- B5: 公司列表合并顺序 (src/lib/publicApi.ts) ---\n');
const publicApi = read('src/lib/publicApi.ts');

ok('B5', '先请求目录公司 /api/companies', publicApi.includes('`/companies?limit='));
ok('B5', '后请求注册装企 /api/public/companies', publicApi.includes('`/public/companies?limit='));
ok('B5', '合并时目录公司排在前（directoryCompanies 先展开）',
  publicApi.includes('...directoryCompanies,') &&
  publicApi.indexOf('...directoryCompanies,') < publicApi.indexOf('...approvedCompanies'));
ok('B5', '按名称去重，目录公司优先',
  publicApi.includes('seenNames') && publicApi.includes('directoryCompanies.map'));

// ─────────────────────────────────────────────
// B6. Google One Tap 排除路径 (GoogleOneTap.tsx)
// ─────────────────────────────────────────────
console.log('\n--- B6: Google One Tap 排除路径 (GoogleOneTap.tsx) ---\n');
const oneTap = read('src/components/GoogleOneTap.tsx');

const requiredPaths = ['/auth', '/login', '/register', '/designer/', '/for-companies', '/join', '/admin', '/verify-email'];
for (const p of requiredPaths) {
  ok('B6', `EXCLUDED_PATHS 包含 '${p}'`, oneTap.includes(`'${p}'`));
}

// ─────────────────────────────────────────────
// C1. CORS 生产白名单 (corsOrigins.ts)
// ─────────────────────────────────────────────
console.log('\n--- C1: CORS 生产白名单 (server/src/lib/corsOrigins.ts) ---\n');
const cors = read('server/src/lib/corsOrigins.ts');

ok('C1', 'www.tarmeer.com 在白名单', cors.includes("'https://www.tarmeer.com'"));
ok('C1', 'tarmeer.com 在白名单', cors.includes("'https://tarmeer.com'"));
ok('C1', 'admin.tarmeer.com 在白名单', cors.includes("'https://admin.tarmeer.com'"));

// ─────────────────────────────────────────────
// C2. DB 字段截断 (companyLeadController.ts) — crmCtrl from A6
// ─────────────────────────────────────────────
console.log('\n--- C2: DB 字段截断 (companyLeadController.ts) ---\n');

ok('C2', 'sourcePage 截断 ≤500',
  crmCtrl.includes('.slice(0, 500)'));
ok('C2', 'companyName 截断 ≤200',
  crmCtrl.includes('.slice(0, 200)'));
ok('C2', 'contactName 截断 ≤100',
  crmCtrl.includes('.slice(0, 100)'));

// ─────────────────────────────────────────────
// 汇总
// ─────────────────────────────────────────────
console.log(`\n${'='.repeat(60)}`);
console.log(`  RESULT: ${passed} PASS, ${failed} FAIL`);
if (failed > 0) {
  console.log(`\n  !! 有 ${failed} 个契约被破坏 — 请检查上方 FAIL 条目`);
  console.log(`  !! 如果是故意修改，需要用户明确许可并更新 CLAUDE.md Frozen Contracts`);
}
console.log(`${'='.repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
