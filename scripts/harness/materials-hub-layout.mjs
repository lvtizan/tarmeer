import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const hub = read('src/components/materials/MaterialsHub.tsx');
const featured = read('src/components/materials/HubFeatured.tsx');
const search = read('src/components/materials/HubSearchResults.tsx');
const card = read('src/components/materials/HubProductCard.tsx');
const directory = read('src/components/materials/MegaMenuDirectory.tsx');

assert.match(hub, /max-w-\[1920px\]/);
assert.match(hub, /lg:grid-cols-\[240px_minmax\(0,1fr\)\]/);
assert.match(hub, /lg:self-start lg:sticky lg:top-24/);
assert.match(directory, /lg:max-h-\[calc\(100vh-8rem\)\] lg:overflow-y-auto/);
assert.match(directory, /getMegaMenuFlyoutPlacement/);
assert.match(directory, /absolute left-full z-30 hidden pl-4 lg:block/);
assert.match(directory, /style=\{\{ top: flyoutPlacement\.top \}\}/);
assert.match(directory, /maxHeight: flyoutPlacement\.maxHeight, minHeight: flyoutPlacement\.minHeight/);
assert.match(directory, /suppressNextFocusRef\.current/);
assert.match(directory, /onFocus=\{\(event\) => \{/);
assert.match(directory, /if \(!isDesktop\) return;/);
assert.match(directory, /isDesktop && e\.key === 'ArrowRight'/);
assert.match(directory, /aria-expanded=\{isDesktop \? activeKey === c\.key : isOpen\}/);
assert.match(directory, /material-category-mobile-\$\{c\.key\}/);
assert.match(directory, /e\.key === 'ArrowRight'/);
assert.match(directory, /flyoutRef\.current\?\.focus\(\)/);
assert.match(directory, /id="material-category-flyout"/);
assert.match(directory, /event\.key !== 'Escape'/);
assert.match(directory, /suppressNextFocusRef\.current = true/);
assert.match(directory, /onBlurCapture=\{\(event\) => closeFlyout\(true, event\.currentTarget\.contains\(event\.relatedTarget\)\)\}/);
assert.match(directory, /shouldReturnToCategoryFromFlyout/);
assert.match(directory, /event\.target === event\.currentTarget/);
assert.match(directory, /window\.addEventListener\('resize', repositionActiveFlyout\)/);
assert.match(directory, /window\.removeEventListener\('resize', repositionActiveFlyout\)/);
assert.match(directory, /onScroll=\{repositionActiveFlyout\}/);
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
execFileSync(process.execPath, ['--test', 'src/lib/megaMenuFlyout.test.mjs'], {
  cwd: new URL('../..', import.meta.url),
  stdio: 'pipe',
});
execFileSync(process.execPath, ['--test', 'src/lib/megaMenuFocus.test.mjs'], {
  cwd: new URL('../..', import.meta.url),
  stdio: 'pipe',
});

console.log('materials-hub-layout: static assertions + 2 behavior suites PASS');
