"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProductImage = uploadProductImage;
exports.listProducts = listProducts;
exports.listMyProducts = listMyProducts;
exports.addProduct = addProduct;
exports.updateProduct = updateProduct;
exports.deleteProduct = deleteProduct;
exports.reorderProducts = reorderProducts;
exports.translateText = translateText;
const database_1 = __importDefault(require("../config/database"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const variantWorker_1 = require("../lib/variantWorker");
const imageVariants_1 = require("../lib/imageVariants");
const translate_1 = require("../lib/translate");
function validatePrice(body) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) {
        return 'A valid price greater than 0 is required.';
    }
    const unit = typeof body.price_unit === 'string' ? body.price_unit.trim() : '';
    if (unit.length === 0) {
        return 'Price unit is required.';
    }
    return null; // ok
}
async function uploadProductImage(req, res) {
    try {
        const userId = req.supplierUser.id;
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: 'No image data provided.' });
        const mimeType = file.mimetype;
        if (!mimeType.startsWith('image/'))
            return res.status(400).json({ error: 'Only images allowed.' });
        const extMap = {
            'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
            'image/webp': 'webp', 'image/gif': 'gif',
        };
        const ext = extMap[mimeType] || 'jpg';
        const { buffer: processedBuffer, ext: processedExt } = await (0, imageVariants_1.processUploadedImage)(file.buffer);
        const fileName = `${userId}-${(0, crypto_1.randomUUID)()}.${processedExt}`;
        const uploadDir = path_1.default.join(process.cwd(), 'public', 'uploads', 'suppliers', 'products');
        await promises_1.default.mkdir(uploadDir, { recursive: true, mode: 0o755 });
        const filePath = path_1.default.join(uploadDir, fileName);
        await promises_1.default.writeFile(filePath, processedBuffer, { mode: 0o644 });
        (0, variantWorker_1.enqueueVariants)(filePath);
        res.json({ url: `/uploads/suppliers/products/${fileName}` });
    }
    catch (error) {
        console.error('Upload product image error:', error);
        res.status(500).json({ error: 'Failed to upload image.' });
    }
}
async function getProfileId(supplierUserId) {
    const [rows] = await database_1.default.execute('SELECT id FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [supplierUserId]);
    return rows[0]?.id || null;
}
async function getProfileCountry(supplierUserId) {
    const [rows] = await database_1.default.execute('SELECT country FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [supplierUserId]);
    return rows[0]?.country || 'ae';
}
async function translateText(req, res) {
    try {
        const { text } = req.body;
        if (!text || !String(text).trim()) return res.json({ translated: '' });
        // 产品名称/描述足够短；超长直接截断，防止超大 body 被代理到外部
        const src = String(text).slice(0, 2000);
        const country = await getProfileCountry(req.supplierUser.id);
        const target = country === 'vn' ? 'vi' : 'en';
        const translated = await translate_1.translate(src, target);
        res.json({ translated });
    }
    catch (error) {
        console.error('Translate error:', error);
        res.json({ translated: req.body?.text || '' });
    }
}
async function listProducts(req, res) {
    try {
        const { slug } = req.params;
        const [profileRows] = await database_1.default.execute("SELECT id FROM supplier_profiles WHERE slug = ? AND status = 'approved'", [slug]);
        const profile = profileRows[0];
        if (!profile)
            return res.status(404).json({ error: 'Supplier not found.' });
        const [products] = await database_1.default.execute('SELECT * FROM supplier_products WHERE supplier_profile_id = ? ORDER BY sort_order, id', [profile.id]);
        res.json({ products });
    }
    catch (error) {
        console.error('List products error:', error);
        res.status(500).json({ error: 'Failed to load products.' });
    }
}
async function listMyProducts(req, res) {
    try {
        const profileId = await getProfileId(req.supplierUser.id);
        if (!profileId)
            return res.json({ products: [] });
        const [products] = await database_1.default.execute('SELECT * FROM supplier_products WHERE supplier_profile_id = ? ORDER BY sort_order, id', [profileId]);
        res.json({ products });
    }
    catch (error) {
        console.error('List my products error:', error);
        res.status(500).json({ error: 'Failed to load products.' });
    }
}
async function addProduct(req, res) {
    try {
        const profileId = await getProfileId(req.supplierUser.id);
        if (!profileId)
            return res.status(400).json({ error: 'Create your profile first.' });
        const { title, description, category, image_url, image_urls, sort_order, price, price_unit, price_from, title_translated, description_translated } = req.body;
        // Support multi-image: image_urls takes precedence; image_url is kept for backward compat
        const urls = Array.isArray(image_urls) && image_urls.length > 0
            ? image_urls
            : image_url ? [image_url] : [];
        if (urls.length === 0)
            return res.status(400).json({ error: 'At least one image is required.' });
        const priceErr = validatePrice(req.body);
        if (priceErr)
            return res.status(400).json({ error: priceErr });
        const primaryUrl = urls[0];
        const urlsJson = JSON.stringify(urls);
        const [result] = await database_1.default.execute('INSERT INTO supplier_products (supplier_profile_id, title, description, category, image_url, image_urls, sort_order, price, price_unit, price_from, title_translated, description_translated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [profileId, title || null, description || null, category || null, primaryUrl, urlsJson, sort_order || 0, Number(price), price_unit.trim(), price_from ? 1 : 0, title_translated || null, description_translated || null]);
        const id = result.insertId;
        const [created] = await database_1.default.execute('SELECT * FROM supplier_products WHERE id = ?', [id]);
        const product = created[0];
        if (product?.image_urls && typeof product.image_urls === 'string') {
            product.image_urls = JSON.parse(product.image_urls);
        }
        res.status(201).json({ product });
    }
    catch (error) {
        console.error('Add product error:', error);
        res.status(500).json({ error: 'Failed to add product.' });
    }
}
async function updateProduct(req, res) {
    try {
        const profileId = await getProfileId(req.supplierUser.id);
        if (!profileId)
            return res.status(403).json({ error: 'Forbidden.' });
        const { id } = req.params;
        const { title, description, category, image_url, image_urls, sort_order, price, price_unit, price_from, title_translated, description_translated } = req.body;
        const [existing] = await database_1.default.execute('SELECT id FROM supplier_products WHERE id = ? AND supplier_profile_id = ?', [id, profileId]);
        if (existing.length === 0)
            return res.status(404).json({ error: 'Product not found.' });
        const priceErr = validatePrice(req.body);
        if (priceErr)
            return res.status(400).json({ error: priceErr });
        const urls = Array.isArray(image_urls) && image_urls.length > 0 ? image_urls : null;
        const primaryUrl = urls ? urls[0] : (image_url || null);
        const urlsJson = urls ? JSON.stringify(urls) : null;
        await database_1.default.execute('UPDATE supplier_products SET title=?, description=?, category=?, image_url=COALESCE(?, image_url), image_urls=COALESCE(?, image_urls), sort_order=?, price=?, price_unit=?, price_from=?, title_translated=?, description_translated=? WHERE id=?', [title || null, description || null, category || null, primaryUrl, urlsJson, sort_order ?? 0, Number(price), price_unit.trim(), price_from ? 1 : 0, title_translated || null, description_translated || null, id]);
        const [updated] = await database_1.default.execute('SELECT * FROM supplier_products WHERE id = ?', [id]);
        res.json({ product: updated[0] });
    }
    catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Failed to update product.' });
    }
}
async function deleteProduct(req, res) {
    try {
        const profileId = await getProfileId(req.supplierUser.id);
        if (!profileId)
            return res.status(403).json({ error: 'Forbidden.' });
        const { id } = req.params;
        const [existing] = await database_1.default.execute('SELECT id FROM supplier_products WHERE id = ? AND supplier_profile_id = ?', [id, profileId]);
        if (existing.length === 0)
            return res.status(404).json({ error: 'Product not found.' });
        await database_1.default.execute('DELETE FROM supplier_products WHERE id = ?', [id]);
        res.json({ message: 'Product deleted.' });
    }
    catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
}
async function reorderProducts(req, res) {
    try {
        const profileId = await getProfileId(req.supplierUser.id);
        if (!profileId)
            return res.status(403).json({ error: 'Forbidden.' });
        const { order } = req.body; // [{ id: number, sort_order: number }]
        if (!Array.isArray(order))
            return res.status(400).json({ error: 'order array is required.' });
        for (const item of order) {
            await database_1.default.execute('UPDATE supplier_products SET sort_order = ? WHERE id = ? AND supplier_profile_id = ?', [item.sort_order, item.id, profileId]);
        }
        res.json({ message: 'Reordered.' });
    }
    catch (error) {
        console.error('Reorder products error:', error);
        res.status(500).json({ error: 'Failed to reorder.' });
    }
}
