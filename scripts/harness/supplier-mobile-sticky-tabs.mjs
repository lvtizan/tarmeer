import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('src/components/materials/SupplierDetailClient.tsx', 'utf8');

assert.doesNotMatch(
  source,
  /min-h-screen bg-\[#faf9f7\][^"\n]*overflow-x-(?:clip|hidden)/,
  'the page wrapper must not create an overflow ancestor around the sticky tab strip',
);
assert.match(
  source,
  /data-testid="supplier-section-tabs" className="sticky top-14 z-40 bg-\[#faf9f7\] sm:top-16"/,
  'the sticky tabs should use a stable solid layer at every viewport size',
);
assert.doesNotMatch(
  source,
  /sticky[^"\n]*backdrop-blur/,
  'the sticky tab strip must not enable backdrop filtering at mobile or tablet breakpoints',
);

console.log('supplier-mobile-sticky-tabs: 3/3 PASS — static root-cause guards; run supplier-mobile-sticky-tabs-e2e.mjs for real 390/844/1440 layout checks');
