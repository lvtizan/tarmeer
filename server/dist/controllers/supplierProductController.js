"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadProductImage = uploadProductImage;
exports.listProducts = listProducts;
exports.listPublicProductsFeed = listPublicProductsFeed;
exports.getPublicProductDetail = getPublicProductDetail;
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
const productJsonFields_1 = require("../lib/productJsonFields");
// 应用场景 slug → 存量 category 兜底映射（spec docs/plans/china-materials-revamp-spec.md §2.3）。
// 场景过滤 = JSON_CONTAINS(application_scenes) OR category IN (映射表[scene])，兼容未打场景标签的存量产品。
const SCENE_CATEGORY_FALLBACK = {
    'feature-wall': ['stone', 'paint', 'wallpaper'],
    'flooring': ['flooring', 'stone'],
    'countertop': ['stone', 'kitchen'],
    'kitchen-bath': ['kitchen', 'bathroom', 'sanitary', 'hardware'],
    'lighting': ['lighting'],
    'furniture': ['furniture'],
    'outdoor-garden': ['plants', 'outdoor'],
    'decor': ['plants', 'other', 'decor'],
};
// 公开产品 feed 的 SELECT/JOIN 片段：供应商字段平铺（spec §3.1 契约）
const PUBLIC_PRODUCT_SELECT = `p.id, p.title, p.description, p.category, p.image_url, p.image_urls,
       p.specs, p.certifications, p.application_scenes, p.price, p.price_unit, p.price_from,
       sp.id AS supplier_id, sp.slug AS supplier_slug, sp.company_name AS supplier_name,
       sp.origin AS supplier_origin, sp.logo_url AS supplier_logo`;
const PUBLIC_PRODUCT_FROM = `FROM supplier_products p
       JOIN supplier_profiles sp ON sp.id = p.supplier_profile_id`;
