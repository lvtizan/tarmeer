"use strict";

// One persistent, bounded PDF-to-page-image worker. Public readers only ever
// consume the manifest's completed immutable revision, never a partial directory.
const fs = require('fs/promises');
const path = require('path');
const { spawn, execFile } = require('child_process');
const crypto = require('crypto');
const database = require('../config/database').default;

const running = new Map();
const MAX_PAGES = 160;
const COMMAND_TIMEOUT_MS = 45_000;
const TASK_TIMEOUT_MS = 15 * 60_000;
const MAX_RENDER_BYTES = 250 * 1024 * 1024;
const MAX_SOURCE_BYTES = 60 * 1024 * 1024;
const STDERR_LIMIT = 8_000;
let workerStarted = false;
let workerTimer = null;
let reconcileCursor = 0;
let pruneCursor = 0;
let orphanPublicCursor = 0;

function boundedInvocation(command, args) {
    if (process.platform !== 'linux') return { command, args };
    // Fixed shell program; untrusted paths remain positional "$@" arguments.
    // Cap virtual memory and CPU before exec so malformed PDFs cannot exhaust
    // the API host while Poppler parses them.
    return {
        command: '/bin/sh',
        args: ['-c', 'ulimit -v 786432; ulimit -t 60; exec "$@"', 'catalog-render', command, ...args],
    };
}

function run(command, args, timeout = COMMAND_TIMEOUT_MS) {
    return new Promise((resolve, reject) => {
        const bounded = boundedInvocation(command, args);
        const child = spawn(bounded.command, bounded.args, { stdio: ['ignore', 'ignore', 'pipe'] });
        let stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), timeout);
        child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-STDERR_LIMIT); });
        child.once('error', (error) => { clearTimeout(timer); reject(error); });
        child.once('close', (code, signal) => {
            clearTimeout(timer);
            code === 0
                ? resolve()
                : reject(new Error(`${command} ${signal ? `timed out (${signal})` : `exited ${code}`}: ${stderr}`));
        });
    });
}

function catalogFilePath(fileUrl) {
    if (typeof fileUrl !== 'string') return null;
    if (fileUrl.startsWith('private://catalogs/')) {
        const name = fileUrl.slice('private://catalogs/'.length);
        if (!/^[0-9a-z-]+\.pdf$/i.test(name)) return null;
        return path.join(process.cwd(), 'private', 'catalogs', name);
    }
    if (!fileUrl.startsWith('/uploads/')) return null;
    const uploadsRoot = path.resolve(process.cwd(), 'public', 'uploads');
    const absolute = path.resolve(process.cwd(), 'public', fileUrl.replace(/^\/+/, ''));
    return absolute.startsWith(`${uploadsRoot}${path.sep}`) ? absolute : null;
}

async function sourceHash(source) {
    const hash = crypto.createHash('sha256');
    const handle = await fs.open(source, 'r');
    try {
        const buffer = Buffer.alloc(1024 * 1024);
        for (let position = 0;; position += buffer.length) {
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
            if (!bytesRead) break;
            hash.update(buffer.subarray(0, bytesRead));
        }
        return hash.digest('hex');
    } finally { await handle.close(); }
}

async function updateStatus(id, status, fields = {}) {
    const error = fields.error ? String(fields.error).slice(0, 500) : null;
    if (status === 'ready') {
        return database.execute("UPDATE supplier_catalogs SET render_status = 'ready', render_error = NULL, rendered_at = NOW(), source_sha256 = ?, render_claim_token = NULL WHERE id = ? AND file_url = ? AND render_claim_token = ?", [fields.hash || null, id, fields.fileUrl, fields.claimToken]);
    } else if (status === 'failed') {
        // Never unpublish a previous revision if a replacement source fails.
        return database.execute("UPDATE supplier_catalogs SET render_status = 'failed', render_error = ?, rendered_at = NULL, render_claim_token = NULL WHERE id = ? AND file_url = ? AND render_claim_token = ?", [error || 'Catalog conversion failed.', id, fields.fileUrl, fields.claimToken]);
    }
}

