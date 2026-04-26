#!/usr/bin/env node
/**
 * Harness: Company contact info visibility
 *
 * Rule: Registered companies (company_profiles) and claimed directory companies
 * (uae_companies with owner_user_id) must NOT expose phone/email on public pages.
 * Unclaimed directory companies (uae_companies, owner_user_id IS NULL) CAN show contact info.
 *
 * Usage: node scripts/harness/test-contact-visibility.mjs
 */

import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

let passed = 0;
let failed = 0;

function ok(tc, name, condition) {
  if (condition) { console.log(`  PASS  ${tc} | ${name}`); passed++; }
  else { console.log(`  FAIL  ${tc} | ${name}`); failed++; }
}

console.log('\n--- TC-1: Backend hides contact for registered companies ---\n');

// companyController.ts — fallback to company_profiles should null out phone/email
const compCtrl = readFileSync('server/src/controllers/companyController.ts', 'utf-8');
ok('TC-1', 'companyController: phone = null in fallback', compCtrl.includes("company.phone = null"));
ok('TC-1', 'companyController: email = null in fallback', compCtrl.includes("company.email = null"));
ok('TC-1', 'companyController: is_registered = true in fallback', compCtrl.includes("company.is_registered = true"));

// publicCompanyController.ts — contact fields not selected (omitted, not null)
const pubCtrl = readFileSync('server/src/controllers/publicCompanyController.ts', 'utf-8');
ok('TC-1', 'publicCompanyController: NOTE comment — contact fields intentionally omitted (2x)',
  (pubCtrl.match(/NOTE: contact fields/g) || []).length >= 2);
ok('TC-1', 'publicCompanyController: no cp.phone in SELECT', !pubCtrl.includes('cp.phone'));

console.log('\n--- TC-2: sanitizePublicCompany hides contact for claimed companies ---\n');

// sanitizePublicCompany uses isClaimed gate for phone/email/website
const serialization = readFileSync('server/src/lib/publicCompaniesSerialization.ts', 'utf-8');
ok('TC-2', 'sanitizePublicCompany: isClaimed computed from owner_user_id',
  serialization.includes('isClaimed = !!(company.owner_user_id)'));
ok('TC-2', 'sanitizePublicCompany: phone hidden for claimed companies',
  serialization.includes("phone: isClaimed ? '' : toPublicString(company.phone)"));
ok('TC-2', 'sanitizePublicCompany: email hidden for claimed companies',
  serialization.includes("email: isClaimed ? '' : toPublicString(company.email)"));
ok('TC-2', 'sanitizePublicCompany: website hidden for claimed companies',
  serialization.includes("website: isClaimed ? '' : toPublicString(company.website)"));

console.log('\n--- TC-3: Frontend double-guards contact section ---\n');

const detailPage = readFileSync('src/pages/CompanyDetailPage.tsx', 'utf-8');
const guardCount = (detailPage.match(/!company\.isClaimed && \(company\.phone/g) || []).length;
ok('TC-3', 'CompanyDetailPage: !isClaimed guard on mobile contact section', guardCount >= 1);
ok('TC-3', 'CompanyDetailPage: !isClaimed guard on sidebar contact card', guardCount >= 2);

console.log('\n--- TC-4: Business rule in MEMORY.md ---\n');

const memoryPath = join(homedir(), '.claude', 'projects', '-Users-yiming', 'memory', 'MEMORY.md');
try {
  const memory = readFileSync(memoryPath, 'utf-8');
  ok('TC-4', 'MEMORY.md has registered company phone rule', memory.includes('注册装企电话'));
} catch {
  console.log(`  SKIP  TC-4 | MEMORY.md not found at ${memoryPath} (non-blocking)`);
}

console.log(`\n${'='.repeat(50)}`);
console.log(`  RESULT: ${passed} PASS, ${failed} FAIL`);
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
