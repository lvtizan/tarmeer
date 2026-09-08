import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [hub, directory, featured, publicFeed, imageUrl] = await Promise.all([
  readFile('src/components/materials/MaterialsHub.tsx', 'utf8'),
  readFile('src/components/materials/MegaMenuDirectory.tsx', 'utf8'),
  readFile('src/components/materials/HubFeatured.tsx', 'utf8'),
  readFile('server/dist/controllers/supplierProductController.js', 'utf8'),
  readFile('src/lib/imageUrl.ts', 'utf8'),
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
assert.match(directory, /selectedKey: string \| null/);
assert.match(directory, /onSelectCategory: \(category: MegaCategory\) => void/);
assert.match(directory, /absolute left-full top-0 z-30 hidden pl-4 lg:block/);
assert.match(directory, /\$\{country\}:\$\{activeKey\}/);
assert.match(publicFeed, /p\.image_url IS NOT NULL AND p\.image_url <> ''/);
console.log('materials-directory-interaction: 12/12 PASS');