async function claimCatalog(id, claimToken, mode = 'worker') {
    const eligible = mode === 'force'
        ? "render_status IN ('pending','ready','failed')"
        : mode === 'worker'
            ? "render_status = 'pending' OR render_status IS NULL OR (render_status = 'ready' AND source_sha256 IS NULL) OR (render_status = 'failed' AND render_attempts < 3 AND (render_started_at IS NULL OR render_started_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)))"
            : "render_status = 'pending' OR render_status IS NULL";
    try {
        const [result] = await database.execute(`UPDATE supplier_catalogs SET render_status = 'processing', render_error = NULL, render_started_at = NOW(), render_attempts = render_attempts + 1, render_claim_token = ? WHERE id = ? AND (${eligible})`, [claimToken, id]);
        return result.affectedRows === 1;
    } catch (error) {
        console.error(`[catalog] unable to claim #${id}:`, error.message);
        // Renderer verification runs without DB. Production workers never use this fallback.
        return null;
    }
}

async function pdfMetadata(source) {
    const bounded = boundedInvocation('pdfinfo', [source]);
    const output = await new Promise((resolve, reject) => {
        execFile(bounded.command, bounded.args, { maxBuffer: 1024 * 1024, timeout: COMMAND_TIMEOUT_MS }, (error, stdout, stderr) => {
            error ? reject(new Error(`pdfinfo failed: ${(stderr || error.message).slice(-STDERR_LIMIT)}`)) : resolve(stdout);
        });
    });
    const pages = Number((output.match(/^Pages:\s*(\d+)/m) || [])[1]);
    const size = output.match(/^Page size:\s*([\d.]+)\s+x\s+([\d.]+)/m);
    if (!Number.isInteger(pages) || pages < 1 || pages > MAX_PAGES) throw new Error(`Unsupported PDF page count: ${pages || 'unknown'}`);
    const width = Number(size?.[1]) || 1;
    const height = Number(size?.[2]) || 1;
    if (width / height < 0.25 || width / height > 4)
        throw new Error('Unsupported PDF page aspect ratio.');
    return { pages, ar: Math.min(3, Math.max(0.5, Number((width / height).toFixed(4)) || 1.4)) };
}

async function isCompleteRevision(dir, pages) {
    try {
        for (let page = 1; page <= pages; page += 1) {
            const [full, thumb] = await Promise.all([fs.stat(path.join(dir, `${page}.jpg`)), fs.stat(path.join(dir, `${page}-thumb.jpg`))]);
            if (!full.size || !thumb.size) return false;
        }
        return true;
    } catch { return false; }
}

