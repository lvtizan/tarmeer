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
assert.match(supplierCatalogs, /storeCatalogChunk/);
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
assert.equal(validation.MAX_CATALOG_BYTES, 60 * 1024 * 1024);
assert.equal(validation.MAX_CHUNKS, 30);
assert.deepEqual(validation.parseChunkMeta({ upload_id: 'a1b2c3d4e5f60708', chunk_index: '29', total_chunks: '30' }), { uploadId: 'a1b2c3d4e5f60708', index: 29, total: 30 });
assert.equal(validation.parseChunkMeta({ upload_id: 'a1b2c3d4e5f60708', chunk_index: '30', total_chunks: '31' }), null);
assert.equal(validation.isSameCatalogUploadSession({ uploadId: 'a1b2c3d4e5f60708', total: 30, original_name: 'catalog.pdf' }, { uploadId: 'a1b2c3d4e5f60708', total: 30 }, 'catalog.pdf'), true);
assert.equal(validation.isSameCatalogUploadSession({ uploadId: 'old0000000000000', total: 30, original_name: 'catalog.pdf' }, { uploadId: 'new0000000000000', total: 30 }, 'catalog.pdf'), false);
assert.equal(validation.isPdfBuffer(Buffer.from('%PDF-1.7')), true);
assert.equal(validation.isPdfBuffer(Buffer.from('<script>')), false);
assert.equal(validation.safeCatalogFileName(123, 'private://catalogs/123-00000000-0000-4000-8000-000000000001.pdf'), '123-00000000-0000-4000-8000-000000000001.pdf');
assert.equal(validation.safeCatalogFileName(123, 'private://catalogs/123-x/../999-00000000-0000-4000-8000-000000000001.pdf'), null);

