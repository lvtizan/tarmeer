"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLicense = uploadLicense;
exports.listPublicSuppliers = listPublicSuppliers;
exports.getPublicProfile = getPublicProfile;
exports.getMyProfile = getMyProfile;
exports.upsertProfile = upsertProfile;
const database_1 = __importDefault(require("../config/database"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("crypto");
const variantWorker_1 = require("../lib/variantWorker");
async function uploadLicense(req, res) {
    try {
        const userId = req.supplierUser.id;
        const { data_url } = req.body;
        if (!data_url)
            return res.status(400).json({ error: 'No file data provided.' });
        const matches = data_url.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches)
            return res.status(400).json({ error: 'Invalid file format.' });
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buffer = Buffer.from(base64Data, 'base64');
        const extMap = {
            'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
            'image/gif': 'gif', 'application/pdf': 'pdf',
        };
        const ext = extMap[mimeType] || 'bin';
        const fileName = `${userId}-${(0, crypto_1.randomUUID)()}.${ext}`;
        const uploadDir = path_1.default.join(process.cwd(), 'public', 'uploads', 'suppliers', 'licenses');
        await promises_1.default.mkdir(uploadDir, { recursive: true, mode: 0o755 });
        const filePath = path_1.default.join(uploadDir, fileName);
        await promises_1.default.writeFile(filePath, buffer, { mode: 0o644 });
        if (mimeType.startsWith('image/'))
            (0, variantWorker_1.enqueueVariants)(filePath);
        res.json({ url: `/uploads/suppliers/licenses/${fileName}` });
    }
    catch (error) {
        console.error('Upload license error:', error);
        res.status(500).json({ error: 'Failed to upload file.' });
    }
}
function slugify(name) {
    return name.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
async function listPublicSuppliers(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const origin = req.query.origin; // 'china' | 'dubai'
        const category = req.query.category;
        const orderMode = req.query.order === 'home' ? 'home' : 'list';
        const displayOrderCol = orderMode === 'home' ? 'home_display_order' : 'list_display_order';
        let where = "WHERE sp.status = 'approved' AND sp.is_published = 1 AND (SELECT COUNT(*) FROM supplier_projects spj WHERE spj.supplier_profile_id = sp.id AND spj.is_published = 1) > 0";
        const params = [];
        if (origin && (origin === 'china' || origin === 'dubai')) {
            where += ' AND sp.origin = ?';
            params.push(origin);
        }
        if (category) {
            where += ' AND JSON_CONTAINS(sp.categories, ?)';
            params.push(JSON.stringify(category));
        }
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) as total FROM supplier_profiles sp ${where}`, params);
        const total = countRows[0].total;
        // home: manual display_order wins; weight_score only breaks ties among rows without an order set
        // list: weight_score first, display_order secondary
        const orderBy = orderMode === 'home'
            ? `CASE WHEN COALESCE(sp.${displayOrderCol}, 0) > 0 THEN sp.${displayOrderCol} ELSE 9999 END ASC, COALESCE(sp.weight_score, 0) DESC, sp.created_at DESC`
            : `COALESCE(sp.weight_score, 0) DESC, CASE WHEN COALESCE(sp.${displayOrderCol}, 0) > 0 THEN 0 ELSE 1 END, sp.${displayOrderCol} ASC, sp.created_at DESC`;
        const [rows] = await database_1.default.query(`SELECT sp.*, su.email as user_email
       FROM supplier_profiles sp
       LEFT JOIN supplier_users su ON su.id = sp.supplier_user_id
       ${where}
       ORDER BY ${orderBy}
       LIMIT ${limit} OFFSET ${offset}`, params);
        res.json({ suppliers: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }
    catch (error) {
        console.error('List suppliers error:', error);
        res.status(500).json({ error: 'Failed to load suppliers.' });
    }
}
async function getPublicProfile(req, res) {
    try {
        const { slug } = req.params;
        const [rows] = await database_1.default.execute(`SELECT sp.*, su.email as user_email, su.full_name as user_name
       FROM supplier_profiles sp
       LEFT JOIN supplier_users su ON su.id = sp.supplier_user_id
       WHERE sp.slug = ? AND sp.status = 'approved' AND sp.is_published = 1`, [slug]);
        const supplier = rows[0];
        if (!supplier)
            return res.status(404).json({ error: 'Supplier not found.' });
        // Get products
        const [products] = await database_1.default.execute('SELECT * FROM supplier_products WHERE supplier_profile_id = ? ORDER BY sort_order, id', [supplier.id]);
        // Get catalogs
        const [catalogs] = await database_1.default.execute('SELECT * FROM supplier_catalogs WHERE supplier_profile_id = ? ORDER BY created_at DESC', [supplier.id]);
        res.json({ supplier, products, catalogs });
    }
    catch (error) {
        console.error('Get supplier profile error:', error);
        res.status(500).json({ error: 'Failed to load supplier.' });
    }
}
async function getMyProfile(req, res) {
    try {
        const userId = req.supplierUser.id;
        const [rows] = await database_1.default.execute('SELECT * FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [userId]);
        const profile = rows[0] || null;
        res.json({ profile });
    }
    catch (error) {
        console.error('Get my profile error:', error);
        res.status(500).json({ error: 'Failed to load profile.' });
    }
}
async function upsertProfile(req, res) {
    try {
        const userId = req.supplierUser.id;
        const { company_name, description, origin, categories, cover_image_url, license_url, has_physical_store, store_address, store_lat, store_lng, google_maps_url, contact_phone, whatsapp, website, } = req.body;
        if (!company_name)
            return res.status(400).json({ error: 'Company name is required.' });
        const [existing] = await database_1.default.execute('SELECT id, slug FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [userId]);
        const existingProfile = existing[0];
        const cats = Array.isArray(categories) ? JSON.stringify(categories) : categories || '[]';
        if (existingProfile) {
            // cover_image_url and logo_url are admin-managed; only update them if explicitly included in the request
            const coverUpdate = cover_image_url !== undefined ? ', cover_image_url=?' : '';
            const coverValues = cover_image_url !== undefined ? [cover_image_url || null] : [];
            await database_1.default.execute(`UPDATE supplier_profiles SET
          company_name=?, description=?, origin=?, categories=?, license_url=?,
          has_physical_store=?, store_address=?, store_lat=?, store_lng=?, google_maps_url=?,
          contact_phone=?, whatsapp=?, website=?${coverUpdate}
         WHERE id=?`, [
                company_name, description || '', origin || 'china', cats, license_url || null,
                has_physical_store ? 1 : 0, store_address || null, store_lat || null, store_lng || null, google_maps_url || null,
                contact_phone || null, whatsapp || null, website || null,
                ...coverValues,
                existingProfile.id,
            ]);
            // Keep supplier_users.phone in sync so admin sees latest phone regardless of which field they look at
            if (contact_phone !== undefined) {
                await database_1.default.execute('UPDATE supplier_users SET phone = ? WHERE id = ?', [contact_phone || null, userId]);
            }
            const [updated] = await database_1.default.execute('SELECT * FROM supplier_profiles WHERE id = ?', [existingProfile.id]);
            res.json({ profile: updated[0] });
        }
        else {
            let slug = slugify(company_name);
            // Ensure unique slug
            const [slugCheck] = await database_1.default.execute('SELECT id FROM supplier_profiles WHERE slug = ?', [slug]);
            if (slugCheck.length > 0)
                slug += `-${Date.now()}`;
            await database_1.default.execute(`INSERT INTO supplier_profiles
          (supplier_user_id, company_name, slug, description, origin, categories, cover_image_url, license_url,
           has_physical_store, store_address, store_lat, store_lng, google_maps_url,
           contact_phone, whatsapp, website)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                userId, company_name, slug, description || '', origin || 'china', cats, cover_image_url || null, license_url || null,
                has_physical_store ? 1 : 0, store_address || null, store_lat || null, store_lng || null, google_maps_url || null,
                contact_phone || null, whatsapp || null, website || null,
            ]);
            const [created] = await database_1.default.execute('SELECT * FROM supplier_profiles WHERE supplier_user_id = ?', [userId]);
            res.status(201).json({ profile: created[0] });
        }
    }
    catch (error) {
        console.error('Upsert supplier profile error:', error);
        res.status(500).json({ error: 'Failed to save profile.' });
    }
}
