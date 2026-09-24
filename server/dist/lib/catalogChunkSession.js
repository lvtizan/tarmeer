"use strict";

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { isSameCatalogUploadSession } = require('./catalogValidation');

function sessionConflict(message) {
    return Object.assign(new Error(message), { statusCode: 409 });
}

async function prepareActiveSession({ chunkRoot, meta, originalName, staleMs, now = Date.now() }) {
    const chunkDir = path.join(chunkRoot, 'active');
    const sessionPath = path.join(chunkDir, 'session.json');
    await fs.mkdir(chunkRoot, { recursive: true, mode: 0o700 });

    if (meta.index === 0) {
        let activeStat = null;
        try { activeStat = await fs.stat(chunkDir); }
        catch (error) { if (error?.code !== 'ENOENT') throw error; }
        let sessionStat = null;
        try { sessionStat = await fs.stat(sessionPath); }
        catch (error) { if (error?.code !== 'ENOENT') throw error; }

        if (activeStat) {
            let existingSession = null;
            if (sessionStat) {
                try { existingSession = JSON.parse(await fs.readFile(sessionPath, 'utf8')); }
                catch { /* invalid metadata is replaced */ }
            }
            if (!sessionStat
                || !isSameCatalogUploadSession(existingSession, meta, originalName)
                || now - sessionStat.mtimeMs > staleMs) {
                const abandoned = path.join(chunkRoot, `${meta.uploadId}.abandoned-${crypto.randomUUID()}`);
                try {
                    await fs.rename(chunkDir, abandoned);
                    await fs.rm(abandoned, { recursive: true, force: true });
                }
                catch (error) {
                    // Another index-0 request may have won the atomic rename.
                    // Never remove the new `active` directory created by that winner.
                    if (error?.code !== 'ENOENT') throw error;
                }
            }
        }

        try {
            await fs.mkdir(chunkDir, { mode: 0o700 });
            await fs.writeFile(sessionPath, JSON.stringify({ uploadId: meta.uploadId, total: meta.total, original_name: originalName }), { flag: 'wx', mode: 0o600 });
        }
        catch (error) {
            if (error?.code !== 'EEXIST') throw error;
        }
    }
    return { chunkDir, sessionPath };
}

async function storeCatalogChunk({ chunkRoot, meta, originalName, buffer, staleMs, onBeforeFinalize }) {
    const assemblingDir = path.join(chunkRoot, `${meta.uploadId}.assembling`);
    try {
        await fs.access(assemblingDir);
        throw sessionConflict('This catalog is still being assembled. Please wait a moment and retry.');
    }
    catch (error) {
        if (error?.statusCode) throw error;
        if (error?.code !== 'ENOENT') throw error;
    }
    const { chunkDir, sessionPath } = await prepareActiveSession({ chunkRoot, meta, originalName, staleMs });
    let sessionMeta;
    try { sessionMeta = JSON.parse(await fs.readFile(sessionPath, 'utf8')); }
    catch { throw sessionConflict('Start the catalog upload again.'); }
    if (!isSameCatalogUploadSession(sessionMeta, meta, originalName)) {
        throw sessionConflict('Catalog upload session changed. Please select the PDF and start again.');
    }
    await fs.writeFile(path.join(chunkDir, `chunk_${meta.index}`), buffer, { flag: 'w', mode: 0o600 });
    const touchedAt = new Date();
    await fs.utimes(sessionPath, touchedAt, touchedAt).catch(() => {});
    if (meta.index === meta.total - 1) {
        await onBeforeFinalize?.();
        await fs.rename(chunkDir, assemblingDir);
        return { chunkDir, sessionPath, assemblingDir };
    }
    return { chunkDir, sessionPath, assemblingDir: null };
}

module.exports = { storeCatalogChunk };
