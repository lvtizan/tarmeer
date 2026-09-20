import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const hub = read('src/components/materials/MaterialsHub.tsx');
const featured = read('src/components/materials/HubFeatured.tsx');
const search = read('src/components/materials/HubSearchResults.tsx');
const card = read('src/components/materials/HubProductCard.tsx');

assert.match(hub, /max-w-\[1920px\]/);
assert.match(hub, /lg:grid-cols-\[240px_minmax\(0,1fr\)\]/);
assert.match(featured, /Product directory/);
assert.match(featured, /font-serif text-3xl/);
assert.match(featured, /flex flex-col items-start[^"]*sm:flex-row sm:items-end/);
assert.match(featured, /break-words font-serif text-3xl/);
assert.match(featured, /Curated from verified suppliers/);
assert.doesNotMatch(featured, /seen in Dubai|Tarmeer UAE/);
assert.match(featured, /grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5/);
assert.match(search, /grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5/);
assert.doesNotMatch(featured, /columns-2|break-inside-avoid/);
assert.doesNotMatch(search, /columns-2|break-inside-avoid/);
assert.match(featured, /import HubProductCard from ['"]\.\/HubProductCard['"]/);
assert.match(search, /import HubProductCard from ['"]\.\/HubProductCard['"]/);
assert.match(featured, /<HubProductCard key=\{product\.id\} product=\{product\}/);
assert.match(search, /<HubProductCard key=\{product\.id\} product=\{product\}/);
assert.match(card, /relative aspect-\[4\/3\] overflow-hidden rounded-2xl/);
assert.match(card, /content-visibility:auto/);
assert.match(card, /product\.title\?\.trim\(\) \|\| 'Material'/);
assert.match(card, /alt=\{`\$\{title\}\$\{supplierName/);
assert.doesNotMatch(card, /Tarmeer UAE|sourced from China/);
assert.match(card, /className="min-h-6 min-w-0 overflow-hidden \[&>p\]:truncate"/);
assert.match(card, /flex min-h-5 min-w-0/);
assert.match(featured, /observeAutoLoad/);
assert.match(featured, /ref=\{loadMoreSentinelRef\}/);
assert.match(featured, /requestAutoLoadPage/);
assert.match(featured, /mergeAutoLoadPage\(current, result\.products\)/);
assert.match(featured, /Could not load more products\./);
assert.doesNotMatch(featured, /Load more products<\/button>|'Load more products'/);

execFileSync(process.execPath, ['--test', 'src/lib/materialAutoLoad.test.mjs'], {
  cwd: new URL('../..', import.meta.url),
  stdio: 'pipe',
});

console.log('materials-hub-layout: 30/30 PASS');