// Behavioral check: an immutable private candidate is copied to a public
// revision and becomes visible only through the explicit admin publish call.
const require = createRequire(import.meta.url);
const projectRoot = fileURLToPath(root);
const { storeCatalogChunk } = require(path.join(projectRoot, 'server/dist/lib/catalogChunkSession.js'));
const { withCatalogChunkLock } = require(path.join(projectRoot, 'server/dist/lib/catalogChunkLock.js'));
const sessionRoot = await mkdtemp(path.join(os.tmpdir(), 'catalog-chunk-session-'));
try {
  let advisoryLockOwner = null;
  let nextConnectionId = 0;
  const lockSqlCalls = [];
  const fakeLockPool = {
    async getConnection() {
      const connectionId = ++nextConnectionId;
      return {
        async execute(sql, params) {
          lockSqlCalls.push([sql, params]);
          if (/GET_LOCK/.test(sql)) {
            if (advisoryLockOwner !== null) return [[{ acquired: 0 }]];
            advisoryLockOwner = connectionId;
            return [[{ acquired: 1 }]];
          }
          if (/RELEASE_LOCK/.test(sql)) {
            const released = advisoryLockOwner === connectionId ? 1 : 0;
            if (released) advisoryLockOwner = null;
            return [[{ released }]];
          }
          throw new Error(`Unexpected lock query: ${sql}`);
        },
        release() {},
      };
    },
  };
  const lockedStore = (args) => withCatalogChunkLock(fakeLockPool, 77, () => storeCatalogChunk(args));

  await assert.rejects(
    withCatalogChunkLock(fakeLockPool, 77, async () => { throw new Error('simulated chunk failure'); }),
    /simulated chunk failure/,
  );
  assert.equal(advisoryLockOwner, null);
  assert.ok(lockSqlCalls.some(([sql]) => /GET_LOCK/.test(sql)));
  assert.ok(lockSqlCalls.some(([sql]) => /RELEASE_LOCK/.test(sql)));

  for (const releaseMode of ['throw', 'zero']) {
    let releasedToPool = false;
    let destroyed = false;
    const unsafePool = {
      async getConnection() {
        return {
          async execute(sql) {
            if (/GET_LOCK/.test(sql)) return [[{ acquired: 1 }]];
            if (releaseMode === 'throw') throw new Error('simulated release failure');
            return [[{ released: 0 }]];
          },
          release() { releasedToPool = true; },
          destroy() { destroyed = true; },
        };
      },
    };
    await withCatalogChunkLock(unsafePool, 77, async () => {});
    assert.equal(destroyed, true);
    assert.equal(releasedToPool, false);
  }

  let acquisitionReleased = false;
  let acquisitionDestroyed = false;
  const uncertainAcquisitionPool = {
    async getConnection() {
      return {
        async execute() { throw new Error('simulated acquisition response failure'); },
        release() { acquisitionReleased = true; },
        destroy() { acquisitionDestroyed = true; },
      };
    },
  };
  await assert.rejects(
    withCatalogChunkLock(uncertainAcquisitionPool, 77, async () => {}),
    /simulated acquisition response failure/,
  );
  assert.equal(acquisitionDestroyed, true);
  assert.equal(acquisitionReleased, false);

  for (const invalidAcquisition of [null, undefined, 'unexpected']) {
    let invalidReleased = false;
    let invalidDestroyed = false;
    const invalidAcquisitionPool = {
      async getConnection() {
        return {
          async execute() { return [[{ acquired: invalidAcquisition }]]; },
          release() { invalidReleased = true; },
          destroy() { invalidDestroyed = true; },
        };
      },
    };
    await assert.rejects(
      withCatalogChunkLock(invalidAcquisitionPool, 77, async () => {}),
      /invalid database response/,
    );
    assert.equal(invalidDestroyed, true);
    assert.equal(invalidReleased, false);
  }

  const activeDir = path.join(sessionRoot, 'active');
  const assemblingDir = path.join(sessionRoot, 'inprogress000000.assembling');
  await mkdir(activeDir, { recursive: true });
  await mkdir(assemblingDir, { recursive: true });
  await writeFile(path.join(assemblingDir, 'marker'), 'keep');
  await writeFile(path.join(activeDir, 'session.json'), JSON.stringify({ uploadId: 'old0000000000000', total: 30, original_name: 'catalog.pdf' }));
  await writeFile(path.join(activeDir, 'chunk_1'), 'old-chunk');

  const replacementMeta = { uploadId: 'aaaabbbbccccdddd', index: 0, total: 30 };
  await lockedStore({ chunkRoot: sessionRoot, meta: replacementMeta, originalName: 'catalog.pdf', buffer: Buffer.from('new-zero'), staleMs: 20 * 60 * 1000 });
  const replacementSession = JSON.parse(await readFile(path.join(activeDir, 'session.json'), 'utf8'));
  assert.equal(replacementSession.uploadId, replacementMeta.uploadId);
  assert.equal(await readFile(path.join(activeDir, 'chunk_0'), 'utf8'), 'new-zero');
  await assert.rejects(readFile(path.join(activeDir, 'chunk_1')));
  assert.equal(await readFile(path.join(assemblingDir, 'marker'), 'utf8'), 'keep');

  await writeFile(path.join(activeDir, 'chunk_1'), 'preserve');
  await lockedStore({ chunkRoot: sessionRoot, meta: replacementMeta, originalName: 'catalog.pdf', buffer: Buffer.from('retry-zero'), staleMs: 20 * 60 * 1000 });
  assert.equal(await readFile(path.join(activeDir, 'chunk_1'), 'utf8'), 'preserve');

  const competitors = [
    { meta: { uploadId: '1111222233334444', index: 0, total: 30 }, buffer: Buffer.from('winner-a') },
    { meta: { uploadId: '5555666677778888', index: 0, total: 30 }, buffer: Buffer.from('winner-b') },
  ];
  const outcomes = await Promise.allSettled(competitors.map(({ meta, buffer }) => lockedStore({ chunkRoot: sessionRoot, meta, originalName: 'catalog.pdf', buffer, staleMs: 20 * 60 * 1000 })));
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 1);
  const winningSession = JSON.parse(await readFile(path.join(activeDir, 'session.json'), 'utf8'));
  assert.equal(competitors.some(({ meta }) => meta.uploadId === winningSession.uploadId), true);
  const winningBuffer = competitors.find(({ meta }) => meta.uploadId === winningSession.uploadId).buffer.toString();
  assert.equal(await readFile(path.join(activeDir, 'chunk_0'), 'utf8'), winningBuffer);
  assert.equal(await readFile(path.join(assemblingDir, 'marker'), 'utf8'), 'keep');

  const finalUploadId = '9999aaaabbbbcccc';
  await lockedStore({ chunkRoot: sessionRoot, meta: { uploadId: finalUploadId, index: 0, total: 2 }, originalName: 'catalog.pdf', buffer: Buffer.from('first'), staleMs: 20 * 60 * 1000 });
  let releaseFinalize;
  let signalFinalize;
  const finalizeReached = new Promise(resolve => { signalFinalize = resolve; });
  const finalizeGate = new Promise(resolve => { releaseFinalize = resolve; });
  const finalChunk = lockedStore({
    chunkRoot: sessionRoot,
    meta: { uploadId: finalUploadId, index: 1, total: 2 },
    originalName: 'catalog.pdf',
    buffer: Buffer.from('last'),
    staleMs: 20 * 60 * 1000,
    onBeforeFinalize: async () => { signalFinalize(); await finalizeGate; },
  });
  await finalizeReached;
  const blockedTakeover = await Promise.allSettled([
    lockedStore({ chunkRoot: sessionRoot, meta: { uploadId: 'ddddeeeeffff0000', index: 0, total: 30 }, originalName: 'catalog.pdf', buffer: Buffer.from('takeover'), staleMs: 20 * 60 * 1000 }),
  ]);
  assert.equal(blockedTakeover[0].status, 'rejected');
  assert.equal(blockedTakeover[0].reason?.statusCode, 409);
  releaseFinalize();
  const finalized = await finalChunk;
  const claimedDir = path.join(sessionRoot, `${finalUploadId}.assembling`);
  assert.equal(finalized.assemblingDir, claimedDir);
  assert.equal(JSON.parse(await readFile(path.join(claimedDir, 'session.json'), 'utf8')).uploadId, finalUploadId);
  assert.equal(await readFile(path.join(claimedDir, 'chunk_1'), 'utf8'), 'last');
  await assert.rejects(readFile(path.join(activeDir, 'session.json')));

  await mkdir(activeDir);
  await writeFile(path.join(activeDir, 'orphan-chunk'), 'crashed-before-session');
  const recoveredMeta = { uploadId: 'abcdabcdabcdabcd', index: 0, total: 30 };
  await lockedStore({ chunkRoot: sessionRoot, meta: recoveredMeta, originalName: 'catalog.pdf', buffer: Buffer.from('recovered'), staleMs: 20 * 60 * 1000 });
  assert.equal(JSON.parse(await readFile(path.join(activeDir, 'session.json'), 'utf8')).uploadId, recoveredMeta.uploadId);
  await assert.rejects(readFile(path.join(activeDir, 'orphan-chunk')));
} finally {
  await rm(sessionRoot, { recursive: true, force: true });
}
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
console.log('catalog render reliability: 118/118 PASS');
