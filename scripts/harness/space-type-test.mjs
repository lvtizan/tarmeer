#!/usr/bin/env node
/**
 * space-type-test.mjs — 空间类型匹配层行为用例
 * 用法: node scripts/harness/space-type-test.mjs
 * 覆盖: companyHasSpaceType 大小写/别名/子串/空数组/未知key
 */
import { companyHasSpaceType, SPACE_TYPE_KEYS, SPACE_TYPE_LABELS } from '../../src/lib/serviceCategories.ts';

let pass = 0, fail = 0;
function eq(label, got, want) {
  if (got === want) { console.log(`  \x1b[32m✓\x1b[0m ${label}`); pass++; }
  else { console.log(`  \x1b[31m✗\x1b[0m ${label} — got ${got}, want ${want}`); fail++; }
}

console.log('companyHasSpaceType:');
eq('villa 命中 "Villa"',            companyHasSpaceType(['Villa'], 'villa'), true);
eq('villa 命中 "Luxury Villa"',     companyHasSpaceType(['Luxury Villa'], 'villa'), true);
eq('villa 命中小写 "townhouse"',    companyHasSpaceType(['townhouse'], 'villa'), true);
eq('villa 不命中 Apartment/Office', companyHasSpaceType(['Apartment', 'Office'], 'villa'), false);
eq('villa 空数组不命中',            companyHasSpaceType([], 'villa'), false);
eq('commercial 命中 "Retail"',      companyHasSpaceType(['Retail'], 'commercial'), true);
eq('commercial 命中 "Commercial"',  companyHasSpaceType(['Commercial'], 'commercial'), true);
eq('outdoor 命中 "Garden"',         companyHasSpaceType(['Garden'], 'outdoor'), true);
eq('apartment 命中 "Penthouse"',    companyHasSpaceType(['Penthouse'], 'apartment'), true);
eq('public 命中 "School"',          companyHasSpaceType(['School'], 'public'), true);
eq('未知 key 不命中',               companyHasSpaceType(['Villa'], 'spaceship'), false);

console.log('常量:');
eq('SPACE_TYPE_KEYS 有 5 个',       SPACE_TYPE_KEYS.length, 5);
eq('villa 有 label',                SPACE_TYPE_LABELS.villa, 'Villa');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
