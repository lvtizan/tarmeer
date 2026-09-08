import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [hub, directory, featured, publicFeed, imageUrl, supplierDetail, hubSearch, materialSearch, macroGrid, productDetail] = await Promise.all([
  readFile('src/components/materials/MaterialsHub.tsx', 'utf8'),
  readFile('src/components/materials/MegaMenuDirectory.tsx', 'utf8'),
  readFile('src/components/materials/HubFeatured.tsx', 'utf8'),
  readFile('server/dist/controllers/supplierProductController.js', 'utf8'),
  readFile('src/lib/imageUrl.ts', 'utf8'),
  readFile('src/components/materials/SupplierDetailClient.tsx', 'utf8'),
  readFile('src/components/materials/HubSearchResults.tsx', 'utf8'),
  readFile('src/components/materials/MaterialSearchResults.tsx', 'utf8'),
  readFile('src/components/materials/MacroProductGrid.tsx', 'utf8'),
  readFile('src/components/materials/ProductDetailClient.tsx', 'utf8'),
]);

assert.match(hub, /selectedCategory/);
assert.match(hub, /onSelectCategory=\{selectCategory\}/);
assert.match(hub, /setSubmitted\(''\)/);
assert.match(hub, /productsResultRef/);
assert.match(hub, /scrollIntoView\(\{ behavior: 'smooth', block: 'start' \}\)/);
assert.match(hub, /id="products-results"/);
assert.match(featured, /fetchMaterialProducts\(\{ page: 1, limit: 24, category: selectedCategory\?\.key \}/);
assert.match(publicFeed, /ORDER BY p\.id DESC/);
const publicFeedHandler = publicFeed.slice(
  publicFeed.indexOf('async function listPublicProductsFeed'),
  publicFeed.indexOf('// GET /api/suppliers/products/public/:id'),
);
assert.doesNotMatch(publicFeedHandler, /weight_score/);
assert.match(imageUrl, /hostname === 'localhost'/);
assert.match(imageUrl, /https:\/\/www\.tarmeer\.com/);
assert.match(featured, /resolveImageUrl\(p\.image_url\)/);
assert.match(featured, /Show all products/);
assert.match(featured, /Load more products/);
assert.match(featured, /requestVersionRef/);
assert.match(featured, /const \[refreshing, setRefreshing\] = useState\(false\)/);
assert.match(featured, /const \[displayedCountry, setDisplayedCountry\] = useState\(country\)/);
assert.match(featured, /const \[displayedCategory, setDisplayedCategory\] = useState<MegaCategory \| null>\(null\)/);
assert.match(featured, /if \(!canKeepVisibleProducts\) \{/);
assert.match(featured, /const canLoadMore = hasVisibleProducts && displayedMatchesSelection && !refreshing && !error/);
assert.match(featured, /if \(!canLoadMore \|\| loadingMore\) return;/);
assert.match(featured, /canLoadMore && products\.length < total/);
assert.match(featured, /setRetryNonce/);
assert.match(featured, /supplierFromProductsHref\(supplierSlug\)/);
assert.match(hubSearch, /supplierFromProductsHref\(supplierSlug\)/);
assert.match(materialSearch, /supplierFromProductsHref\(p\.supplier_slug\)/);
assert.match(macroGrid, /supplierFromProductsHref\(p\.supplier_slug\)/);
assert.match(productDetail, /supplierFromProductsHref\(product\.supplier_slug\)/);
assert.match(supplierDetail, /searchParams\.get\('from'\) === 'products'/);
assert.match(supplierDetail, /router\.push\(`\/materials\?tab=\$\{originTab\}`\)/);
assert.match(directory, /selectedKey: string \| null/);
assert.match(directory, /onSelectCategory: \(category: MegaCategory\) => void/);
assert.match(directory, /<li key=\{c\.key\} className="relative">/);
assert.match(directory, /isActive && \(\s*<div\s*className="absolute left-full top-0 z-30 hidden pl-4 lg:block"/);
assert.doesNotMatch(directory, /\/\* Desktop floating mega panel \*\/[\s\S]*?className="absolute left-full top-0 z-30 hidden pl-4 lg:block"/);
assert.match(directory, /\$\{country\}:\$\{activeKey\}/);
assert.match(publicFeed, /p\.image_url IS NOT NULL AND p\.image_url <> ''/);
console.log('materials-directory-interaction: 12/12 PASS');
