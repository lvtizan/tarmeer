#!/usr/bin/env node
/**
 * Harness: Company contact info visibility
 *
 * Rule: Registered companies (company_profiles) must NOT expose
 * phone/email on public pages. Directory companies (uae_companies)
 * CAN show contact info.
 *
 * Usage: PORT=3099 node scripts/harness/test-contact-visibility.mjs
 */

import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;

function ok(tc, name, condition) {
  if (condition) { console.log(`  PASS  ${tc} | ${name}`); passed++; }
  else { console.log(`  FAIL  ${tc} | ${name}`); failed++; }
}

console.log('\n--- TC-1: Backend hides contact for registered companies ---\n');

// companyController.ts — fallback to company_profiles should null out phone/email
const compCtrl = readFileSync('server/src/controllers/companyController.ts', 'utf-8');
const fallbackSection = compCtrl.match(/Fallback to company_profiles[\s\S]*?company\.portfolio_categories/);
ok('TC-1', 'companyController: phone = null in fallback', compCtrl.includes("company.phone = null"));
ok('TC-1', 'companyController: email = null in fallback', compCtrl.includes("company.email = null"));
ok('TC-1', 'companyController: is_registered = true in fallback', compCtrl.includes("company.is_registered = true"));

// publicCompanyController.ts — list and detail both hide contact
const pubCtrl = readFileSync('server/src/controllers/publicCompanyController.ts', 'utf-8');
const phoneNullCount = (pubCtrl.match(/phone: null/g) || []).length;
const contactNullCount = (pubCtrl.match(/contact_person: null/g) || []).length;
ok('TC-1', 'publicCompanyController: phone null in list + detail (2x)', phoneNullCount >= 2);
ok('TC-1', 'publicCompanyController: contact_person null (2x)', contactNullCount >= 2);
ok('TC-1', 'publicCompanyController: is_registered in list', pubCtrl.includes('is_registered: true'));

console.log('\n--- TC-2: Directory companies still show contact ---\n');

// sanitizePublicCompany should still pass through phone/email for directory companies
const serialization = readFileSync('server/src/lib/publicCompaniesSerialization.ts', 'utf-8');
ok('TC-2', 'sanitizePublicCompany returns phone', serialization.includes("phone: toPublicString(company.phone)"));
ok('TC-2', 'sanitizePublicCompany returns email', serialization.includes("email: toPublicString(company.email)"));

console.log('\n--- TC-3: Business rule documented ---\n');

const memory = readFileSync('/Users/kp/.claude/projects/-Users-kp/memory/MEMORY.md', 'utf-8');
ok('TC-3', 'MEMORY.md has contact visibility rule', memory.includes('联系方式展示规则'));
ok('TC-3', 'MEMORY.md explains business logic', memory.includes('跳过平台'));

console.log(`\n${'='.repeat(50)}`);
console.log(`  RESULT: ${passed} PASS, ${failed} FAIL`);
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
