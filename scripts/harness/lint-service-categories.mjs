#!/usr/bin/env node
/**
 * Service Categories Consistency Linter
 *
 * Checks that company_type values and service tags are consistent
 * across all 6 files that define them. Catches drift when one file
 * is updated but others are not.
 *
 * Usage:
 *   node scripts/harness/lint-service-categories.mjs
 *
 * Exit code 0 = all checks pass, 1 = one or more checks failed.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

let passed = 0;
let failed = 0;

function ok(label, detail = '') {
  console.log(`  ✅ ${label}${detail ? ': ' + detail : ''}`);
  passed++;
}

function fail(label, detail = '') {
  console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`);
  failed++;
}

async function read(rel) {
  try { return await readFile(path.join(ROOT, rel), 'utf-8'); }
  catch { return null; }
}

// ── Expected values ──────────────────────────────────────────────────────────

const EXPECTED_COMPANY_TYPES = [
  'design_studio', 'renovation_company', 'general_contractor',
  'mep_contractor', 'maintenance_company', 'specialty_trade', 'landscaping', 'furnishing',
  'fitout_contractor', 'glass_aluminium', 'waterproofing', 'smart_home', 'fire_fighting',
  'carpentry_joinery', 'stone_marble', 'steel_fabrication', 'cleaning_services',
  'manpower_supply', 'swimming_pool',
];

const EXPECTED_SERVICES = [
  'Interior Design', 'Architecture', 'Fit-Out', 'Renovation', 'Construction', 'Landscape',
  'Furniture', 'Joinery', 'MEP', 'Project Management', 'Design & Build', 'Turnkey Solutions', 'Maintenance',
  'Glass & Aluminium', 'Painting & Finishing', 'Flooring & Tiling', 'Demolition',
  'Steel & Fabrication', 'Curtains & Blinds', 'Cleaning Services', 'Pools',
  'HVAC & Ducting', 'Fire Fighting', 'Smart Home & Automation', 'Waterproofing',
  'Solar Systems', 'Epoxy & PU Flooring', 'Scaffolding', 'Lighting Installation',
  'Stone & Marble Fixing', 'Gypsum & Partitions', 'Deep Cleaning',
];

const NEW_I18N_KEYS = [
  'typeFitoutContractor', 'typeGlassAluminium', 'typeWaterproofing', 'typeSmartHome',
  'typeFireFighting', 'typeCarpentryJoinery', 'typeStoneMarble', 'typeSteelFabrication',
  'typeCleaningServices', 'typeManpowerSupply', 'typeSwimmingPool',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractStringArray(src, varName) {
  // Match: const VAR = [ ... ];  (possibly multiline)
  const re = new RegExp(`(?:const|export const)\\s+${varName}\\s*=\\s*\\[([^\\]]+)\\]`, 's');
  const m = src.match(re);
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
}

function countMatches(src, key) {
  return (src.match(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
}

// ── Rule 1: Server VALID_COMPANY_TYPES ───────────────────────────────────────

async function checkServerTypes() {
  console.log('\n── Rule 1: server/src/lib/companyProfileDraft.ts — VALID_COMPANY_TYPES');
  const src = await read('server/src/lib/companyProfileDraft.ts');
  if (!src) { fail('file exists', 'companyProfileDraft.ts not found'); return; }

  const types = extractStringArray(src, 'VALID_COMPANY_TYPES');
  if (!types) { fail('array parseable'); return; }

  ok('count', `${types.length} types (expected ${EXPECTED_COMPANY_TYPES.length})`);
  if (types.length !== EXPECTED_COMPANY_TYPES.length) fail('count mismatch', `got ${types.length}, want ${EXPECTED_COMPANY_TYPES.length}`);

  for (const t of EXPECTED_COMPANY_TYPES) {
    if (types.includes(t)) ok(`contains '${t}'`);
    else fail(`missing '${t}'`);
  }
}

// ── Rule 2: Server VALID_SERVICES ────────────────────────────────────────────

async function checkServerServices() {
  console.log('\n── Rule 2: server/src/lib/companyProfileDraft.ts — VALID_SERVICES');
  const src = await read('server/src/lib/companyProfileDraft.ts');
  if (!src) return; // already reported above

  const services = extractStringArray(src, 'VALID_SERVICES');
  if (!services) { fail('array parseable'); return; }

  if (services.length === EXPECTED_SERVICES.length) ok('count', `${services.length} services`);
  else fail('count mismatch', `got ${services.length}, want ${EXPECTED_SERVICES.length}`);

  const missing = EXPECTED_SERVICES.filter(s => !services.includes(s));
  if (missing.length === 0) ok('all expected services present');
  else missing.forEach(s => fail(`missing '${s}'`));
}

// ── Rule 3: Frontend COMPANY_TYPE_LABELS ─────────────────────────────────────

async function checkFrontendLabels() {
  console.log('\n── Rule 3: src/lib/companyData.ts — COMPANY_TYPE_LABELS');
  const src = await read('src/lib/companyData.ts');
  if (!src) { fail('file exists', 'companyData.ts not found'); return; }

  for (const t of EXPECTED_COMPANY_TYPES) {
    if (src.includes(`${t}:`)) ok(`label key '${t}'`);
    else fail(`missing label for '${t}'`);
  }
}

// ── Rule 4: i18n keys in forCompanies.ts ─────────────────────────────────────

async function checkI18n() {
  console.log('\n── Rule 4: src/i18n/forCompanies.ts — EN + AR keys');
  const src = await read('src/i18n/forCompanies.ts');
  if (!src) { fail('file exists', 'forCompanies.ts not found'); return; }

  for (const key of NEW_I18N_KEYS) {
    const count = countMatches(src, key + ':');
    if (count >= 2) ok(`'${key}' present in both EN + AR`);
    else if (count === 1) fail(`'${key}' found only once (missing from EN or AR)`);
    else fail(`'${key}' not found in either locale`);
  }

  // Verify swimming pool has full label, not truncated
  if (src.includes("typeSwimmingPool: 'Swimming Pool Contractor'")) ok("swimming pool EN label = 'Swimming Pool Contractor'");
  else fail("swimming pool EN label is wrong (expected 'Swimming Pool Contractor')");

  if (src.includes("typeSwimmingPool: 'مقاول مسابح'")) ok("swimming pool AR label = 'مقاول مسابح'");
  else fail("swimming pool AR label is wrong (expected 'مقاول مسابح')");
}

// ── Rule 5: CompanySignupForm COMPANY_TYPES ───────────────────────────────────

async function checkSignupForm() {
  console.log('\n── Rule 5: src/components/for-companies/CompanySignupForm.tsx — COMPANY_TYPES');
  const src = await read('src/components/for-companies/CompanySignupForm.tsx');
  if (!src) { fail('file exists', 'CompanySignupForm.tsx not found'); return; }

  for (const t of EXPECTED_COMPANY_TYPES) {
    if (src.includes(`value: '${t}'`)) ok(`entry for '${t}'`);
    else fail(`missing entry for '${t}'`);
  }

  // Verify labelKey pattern for new types
  const keyChecks = [
    ["typeFitoutContractor", 'fitout_contractor'],
    ["typeSwimmingPool", 'swimming_pool'],
  ];
  for (const [key, val] of keyChecks) {
    if (src.includes(`value: '${val}'`) && src.includes(`labelKey: '${key}'`)) ok(`'${val}' → labelKey '${key}'`);
    else fail(`'${val}' labelKey mismatch — expected '${key}'`);
  }
}

// ── Rule 6: CompanyProfileForm SERVICES + TYPE_OPTIONS ───────────────────────

async function checkProfileForm() {
  console.log('\n── Rule 6: src/components/company/CompanyProfileForm.tsx — SERVICES + TYPE_OPTIONS');
  const src = await read('src/components/company/CompanyProfileForm.tsx');
  if (!src) { fail('file exists', 'CompanyProfileForm.tsx not found'); return; }

  // Check SERVICES count via new entries
  const newServiceChecks = ['HVAC & Ducting', 'Fire Fighting', 'Smart Home & Automation', 'Waterproofing', 'Solar Systems', 'Epoxy & PU Flooring', 'Scaffolding', 'Lighting Installation', 'Stone & Marble Fixing', 'Gypsum & Partitions', 'Deep Cleaning'];
  const missingServices = newServiceChecks.filter(s => !src.includes(`'${s}'`));
  if (missingServices.length === 0) ok(`all 11 new services present`);
  else missingServices.forEach(s => fail(`missing service '${s}'`));

  // Check TYPE_OPTIONS new entries
  for (const t of EXPECTED_COMPANY_TYPES.slice(8)) { // new ones only
    if (src.includes(`value:'${t}'`) || src.includes(`value: '${t}'`)) ok(`TYPE_OPTIONS entry '${t}'`);
    else fail(`TYPE_OPTIONS missing '${t}'`);
  }
}

// ── Rule 7: CompanyEditModal SERVICES + company_type options ─────────────────

async function checkEditModal() {
  console.log('\n── Rule 7: src/components/admin/CompanyEditModal.tsx — SERVICES + company_type options');
  const src = await read('src/components/admin/CompanyEditModal.tsx');
  if (!src) { fail('file exists', 'CompanyEditModal.tsx not found'); return; }

  const newServiceChecks = ['HVAC & Ducting', 'Fire Fighting', 'Smart Home & Automation', 'Waterproofing', 'Solar Systems', 'Epoxy & PU Flooring', 'Scaffolding', 'Lighting Installation', 'Stone & Marble Fixing', 'Gypsum & Partitions', 'Deep Cleaning'];
  const missingServices = newServiceChecks.filter(s => !src.includes(`'${s}'`));
  if (missingServices.length === 0) ok('all 11 new services present');
  else missingServices.forEach(s => fail(`missing service '${s}'`));

  for (const t of EXPECTED_COMPANY_TYPES.slice(8)) {
    if (src.includes(`value: '${t}'`)) ok(`company_type option '${t}'`);
    else fail(`company_type option missing '${t}'`);
  }
}

// ── Rule 8: Cross-file consistency — types agree across all files ─────────────

async function checkCrossFileConsistency() {
  console.log('\n── Rule 8: Cross-file consistency — company_type values');

  const [serverSrc, labelsSrc, signupSrc, profileSrc, modalSrc] = await Promise.all([
    read('server/src/lib/companyProfileDraft.ts'),
    read('src/lib/companyData.ts'),
    read('src/components/for-companies/CompanySignupForm.tsx'),
    read('src/components/company/CompanyProfileForm.tsx'),
    read('src/components/admin/CompanyEditModal.tsx'),
  ]);

  for (const t of EXPECTED_COMPANY_TYPES) {
    const inServer = serverSrc?.includes(`'${t}'`) ?? false;
    const inLabels = labelsSrc?.includes(`${t}:`) ?? false;
    const inSignup = signupSrc?.includes(`value: '${t}'`) ?? false;
    const inProfile = !!(profileSrc?.includes(`value:'${t}'`) || profileSrc?.includes(`value: '${t}'`));
    const inModal = modalSrc?.includes(`value: '${t}'`) ?? false;

    const allPresent = inServer && inLabels && inSignup && inProfile && inModal;
    if (allPresent) ok(`'${t}' consistent across all 5 files`);
    else {
      const missing = [
        !inServer && 'server/companyProfileDraft',
        !inLabels && 'companyData labels',
        !inSignup && 'CompanySignupForm',
        !inProfile && 'CompanyProfileForm',
        !inModal && 'CompanyEditModal',
      ].filter(Boolean);
      fail(`'${t}' missing from: ${missing.join(', ')}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Service Categories Consistency Linter');
  console.log('='.repeat(60));

  await checkServerTypes();
  await checkServerServices();
  await checkFrontendLabels();
  await checkI18n();
  await checkSignupForm();
  await checkProfileForm();
  await checkEditModal();
  await checkCrossFileConsistency();

  console.log('\n' + '='.repeat(60));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
