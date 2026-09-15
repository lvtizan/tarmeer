"use strict";

const path = require('path');
const MAX_CATALOG_BYTES = 60 * 1024 * 1024;
const MAX_CHUNKS = 30;
const CHUNK_BYTES = 2 * 1024 * 1024;

function isPdfBuffer(buffer) {
    return Buffer.isBuffer(buffer) && buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}
function isPdfUpload(file) {
    return Boolean(file?.buffer) && file.mimetype === 'application/pdf' && /\.pdf$/i.test(file.originalname || '') && isPdfBuffer(file.buffer);
}
function safeCatalogFileName(userId, fileUrl) {
    const id = Number(userId);
    if (!Number.isSafeInteger(id) || id < 1 || typeof fileUrl !== 'string') return null;
    // Exact canonical URL prevents a prefix/path-normalisation trick from
    // binding somebody else's uploaded file to this supplier's catalog.
    const match = new RegExp(`^private://catalogs/(${id}-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\\.pdf)$`, 'i').exec(fileUrl);
    return match ? match[1] : null;
}
function parseChunkMeta(meta) {
    const uploadId = typeof meta?.upload_id === 'string' ? meta.upload_id : '';
    const index = Number(meta?.chunk_index);
    const total = Number(meta?.total_chunks);
    if (!/^[a-f0-9]{16}$/i.test(uploadId)
        || !Number.isSafeInteger(index) || !Number.isSafeInteger(total)
        || total < 1 || total > MAX_CHUNKS || index < 0 || index >= total) return null;
    return { uploadId: uploadId.toLowerCase(), index, total };
}
module.exports = { MAX_CATALOG_BYTES, MAX_CHUNKS, CHUNK_BYTES, isPdfBuffer, isPdfUpload, safeCatalogFileName, parseChunkMeta };
