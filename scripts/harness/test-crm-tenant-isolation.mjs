#!/usr/bin/env node
/**
 * Harness: CRM tenant isolation — 装企线索不能进业主 CRM 池
 *
 * 验证:
 * 1. 装企表单提交不调用 pushLeadToCRM（业主 tenant）
 * 2. mirror inquiry 不推 CRM，只在 DB 标记 synced
 * 3. 代码级检查：companyLeadController 不 import/调用 pushLeadToCRM
 *
 * 用法: node scripts/harness/test-crm-tenant-isolation.mjs
 */

import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;
const failures = [];

function ok(tc, name, condition) {
  if (condition) { console.log(`  PASS  ${tc} | ${name}`); passed++; }
  else { console.log(`  FAIL  ${tc} | ${name}`); failed++; failures.push(`${tc}: ${name}`); }
}

// ================================================================
// TC-1: companyLeadController 不直接调用 pushLeadToCRM
// ================================================================
console.log('\n--- TC-1: companyLeadController 不调用 pushLeadToCRM ---');

const ctrl = readFileSync('server/src/controllers/companyLeadController.ts', 'utf-8');

// 检查 import：应该只 import pushCompanyLeadToCRM，不 import pushLeadToCRM
// 或者如果 import 了 pushLeadToCRM，不能在 submitCompanyLead 函数里调用它
const importLine = ctrl.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/lib\/crmPush['"]/);
const importedFunctions = importLine ? importLine[1] : '';

// 找 submitCompanyLead 函数体
const submitFnMatch = ctrl.match(/export async function submitCompanyLead[\s\S]*?^}/m);
const submitFnBody = submitFnMatch ? submitFnMatch[0] : ctrl;

// 在 submitCompanyLead 函数体内不应该有 pushLeadToCRM 调用
const hasPushLeadInSubmit = /pushLeadToCRM\s*\(/.test(submitFnBody);
ok('TC-1', 'submitCompanyLead 不调用 pushLeadToCRM', !hasPushLeadInSubmit);

// 应该调用 pushCompanyLeadToCRM
const hasPushCompanyLead = /pushCompanyLeadToCRM\s*\(/.test(submitFnBody);
ok('TC-1', 'submitCompanyLead 调用 pushCompanyLeadToCRM', hasPushCompanyLead);

// ================================================================
// TC-2: mirror inquiry 不推 CRM
// ================================================================
console.log('\n--- TC-2: mirror inquiry 不推 CRM ---');

// 在 mirror inquiry 附近不应该有 pushLeadToCRM
// 找 mirrorInquiryId 到 pushCompanyLeadToCRM 之间的代码
const mirrorSection = ctrl.match(/mirrorInquiryId[\s\S]*?pushCompanyLeadToCRM/);
const mirrorCode = mirrorSection ? mirrorSection[0] : '';

const mirrorCallsPushLead = /pushLeadToCRM\s*\(/.test(mirrorCode);
ok('TC-2', 'mirror inquiry 区域不调用 pushLeadToCRM', !mirrorCallsPushLead);

// mirror inquiry 应该直接标记 synced
const mirrorMarksSynced = /crm_sync_status.*=.*'synced'/.test(mirrorCode) || /crm_sync_status.*synced/.test(ctrl);
ok('TC-2', 'mirror inquiry 直接标记 DB synced', mirrorMarksSynced);

// ================================================================
// TC-3: crmPush.ts tenant 隔离
// ================================================================
console.log('\n--- TC-3: crmPush.ts tenant 隔离 ---');

const crmPush = readFileSync('server/src/lib/crmPush.ts', 'utf-8');

// pushLeadToCRM 使用 CRM_TENANT_ID（业主）
const pushLeadFn = crmPush.match(/export async function pushLeadToCRM[\s\S]*?^}/m);
const pushLeadBody = pushLeadFn ? pushLeadFn[0] : '';
ok('TC-3', 'pushLeadToCRM 使用 CRM_TENANT_ID', pushLeadBody.includes('CRM_TENANT_ID'));
ok('TC-3', 'pushLeadToCRM 不使用 CRM_COMPANY_TENANT_ID', !pushLeadBody.includes('CRM_COMPANY_TENANT_ID'));

// pushCompanyLeadToCRM 使用 CRM_COMPANY_TENANT_ID（装企）
const pushCompanyFn = crmPush.match(/export async function pushCompanyLeadToCRM[\s\S]*?^}/m);
const pushCompanyBody = pushCompanyFn ? pushCompanyFn[0] : '';
ok('TC-3', 'pushCompanyLeadToCRM 使用 CRM_COMPANY_TENANT_ID', pushCompanyBody.includes('CRM_COMPANY_TENANT_ID'));

// ================================================================
// TC-4: 其他 controller 没有错误调用
// ================================================================
console.log('\n--- TC-4: 其他 controller 的 CRM 调用正确 ---');

// inquiryController 应该用 pushLeadToCRM（业主询盘 → 业主 tenant，正确）
const inquiryCtrl = readFileSync('server/src/controllers/inquiryController.ts', 'utf-8');
const inquiryUsesPushLead = /pushLeadToCRM\s*\(/.test(inquiryCtrl);
const inquiryUsesPushCompany = /pushCompanyLeadToCRM\s*\(/.test(inquiryCtrl);
ok('TC-4', 'inquiryController 用 pushLeadToCRM（业主 tenant，正确）', inquiryUsesPushLead);
ok('TC-4', 'inquiryController 不用 pushCompanyLeadToCRM', !inquiryUsesPushCompany);

// ================================================================
// TC-5: 历史数据检查提示
// ================================================================
console.log('\n--- TC-5: 代码注释/文档提醒 ---');

// companyLeadController 应该有注释说明为什么不推 mirror inquiry 到 CRM
const hasComment = ctrl.includes('company tenant ONLY') || ctrl.includes('not homeowner tenant') || ctrl.includes('不推 CRM');
ok('TC-5', '代码有注释说明 tenant 隔离', hasComment);

// MEMORY.md 应该有 CRM 推送安全规则
const memory = readFileSync('/Users/kp/.claude/projects/-Users-kp/memory/MEMORY.md', 'utf-8');
ok('TC-5', 'MEMORY.md 有 CRM 推送安全规则', memory.includes('CRM 推送安全规则'));
ok('TC-5', 'MEMORY.md 记录了 77 条事故', memory.includes('77'));

// ================================================================
console.log('\n' + '='.repeat(60));
console.log(`  RESULT: ${passed} PASS, ${failed} FAIL`);
if (failures.length) {
  console.log('\n  FAILURES:');
  failures.forEach(f => console.log(`    - ${f}`));
}
console.log('='.repeat(60) + '\n');

process.exit(failed > 0 ? 1 : 0);
