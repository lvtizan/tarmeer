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
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const crypto_1 = require("crypto");
const variantWorker_1 = require("../lib/variantWorker");
async function getProfileId(supplierUserId) {
    const [rows] = await database_1.default.execute('SELECT id FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [supplierUserId]);
    return rows[0]?.id || null;
}
async function uploadCatalogFile(req, res) {
    try {
        const userId = req.supplierUser.id;
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'No file data provided.' });
        const mimeType = file.mimetype;
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
        if (!allowed.includes(mimeType) && !mimeType.startsWith('image/')) {
            return res.status(400).json({ error: 'Only PDF and image files are allowed.' });
        }
        const extMap = {
            'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
            'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
        };
        const ext = extMap[mimeType] || 'bin';
        const fileName = `${userId}-${(0, crypto_1.randomUUID)()}.${ext}`;
        const uploadDir = path_1.default.join(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs');
        await promises_1.default.mkdir(uploadDir, { recursive: true, mode: 0o755 });
        const filePath = path_1.default.join(uploadDir, fileName);
        await promises_1.default.writeFile(filePath, file.buffer, { mode: 0o644 });
        if (mimeType.startsWith('image/'))
            (0, variantWorker_1.enqueueVariants)(filePath);
        const originalName = req.body.original_name || file.originalname || '';
        const baseName = originalName ? path_1.default.basename(originalName, path_1.default.extname(originalName)) : '';
        res.json({ url: `/uploads/suppliers/catalogs/${fileName}`, original_name: baseName });
    }
    catch (error) {
        console.error('Upload catalog file error:', error);
        res.status(500).json({ error: 'Failed to upload file.' });
    }
}
async function uploadCatalogChunk(req, res) {
    try {
        const userId = req.supplierUser.id;
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'No chunk data.' });
        const { upload_id, chunk_index, total_chunks, original_name } = req.body;
        if (!upload_id || chunk_index === undefined || !total_chunks) {
            return res.status(400).json({ error: 'Missing chunk metadata.' });
        }
        const chunkDir = path_1.default.join(os_1.default.tmpdir(), 'tarmeer-chunks', upload_id);
        await promises_1.default.mkdir(chunkDir, { recursive: true });
        await promises_1.default.writeFile(path_1.default.join(chunkDir, `chunk_${chunk_index}`), file.buffer);
        const idx = parseInt(chunk_index, 10);
        const total = parseInt(total_chunks, 10);
        if (idx < total - 1) {
            return res.json({ done: false });
        }
        // Last chunk received — assemble
        const ext = original_name ? path_1.default.extname(original_name).replace('.', '') || 'bin' : 'bin';
        const fileName = `${userId}-${(0, crypto_1.randomUUID)()}.${ext}`;
        const uploadDir = path_1.default.join(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs');
        await promises_1.default.mkdir(uploadDir, { recursive: true, mode: 0o755 });
        const finalPath = path_1.default.join(uploadDir, fileName);
        const ws = (0, fs_1.createWriteStream)(finalPath);
        for (let i = 0; i < total; i++) {
            const buf = await promises_1.default.readFile(path_1.default.join(chunkDir, `chunk_${i}`));
            await new Promise((resolve, reject) => { ws.write(buf, err => err ? reject(err) : resolve()); });
        }
        await new Promise(resolve => ws.end(resolve));
        await promises_1.default.chmod(finalPath, 0o644);
        await promises_1.default.rm(chunkDir, { recursive: true, force: true });
        const baseName = original_name ? path_1.default.basename(original_name, path_1.default.extname(original_name)) : '';
        res.json({ done: true, url: `/uploads/suppliers/catalogs/${fileName}`, original_name: baseName });
    }
    catch (error) {
        console.error('Upload catalog chunk error:', error);
        res.status(500).json({ error: 'Failed to process chunk.' });
    }
}
async function listCatalogs(req, res) {
    try {
        const { slug } = req.params;
        // 国家隔离铁律：按站点国家解析供应商，禁止只靠 slug 猜（slug 跨国唯一性未强制约束）。
        // 与 getPublicProfile 同口径：query 优先，回退 x-country，再回退 ae。
        const reqCountry = (typeof req.query.country === 'string' && ['ae', 'vn'].includes(req.query.country) ? req.query.country : null) || req.country || 'ae';
        const [profileRows] = await database_1.default.execute("SELECT id FROM supplier_profiles WHERE slug = ? AND status = 'approved' AND is_published = 1 AND country = ?", [slug, reqCountry]);
        const profile = profileRows[0];
        if (!profile)
            return res.status(404).json({ error: 'Supplier not found.' });
        const [catalogs] = await database_1.default.execute('SELECT * FROM supplier_catalogs WHERE supplier_profile_id = ? ORDER BY created_at DESC', [profile.id]);
        res.json({ catalogs });
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
        const { title, file_url, file_size } = req.body;
        if (!title || !file_url)
            return res.status(400).json({ error: 'Title and file URL are required.' });
        const [result] = await database_1.default.execute('INSERT INTO supplier_catalogs (supplier_profile_id, title, file_url, file_size) VALUES (?, ?, ?, ?)', [profileId, title, file_url, file_size || null]);
        const id = result.insertId;
        const [created] = await database_1.default.execute('SELECT * FROM supplier_catalogs WHERE id = ?', [id]);
        res.status(201).json({ catalog: created[0] });
    }
    catch (error) {
        console.error('Upload catalog error:', error);
        res.status(500).json({ error: 'Failed to upload catalog.' });
    }
}
async function deleteCatalog(req, res) {
    try {
        const profileId = await getProfileId(req.supplierUser.id);
        if (!profileId)
            return res.status(403).json({ error: 'Forbidden.' });
        const { id } = req.params;
        const [existing] = await database_1.default.execute('SELECT id FROM supplier_catalogs WHERE id = ? AND supplier_profile_id = ?', [id, profileId]);
        if (existing.length === 0)
            return res.status(404).json({ error: 'Catalog not found.' });
        await database_1.default.execute('DELETE FROM supplier_catalogs WHERE id = ?', [id]);
        res.json({ message: 'Catalog deleted.' });
    }
    catch (error) {
        console.error('Delete catalog error:', error);
        res.status(500).json({ error: 'Failed to delete catalog.' });
    }
}
