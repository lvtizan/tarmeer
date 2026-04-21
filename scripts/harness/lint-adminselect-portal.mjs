#!/usr/bin/env node
/**
 * lint-adminselect-portal.mjs — Ensure AdminSelect dropdown uses Portal
 *
 * AdminSelect dropdown MUST use createPortal to render to document.body.
 * Without Portal, any parent with overflow-hidden, backdrop-blur, or transform
 * will clip or misposition the dropdown.
 *
 * This bug has occurred 3+ times across different pages (admin, for-companies, homepage banner).
 *
 * Run: node scripts/harness/lint-adminselect-portal.mjs
 */

import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;

function ok(name, condition) {
  if (condition) { console.log(`  PASS | ${name}`); passed++; }
  else { console.log(`  FAIL | ${name}`); failed++; }
}

const src = readFileSync('src/components/ui/AdminSelect.tsx', 'utf-8');

console.log('\n--- AdminSelect Portal Checks ---\n');

// Must import createPortal
ok('imports createPortal from react-dom', src.includes("createPortal") && src.includes("react-dom"));

// Desktop dropdown must use createPortal
const desktopSection = src.match(/Desktop.*portal[\s\S]*?document\.body/);
ok('desktop dropdown uses createPortal(…, document.body)', !!desktopSection);

// Mobile modal must use createPortal
const mobileSection = src.match(/Mobile.*portal[\s\S]*?document\.body/);
ok('mobile modal uses createPortal(…, document.body)', !!mobileSection);

// Must NOT have dropdown rendered inside the component div without portal
// (check there's no <ul with fixed positioning NOT inside createPortal)
const rawFixedUl = src.match(/<ul[\s\S]*?fixed[\s\S]*?(?<!createPortal\([\s\S]*?)<\/ul>/);
ok('no fixed dropdown outside createPortal', !rawFixedUl);

// z-index must be high enough
ok('dropdown z-index >= 9999', src.includes('z-[9999]'));

// getBoundingClientRect for positioning
ok('uses getBoundingClientRect for position calc', src.includes('getBoundingClientRect'));

console.log(`\n${'='.repeat(50)}`);
console.log(`  RESULT: ${passed} PASS, ${failed} FAIL`);
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
