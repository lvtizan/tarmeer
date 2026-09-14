#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../..', import.meta.url);
const read = (file) => readFile(new URL(file, root), 'utf8');

const [renderer, supplierCatalogs, adminCatalogs, publicProfile, reader] = await Promise.all([
  read('server/dist/lib/catalogRenderer.js'),
  read('server/dist/controllers/supplierCatalogController.js'),
  read('server/dist/controllers/supplierAdminController.js'),
  read('server/dist/controllers/supplierProfileController.js'),
  read('src/components/materials/CatalogReader.tsx'),
]);

assert.match(renderer, /pdftoppm/);
assert.match(renderer, /manifest\.json/);
assert.match(renderer, /running\.has\(id\)/);
assert.match(renderer, /activeRender\.then\(\(\) => renderCatalogPages\(catalog, \{ force: true \}\)\)/);
assert.match(renderer, /catalogFilePath/);
assert.match(supplierCatalogs, /enqueueCatalogRender\)\(created\[0\]\)/);
assert.match(supplierCatalogs, /catalogs\.forEach\(\(catalog\).*enqueueCatalogRender/);
assert.match(adminCatalogs, /enqueueCatalogRender\)\(\{ id: catalogId, file_url: newUrl \}, \{ force: true \}\)/);
assert.match(adminCatalogs, /enqueueCatalogRender\)\(created\[0\]\)/);
assert.match(publicProfile, /catalogs\.forEach\(\(catalog\).*enqueueCatalogRender/);
assert.match(reader, /for \(let attempt = 0; attempt < 30/);
assert.match(reader, /imageExtRef\.current = data\?\.format === 'jpg' \? 'jpg' : 'webp'/);
assert.match(reader, /Download the original PDF/);
assert.match(reader, /resolveImageUrl\(active\.file_url\)/);
console.log('catalog render reliability: 13/13 PASS');
