#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = new URL('../..', import.meta.url);
const read = (file) => readFile(new URL(file, root), 'utf8');

const [renderer, supplierCatalogs, supplierRoutes, adminCatalogs, adminRoutes, adminPage, adminApi, profile, reader, catalogPage, migration, sourceMigration, flooringCatalog] = await Promise.all([
  read('server/dist/lib/catalogRenderer.js'),
  read('server/dist/controllers/supplierCatalogController.js'),
  read('server/dist/routes/suppliers.js'),
  read('server/dist/controllers/supplierAdminController.js'),
  read('server/dist/routes/admin.js'),
  read('src/app/admin/suppliers/[id]/page.tsx'),
  read('src/lib/adminApi.ts'),
  read('server/dist/controllers/supplierProfileController.js'),
  read('src/components/materials/CatalogReader.tsx'),
  read('src/app/supplier/catalogs/page.tsx'),
  read('server/dist/lib/autoMigrate.js'),
  read('server/dist/scripts/migrateCatalogSourcesPrivate.js'),
  read('src/components/flooring/FlooringHeroCatalog.tsx'),
]);
const validation = await import('../../server/dist/lib/catalogValidation.js');

assert.match(renderer, /pdftoppm/);
assert.match(renderer, /manifest\.json/);
assert.match(renderer, /running\.has\(id\)/);
assert.match(renderer, /catalogFilePath/);
assert.match(renderer, /render_status = 'processing'/);
assert.match(renderer, /render_status = 'ready'/);
assert.match(renderer, /startCatalogRenderWorker/);
assert.match(renderer, /claimCatalog/);
assert.match(renderer, /\.staging-/);
assert.match(renderer, /COMMAND_TIMEOUT_MS/);
assert.match(renderer, /catalog_visible = 1/);
assert.match(renderer, /published_sha256 = \?/);
assert.match(renderer, /unpublishCatalogPreview/);
assert.match(renderer, /repairExpected/);
assert.match(renderer, /retiredLongEnough/);
assert.match(renderer, /const candidatePath = path\.join\(privateRoot, 'manifests'/);
assert.match(renderer, /published_sha256 IS NOT NULL/);
assert.match(renderer, /let pruneCursor = 0/);
assert.match(renderer, /quarantineCatalogPublicArtifacts/);
assert.match(renderer, /pruneOrphanPublicCatalogRoots/);
assert.match(supplierCatalogs, /quarantineCatalogPublicArtifacts/);
assert.doesNotMatch(renderer, /candidate-manifest\.json/);
assert.match(renderer, /MAX_SOURCE_BYTES/);
assert.doesNotMatch(supplierCatalogs, /enqueueCatalogRender/);
assert.match(supplierCatalogs, /parseChunkMeta/);
assert.match(supplierCatalogs, /tarmeer-catalog-chunks/);
assert.match(supplierCatalogs, /safeCatalogFileName/);
assert.match(supplierCatalogs, /\.assembling/);
assert.match(supplierCatalogs, /\.part/);
assert.match(supplierCatalogs, /path_1\.default\.join\(chunkRoot, 'active'\)/);
assert.match(supplierCatalogs, /sessionMeta\.uploadId !== meta\.uploadId/);
assert.match(supplierCatalogs, /lastCatalogCleanupAt/);
assert.match(supplierCatalogs, /assertUnboundCatalogQuotaForUser/);
assert.match(supplierCatalogs, /catalog-upload-locks/);
assert.match(supplierCatalogs, /CATALOG_UPLOAD_LOCK_STALE_MS/);
assert.match(supplierCatalogs, /\.stale-/);
assert.match(supplierCatalogs, /path_1\.default\.join\(lock, 'owner'\)/);
assert.match(supplierCatalogs, /ownerHandle\?\.utimes/);
assert.match(supplierCatalogs, /withCatalogUploadLock\(req\.supplierUser\.id/);
assert.match(supplierRoutes, /limitCatalogBodyConcurrency/);
assert.match(supplierRoutes, /activeCatalogBodies >= 8/);
assert.doesNotMatch(adminCatalogs, /enqueueCatalogRender/);
assert.match(adminCatalogs, /publishCatalogPreview/);
assert.match(adminCatalogs, /removeCatalogArtifacts/);
assert.match(adminCatalogs, /JOIN supplier_profiles sp ON sp\.id = sc\.supplier_profile_id/);
assert.match(adminCatalogs, /sp\.country = \?/);
assert.match(adminCatalogs, /unpublishCatalogPreview/);
assert.match(adminRoutes, /catalogs\/:id\/source/);
assert.match(adminRoutes, /catalogs\/:id\/publish/);
assert.match(adminRoutes, /catalogs\/:id\/unpublish/);
assert.match(adminRoutes, /suppliers\/:id\/products.*requireSupplierCountryScope/);
assert.match(adminRoutes, /suppliers\/:id\/projects.*requireSupplierCountryScope/);
assert.match(adminRoutes, /suppliers\/:id\/catalogs.*requireSupplierCountryScope/);
assert.match(adminCatalogs, /function requireSupplierCountryScope/);
assert.match(adminCatalogs, /role === 'super_admin'[\s\S]{0,180}SELECT supplier_user_id, country FROM supplier_profiles WHERE id = \?/);
assert.match(adminRoutes, /fileSize: 60 \* 1024 \* 1024/);
assert.match(adminPage, /Ready for review/);
assert.match(adminPage, /publishSupplierCatalog/);
assert.match(adminPage, /canApproveCatalogs && hasUnpublishedRevision/);
assert.doesNotMatch(adminPage, /href=\{c\.file_url\}/);
assert.match(adminApi, /openSupplierCatalogSource/);
assert.doesNotMatch(profile, /catalogs\.forEach\(\(catalog\).*enqueueCatalogRender/);
assert.doesNotMatch(reader, /Download the original PDF/);
assert.match(reader, /imageExtRef\.current = data\?\.format === 'jpg' \? 'jpg' : 'webp'/);
assert.match(catalogPage, /accept="application\/pdf"/);
assert.match(migration, /catalog_visible/);
assert.match(migration, /published_sha256/);
assert.match(sourceMigration, /catalog-legacy-quarantine/);
assert.match(sourceMigration, /catalog-migration-audit\.jsonl/);
assert.doesNotMatch(flooringCatalog, /file_url/);
assert.equal(validation.parseChunkMeta({ upload_id: '../../bad', chunk_index: '0', total_chunks: '1' }), null);
assert.deepEqual(validation.parseChunkMeta({ upload_id: 'a1b2c3d4e5f60708', chunk_index: '0', total_chunks: '1' }), { uploadId: 'a1b2c3d4e5f60708', index: 0, total: 1 });
assert.equal(validation.isPdfBuffer(Buffer.from('%PDF-1.7')), true);
assert.equal(validation.isPdfBuffer(Buffer.from('<script>')), false);
assert.equal(validation.safeCatalogFileName(123, 'private://catalogs/123-00000000-0000-4000-8000-000000000001.pdf'), '123-00000000-0000-4000-8000-000000000001.pdf');
assert.equal(validation.safeCatalogFileName(123, 'private://catalogs/123-x/../999-00000000-0000-4000-8000-000000000001.pdf'), null);

// Behavioral check: an immutable private candidate is copied to a public
// revision and becomes visible only through the explicit admin publish call.
const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(root);
const databasePath = require.resolve(path.join(projectRoot, 'server/dist/config/database.js'));
const rendererPath = require.resolve(path.join(projectRoot, 'server/dist/lib/catalogRenderer.js'));
const hash = 'a'.repeat(64);
const dbCalls = [];
let publishLockReads = 0;
const fakeConnection = {
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
  execute: async (sql, params) => {
    dbCalls.push([sql, params]);
    if (/SELECT supplier_profile_id/.test(sql)) return [[{ supplier_profile_id: 9 }]];
    if (/FOR UPDATE/.test(sql)) {
      publishLockReads += 1;
      return [[publishLockReads === 1
        ? { source_sha256: hash, published_sha256: null, catalog_visible: 0, render_status: 'ready' }
        : { source_sha256: hash, published_sha256: hash, catalog_visible: 1, render_status: 'ready' }]];
    }
    return [{ affectedRows: 1 }];
  },
};
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: { __esModule: true, default: {
  execute: async (sql, params) => {
    dbCalls.push([sql, params]);
    if (/SELECT id, source_sha256/.test(sql)) return [[{ id: 77, source_sha256: hash, published_sha256: null, catalog_visible: 0, render_status: 'ready' }]];
    if (/SELECT id FROM supplier_profiles WHERE id = \? AND country = \?/.test(sql)) {
      return [params?.[1] === 'ae' ? [{ id: Number(params[0]) }] : []];
    }
    return [{ affectedRows: 1 }];
  },
  getConnection: async () => fakeConnection,
} } };
delete require.cache[rendererPath];
const rendererModule = require(rendererPath);
const originalCwd = process.cwd();
const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'catalog-publish-test-'));
try {
  process.chdir(tempRoot);
  const revision = path.join(tempRoot, 'private/catalog-previews/77/revisions', hash);
  const manifests = path.join(tempRoot, 'private/catalog-previews/77/manifests');
  await mkdir(revision, { recursive: true });
  await mkdir(manifests, { recursive: true });
  await writeFile(path.join(revision, '1.jpg'), Buffer.from('full'));
  await writeFile(path.join(revision, '1-thumb.jpg'), Buffer.from('thumb'));
  await writeFile(path.join(manifests, `${hash}.json`), JSON.stringify({ pages: 1, ar: 1.4, format: 'jpg', rev: 1, source_sha256: hash, dir: `revisions/${hash}` }));
  await rendererModule.publishCatalogPreview(77);
  const published = JSON.parse(await readFile(path.join(tempRoot, 'public/uploads/suppliers/catalogs/pages/77/manifest.json'), 'utf8'));
  assert.equal(published.source_sha256, hash);
  assert.equal(await readFile(path.join(tempRoot, 'public/uploads/suppliers/catalogs/pages/77/revisions', hash, '1.jpg'), 'utf8'), 'full');
  assert.ok(dbCalls.some(([sql]) => /catalog_visible = 1/.test(sql)));
  await rendererModule.unpublishCatalogPreview(77, 9);
  await assert.rejects(readFile(path.join(tempRoot, 'public/uploads/suppliers/catalogs/pages/77/manifest.json'), 'utf8'));
  assert.ok(dbCalls.some(([sql]) => /catalog_visible = 0, published_sha256 = NULL/.test(sql)));
  // A delete first isolates the static public root. If the DB mutation fails,
  // the root can be restored; if the process crashes, only private quarantine
  // remains and the former public URL is unreachable.
  const staleManifest = path.join(tempRoot, 'public/uploads/suppliers/catalogs/pages/77/manifest.json');
  await mkdir(path.dirname(staleManifest), { recursive: true });
  await writeFile(staleManifest, '{}');
  const deletedQuarantine = await rendererModule.quarantineCatalogPublicArtifacts(77);
  await assert.rejects(readFile(staleManifest, 'utf8'));
  await rendererModule.restoreCatalogPublicArtifacts(77, deletedQuarantine);
  assert.equal(await readFile(staleManifest, 'utf8'), '{}');
  await rendererModule.discardCatalogPublicQuarantine(await rendererModule.quarantineCatalogPublicArtifacts(77));
  await rendererModule.removeCatalogArtifacts(77, null, false);

  // Behavioral country guard: a supplier-scoped admin can mutate only a
  // supplier in the same country; super admins remain intentionally global.
  const adminControllerPath = require.resolve(path.join(projectRoot, 'server/dist/controllers/supplierAdminController.js'));
  delete require.cache[adminControllerPath];
  const { requireSupplierCountryScope } = require(adminControllerPath);
  const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  let nextCalls = 0;
  await requireSupplierCountryScope({ params: { id: '91' }, admin: { role: 'sub_admin', country: 'ae' } }, response(), () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  const denied = response();
  await requireSupplierCountryScope({ params: { id: '91' }, admin: { role: 'sub_admin', country: 'vn' } }, denied, () => { nextCalls += 1; });
  assert.equal(denied.statusCode, 404);
  await requireSupplierCountryScope({ params: { id: '91' }, admin: { role: 'super_admin', country: 'ae' } }, response(), () => { nextCalls += 1; });
  assert.equal(nextCalls, 2);
} finally {
  process.chdir(originalCwd);
  await rm(tempRoot, { recursive: true, force: true });
}
console.log('catalog render reliability: 76/76 PASS');
