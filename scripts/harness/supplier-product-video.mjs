import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseJsonArray } from '../../server/dist/lib/productJsonFields.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const controller = read('server/dist/controllers/supplierProductController.js');
const macroController = read('server/dist/controllers/materialsMacroController.js');
const profileController = read('server/dist/controllers/supplierProfileController.js');
const migrations = read('server/dist/lib/autoMigrate.js');
const serverVideo = read('server/dist/lib/materialVideo.js');
const materialsApi = read('src/lib/materialsApi.ts');
const materialMacros = read('src/lib/materialMacros.ts');
const detail = read('src/components/materials/ProductDetailClient.tsx');
const supplierLibrary = read('src/components/materials/SupplierProductLibrary.tsx');
const supplierDetail = read('src/components/materials/SupplierDetailClient.tsx');

execFileSync(process.execPath, ['--test', 'src/lib/materialVideo.test.mjs'], {
  cwd: new URL('../..', import.meta.url),
  stdio: 'pipe',
});

assert.deepEqual(
  parseJsonArray('["/uploads/suppliers/demo/one.webp","/uploads/suppliers/demo/two.webp"]'),
  ['/uploads/suppliers/demo/one.webp', '/uploads/suppliers/demo/two.webp'],
);

assert.match(migrations, /supplier_products', column: 'video_url', type: 'VARCHAR\(500\) NULL'/);
assert.match(controller, /p\.image_urls, p\.video_url/);
assert.match(controller, /video_url: \(0, materialVideo_1\.normalizeMaterialVideoUrl\)\(rest\.video_url\)/);
assert.match(controller, /video_url: \(0, materialVideo_1\.normalizeMaterialVideoUrl\)\(p\.video_url\)/);
assert.match(controller, /image_urls: \(0, productJsonFields_1\.parseJsonArray\)\(p\.image_urls\)/);
assert.match(profileController, /video_url: \(0, materialVideo_1\.normalizeMaterialVideoUrl\)\(p\.video_url\)/);
assert.match(profileController, /image_urls: \(0, productJsonFields_1\.parseJsonArray\)\(p\.image_urls\)/);
assert.match(serverVideo, /A-Za-z0-9_-/);
assert.doesNotMatch(serverVideo, /https:/);
assert.match(materialsApi, /video_url: string \| null/);
assert.match(materialsApi, /video_url: normalizeMaterialVideoUrl\(row\.video_url\)/);
assert.match(materialMacros, /export type SearchProduct[\s\S]{0,240}video_url: string \| null/);
assert.match(macroController, /p\.image_url, p\.video_url, p\.category/);
assert.match(macroController, /video_url: \(0, materialVideo_1\.normalizeMaterialVideoUrl\)\(r\.video_url\)/);
assert.match(detail, /<video[\s\S]*?controls[\s\S]*?playsInline[\s\S]*?preload="metadata"/);
assert.match(detail, /<source src=\{resolveImageUrl\(product\.video_url\)\} type="video\/mp4"/);
assert.match(supplierLibrary, /product\.video_url &&/);
assert.match(supplierLibrary, /className="relative aspect-\[4\/3\] overflow-hidden"/);
assert.match(supplierDetail, /onOpenProduct=\{openProductMedia\}/);
assert.match(supplierDetail, /const videoUrl = normalizeMaterialVideoUrl\(product\.video_url\)/);
assert.match(supplierDetail, /lightbox\.idx === lightbox\.images\.length/);
assert.match(supplierDetail, /role="dialog"/);
assert.match(supplierDetail, /aria-label="Next media"/);
assert.match(supplierDetail, /<video[\s\S]*?playsInline[\s\S]*?preload="metadata"[\s\S]*?poster=/);
assert.match(supplierDetail, /className="aspect-video w-\[min\(90vw,960px\)\]/);
assert.doesNotMatch(supplierDetail, /<video[\s\S]*?autoPlay/);

console.log('supplier-product-video: 28/28 PASS');