async function pruneCatalogRevisions(catalogId) {
    const [rows] = await database.execute('SELECT source_sha256, published_sha256 FROM supplier_catalogs WHERE id = ? LIMIT 1', [catalogId]);
    const current = rows[0];
    if (!current) return;
    const privateKeep = new Set([current.source_sha256, current.published_sha256].filter((value) => /^[a-f0-9]{64}$/i.test(value || '')));
    const publicKeep = new Set([current.published_sha256].filter((value) => /^[a-f0-9]{64}$/i.test(value || '')));
    const roots = [
        ['private', path.resolve(process.cwd(), 'private', 'catalog-previews', String(catalogId), 'revisions'), privateKeep],
        ['public', path.resolve(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs', 'pages', String(catalogId), 'revisions'), publicKeep],
    ];
    const retiredRoot = path.resolve(process.cwd(), 'private', 'catalog-previews', String(catalogId), 'retired');
    const retiredLongEnough = async (scope, hash) => {
        await fs.mkdir(retiredRoot, { recursive: true, mode: 0o700 });
        const marker = path.join(retiredRoot, `${scope}-${hash}`);
        try { return (await fs.stat(marker)).mtimeMs < Date.now() - 24 * 60 * 60 * 1000; }
        catch {
            await fs.writeFile(marker, String(Date.now()), { flag: 'wx', mode: 0o600 }).catch(() => {});
            return false;
        }
    };
    for (const [scope, root, keep] of roots) {
        try {
            for (const entry of await fs.readdir(root, { withFileTypes: true })) {
                const entryPath = path.join(root, entry.name);
                if (entry.isDirectory() && /^[a-f0-9]{64}$/i.test(entry.name)) {
                    const marker = path.join(retiredRoot, `${scope}-${entry.name}`);
                    if (keep.has(entry.name)) await fs.rm(marker, { force: true });
                    else if (await retiredLongEnough(scope, entry.name)) {
                        await fs.rm(entryPath, { recursive: true, force: true });
                        await fs.rm(marker, { force: true });
                    }
                }
                else if (entry.isDirectory() && entry.name.startsWith('.staging-') && (await fs.stat(entryPath)).mtimeMs < Date.now() - 20 * 60 * 1000)
                    await fs.rm(path.join(root, entry.name), { recursive: true, force: true });
            }
        } catch { /* no revisions yet */ }
    }
    const manifestRoot = path.resolve(process.cwd(), 'private', 'catalog-previews', String(catalogId), 'manifests');
    try {
        for (const entry of await fs.readdir(manifestRoot, { withFileTypes: true })) {
            if (entry.isFile() && /^[a-f0-9]{64}\.json$/i.test(entry.name) && !privateKeep.has(entry.name.slice(0, -5))
                && await retiredLongEnough('private', entry.name.slice(0, -5)))
                await fs.rm(path.join(manifestRoot, entry.name), { force: true });
        }
    } catch { /* no manifests yet */ }
}

async function publishCatalogPreview(id, { repairExpected = null } = {}) {
    const catalogId = Number(id);
    if (!Number.isSafeInteger(catalogId) || catalogId < 1) throw new Error('Invalid catalog id.');
    const [snapshotRows] = await database.execute('SELECT id, source_sha256, published_sha256, catalog_visible, render_status FROM supplier_catalogs WHERE id = ? LIMIT 1', [catalogId]);
    const snapshot = snapshotRows[0];
    const candidateHash = repairExpected || snapshot?.source_sha256;
    if (!snapshot || !/^[a-f0-9]{64}$/i.test(candidateHash || '')) throw new Error('Catalog preview is not ready.');
    if (repairExpected) {
        if (snapshot.catalog_visible !== 1 || snapshot.published_sha256 !== repairExpected)
            throw new Error('Catalog is no longer published; repair cancelled.');
    }
    else if (snapshot.render_status !== 'ready' || snapshot.source_sha256 !== candidateHash) {
        throw new Error('Catalog preview is not ready.');
    }
    const privateRoot = path.resolve(process.cwd(), 'private', 'catalog-previews', String(catalogId));
    const candidatePath = path.join(privateRoot, 'manifests', `${candidateHash}.json`);
    const candidate = JSON.parse(await fs.readFile(candidatePath, 'utf8'));
    if (candidate.source_sha256 !== candidateHash || candidate.dir !== `revisions/${candidateHash}`) throw new Error('Catalog preview version mismatch.');
    const privateRevision = path.join(privateRoot, candidate.dir);
    if (!(await isCompleteRevision(privateRevision, Number(candidate.pages)))) throw new Error('Catalog preview is incomplete.');
    const publicRoot = path.resolve(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs', 'pages', String(catalogId));
    const publicRevision = path.join(publicRoot, candidate.dir);
    const connection = await database.getConnection();
    try {
        await connection.beginTransaction();
        const [lockedRows] = await connection.execute("SELECT source_sha256, published_sha256, catalog_visible, render_status FROM supplier_catalogs WHERE id = ? FOR UPDATE", [catalogId]);
        const locked = lockedRows[0];
        if (repairExpected) {
            if (locked?.catalog_visible !== 1 || locked?.published_sha256 !== repairExpected)
                throw new Error('Catalog is no longer published; repair cancelled.');
        }
        else if (locked?.render_status !== 'ready' || locked?.source_sha256 !== candidate.source_sha256) {
            throw new Error('Catalog changed before publication.');
        }
        // Keep the row lock across the file switch. Unpublish uses the same lock,
        // so neither an admin action nor a stale repair can resurrect content.
        await fs.mkdir(path.dirname(publicRevision), { recursive: true, mode: 0o755 });
        if (!(await isCompleteRevision(publicRevision, Number(candidate.pages)))) {
            const staging = `${publicRevision}.staging-${crypto.randomUUID()}`;
            await fs.cp(privateRevision, staging, { recursive: true, errorOnExist: true });
            if (!(await isCompleteRevision(staging, Number(candidate.pages)))) {
                await fs.rm(staging, { recursive: true, force: true });
                throw new Error('Published catalog copy is incomplete.');
            }
            try { await fs.rename(staging, publicRevision); }
            catch (error) {
                if (!(await isCompleteRevision(publicRevision, Number(candidate.pages)))) throw error;
                await fs.rm(staging, { recursive: true, force: true });
            }
        }
        if (!repairExpected)
            await connection.execute('UPDATE supplier_catalogs SET catalog_visible = 1, published_sha256 = ? WHERE id = ? AND source_sha256 = ?', [candidate.source_sha256, catalogId, candidate.source_sha256]);
        await connection.commit();
        // Re-lock after the DB commit before switching the public pointer. If we
        // crash between phases, hash-aware reconciliation finishes it; if an
        // unpublish wins in between, this verification cancels the switch.
        await connection.beginTransaction();
        const [publishRows] = await connection.execute('SELECT source_sha256, published_sha256, catalog_visible FROM supplier_catalogs WHERE id = ? FOR UPDATE', [catalogId]);
        const publishState = publishRows[0];
        if (publishState?.catalog_visible !== 1 || publishState?.published_sha256 !== candidate.source_sha256
            || (!repairExpected && publishState?.source_sha256 !== candidate.source_sha256))
            throw new Error('Catalog publication state changed before the public switch.');
        const manifest = path.join(publicRoot, 'manifest.json');
        const temp = `${manifest}.${process.pid}.${crypto.randomUUID()}.tmp`;
        await fs.writeFile(temp, JSON.stringify(candidate), { mode: 0o644 });
        await fs.rename(temp, manifest);
        await connection.commit();
        await pruneCatalogRevisions(catalogId).catch((error) => console.warn(`[catalog] revision cleanup skipped for #${catalogId}:`, error?.message));
        return candidate;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally { connection.release(); }
}

async function unpublishCatalogPreview(id, supplierProfileId) {
    const catalogId = Number(id);
    const connection = await database.getConnection();
    const publicRoot = path.resolve(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs', 'pages', String(catalogId));
    const quarantine = path.resolve(process.cwd(), 'private', 'catalog-unpublished', `${catalogId}-${crypto.randomUUID()}`);
    let moved = false;
    try {
        await connection.beginTransaction();
        const [rows] = await connection.execute('SELECT supplier_profile_id FROM supplier_catalogs WHERE id = ? FOR UPDATE', [catalogId]);
        if (!rows[0] || Number(rows[0].supplier_profile_id) !== Number(supplierProfileId)) throw new Error('Catalog not found.');
        try {
            await fs.mkdir(path.dirname(quarantine), { recursive: true, mode: 0o700 });
            await fs.rename(publicRoot, quarantine);
            moved = true;
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
        await connection.execute('UPDATE supplier_catalogs SET catalog_visible = 0, published_sha256 = NULL WHERE id = ? AND supplier_profile_id = ?', [catalogId, supplierProfileId]);
        await connection.commit();
        if (moved) await fs.rm(quarantine, { recursive: true, force: true }).catch((error) => console.warn(`[catalog] unpublished quarantine cleanup skipped for #${catalogId}:`, error?.message));
    } catch (error) {
        await connection.rollback();
        if (moved) await fs.rename(quarantine, publicRoot).catch(() => {});
        throw error;
    } finally { connection.release(); }
}

// Deletion must make the public path unreachable before its database row goes
// away.  A crash after the rename leaves only a private quarantine, never a
// static URL that can still serve the old catalog.  Callers restore this path
// if their subsequent database transaction fails, then discard it after the
// deletion commits.
async function quarantineCatalogPublicArtifacts(id) {
    const catalogId = Number(id);
    if (!Number.isSafeInteger(catalogId) || catalogId < 1) return null;
    const publicRoot = path.resolve(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs', 'pages', String(catalogId));
    const quarantine = path.resolve(process.cwd(), 'private', 'catalog-deleted', `${catalogId}-${crypto.randomUUID()}`);
    try {
        await fs.mkdir(path.dirname(quarantine), { recursive: true, mode: 0o700 });
        await fs.rename(publicRoot, quarantine);
        return quarantine;
    } catch (error) {
        if (error?.code === 'ENOENT') return null;
        throw error;
    }
}

async function restoreCatalogPublicArtifacts(id, quarantine) {
    if (!quarantine) return;
    const publicRoot = path.resolve(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs', 'pages', String(Number(id)));
    await fs.mkdir(path.dirname(publicRoot), { recursive: true, mode: 0o755 });
    await fs.rename(quarantine, publicRoot);
}

async function discardCatalogPublicQuarantine(quarantine) {
    if (quarantine) await fs.rm(quarantine, { recursive: true, force: true });
}

async function publishedManifestHealthy(id, expectedHash) {
    try {
        const root = path.resolve(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs', 'pages', String(id));
        const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
        return manifest.source_sha256 === expectedHash
            && manifest.dir === `revisions/${expectedHash}`
            && await isCompleteRevision(path.join(root, manifest.dir), Number(manifest.pages));
    } catch { return false; }
}

async function removeCatalogArtifacts(id, fileUrl, removeSource = true) {
    const catalogId = Number(id);
    if (!Number.isSafeInteger(catalogId) || catalogId < 1) return;
    // Historical rows could contain arbitrary /uploads paths from the legacy
    // client-supplied URL API. Never delete those here; only canonical private
    // catalog originals created by the hardened upload path are owned by us.
    const source = removeSource && typeof fileUrl === 'string' && fileUrl.startsWith('private://catalogs/')
        ? catalogFilePath(fileUrl)
        : null;
    await Promise.all([
        fs.rm(path.resolve(process.cwd(), 'private', 'catalog-previews', String(catalogId)), { recursive: true, force: true }),
        fs.rm(path.resolve(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs', 'pages', String(catalogId)), { recursive: true, force: true }),
        source ? fs.rm(source, { force: true }) : Promise.resolve(),
    ]);
}

async function pruneOrphanPublicCatalogRoots() {
    const root = path.resolve(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs', 'pages');
    let entries;
    try { entries = await fs.readdir(root, { withFileTypes: true }); }
    catch (error) { if (error?.code === 'ENOENT') return; throw error; }
    const ids = entries
        .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
        .map((entry) => Number(entry.name))
        .filter((id) => Number.isSafeInteger(id) && id > orphanPublicCursor)
        .sort((a, b) => a - b)
        .slice(0, 24);
    if (ids.length === 0 && orphanPublicCursor !== 0) {
        orphanPublicCursor = 0;
        return;
    }
    for (const id of ids) {
        orphanPublicCursor = id;
        const [rows] = await database.execute('SELECT id FROM supplier_catalogs WHERE id = ? LIMIT 1', [id]);
        if (!rows[0]) await fs.rm(path.join(root, String(id)), { recursive: true, force: true });
    }
}

async function ownsClaim(id, fileUrl, claimToken) {
    const [rows] = await database.execute("SELECT id FROM supplier_catalogs WHERE id = ? AND file_url = ? AND render_status = 'processing' AND render_claim_token = ? LIMIT 1", [id, fileUrl, claimToken]);
    return Boolean(rows[0]);
}

async function renderCatalogPages(catalog, { force = false, claimed = false, claimToken: suppliedClaimToken = null } = {}) {
    const id = Number(catalog?.id);
    const source = catalogFilePath(catalog?.file_url);
    if (!id) return false;
    if (!source || !/\.pdf(?:$|\?)/i.test(catalog?.file_url || '')) {
        try { await updateStatus(id, 'failed', { error: 'Catalog source is not a supported PDF.', fileUrl: catalog?.file_url, claimToken: suppliedClaimToken }); } catch (error) { console.error(error); }
        return false;
    }
    if (running.has(id)) return running.get(id);
    const task = (async () => {
        const claimToken = suppliedClaimToken || crypto.randomUUID();
        try {
            if (!claimed) {
                const acquired = await claimCatalog(id, claimToken, force ? 'force' : 'direct');
                if (acquired === false) return false;
            }
            const sourceStat = await fs.stat(source);
            if (!sourceStat.isFile() || sourceStat.size < 5 || sourceStat.size > MAX_SOURCE_BYTES) {
                throw new Error('Catalog source exceeds the supported 60 MB limit.');
            }
            const hash = await sourceHash(source);
            if (claimed && !(await ownsClaim(id, catalog.file_url, claimToken))) return false;
            const taskStartedAt = Date.now();
            const pagesDir = path.resolve(process.cwd(), 'private', 'catalog-previews', String(id));
            const manifest = path.join(pagesDir, 'manifests', `${hash}.json`);
            let existing = null;
            try { existing = JSON.parse(await fs.readFile(manifest, 'utf8')); } catch { /* no published revision */ }
            // Recover if we crashed after publish but before the database write.
            if (Number(existing?.pages) > 0 && existing.source_sha256 === hash && await isCompleteRevision(path.join(pagesDir, existing.dir || ''), Number(existing.pages))) {
                await updateStatus(id, 'ready', { hash, fileUrl: catalog.file_url, claimToken });
                return true;
            }
            const meta = await pdfMetadata(source);
            await Promise.all([
                fs.mkdir(path.join(pagesDir, 'revisions'), { recursive: true, mode: 0o755 }),
                fs.mkdir(path.dirname(manifest), { recursive: true, mode: 0o755 }),
            ]);
            const finalDir = path.join(pagesDir, 'revisions', hash);
            if (!(await isCompleteRevision(finalDir, meta.pages))) {
                const staging = path.join(pagesDir, 'revisions', `.staging-${hash}-${crypto.randomUUID()}`);
                await fs.mkdir(staging, { recursive: true, mode: 0o755 });
                try {
                    let renderedBytes = 0;
                    for (let page = 1; page <= meta.pages; page += 1) {
                        if (Date.now() - taskStartedAt > TASK_TIMEOUT_MS) throw new Error('Catalog conversion exceeded the 15 minute limit.');
                        // -scale-to constrains both dimensions; a later page with
                        // a pathological MediaBox cannot trigger a raster OOM.
                        await run('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-jpeg', '-jpegopt', 'quality=84', '-scale-to', '2200', source, path.join(staging, String(page))]);
                        await run('pdftoppm', ['-f', String(page), '-l', String(page), '-singlefile', '-jpeg', '-jpegopt', 'quality=72', '-scale-to', '240', source, path.join(staging, `${page}-thumb`)]);
                        const [full, thumb] = await Promise.all([fs.stat(path.join(staging, `${page}.jpg`)), fs.stat(path.join(staging, `${page}-thumb.jpg`))]);
                        renderedBytes += full.size + thumb.size;
                        if (renderedBytes > MAX_RENDER_BYTES) throw new Error('Catalog preview exceeds the 250 MB render limit.');
                    }
                    if (!(await isCompleteRevision(staging, meta.pages))) throw new Error('Rendered catalog revision is incomplete.');
                    if (await sourceHash(source) !== hash) throw new Error('Catalog source changed during conversion.');
                    try { await fs.rename(staging, finalDir); }
                    catch (error) {
                        if (!(await isCompleteRevision(finalDir, meta.pages))) throw error;
                        await fs.rm(staging, { recursive: true, force: true });
                    }
                } catch (error) {
                    await fs.rm(staging, { recursive: true, force: true });
                    throw error;
                }
            }
            if (await sourceHash(source) !== hash || !(await ownsClaim(id, catalog.file_url, claimToken))) throw new Error('Catalog source changed during conversion.');
            const body = JSON.stringify({ pages: meta.pages, ar: meta.ar, format: 'jpg', rev: Date.now(), source_sha256: hash, dir: `revisions/${hash}` });
            const temp = `${manifest}.${process.pid}.${crypto.randomUUID()}.tmp`;
            await fs.writeFile(temp, body, { mode: 0o644 });
            await fs.rename(temp, manifest);
            await updateStatus(id, 'ready', { hash, fileUrl: catalog.file_url, claimToken });
            return true;
        } catch (error) {
            console.error(`Catalog render failed for #${id}:`, error);
            try { await updateStatus(id, 'failed', { error: error?.message || error, fileUrl: catalog.file_url, claimToken }); } catch (statusError) { console.error(statusError); }
            return false;
        } finally { running.delete(id); }
    })();
    running.set(id, task);
    return task;
}

function enqueueCatalogRender() {
    // Requests only persist pending work; this worker is the single execution path.
    if (workerTimer) clearTimeout(workerTimer);
    workerTimer = setTimeout(runWorker, 50);
}

async function runWorker() {
    try {
        await database.execute("UPDATE supplier_catalogs SET render_status = 'pending', render_claim_token = NULL WHERE render_status = 'processing' AND render_started_at < DATE_SUB(NOW(), INTERVAL 20 MINUTE)");
        let [publishedRows] = await database.execute("SELECT id, published_sha256 FROM supplier_catalogs WHERE catalog_visible = 1 AND published_sha256 IS NOT NULL AND id > ? ORDER BY id ASC LIMIT 24", [reconcileCursor]);
        if (publishedRows.length === 0 && reconcileCursor !== 0) {
            reconcileCursor = 0;
            [publishedRows] = await database.execute("SELECT id, published_sha256 FROM supplier_catalogs WHERE catalog_visible = 1 AND published_sha256 IS NOT NULL AND id > 0 ORDER BY id ASC LIMIT 24");
        }
        for (const published of publishedRows) {
            reconcileCursor = Number(published.id);
            if (!(await publishedManifestHealthy(published.id, published.published_sha256))) {
                await publishCatalogPreview(published.id, { repairExpected: published.published_sha256 });
                break;
            }
        }
        // GC is independent of visibility/current render state. This bounds
        // abandoned candidate revisions for unpublished and replaced catalogs.
        let [pruneRows] = await database.execute('SELECT id FROM supplier_catalogs WHERE id > ? ORDER BY id ASC LIMIT 24', [pruneCursor]);
        if (pruneRows.length === 0 && pruneCursor !== 0) {
            pruneCursor = 0;
            [pruneRows] = await database.execute('SELECT id FROM supplier_catalogs WHERE id > 0 ORDER BY id ASC LIMIT 24');
        }
        for (const row of pruneRows) {
            pruneCursor = Number(row.id);
            await pruneCatalogRevisions(row.id).catch((error) => console.warn(`[catalog] periodic revision cleanup skipped for #${row.id}:`, error?.message));
        }
        await pruneOrphanPublicCatalogRoots().catch((error) => console.warn('[catalog] orphan public cleanup skipped:', error?.message));
        const [rows] = await database.execute("SELECT id FROM supplier_catalogs WHERE render_status = 'pending' OR render_status IS NULL OR (render_status = 'ready' AND source_sha256 IS NULL) OR (render_status = 'failed' AND render_attempts < 3 AND (render_started_at IS NULL OR render_started_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))) ORDER BY created_at ASC, id ASC LIMIT 12");
        for (const catalog of rows) {
            const claimToken = crypto.randomUUID();
            if (await claimCatalog(catalog.id, claimToken, 'worker')) {
                // Read the source only after the conditional claim. An admin
                // replacement cannot make this worker render a stale URL.
                const [fresh] = await database.execute("SELECT id, file_url FROM supplier_catalogs WHERE id = ? AND render_status = 'processing' AND render_claim_token = ? LIMIT 1", [catalog.id, claimToken]);
                if (fresh[0]) await renderCatalogPages(fresh[0], { claimed: true, claimToken });
                break;
            }
        }
    } catch (error) { console.error('[catalog] render worker error:', error); }
    finally { workerTimer = setTimeout(runWorker, 15_000); }
}

function startCatalogRenderWorker() {
    if (workerStarted) return;
    workerStarted = true;
    void runWorker();
}

module.exports = { enqueueCatalogRender, renderCatalogPages, catalogFilePath, startCatalogRenderWorker, sourceHash, publishCatalogPreview, unpublishCatalogPreview, quarantineCatalogPublicArtifacts, restoreCatalogPublicArtifacts, discardCatalogPublicQuarantine, removeCatalogArtifacts };