// 国家隔离铁律：query 优先 → x-country（req.country）→ 'ae'（对齐 listPublicSuppliers）
function resolvePublicCountry(req) {
    return (typeof req.query.country === 'string' && ['ae', 'vn'].includes(req.query.country) ? req.query.country : null) || req.country || 'ae';
}
// JSON 列 parse 成数组再返回（spec §3.1）
function mapPublicProduct(row) {
    return {
        ...row,
        image_urls: (0, productJsonFields_1.parseJsonArray)(row.image_urls),
        specs: (0, productJsonFields_1.parseJsonArray)(row.specs),
        certifications: (0, productJsonFields_1.parseJsonArray)(row.certifications),
        application_scenes: (0, productJsonFields_1.parseJsonArray)(row.application_scenes),
    };
}
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
// GET /api/suppliers/products/public — 跨供应商公开产品 feed（spec §3.1，中国新材料目录）
async function listPublicProductsFeed(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 24));
        const offset = (page - 1) * limit;
        const country = resolvePublicCountry(req);
        // 国家隔离铁律：只暴露本国 approved + published 供应商的产品
        let where = "WHERE sp.status = 'approved' AND sp.is_published = 1 AND sp.country = ?";
        const params = [country];
        const category = req.query.category;
        if (category && typeof category === 'string') {
            where += ' AND p.category = ?';
            params.push(category);
        }
        const scene = req.query.scene;
        if (scene && typeof scene === 'string') {
            const fallbackCats = SCENE_CATEGORY_FALLBACK[scene];
            if (!fallbackCats)
                return res.status(400).json({ error: 'Invalid scene.' });
            const inPlaceholders = fallbackCats.map(() => '?').join(',');
            where += ` AND (JSON_CONTAINS(p.application_scenes, ?) OR p.category IN (${inPlaceholders}))`;
            params.push(JSON.stringify(scene), ...fallbackCats);
        }
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) as total ${PUBLIC_PRODUCT_FROM} ${where}`, params);
        const total = countRows[0].total;
        // LIMIT/OFFSET 拼过整数校验的数字（pool.execute 传参会报错——已知坑）
        const [rows] = await database_1.default.query(`SELECT ${PUBLIC_PRODUCT_SELECT}
       ${PUBLIC_PRODUCT_FROM}
       ${where}
       ORDER BY COALESCE(sp.weight_score, 0) DESC, p.sort_order, p.id DESC
       LIMIT ${limit} OFFSET ${offset}`, params);
        res.json({ products: rows.map(mapPublicProduct), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }
    catch (error) {
        console.error('List public products feed error:', error);
        res.status(500).json({ error: 'Failed to load products.' });
    }
}
// GET /api/suppliers/products/public/:id — 单个产品 + related（同 category、同国家、排除自身、≤8）
async function getPublicProductDetail(req, res) {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0)
            return res.status(404).json({ error: 'Product not found.' });
        const country = resolvePublicCountry(req);
        const [rows] = await database_1.default.execute(`SELECT ${PUBLIC_PRODUCT_SELECT}
       ${PUBLIC_PRODUCT_FROM}
       WHERE p.id = ? AND sp.status = 'approved' AND sp.is_published = 1 AND sp.country = ?`, [id, country]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Product not found.' });
        const product = mapPublicProduct(rows[0]);
        // related：同 category（产品无 category 时退回同供应商），同国家，排除自身
        let relWhere = "WHERE sp.status = 'approved' AND sp.is_published = 1 AND sp.country = ? AND p.id != ?";
        const relParams = [country, id];
        if (product.category) {
            relWhere += ' AND p.category = ?';
            relParams.push(product.category);
        }
        else {
            relWhere += ' AND p.supplier_profile_id = ?';
            relParams.push(product.supplier_id);
        }
        const [relRows] = await database_1.default.query(`SELECT ${PUBLIC_PRODUCT_SELECT}
       ${PUBLIC_PRODUCT_FROM}
       ${relWhere}
       ORDER BY COALESCE(sp.weight_score, 0) DESC, p.sort_order, p.id DESC
       LIMIT 8`, relParams);
        res.json({ product, related: relRows.map(mapPublicProduct) });
    }
    catch (error) {
        console.error('Get public product detail error:', error);
        res.status(500).json({ error: 'Failed to load product.' });
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
        const { specs, certifications, application_scenes } = req.body;
        const [result] = await database_1.default.execute('INSERT INTO supplier_products (supplier_profile_id, title, description, category, image_url, image_urls, sort_order, price, price_unit, price_from, title_translated, description_translated, specs, certifications, application_scenes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [profileId, title || null, description || null, category || null, primaryUrl, urlsJson, sort_order || 0, Number(price), price_unit.trim(), price_from ? 1 : 0, title_translated || null, description_translated || null, (0, productJsonFields_1.jsonArrayOrNull)(specs), (0, productJsonFields_1.jsonArrayOrNull)(certifications), (0, productJsonFields_1.jsonArrayOrNull)(application_scenes)]);
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
        // specs/certifications/application_scenes：只在传了数组时覆盖（COALESCE 忽略缺省，防误清空 admin 填的值）
        const { specs, certifications, application_scenes } = req.body;
        await database_1.default.execute('UPDATE supplier_products SET title=?, description=?, category=?, image_url=COALESCE(?, image_url), image_urls=COALESCE(?, image_urls), sort_order=?, price=?, price_unit=?, price_from=?, title_translated=?, description_translated=?, specs=COALESCE(?, specs), certifications=COALESCE(?, certifications), application_scenes=COALESCE(?, application_scenes) WHERE id=?', [title || null, description || null, category || null, primaryUrl, urlsJson, sort_order ?? 0, Number(price), price_unit.trim(), price_from ? 1 : 0, title_translated || null, description_translated || null, (0, productJsonFields_1.jsonArrayOrNull)(specs), (0, productJsonFields_1.jsonArrayOrNull)(certifications), (0, productJsonFields_1.jsonArrayOrNull)(application_scenes), id]);
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
