import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [hub, directory, featured, publicFeed, materialsApi, imageUrl, supplierDetail, hubSearch, materialSearch, macroGrid, productDetail] = await Promise.all([
  readFile('src/components/materials/MaterialsHub.tsx', 'utf8'),
  readFile('src/components/materials/MegaMenuDirectory.tsx', 'utf8'),
  readFile('src/components/materials/HubFeatured.tsx', 'utf8'),
  readFile('server/dist/controllers/supplierProductController.js', 'utf8'),
  readFile('src/lib/materialsApi.ts', 'utf8'),
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
assert.match(featured, /balanced: !category/);
assert.match(featured, /const productRequest = buildProductRequest\(1, selectedCategory\?\.key\)/);
assert.match(featured, /fetchMaterialProducts\(productRequest, country\)/);
assert.match(featured, /buildProductRequest\(nextPage, selectedCategory\?\.key\)/);
assert.match(publicFeed, /req\.query\.balanced === '1'/);
assert.match(publicFeed, /ROW_NUMBER\(\) OVER \(PARTITION BY p\.supplier_profile_id ORDER BY p\.id DESC\) AS supplier_rank/);
assert.match(publicFeed, /ORDER BY CEIL\(supplier_rank \/ 2\) ASC, id DESC/);
assert.match(materialsApi, /if \(params\.balanced\) qs\.set\('balanced', '1'\)/);
assert.match(publicFeed, /ORDER BY p\.id DESC/);
const publicFeedHandler = publicFeed.slice(
  publicFeed.indexOf('async function listPublicProductsFeed'),
  publicFeed.indexOf('// GET /api/suppliers/products/public/:id'),
);
assert.doesNotMatch(publicFeedHandler, /weight_score/);
assert.match(imageUrl, /hostname === 'localhost'/);
assert.match(imageUrl, /https:\/\/www\.tarmeer\.com/);
assert.match(featured, /<HubProductCard key=\{product\.id\} product=\{product\}/);
assert.match(featured, /Show all products/);
assert.match(featured, /observeAutoLoad/);
assert.match(featured, /ref=\{loadMoreSentinelRef\}/);
assert.doesNotMatch(featured, /Load more products<\/button>|'Load more products'/);
assert.match(featured, /requestVersionRef/);
assert.match(featured, /const \[refreshing, setRefreshing\] = useState\(false\)/);
assert.match(featured, /const \[displayedCountry, setDisplayedCountry\] = useState\(country\)/);
assert.match(featured, /const \[displayedCategory, setDisplayedCategory\] = useState<MegaCategory \| null>\(null\)/);
assert.match(featured, /if \(!canKeepVisibleProducts\) \{/);
assert.match(featured, /const canLoadMore = hasVisibleProducts && displayedMatchesSelection && !refreshing && !error/);
assert.match(featured, /requestAutoLoadPage/);
assert.match(featured, /const shouldLoadMore = canLoadMore && hasMore/);
assert.match(featured, /setRetryNonce/);
assert.match(materialSearch, /supplierFromProductsHref\(p\.supplier_slug\)/);
assert.match(macroGrid, /supplierFromProductsHref\(p\.supplier_slug\)/);
assert.match(productDetail, /supplierFromProductsHref\(product\.supplier_slug\)/);
assert.match(supplierDetail, /searchParams\.get\('from'\) === 'products'/);
assert.match(supplierDetail, /router\.push\(`\/materials\?tab=\$\{originTab\}`\)/);
assert.match(directory, /selectedKey: string \| null/);
assert.match(directory, /onSelectCategory: \(category: MegaCategory\) => void/);
assert.match(directory, /<li key=\{c\.key\} className="relative">/);
assert.match(directory, /const activeCategory = categories\.find/);
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
assert.match(directory, /id="material-category-flyout"/);
assert.match(directory, /onBlurCapture=\{\(event\) => closeFlyout\(true, event\.currentTarget\.contains\(event\.relatedTarget\)\)\}/);
assert.match(directory, /shouldReturnToCategoryFromFlyout/);
assert.match(directory, /event\.target === event\.currentTarget/);
assert.match(directory, /window\.addEventListener\('resize', repositionActiveFlyout\)/);
assert.match(directory, /window\.removeEventListener\('resize', repositionActiveFlyout\)/);
assert.match(directory, /onScroll=\{repositionActiveFlyout\}/);
assert.match(directory, /\$\{country\}:\$\{activeKey\}/);
assert.match(publicFeed, /p\.image_url IS NOT NULL AND p\.image_url <> ''/);
console.log('materials-directory-interaction: 12/12 PASS');
