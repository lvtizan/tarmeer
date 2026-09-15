"use strict";

// Move historical public catalog originals into private storage, but only when
// a complete published page-image revision already exists. Dry-run by default.
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const database = require('../config/database').default;

const apply = process.argv.includes('--apply');
const onlyIdArg = process.argv.find((arg) => arg.startsWith('--id='));
const onlyId = onlyIdArg ? Number(onlyIdArg.slice(5)) : null;
const MAX_SOURCE_BYTES = 60 * 1024 * 1024;

function isCanonicalSupplierOriginal(fileUrl) {
    return /^\/uploads\/suppliers\/catalogs\/[^/]+\.pdf$/i.test(String(fileUrl || ''));
}

async function appendAudit(entry) {
    const audit = path.resolve(process.cwd(), 'private/catalog-migration-audit.jsonl');
    await fs.mkdir(path.dirname(audit), { recursive: true, mode: 0o700 });
    await fs.appendFile(audit, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, { mode: 0o600 });
}

async function completePublishedPreview(id) {
    const root = path.resolve(process.cwd(), 'public/uploads/suppliers/catalogs/pages', String(id));
    try {
        const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
        const pages = Number(manifest.pages);
        if (!Number.isSafeInteger(pages) || pages < 1 || pages > 160) return false;
        const dir = typeof manifest.dir === 'string' && /^revisions\/[a-f0-9]{64}$/i.test(manifest.dir) ? manifest.dir : '';
        const base = dir ? path.join(root, dir) : root;
        const ext = manifest.format === 'jpg' ? 'jpg' : 'webp';
        for (let page = 1; page <= pages; page += 1) {
            const [full, thumb] = await Promise.all([
                fs.stat(path.join(base, `${page}.${ext}`)),
                fs.stat(path.join(base, `${page}-thumb.${ext}`)),
            ]);
            if (!full.size || !thumb.size) return false;
        }
        return true;
    } catch { return false; }
}

async function main() {
    const params = [];
    let where = "file_url LIKE '/uploads/%'";
    if (Number.isSafeInteger(onlyId) && onlyId > 0) { where += ' AND id = ?'; params.push(onlyId); }
    const [catalogs] = await database.execute(`SELECT id, file_url FROM supplier_catalogs WHERE ${where} ORDER BY id`, params);
    let eligible = 0;
    let moved = 0;
    let quarantined = 0;
    let skipped = 0;
    for (const catalog of catalogs) {
        const uploadsRoot = path.resolve(process.cwd(), 'public/uploads');
        const source = path.resolve(process.cwd(), 'public', String(catalog.file_url).replace(/^\/+/, ''));
        if (!source.startsWith(`${uploadsRoot}${path.sep}`) || !(await completePublishedPreview(catalog.id))) {
            skipped += 1;
            console.log(`SKIP #${catalog.id}: no complete published page preview`);
            continue;
        }
        let stat;
        let signature;
        try {
            stat = await fs.stat(source);
            const handle = await fs.open(source, 'r');
            signature = Buffer.alloc(5);
            try { await handle.read(signature, 0, 5, 0); } finally { await handle.close(); }
        } catch {
            skipped += 1;
            console.log(`SKIP #${catalog.id}: source missing`);
            continue;
        }
        if (!stat.isFile() || stat.size > MAX_SOURCE_BYTES || signature.toString('ascii') !== '%PDF-') {
            skipped += 1;
            console.log(`SKIP #${catalog.id}: invalid or oversized PDF`);
            continue;
        }
        eligible += 1;
        const canQuarantine = isCanonicalSupplierOriginal(catalog.file_url);
        if (!apply) {
            console.log(`WOULD MOVE #${catalog.id}: ${catalog.file_url}${canQuarantine ? ' (public original will be quarantined)' : ' (public original retained: non-canonical path)'}`);
            continue;
        }
        const fileName = `legacy-${catalog.id}-${crypto.randomUUID()}.pdf`;
        const destination = path.resolve(process.cwd(), 'private/catalogs', fileName);
        await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o755 });
        await fs.copyFile(source, destination);
        await fs.chmod(destination, 0o644);
        const privateUrl = `private://catalogs/${fileName}`;
        const [result] = await database.execute('UPDATE supplier_catalogs SET file_url = ? WHERE id = ? AND file_url = ?', [privateUrl, catalog.id, catalog.file_url]);
        if (result.affectedRows !== 1) {
            await fs.rm(destination, { force: true });
            console.log(`SKIP #${catalog.id}: row changed concurrently`);
            skipped += 1;
            continue;
        }
        moved += 1;
        let quarantinePath = null;
        if (canQuarantine) {
            // Re-check after the conditional DB update. Only an unreferenced,
            // canonical supplier-catalog path is moved, and the move is
            // recoverable rather than destructive.
            const [references] = await database.execute('SELECT id FROM supplier_catalogs WHERE file_url = ? LIMIT 1', [catalog.file_url]);
            if (references.length === 0) {
                const quarantineDir = path.resolve(process.cwd(), 'private/catalog-legacy-quarantine');
                quarantinePath = path.join(quarantineDir, `${catalog.id}-${crypto.randomUUID()}-${path.basename(source)}`);
                await fs.mkdir(quarantineDir, { recursive: true, mode: 0o700 });
                try {
                    await fs.rename(source, quarantinePath);
                    quarantined += 1;
                }
                catch (error) {
                    quarantinePath = null;
                    console.warn(`WARN #${catalog.id}: private copy is active but public original quarantine failed: ${error.message}`);
                }
            }
        }
        await appendAudit({ catalog_id: catalog.id, old_url: catalog.file_url, new_url: privateUrl, quarantined_to: quarantinePath });
        console.log(`MOVED #${catalog.id}${quarantinePath ? ' (public original quarantined)' : ' (public original retained for audited GC)'}`);
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', found: catalogs.length, eligible, moved, quarantined, skipped }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => database.end());
