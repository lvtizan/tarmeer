#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, URL, require(name) {
    if (name in dependencies) return dependencies[name];
    throw Error(name);
  } });
  return exports;
}
const library = load('../../src/lib/supplierProductLibrary.ts');
const { getMaterialGallery, getMaterialSpecifications, isFullSlabProduct } = load('../../src/lib/materialGallery.ts', { './supplierProductLibrary': library });
const cover = '/uploads/suppliers/supplier-1127/fyn-20261014/fyn18-1/products/01.webp';
const scene = '/uploads/suppliers/supplier-1127/fyn-20261014/fyn18-1/applications/01.webp';
const specs = [{ label: 'Display format', value: 'Full slab' }];
let count = 0;
const check = (name, run) => { run(); count++; console.log('PASS ' + name); };
check('full slabs are explicitly declared in product data', () => {
  assert.equal(isFullSlabProduct({ specs }), true);
  assert.equal(isFullSlabProduct({ specs: JSON.stringify(specs) }), true);
  assert.equal(isFullSlabProduct({ specs: ['Display format: Full slab'] }), true);
});
check('ordinary materials remain unchanged', () => {
  assert.equal(isFullSlabProduct({}), false);
  const result = getMaterialGallery({ image_urls: [cover, scene] });
  assert.equal(result.productImages.length, 2);
  assert.equal(result.applicationImages.length, 0);
});
check('product image and application reference have independent galleries', () => {
  const result = getMaterialGallery({ specs, image_urls: [cover, scene] });
  assert.equal(result.productImages.join(), cover);
  assert.equal(result.applicationImages.join(), scene);
});
check('missing scene images do not borrow another product', () => {
  const result = getMaterialGallery({ specs, image_url: cover });
  assert.equal(result.productImages.join(), cover);
  assert.equal(result.applicationImages.length, 0);
});
check('duplicates do not produce duplicate thumbnails', () => {
  assert.equal(getMaterialGallery({ specs, image_urls: [cover, cover, scene, scene] }).productImages.length, 1);
  assert.equal(getMaterialGallery({ specs, image_urls: [cover, cover, scene, scene] }).applicationImages.length, 1);
});
check('absolute images and query strings preserve their original URLs', () => {
  const url = `https://www.tarmeer.com${scene}?v=2`;
  assert.equal(getMaterialGallery({ specs, image_urls: [cover, url] }).applicationImages[0], url);
});
check('invalid legacy URLs do not crash gallery rendering', () => {
  assert.equal(getMaterialGallery({ specs, image_urls: ['http://[invalid', '', cover] }).productImages.length, 2);
});
check('empty galleries produce empty arrays', () => {
  const result = getMaterialGallery({ specs });
  assert.equal(result.productImages.length + result.applicationImages.length, 0);
});
check('application images are reordered after product images for lightbox indices', () => {
  const result = getMaterialGallery({ specs, image_urls: [scene, cover] });
  const shots = [...result.productImages, ...result.applicationImages];
  assert.equal(shots[0], cover);
  assert.equal(shots[result.productImages.length], scene);
});
check('declared collections and model codes remain searchable', () => {
  const product = { id: 1, title_translated: 'Emerald Wilderness', specs: [...specs, { label: 'Model', value: 'FYN18-1' }, { label: 'Collection', value: 'Green Stone' }] };
  const indexed = library.indexSupplierProducts([product], () => 'Stone');
  assert.equal(library.filterIndexedSupplierProducts(indexed, 'Green Stone', 'FYN18-1').length, 1);
  assert.equal(library.filterIndexedSupplierProducts(indexed, 'White Stone', '').length, 0);
});
check('layout metadata is not shown as a purchasing specification', () => {
  const original = [...specs, { label: 'Model', value: 'FYN18-1' }, { label: 'Color', value: 'Green' }];
  const visible = getMaterialSpecifications(original);
  assert.equal(visible.length, 2); assert.equal(visible[0].label, 'Model');
  assert.equal(original.length, 3);
});
console.log(`material-slab-gallery: ${count}/${count} PASS`);
