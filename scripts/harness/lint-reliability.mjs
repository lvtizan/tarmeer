#!/usr/bin/env node
/**
 * Reliability Invariant Linter
 * Mechanically checks all rules from docs/RELIABILITY.md against actual source files.
 *
 * Exit code 0 = all checks pass, 1 = one or more checks failed.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..', '..');

let failures = 0;

function pass(rule, message) {
  console.log(`\n\u{1F4CB} Rule ${rule}`);
  console.log(`  \u2705 ${message}`);
}

function fail(rule, message) {
  console.log(`\n\u{1F4CB} Rule ${rule}`);
  console.log(`  \u274C ${message}`);
  failures++;
}

async function readSource(relativePath) {
  const absolute = path.join(ROOT, relativePath);
  try {
    return await readFile(absolute, 'utf-8');
  } catch (err) {
    return null;
  }
}

// ─── Rule 1: Data source merge order ────────────────────────────────────────
async function checkMergeOrder() {
  const label = '1: Data source merge order';
  const source = await readSource('src/lib/publicApi.ts');
  if (!source) {
    fail(label, 'publicApi.ts not found');
    return;
  }

  // The merged array must spread directoryCompanies BEFORE approvedCompanies.
  // We look for a pattern like: [...directoryCompanies, ...approvedCompanies...]
  // and verify directory comes first by comparing index positions.
  const mergedMatch = source.match(
    /(?:const|let)\s+merged\s*=\s*\[([^\]]+)\]/s
  );
  if (!mergedMatch) {
    fail(label, 'Could not locate `merged` array in publicApi.ts');
    return;
  }

  const mergedBody = mergedMatch[1];
  const directoryIdx = mergedBody.indexOf('directoryCompanies');
  const approvedIdx = mergedBody.indexOf('approvedCompanies');

  if (directoryIdx === -1 || approvedIdx === -1) {
    fail(label, 'merged array does not reference both directoryCompanies and approvedCompanies');
  } else if (directoryIdx < approvedIdx) {
    pass(label, 'Directory companies come first in merge');
  } else {
    fail(label, 'approvedCompanies appears BEFORE directoryCompanies — merge order is wrong');
  }
}

// ─── Rule 2: No base64 in database ──────────────────────────────────────────
async function checkBase64Prohibition() {
  const label = '2: No base64 in database';
  const source = await readSource('server/src/lib/projectPersistence.ts');
  if (!source) {
    fail(label, 'projectPersistence.ts not found');
    return;
  }

  if (/validateNoBase64Images/.test(source)) {
    pass(label, 'validateNoBase64Images guard exists in projectPersistence.ts');
  } else {
    fail(label, 'No base64 validation function found in projectPersistence.ts');
  }
}

// ─── Rule 3: CORS whitelist completeness ────────────────────────────────────
async function checkCorsWhitelist() {
  const label = '3: CORS whitelist completeness';
  const source = await readSource('server/src/lib/corsOrigins.ts');
  if (!source) {
    fail(label, 'corsOrigins.ts not found');
    return;
  }

  const requiredDomains = [
    'https://www.tarmeer.com',
    'https://tarmeer.com',
    'https://admin.tarmeer.com',
  ];

  // Extract only the production array block to avoid matching comments or dev entries
  const prodMatch = source.match(/production\s*:\s*\[([\s\S]*?)\]/);
  if (!prodMatch) {
    fail(label, 'Could not locate production array in corsOrigins.ts');
    return;
  }

  const prodBlock = prodMatch[1];
  const missing = requiredDomains.filter((d) => !prodBlock.includes(d));

  if (missing.length === 0) {
    pass(label, `All required domains present: ${requiredDomains.join(', ')}`);
  } else {
    fail(label, `Missing from production CORS array: ${missing.join(', ')}`);
  }
}

// ─── Rule 4: Nginx bare domain redirect ─────────────────────────────────────
async function checkNginxBareDomain() {
  const label = '4: Nginx bare domain redirect';
  const source = await readSource('nginx-tarmeer.conf');
  if (!source) {
    fail(label, 'nginx-tarmeer.conf not found');
    return;
  }

  const handlesTarmeerCom = /server_name\s+[^;]*\btarmeer\.com\b/.test(source);
  const redirectsToWww = /return\s+301\s+https:\/\/www\.tarmeer\.com/.test(source);

  if (handlesTarmeerCom && redirectsToWww) {
    pass(label, 'nginx-tarmeer.conf handles tarmeer.com and redirects to www');
  } else {
    const issues = [];
    if (!handlesTarmeerCom) issues.push('bare domain tarmeer.com not in server_name');
    if (!redirectsToWww) issues.push('no 301 redirect to https://www.tarmeer.com');
    fail(label, issues.join('; '));
  }
}

// ─── Rule 5: NotificationBell admin-only ────────────────────────────────────
async function checkNotificationBellAdminOnly() {
  const label = '5: NotificationBell admin-only';
  const source = await readSource('src/components/Navbar.tsx');
  if (!source) {
    fail(label, 'Navbar.tsx not found');
    return;
  }

  // Look for the JSX pattern: {activeRole === 'admin' && <NotificationBell />}
  // We need to find the JSX usage (not the import) and check for the admin guard.
  // Search for all occurrences of <NotificationBell in JSX and verify each has the guard.
  const jsxBellPattern = /<NotificationBell\s*\/?\s*>/g;
  let match;
  let foundJsx = false;
  let allGuarded = true;

  while ((match = jsxBellPattern.exec(source)) !== null) {
    foundJsx = true;
    const windowStart = Math.max(0, match.index - 200);
    const window = source.slice(windowStart, match.index + match[0].length);

    if (!/activeRole\s*===\s*['"]admin['"]/.test(window)) {
      allGuarded = false;
    }
  }

  if (!foundJsx) {
    fail(label, 'NotificationBell JSX usage not found in Navbar.tsx');
  } else if (allGuarded) {
    pass(label, "activeRole === 'admin' guard present near NotificationBell");
  } else {
    fail(label, 'NotificationBell is not guarded by activeRole === \'admin\' check');
  }
}

// ─── Rule 6: Image storage paths ────────────────────────────────────────────
async function checkImageStoragePaths() {
  const label = '6: Image storage paths';
  const source = await readSource('server/src/lib/projectImageStorage.ts');
  if (!source) {
    fail(label, 'projectImageStorage.ts not found');
    return;
  }

  if (/\/uploads\/projects\b/.test(source)) {
    pass(label, 'projectImageStorage.ts uses /uploads/projects/ path');
  } else {
    fail(label, '/uploads/projects/ path not found in projectImageStorage.ts');
  }
}

// ─── Rule 7: CRM tenant routing — company leads must NOT call pushLeadToCRM ──
async function checkCrmTenantRouting() {
  const label = '7: CRM tenant routing (company leads → company tenant only)';
  const source = await readSource('server/src/controllers/companyLeadController.ts');
  if (!source) {
    fail(label, 'companyLeadController.ts not found');
    return;
  }

  // pushLeadToCRM must NOT be imported or called in this file.
  // That function pushes to the homeowner CRM tenant, which is wrong for company leads.
  // Incident: 2026-04-18 — 47 company users appeared as 业主 in CRM because production
  // code called pushLeadToCRM on the design_inquiries mirror row.
  if (/pushLeadToCRM/.test(source)) {
    fail(label, 'companyLeadController.ts references pushLeadToCRM — company leads must only use pushCompanyLeadToCRM');
  } else {
    pass(label, 'pushLeadToCRM not referenced in companyLeadController.ts');
  }

  // pushCompanyLeadToCRM must still be called (company CRM push must exist).
  if (/pushCompanyLeadToCRM/.test(source)) {
    pass(label, 'pushCompanyLeadToCRM is called for company CRM push');
  } else {
    fail(label, 'pushCompanyLeadToCRM not found in companyLeadController.ts — company leads will not reach CRM');
  }

  // Mirror INSERT must set crm_sync_status='synced' to prevent retry workers
  // from picking it up and accidentally pushing to homeowner CRM.
  if (/design_inquiries[\s\S]{0,400}'synced'/.test(source)) {
    pass(label, "mirror design_inquiries INSERT sets crm_sync_status='synced'");
  } else {
    fail(label, "mirror design_inquiries INSERT must set crm_sync_status='synced'");
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Reliability Invariant Linter ===\n');

  await checkMergeOrder();
  await checkBase64Prohibition();
  await checkCorsWhitelist();
  await checkNginxBareDomain();
  await checkNotificationBellAdminOnly();
  await checkImageStoragePaths();
  await checkCrmTenantRouting();

  console.log('\n' + '='.repeat(40));
  if (failures > 0) {
    console.log(`\n${failures} rule(s) FAILED`);
    process.exit(1);
  } else {
    console.log('\nAll rules passed');
    process.exit(0);
  }
}

main();
