"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadCatalogFile = uploadCatalogFile;
exports.uploadCatalogChunk = uploadCatalogChunk;
exports.listCatalogs = listCatalogs;
exports.listMyCatalogs = listMyCatalogs;
exports.uploadCatalog = uploadCatalog;
exports.deleteCatalog = deleteCatalog;
const database_1 = __importDefault(require("../config/database"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = require("crypto");
const supplierRedact_1 = require("../lib/supplierRedact");
const catalogValidation_1 = require("../lib/catalogValidation");
const catalogRenderer_1 = require("../lib/catalogRenderer");
let catalogCleanupTask = null;
let lastCatalogCleanupAt = 0;
const CATALOG_UPLOAD_LOCK_STALE_MS = 20 * 60 * 1000;
async function assertUnboundCatalogQuotaForUser(userId, incomingBytes) {
    const uploadDir = path_1.default.join(process.cwd(), 'private', 'catalogs');
    await promises_1.default.mkdir(uploadDir, { recursive: true, mode: 0o755 });
    const pattern = new RegExp(`^${Number(userId)}-[0-9a-f-]{36}\\.pdf$`, 'i');
    let count = 0;
    let bytes = 0;
    for (const entry of await promises_1.default.readdir(uploadDir, { withFileTypes: true })) {
        if (!entry.isFile() || !pattern.test(entry.name)) continue;
        const fileUrl = `private://catalogs/${entry.name}`;
        const [rows] = await database_1.default.execute('SELECT id FROM supplier_catalogs WHERE file_url = ? LIMIT 1', [fileUrl]);
        if (!rows[0]) {
            count += 1;
            bytes += (await promises_1.default.stat(path_1.default.join(uploadDir, entry.name))).size;
        }
    }
    if (count >= 20 || bytes + Number(incomingBytes || 0) > 180 * 1024 * 1024)
        throw Object.assign(new Error('Save or remove your pending catalog uploads before adding more.'), { statusCode: 429 });
}
async function withCatalogUploadLock(userId, task) {
    const lock = path_1.default.join(process.cwd(), 'private', 'catalog-upload-locks', String(userId));
    const ownerToken = (0, crypto_1.randomUUID)();
    let ownerHandle = null;
    await promises_1.default.mkdir(path_1.default.dirname(lock), { recursive: true, mode: 0o700 });
    let acquired = false;
    for (let attempt = 0; attempt < 2 && !acquired; attempt += 1) {
        try {
            await promises_1.default.mkdir(lock, { mode: 0o700 });
            try {
                await promises_1.default.writeFile(path_1.default.join(lock, 'owner'), ownerToken, { flag: 'wx', mode: 0o600 });
                ownerHandle = await promises_1.default.open(path_1.default.join(lock, 'owner'), 'r+');
            }
            catch (ownerError) {
                await promises_1.default.rm(lock, { recursive: true, force: true });
                throw ownerError;
            }
            acquired = true;
        }
        catch (error) {
            if (error?.code !== 'EEXIST') throw error;
            let stale = false;
            try { stale = Date.now() - (await promises_1.default.stat(path_1.default.join(lock, 'owner'))).mtimeMs > CATALOG_UPLOAD_LOCK_STALE_MS; }
            catch (statError) {
                if (statError?.code === 'ENOENT') {
                    try { stale = Date.now() - (await promises_1.default.stat(lock)).mtimeMs > CATALOG_UPLOAD_LOCK_STALE_MS; }
                    catch (lockError) {
                        if (lockError?.code === 'ENOENT') continue;
                        throw lockError;
                    }
                }
                else {
                    throw statError;
                }
            }
            if (!stale || attempt > 0) break;
            // Never delete a lock in place: rename makes stale-lock takeover
            // atomic, while a concurrent request can only win one rename.
            const retired = `${lock}.stale-${(0, crypto_1.randomUUID)()}`;
            try {
                await promises_1.default.rename(lock, retired);
                await promises_1.default.rm(retired, { recursive: true, force: true });
            }
            catch (renameError) {
                if (renameError?.code !== 'ENOENT') break;
            }
        }
    }
    if (!acquired) {
        const error = new Error('Another catalog upload is being finalized. Please retry.');
        error.statusCode = 409;
        throw error;
    }
    // Keep long-but-live finalizations fresh. A crashed process stops touching
    // the directory and can be reclaimed after the stale threshold.
    const heartbeat = setInterval(() => {
        const now = new Date();
        void ownerHandle?.utimes(now, now).catch(() => {});
    }, 60_000);
    heartbeat.unref?.();
    try {
        return await task();
    } finally {
        clearInterval(heartbeat);
        await ownerHandle?.close().catch(() => {});
        let stillOwner = false;
        try { stillOwner = (await promises_1.default.readFile(path_1.default.join(lock, 'owner'), 'utf8')) === ownerToken; }
        catch { /* lock was reclaimed */ }
        if (stillOwner) await promises_1.default.rm(lock, { recursive: true, force: true });
    }
}
async function getProfileId(supplierUserId) {
    const [rows] = await database_1.default.execute('SELECT id FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [supplierUserId]);
    return rows[0]?.id || null;
}
// Upload sessions and raw files without a catalog record are transient. Clean
// them lazily on the next upload so abandoned chunks cannot fill the temp disk.
async function cleanupStaleCatalogUploads() {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const chunkRoot = path_1.default.join(os_1.default.tmpdir(), 'tarmeer-catalog-chunks');
    try {
        for (const userEntry of await promises_1.default.readdir(chunkRoot, { withFileTypes: true })) {
            if (!userEntry.isDirectory())
                continue;
            const userDir = path_1.default.join(chunkRoot, userEntry.name);
            for (const session of await promises_1.default.readdir(userDir, { withFileTypes: true })) {
                const sessionDir = path_1.default.join(userDir, session.name);
                if (session.isDirectory() && (await promises_1.default.stat(sessionDir)).mtimeMs < cutoff)
                    await promises_1.default.rm(sessionDir, { recursive: true, force: true });
            }
        }
    }
    catch { /* first upload/no temp directory */ }
    const uploadDir = path_1.default.join(process.cwd(), 'private', 'catalogs');
    try {
        for (const entry of await promises_1.default.readdir(uploadDir, { withFileTypes: true })) {
            if (!entry.isFile() || !/^[0-9]+-[0-9a-f-]{36}\.pdf$/i.test(entry.name))
                continue;
            const filePath = path_1.default.join(uploadDir, entry.name);
            if ((await promises_1.default.stat(filePath)).mtimeMs >= cutoff)
                continue;
            const ownerId = Number(entry.name.split('-', 1)[0]);
            await withCatalogUploadLock(ownerId, async () => {
                const current = await promises_1.default.stat(filePath).catch(() => null);
                if (!current || current.mtimeMs >= cutoff) return;
                const fileUrl = `private://catalogs/${entry.name}`;
                const [rows] = await database_1.default.execute('SELECT id FROM supplier_catalogs WHERE file_url = ? LIMIT 1', [fileUrl]);
                if (!rows[0]) await promises_1.default.rm(filePath, { force: true });
            });
        }
    }
    catch (error) { console.warn('Catalog upload cleanup skipped:', error?.message); }
}
function scheduleCatalogUploadCleanup() {
    if (catalogCleanupTask || Date.now() - lastCatalogCleanupAt < 60 * 60 * 1000)
        return;
    lastCatalogCleanupAt = Date.now();
    catalogCleanupTask = cleanupStaleCatalogUploads().finally(() => { catalogCleanupTask = null; });
}
async function uploadCatalogFile(req, res) {
    try {
        const userId = req.supplierUser.id;
        scheduleCatalogUploadCleanup();
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'No file data provided.' });
        if (!(0, catalogValidation_1.isPdfUpload)(file) || file.size > catalogValidation_1.MAX_CATALOG_BYTES) {
            return res.status(400).json({ error: 'Catalogs must be valid PDF files up to 60 MB.' });
        }
        const fileName = await withCatalogUploadLock(userId, async () => {
            await assertUnboundCatalogQuotaForUser(userId, file.size);
            const name = `${userId}-${(0, crypto_1.randomUUID)()}.pdf`;
            const uploadDir = path_1.default.join(process.cwd(), 'private', 'catalogs');
            await promises_1.default.writeFile(path_1.default.join(uploadDir, name), file.buffer, { mode: 0o644 });
            return name;
        });
        const originalName = req.body.original_name || file.originalname || '';
        const baseName = originalName ? path_1.default.basename(originalName, path_1.default.extname(originalName)) : '';
        res.json({ url: `private://catalogs/${fileName}`, original_name: baseName });
    }
    catch (error) {
        console.error('Upload catalog file error:', error);
        res.status(error?.statusCode || 500).json({ error: error?.statusCode ? error.message : 'Failed to upload file.' });
    }
}
async function uploadCatalogChunk(req, res) {
    try {
        const userId = req.supplierUser.id;
        scheduleCatalogUploadCleanup();
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'No chunk data.' });
        const meta = (0, catalogValidation_1.parseChunkMeta)(req.body);
        if (!meta || file.size > catalogValidation_1.CHUNK_BYTES) {
            return res.status(400).json({ error: 'Invalid catalog upload chunk.' });
        }
        const original_name = typeof req.body.original_name === 'string' ? req.body.original_name : '';
        if (!/\.pdf$/i.test(original_name || file.originalname || '')) {
            return res.status(400).json({ error: 'Catalogs must be PDF files.' });
        }
        // Client ids are only tokens, never path segments.  Namespace by owner
        // and validate before any write/remove so a chunk cannot escape /tmp.
        const chunkRoot = path_1.default.join(os_1.default.tmpdir(), 'tarmeer-catalog-chunks', String(userId));
        // One fixed per-user slot makes admission atomic across concurrent
        // requests/processes (mkdir is the lock); metadata binds it to uploadId.
        const chunkDir = path_1.default.join(chunkRoot, 'active');
        const assemblingDir = path_1.default.join(chunkRoot, `${meta.uploadId}.assembling`);
        if (!chunkDir.startsWith(`${chunkRoot}${path_1.default.sep}`)) {
            return res.status(400).json({ error: 'Invalid catalog upload session.' });
        }
        try {
            await promises_1.default.access(assemblingDir);
            return res.status(409).json({ error: 'Catalog upload is already being assembled.' });
        }
        catch { /* no active assembler */ }
        await promises_1.default.mkdir(chunkRoot, { recursive: true, mode: 0o700 });
        if (meta.index === 0) {
            // A browser refresh must not lock the supplier out for a day. Only
            // reclaim a session whose heartbeat stopped for the lock TTL.
            try {
                const sessionPath = path_1.default.join(chunkDir, 'session.json');
                if (Date.now() - (await promises_1.default.stat(sessionPath)).mtimeMs > CATALOG_UPLOAD_LOCK_STALE_MS) {
                    const abandoned = path_1.default.join(chunkRoot, `${meta.uploadId}.abandoned-${(0, crypto_1.randomUUID)()}`);
                    await promises_1.default.rename(chunkDir, abandoned);
                    await promises_1.default.rm(abandoned, { recursive: true, force: true });
                }
            }
            catch { /* no prior session, or another request reclaimed it */ }
            try {
                await promises_1.default.mkdir(chunkDir, { mode: 0o700 });
                await promises_1.default.writeFile(path_1.default.join(chunkDir, 'session.json'), JSON.stringify({ uploadId: meta.uploadId, total: meta.total, original_name }), { flag: 'wx', mode: 0o600 });
            }
            catch (error) {
                if (error.code !== 'EEXIST') throw error;
            }
        }
        let sessionMeta;
        try { sessionMeta = JSON.parse(await promises_1.default.readFile(path_1.default.join(chunkDir, 'session.json'), 'utf8')); }
        catch { return res.status(409).json({ error: 'Start the catalog upload again.' }); }
        if (sessionMeta.uploadId !== meta.uploadId || Number(sessionMeta.total) !== meta.total || String(sessionMeta.original_name || '') !== original_name)
            return res.status(409).json({ error: 'Catalog upload session metadata changed.' });
        await promises_1.default.writeFile(path_1.default.join(chunkDir, `chunk_${meta.index}`), file.buffer, { flag: 'w', mode: 0o600 });
        const now = new Date();
        await promises_1.default.utimes(path_1.default.join(chunkDir, 'session.json'), now, now).catch(() => {});
        const idx = meta.index;
        const total = meta.total;
        if (idx < total - 1) {
            return res.json({ done: false });
        }
        // Last chunk received — atomically take ownership of this session so two
        // concurrent final requests cannot assemble or delete each other's data.
        try { await promises_1.default.rename(chunkDir, assemblingDir); }
        catch { return res.status(409).json({ error: 'Catalog upload is already being assembled.' }); }
        let assembledBytes = 0;
        for (let i = 0; i < total; i++) {
            try {
                const part = await promises_1.default.stat(path_1.default.join(assemblingDir, `chunk_${i}`));
                if (!part.isFile() || part.size < 1 || part.size > catalogValidation_1.CHUNK_BYTES)
                    throw new Error('invalid chunk');
                assembledBytes += part.size;
            }
            catch {
                await promises_1.default.rename(assemblingDir, chunkDir).catch(() => {});
                return res.status(409).json({ error: 'Catalog upload is incomplete. Retry the missing chunks.' });
            }
        }
        if (assembledBytes > catalogValidation_1.MAX_CATALOG_BYTES) {
            await promises_1.default.rm(assemblingDir, { recursive: true, force: true });
            return res.status(400).json({ error: 'Catalog exceeds the 60 MB limit.' });
        }
        const fileName = `${userId}-${(0, crypto_1.randomUUID)()}.pdf`;
        const uploadDir = path_1.default.join(process.cwd(), 'private', 'catalogs');
        await promises_1.default.mkdir(uploadDir, { recursive: true, mode: 0o755 });
        const finalPath = path_1.default.join(uploadDir, fileName);
        try {
            await withCatalogUploadLock(userId, async () => {
                await assertUnboundCatalogQuotaForUser(userId, assembledBytes);
                const partialPath = `${finalPath}.part`;
                try {
                    await promises_1.default.writeFile(partialPath, Buffer.alloc(0), { flag: 'wx', mode: 0o600 });
                    for (let i = 0; i < total; i++) {
                        const buf = await promises_1.default.readFile(path_1.default.join(assemblingDir, `chunk_${i}`));
                        await promises_1.default.appendFile(partialPath, buf);
                    }
                    await promises_1.default.rename(partialPath, finalPath);
                }
                catch (error) {
                    await promises_1.default.rm(partialPath, { force: true });
                    throw error;
                }
            });
        } catch (error) {
            await promises_1.default.rename(assemblingDir, chunkDir).catch(() => {});
            throw error;
        }
        await promises_1.default.chmod(finalPath, 0o644);
        const finalStat = await promises_1.default.stat(finalPath);
        if (finalStat.size > catalogValidation_1.MAX_CATALOG_BYTES) {
            await promises_1.default.rm(finalPath, { force: true });
            await promises_1.default.rm(assemblingDir, { recursive: true, force: true });
            return res.status(400).json({ error: 'Catalog exceeds the 60 MB limit.' });
        }
        const handle = await promises_1.default.open(finalPath, 'r');
        const signature = Buffer.alloc(5);
        try {
            await handle.read(signature, 0, signature.length, 0);
        }
        finally {
            await handle.close();
        }
        if (!(0, catalogValidation_1.isPdfBuffer)(signature)) {
            await promises_1.default.rm(finalPath, { force: true });
            await promises_1.default.rm(assemblingDir, { recursive: true, force: true });
            return res.status(400).json({ error: 'Catalog must be a valid PDF file.' });
        }
        await promises_1.default.rm(assemblingDir, { recursive: true, force: true });
        const baseName = original_name ? path_1.default.basename(original_name, path_1.default.extname(original_name)) : '';
        res.json({ done: true, url: `private://catalogs/${fileName}`, original_name: baseName });
    }
    catch (error) {
        console.error('Upload catalog chunk error:', error);
        res.status(error?.statusCode || 500).json({ error: error?.statusCode ? error.message : 'Failed to process chunk.' });
    }
}
async function listCatalogs(req, res) {
    try {
        const { slug } = req.params;
        // 国家隔离铁律：按站点国家解析供应商，禁 VN 命中 AE 供应商目录（P0 串域）。
        const reqCountry = (typeof req.query.country === 'string' && ['ae', 'vn'].includes(req.query.country) ? req.query.country : null) || req.country || 'ae';
        const [profileRows] = await database_1.default.execute("SELECT id, company_name, name_zh FROM supplier_profiles WHERE slug = ? AND status = 'approved' AND country = ?", [slug, reqCountry]);
        const profile = profileRows[0];
        if (!profile)
            return res.status(404).json({ error: 'Supplier not found.' });
        const [catalogs] = await database_1.default.execute('SELECT id, title, file_size, created_at FROM supplier_catalogs WHERE supplier_profile_id = ? AND catalog_visible = 1 ORDER BY created_at DESC', [profile.id]);
        // 公开去标识：目录标题里的真实厂名(中英)一并遮蔽(与 getPublicProfile 同口径,修 C1/退 F3)。
        // 原件路径不进入公开响应；浏览器只读取已发布的逐页预览。
        const realName = profile.company_name || '';
        const realZh = profile.name_zh || '';
        const maskTitle = (t) => {
            let out = supplierRedact_1.maskSupplierMentions(t, realName);
            if (realZh)
                out = supplierRedact_1.maskSupplierMentions(out, realZh);
            return out;
        };
        const masked = (Array.isArray(catalogs) ? catalogs : []).map((c) => ({ ...c, title: maskTitle(c.title) }));
        res.json({ catalogs: masked });
    }
    catch (error) {
        console.error('List catalogs error:', error);
        res.status(500).json({ error: 'Failed to load catalogs.' });
    }
}
async function listMyCatalogs(req, res) {
    try {
        const profileId = await getProfileId(req.supplierUser.id);
        if (!profileId)
            return res.json({ catalogs: [] });
        const [catalogs] = await database_1.default.execute('SELECT * FROM supplier_catalogs WHERE supplier_profile_id = ? ORDER BY created_at DESC', [profileId]);
        res.json({ catalogs });
    }
    catch (error) {
        console.error('List my catalogs error:', error);
        res.status(500).json({ error: 'Failed to load catalogs.' });
    }
}
async function uploadCatalog(req, res) {
    try {
        const profileId = await getProfileId(req.supplierUser.id);
        if (!profileId)
            return res.status(400).json({ error: 'Create your profile first.' });
        const { title, file_url } = req.body;
        if (!title || !file_url)
            return res.status(400).json({ error: 'Title and file URL are required.' });
        const created = await withCatalogUploadLock(req.supplierUser.id, async () => {
            const fileName = (0, catalogValidation_1.safeCatalogFileName)(req.supplierUser.id, file_url);
            if (!fileName) throw Object.assign(new Error('Upload a catalog PDF before creating its record.'), { statusCode: 400 });
            const catalogPath = path_1.default.join(process.cwd(), 'private', 'catalogs', fileName);
            let size;
            try {
                const stat = await promises_1.default.stat(catalogPath);
                const handle = await promises_1.default.open(catalogPath, 'r');
                const signature = Buffer.alloc(5);
                try { await handle.read(signature, 0, signature.length, 0); }
                finally { await handle.close(); }
                size = stat.size;
                if (size > catalogValidation_1.MAX_CATALOG_BYTES || !(0, catalogValidation_1.isPdfBuffer)(signature)) throw new Error('invalid PDF');
            }
            catch { throw Object.assign(new Error('The uploaded catalog PDF is unavailable or invalid.'), { statusCode: 400 }); }
            // The filesystem lock and DB row lock together make file consumption,
            // duplicate detection and quota enforcement one serialized action.
            const connection = await database_1.default.getConnection();
            try {
                await connection.beginTransaction();
                await connection.execute('SELECT id FROM supplier_profiles WHERE id = ? FOR UPDATE', [profileId]);
                const [stats] = await connection.execute("SELECT COUNT(*) AS total, SUM(render_status IN ('pending','processing')) AS queued FROM supplier_catalogs WHERE supplier_profile_id = ?", [profileId]);
                if (Number(stats[0]?.total || 0) >= 20)
                    throw Object.assign(new Error('A supplier can store at most 20 catalogs.'), { statusCode: 409 });
                if (Number(stats[0]?.queued || 0) >= 3)
                    throw Object.assign(new Error('Please wait for current catalog previews to finish.'), { statusCode: 429 });
                const [duplicate] = await connection.execute('SELECT id FROM supplier_catalogs WHERE supplier_profile_id = ? AND file_url = ? LIMIT 1', [profileId, file_url]);
                if (duplicate[0])
                    throw Object.assign(new Error('This uploaded catalog has already been saved.'), { statusCode: 409 });
                const [result] = await connection.execute("INSERT INTO supplier_catalogs (supplier_profile_id, title, file_url, file_size, render_status, catalog_visible) VALUES (?, ?, ?, ?, 'pending', 0)", [profileId, title, file_url, size]);
                const [rows] = await connection.execute('SELECT * FROM supplier_catalogs WHERE id = ?', [result.insertId]);
                await connection.commit();
                return rows[0];
            }
            catch (error) {
                await connection.rollback();
                throw error;
            }
            finally { connection.release(); }
        });
        res.status(201).json({ catalog: created });
    }
    catch (error) {
        console.error('Upload catalog error:', error);
        res.status(error?.statusCode || 500).json({ error: error?.statusCode ? error.message : 'Failed to upload catalog.' });
    }
}
async function deleteCatalog(req, res) {
    try {
        const profileId = await getProfileId(req.supplierUser.id);
        if (!profileId)
            return res.status(403).json({ error: 'Forbidden.' });
        const { id } = req.params;
        const connection = await database_1.default.getConnection();
        let existing;
        let quarantine = null;
        try {
            await connection.beginTransaction();
            const [rows] = await connection.execute('SELECT id, file_url FROM supplier_catalogs WHERE id = ? AND supplier_profile_id = ? FOR UPDATE', [id, profileId]);
            if (!rows[0]) {
                await connection.rollback();
                return res.status(404).json({ error: 'Catalog not found.' });
            }
            existing = rows[0];
            quarantine = await (0, catalogRenderer_1.quarantineCatalogPublicArtifacts)(id);
            await connection.execute('DELETE FROM supplier_catalogs WHERE id = ?', [id]);
            await connection.commit();
        }
        catch (error) {
            await connection.rollback().catch(() => {});
            // Fail closed: a concurrent withdraw/delete or an uncertain commit
            // must never put old pages back under a public URL. If rollback
            // leaves a visible catalog row, the hash-aware worker republishes
            // its immutable private revision on its next reconciliation pass.
            throw error;
        }
        finally { connection.release(); }
        // The public path remains withdrawn after commit even if best-effort
        // private cleanup fails; the worker can safely clear residual files.
        const [references] = await database_1.default.execute('SELECT id FROM supplier_catalogs WHERE file_url = ? LIMIT 1', [existing.file_url]);
        await (0, catalogRenderer_1.removeCatalogArtifacts)(id, existing.file_url, references.length === 0).catch((error) => console.warn('Catalog private cleanup deferred:', error?.message));
        await (0, catalogRenderer_1.discardCatalogPublicQuarantine)(quarantine).catch((error) => console.warn('Catalog quarantine cleanup deferred:', error?.message));
        res.json({ message: 'Catalog deleted.' });
    }
    catch (error) {
        console.error('Delete catalog error:', error);
        res.status(500).json({ error: 'Failed to delete catalog.' });
    }
}
