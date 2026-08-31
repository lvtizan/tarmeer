"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRenameCatalog = adminRenameCatalog;
exports.adminReplaceCatalogFile = adminReplaceCatalogFile;
exports.adminAddCatalog = adminAddCatalog;
exports.adminDeleteCatalog = adminDeleteCatalog;
exports.adminReplaceProductImage = adminReplaceProductImage;
exports.createAdminSupplierAccount = createAdminSupplierAccount;
exports.listSuppliers = listSuppliers;
exports.getSupplierDetail = getSupplierDetail;
exports.updateSupplierStatus = updateSupplierStatus;
exports.updateSupplier = updateSupplier;
exports.deleteSupplier = deleteSupplier;
exports.adminAddProduct = adminAddProduct;
exports.adminDeleteProduct = adminDeleteProduct;
exports.adminUpdateProduct = adminUpdateProduct;
exports.adminUploadProjectImage = adminUploadProjectImage;
exports.adminAddProject = adminAddProject;
exports.adminUpdateProject = adminUpdateProject;
exports.adminDeleteProject = adminDeleteProject;
exports.setSupplierHomeOrder = setSupplierHomeOrder;
exports.setSupplierListOrder = setSupplierListOrder;
exports.toggleSupplierPublished = toggleSupplierPublished;
exports.toggleSupplierProjectPublished = toggleSupplierProjectPublished;
exports.getSupplierReport = getSupplierReport;
const database_1 = __importDefault(require("../config/database"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const variantWorker_1 = require("../lib/variantWorker");
const imageVariants_1 = require("../lib/imageVariants");
const activityLogger_1 = require("../lib/activityLogger");
const productPriceRange_1 = require("../lib/productPriceRange");
const slugify_1 = require("../lib/slugify");
// 报价币种白名单。⚠️ 与 supplierProductController.PRODUCT_CURRENCIES / 前端 src/lib/supplierProductUnits.ts 同源。
const SUPPORTED_PRICE_CURRENCIES = ['AED', 'CNY', 'USD', 'VND'];
/** 记录供应商后台操作到 activity_log（审计）。整体 try/catch，记录失败绝不影响主操作。 */
async function logSupplierAction(req, action, targetId, description, country = req.admin?.country) {
    try {
        await activityLogger_1.logActivity({
            userId: req.admin?.id,
            userName: req.admin?.full_name || req.admin?.email || 'admin',
            userRole: req.admin?.role || 'admin',
            action,
            targetType: 'supplier',
            targetId: targetId != null ? Number(targetId) : null,
            description,
            ip: activityLogger_1.getClientIp ? activityLogger_1.getClientIp(req) : undefined,
            country,
        });
    }
    catch (e) {
        console.error('[SupplierAudit] log failed:', e);
    }
}
const ADMIN_SUPPLIER_COUNTRIES = new Set(['ae', 'vn']);
function adminSupplierCountry(req) {
    const requestedCountry = typeof req.body?.country === 'string' ? req.body.country : '';
    if (req.admin?.role === 'super_admin') {
        const selectedCountry = requestedCountry || req.admin.country;
        return ADMIN_SUPPLIER_COUNTRIES.has(selectedCountry) ? selectedCountry : null;
    }
    return ADMIN_SUPPLIER_COUNTRIES.has(req.admin?.country) ? req.admin.country : null;
}
/** POST /admin/suppliers — privileged account provisioning; public registration remains verification-gated. */
async function createAdminSupplierAccount(req, res) {
    const companyName = typeof req.body?.companyName === 'string' ? req.body.companyName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const country = adminSupplierCountry(req);
    if (!country)
        return res.status(400).json({ error: 'A supported admin country is required.' });
    if (!companyName || companyName.length > 100)
        return res.status(400).json({ error: 'Company name is required and must be at most 100 characters.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255)
        return res.status(400).json({ error: 'A valid email is required.' });
    if (password.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    if (Buffer.byteLength(password, 'utf8') > 72)
        return res.status(400).json({ error: 'Password must be at most 72 UTF-8 bytes.' });
    if (phone.length > 64)
        return res.status(400).json({ error: 'Phone must be at most 64 characters.' });
    let connection;
    try {
        connection = await database_1.default.getConnection();
        await connection.beginTransaction();
        const [supplierUsers] = await connection.execute('SELECT id FROM supplier_users WHERE email = ? LIMIT 1', [email]);
        const [siteUsers] = await connection.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        if (supplierUsers.length > 0 || siteUsers.length > 0) {
            await connection.rollback();
            return res.status(409).json({ error: 'This email is already registered.' });
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const [userResult] = await connection.execute(`INSERT INTO supplier_users (email, password, full_name, phone, email_verified)
             VALUES (?, ?, ?, ?, 1)`, [email, passwordHash, companyName, phone || null]);
        const userId = userResult.insertId;
        const baseSlug = (0, slugify_1.slugify)(companyName).slice(0, 240) || 'supplier';
        const slug = `${baseSlug}-${userId}`;
        const [profileResult] = await connection.execute(`INSERT INTO supplier_profiles
             (supplier_user_id, company_name, slug, status, contact_phone, country)
             VALUES (?, ?, ?, 'pending', ?, ?)`, [userId, companyName, slug, phone || null, country]);
        await connection.execute(`INSERT INTO activity_log
             (user_id, user_name, user_role, action, target_type, target_id, description, ip, country)
             VALUES (?, ?, ?, ?, 'supplier', ?, ?, ?, ?)`, [
            req.admin?.id || null,
            req.admin?.full_name || req.admin?.email || 'admin',
            req.admin?.role || 'admin',
            'supplier_account_create',
            profileResult.insertId,
            `创建免邮箱验证供应商账号：${email}`,
            activityLogger_1.getClientIp ? activityLogger_1.getClientIp(req) : null,
            country,
        ]);
        await connection.commit();
        return res.status(201).json({
            message: 'Supplier account created. It can sign in immediately.',
            supplier: {
                id: profileResult.insertId,
                user_id: userId,
                company_name: companyName,
                email,
                email_verified: true,
                country,
                status: 'pending',
            },
        });
    }
    catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            }
            catch (rollbackError) {
                console.error('Admin create supplier account rollback error:', rollbackError);
            }
        }
        if (error?.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'This email is already registered.' });
        console.error('Admin create supplier account error:', error);
        return res.status(500).json({ error: 'Failed to create supplier account.' });
    }
    finally {
        connection?.release();
    }
}
/**
 * PATCH /admin/suppliers/catalogs/:id/title — 修改目录名称
 */
async function adminRenameCatalog(req, res) {
    try {
        const catalogId = Number(req.params.id);
        if (!catalogId)
            return res.status(400).json({ error: 'invalid catalog id' });
        const title = (req.body?.title || '').toString().trim();
        if (!title)
            return res.status(400).json({ error: 'title is required' });
        const [rows] = await database_1.default.execute('SELECT id FROM supplier_catalogs WHERE id = ?', [catalogId]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'catalog not found' });
        await database_1.default.execute('UPDATE supplier_catalogs SET title = ? WHERE id = ?', [title, catalogId]);
        await logSupplierAction(req, 'supplier_catalog_rename', catalogId, `重命名目录#${catalogId} → ${title}`);
        res.json({ id: catalogId, title });
    }
    catch (error) {
        console.error('Admin rename catalog error:', error);
        res.status(500).json({ error: 'Failed to rename catalog.' });
    }
}
/**
 * 管理员替换 catalog PDF 文件 —— 用于"把联系方式打白后回写"工作流。
 * multipart/form-data，字段名 file。保存到 public/uploads/catalogs/redacted/<supplier_id>/<id>.pdf，
 * UPDATE supplier_catalogs.file_url 指向新路径。
 */
async function adminReplaceCatalogFile(req, res) {
    try {
        const catalogId = Number(req.params.id);
        if (!catalogId)
            return res.status(400).json({ error: 'invalid catalog id' });
        if (!req.file?.buffer)
            return res.status(400).json({ error: 'no file uploaded' });
        const [rows] = await database_1.default.execute('SELECT id, supplier_profile_id, file_url FROM supplier_catalogs WHERE id = ?', [catalogId]);
        const cat = rows[0];
        if (!cat)
            return res.status(404).json({ error: 'catalog not found' });
        const supplierId = cat.supplier_profile_id;
        const relPath = `catalogs/redacted/${supplierId}/${catalogId}.pdf`;
        const absPath = path_1.default.resolve(process.cwd(), 'public/uploads', relPath);
        await promises_1.default.mkdir(path_1.default.dirname(absPath), { recursive: true });
        await promises_1.default.writeFile(absPath, req.file.buffer, { mode: 0o644 });
        const newUrl = `/uploads/${relPath}`;
        await database_1.default.execute('UPDATE supplier_catalogs SET file_url = ? WHERE id = ?', [newUrl, catalogId]);
        await logSupplierAction(req, 'supplier_catalog_file_replace', supplierId, `供应商#${supplierId} 替换目录#${catalogId} 文件`);
        res.json({ id: catalogId, file_url: newUrl, file_size: req.file.size });
    }
    catch (error) {
        console.error('Admin replace catalog file error:', error);
        res.status(500).json({ error: 'Failed to replace catalog file.' });
    }
}
/** 管理员帮供应商新增目录 PDF。multipart/form-data：file(PDF) + title(可选，缺省用文件名)。 */
async function adminAddCatalog(req, res) {
    try {
        const supplierId = Number(req.params.id);
        if (!supplierId)
            return res.status(400).json({ error: 'invalid supplier id' });
        if (!req.file?.buffer)
            return res.status(400).json({ error: 'no file uploaded' });
        const isPdf = req.file.mimetype === 'application/pdf' || /\.pdf$/i.test(req.file.originalname || '');
        if (!isPdf)
            return res.status(400).json({ error: 'Only PDF files are allowed.' });
        const [supRows] = await database_1.default.execute('SELECT id FROM supplier_profiles WHERE id = ?', [supplierId]);
        if (supRows.length === 0)
            return res.status(404).json({ error: 'supplier not found' });
        const title = (typeof req.body.title === 'string' && req.body.title.trim())
            || (req.file.originalname || 'Catalog').replace(/\.pdf$/i, '').trim()
            || 'Catalog';
        const fileName = `admin-${supplierId}-${require('crypto').randomUUID()}.pdf`;
        const relPath = `suppliers/catalogs/${fileName}`;
        const absPath = path_1.default.resolve(process.cwd(), 'public/uploads', relPath);
        await promises_1.default.mkdir(path_1.default.dirname(absPath), { recursive: true });
        await promises_1.default.writeFile(absPath, req.file.buffer, { mode: 0o644 });
        const fileUrl = `/uploads/${relPath}`;
        const [result] = await database_1.default.execute('INSERT INTO supplier_catalogs (supplier_profile_id, title, file_url, file_size) VALUES (?, ?, ?, ?)', [supplierId, title, fileUrl, req.file.size || null]);
        await logSupplierAction(req, 'supplier_catalog_add', supplierId, `供应商#${supplierId} 新增目录#${result.insertId}`);
        const [created] = await database_1.default.execute('SELECT * FROM supplier_catalogs WHERE id = ?', [result.insertId]);
        res.status(201).json({ catalog: created[0] });
    }
    catch (error) {
        console.error('Admin add catalog error:', error);
        res.status(500).json({ error: 'Failed to add catalog.' });
    }
}
/** 管理员帮供应商删除目录（按 supplier 侧口径只删库记录，磁盘文件保留）。 */
async function adminDeleteCatalog(req, res) {
    try {
        const catalogId = Number(req.params.id);
        if (!catalogId)
            return res.status(400).json({ error: 'invalid catalog id' });
        const [rows] = await database_1.default.execute('SELECT id, supplier_profile_id FROM supplier_catalogs WHERE id = ?', [catalogId]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'catalog not found' });
        await database_1.default.execute('DELETE FROM supplier_catalogs WHERE id = ?', [catalogId]);
        await logSupplierAction(req, 'supplier_catalog_delete', rows[0].supplier_profile_id, `供应商#${rows[0].supplier_profile_id} 删除目录#${catalogId}`);
        res.json({ message: 'Catalog deleted.' });
    }
    catch (error) {
        console.error('Admin delete catalog error:', error);
        res.status(500).json({ error: 'Failed to delete catalog.' });
    }
}
/**
 * 管理员替换某个供应商产品的封面图。multipart/form-data，字段名 file。
 * 保存到 public/uploads/suppliers/<slug 或 id>/photos/<productId>_<ts>.<ext>，
 * UPDATE supplier_products.image_url 指向新路径。
 */
async function adminReplaceProductImage(req, res) {
    try {
        const supplierId = Number(req.params.id);
        const productId = Number(req.params.productId);
        if (!supplierId || !productId)
            return res.status(400).json({ error: 'invalid id' });
        if (!req.file?.buffer)
            return res.status(400).json({ error: 'no file uploaded' });
        const [supRows] = await database_1.default.execute('SELECT id, slug FROM supplier_profiles WHERE id = ?', [supplierId]);
        const sup = supRows[0];
        if (!sup)
            return res.status(404).json({ error: 'supplier not found' });
        const [prodRows] = await database_1.default.execute('SELECT id FROM supplier_products WHERE id = ? AND supplier_profile_id = ?', [productId, supplierId]);
        if (prodRows.length === 0)
            return res.status(404).json({ error: 'product not found' });
        const { buffer: processedBuffer, ext: processedExt } = await (0, imageVariants_1.processUploadedImage)(req.file.buffer);
        const ts = Date.now();
        const dirSlug = (sup.slug || `id${sup.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const relPath = `suppliers/${dirSlug}/photos/${productId}_${ts}.${processedExt}`;
        const absPath = path_1.default.resolve(process.cwd(), 'public/uploads', relPath);
        await promises_1.default.mkdir(path_1.default.dirname(absPath), { recursive: true });
        await promises_1.default.writeFile(absPath, processedBuffer, { mode: 0o644 });
        (0, variantWorker_1.enqueueVariants)(absPath);
        const newUrl = `/uploads/${relPath}`;
        await database_1.default.execute('UPDATE supplier_products SET image_url = ? WHERE id = ?', [newUrl, productId]);
        await logSupplierAction(req, 'supplier_product_image_replace', supplierId, `供应商#${supplierId} 换商品#${productId} 图`);
        res.json({ id: productId, image_url: newUrl });
    }
    catch (error) {
        console.error('Admin replace product image error:', error);
        res.status(500).json({ error: 'Failed to replace product image.' });
    }
}
async function listSuppliers(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status;
        const origin = req.query.origin;
        const source = req.query.source;
        const search = req.query.search;
        const group = req.query.group;
        const country = req.query.country || req.country || 'ae';
        let where = 'WHERE sp.country = ?';
        const params = [country];
        if (status) {
            where += ' AND sp.status = ?';
            params.push(status);
        }
        if (origin) {
            where += ' AND sp.origin = ?';
            params.push(origin);
        }
        if (source) {
            where += ' AND sp.source = ?';
            params.push(source);
        }
        if (search) {
            where += ' AND (sp.company_name LIKE ? OR sp.name_zh LIKE ? OR su.email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        if (group === 'team') {
            where += ' AND su.email LIKE ?';
            params.push('%@tarmeer-team.com');
        }
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) as total FROM supplier_profiles sp LEFT JOIN supplier_users su ON su.id = sp.supplier_user_id ${where}`, params);
        const total = countRows[0].total;
        // tab 统计（均按国家全量，不受分页/当前 tab 筛选影响，与合作方同步计数口径一致）
        const [partnerRows] = await database_1.default.execute(`SELECT COUNT(*) as pc FROM supplier_profiles WHERE country = ? AND source = 'partner'`, [country]);
        const partnerCount = partnerRows[0].pc;
        const [allRows] = await database_1.default.execute(`SELECT COUNT(*) as ac FROM supplier_profiles WHERE country = ?`, [country]);
        const allCount = allRows[0].ac;
        const [teamRows] = await database_1.default.execute(`SELECT COUNT(*) as tc FROM supplier_profiles sp LEFT JOIN supplier_users su ON su.id = sp.supplier_user_id WHERE sp.country = ? AND su.email LIKE '%@tarmeer-team.com'`, [country]);
        const teamCount = teamRows[0].tc;
        const [rows] = await database_1.default.query(`SELECT sp.*, su.email as user_email, su.full_name as user_name,
              (SELECT COUNT(*) FROM supplier_products WHERE supplier_profile_id = sp.id) as product_count,
              (SELECT COUNT(*) FROM supplier_catalogs WHERE supplier_profile_id = sp.id) as catalog_count
       FROM supplier_profiles sp
       LEFT JOIN supplier_users su ON su.id = sp.supplier_user_id
       ${where}
       ORDER BY CASE WHEN GREATEST(COALESCE(sp.home_display_order,0), COALESCE(sp.list_display_order,0)) > 0 THEN 0 ELSE 1 END,
                LEAST(CASE WHEN sp.home_display_order > 0 THEN sp.home_display_order ELSE 999999 END,
                      CASE WHEN sp.list_display_order > 0 THEN sp.list_display_order ELSE 999999 END) ASC,
                COALESCE(sp.published_at, sp.updated_at) DESC,
                sp.id DESC
       LIMIT ${limit} OFFSET ${offset}`, params);
        res.json({ suppliers: rows, partnerCount, allCount, teamCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }
    catch (error) {
        console.error('Admin list suppliers error:', error);
        res.status(500).json({ error: 'Failed to load suppliers.' });
    }
}
async function getSupplierDetail(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await database_1.default.execute(`SELECT sp.*, su.email as user_email, su.full_name as user_name, su.phone as user_phone, su.created_at as user_created_at
       FROM supplier_profiles sp
       LEFT JOIN supplier_users su ON su.id = sp.supplier_user_id
       WHERE sp.id = ?`, [id]);
        const supplier = rows[0];
        if (!supplier)
            return res.status(404).json({ error: 'Supplier not found.' });
        const [products] = await database_1.default.execute('SELECT * FROM supplier_products WHERE supplier_profile_id = ? ORDER BY sort_order, id', [id]);
        const [catalogs] = await database_1.default.execute('SELECT * FROM supplier_catalogs WHERE supplier_profile_id = ? ORDER BY created_at DESC', [id]);
        const [projects] = await database_1.default.execute('SELECT * FROM supplier_projects WHERE supplier_profile_id = ? ORDER BY sort_order ASC, id DESC', [id]);
        res.json({ supplier, products, catalogs, projects });
    }
    catch (error) {
        console.error('Admin get supplier detail error:', error);
        res.status(500).json({ error: 'Failed to load supplier.' });
    }
}
async function updateSupplierStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status.' });
        }
        await database_1.default.execute('UPDATE supplier_profiles SET status = ? WHERE id = ?', [status, id]);
        await logSupplierAction(req, 'supplier_status_update', id, `供应商#${id} 状态→${status}`);
        res.json({ message: 'Status updated.' });
    }
    catch (error) {
        console.error('Admin update supplier status error:', error);
        res.status(500).json({ error: 'Failed to update status.' });
    }
}
async function updateSupplier(req, res) {
    try {
        const { id } = req.params;
        const fields = req.body;
        const allowed = [
            'company_name', 'name_zh', 'description', 'origin', 'categories', 'has_physical_store',
            'store_address', 'store_lat', 'store_lng', 'google_maps_url',
            'contact_phone', 'whatsapp', 'website', 'status', 'logo_url', 'cover_image_url',
        ];
        const sets = [];
        const values = [];
        for (const key of allowed) {
            if (key in fields) {
                sets.push(`${key} = ?`);
                let val = fields[key];
                if (key === 'categories' && Array.isArray(val))
                    val = JSON.stringify(val);
                values.push(val);
            }
        }
        if (sets.length === 0)
            return res.status(400).json({ error: 'No fields to update.' });
        values.push(id);
        await database_1.default.execute(`UPDATE supplier_profiles SET ${sets.join(', ')} WHERE id = ?`, values);
        await logSupplierAction(req, 'supplier_update', id, `编辑供应商#${id} 资料(${sets.length}项)`);
        res.json({ message: 'Supplier updated.' });
    }
    catch (error) {
        console.error('Admin update supplier error:', error);
        res.status(500).json({ error: 'Failed to update supplier.' });
    }
}
async function deleteSupplier(req, res) {
    try {
        const { id } = req.params;
        const requestedCountry = typeof req.body?.country === 'string' ? req.body.country : '';
        const country = req.admin?.role === 'super_admin' && ADMIN_SUPPLIER_COUNTRIES.has(requestedCountry)
            ? requestedCountry
            : (ADMIN_SUPPLIER_COUNTRIES.has(req.admin?.country) ? req.admin.country : null);
        // Get supplier_user_id
        const [rows] = await database_1.default.execute('SELECT supplier_user_id FROM supplier_profiles WHERE id = ? AND country = ?', [id, country]);
        const profile = rows[0];
        if (!profile)
            return res.status(404).json({ error: 'Supplier not found.' });
        // Cascade delete: products → catalogs → profile → user
        await database_1.default.execute('DELETE FROM supplier_products WHERE supplier_profile_id = ?', [id]);
        await database_1.default.execute('DELETE FROM supplier_catalogs WHERE supplier_profile_id = ?', [id]);
        await database_1.default.execute('DELETE FROM supplier_profiles WHERE id = ?', [id]);
        await database_1.default.execute('DELETE FROM supplier_users WHERE id = ?', [profile.supplier_user_id]);
        await logSupplierAction(req, 'supplier_delete', id, `删除供应商#${id}`, country);
        res.json({ message: 'Supplier deleted.' });
    }
    catch (error) {
        console.error('Admin delete supplier error:', error);
        res.status(500).json({ error: 'Failed to delete supplier.' });
    }
}
async function adminAddProduct(req, res) {
    try {
        const { id } = req.params;
        const [profileRows] = await database_1.default.execute('SELECT id FROM supplier_profiles WHERE id = ?', [id]);
        if (profileRows.length === 0)
            return res.status(404).json({ error: 'Supplier not found.' });
        const { title, description, category, image_url, sort_order, specs, certifications, application_scenes } = req.body;
        if (!image_url)
            return res.status(400).json({ error: 'image_url is required.' });
        // 新增时也落规格/认证/应用场景(与编辑一致);数组→JSON串(空→'[]'),未传→null
        const jarr = (x) => Array.isArray(x) ? JSON.stringify(x) : null;
        const parsedPrice = (0, productPriceRange_1.parseProductPrice)(req.body.price, 'price', { allowClear: true });
        const parsedPriceMax = (0, productPriceRange_1.parseProductPrice)(req.body.price_max, 'price_max', { allowClear: true });
        if (parsedPrice.kind === 'invalid' || parsedPriceMax.kind === 'invalid')
            return res.status(400).json({ error: parsedPrice.error || parsedPriceMax.error });
        const boundsError = (0, productPriceRange_1.validateProductPriceRange)(parsedPrice, parsedPriceMax);
        if (boundsError)
            return res.status(400).json({ error: boundsError });
        const priceCurrency = req.body.price_currency === undefined || req.body.price_currency === null
            ? null
            : SUPPORTED_PRICE_CURRENCIES.includes(req.body.price_currency) ? req.body.price_currency : null;
        const [result] = await database_1.default.execute('INSERT INTO supplier_products (supplier_profile_id, title, description, category, image_url, sort_order, price, price_max, price_unit, price_currency, price_from, specs, certifications, application_scenes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, title || null, description || null, category || null, image_url, sort_order ?? 0, parsedPrice.kind === 'valid' ? parsedPrice.value : null, parsedPriceMax.kind === 'valid' ? parsedPriceMax.value : null, req.body.price_unit || null, priceCurrency, req.body.price_from ? 1 : 0, jarr(specs), jarr(certifications), jarr(application_scenes)]);
        const [created] = await database_1.default.execute('SELECT * FROM supplier_products WHERE id = ?', [result.insertId]);
        await logSupplierAction(req, 'supplier_product_add', id, `供应商#${id} 新增商品#${result.insertId}`);
        res.status(201).json({ product: created[0] });
    }
    catch (error) {
        console.error('Admin add product error:', error);
        res.status(500).json({ error: 'Failed to add product.' });
    }
}
async function adminDeleteProduct(req, res) {
    try {
        const { id, productId } = req.params;
        const [rows] = await database_1.default.execute('SELECT id FROM supplier_products WHERE id = ? AND supplier_profile_id = ?', [productId, id]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Product not found.' });
        await database_1.default.execute('DELETE FROM supplier_products WHERE id = ?', [productId]);
        await logSupplierAction(req, 'supplier_product_delete', id, `供应商#${id} 删除商品#${productId}`);
        res.json({ message: 'Product deleted.' });
    }
    catch (error) {
        console.error('Admin delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
}
async function adminUpdateProduct(req, res) {
    let connection;
    try {
        const { id, productId } = req.params;
        connection = await database_1.default.getConnection();
        await connection.beginTransaction();
        // Controller-level harness hooks; Express clients cannot populate request object properties.
        await req.priceRangeTestHooks?.beforeLock?.();
        const [rows] = await connection.execute('SELECT id, price, price_max FROM supplier_products WHERE id = ? AND supplier_profile_id = ? FOR UPDATE', [productId, id]);
        await req.priceRangeTestHooks?.afterLock?.();
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Product not found.' });
        }
        const body = req.body || {};
        // 部分更新:只改本次传了 key 的字段。避免其它入口(如 SupplierEditModal 只传 title/category)清空 description/price 等。
        // 列名为硬编码白名单,仅值走参数化,无注入风险。
        const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
        const sets = [];
        const params = [];
        const effectivePriceValue = has('price') ? body.price : rows[0].price;
        const effectiveMaxValue = has('price_max') ? body.price_max : rows[0].price_max;
        const parsedPrice = (0, productPriceRange_1.parseProductPrice)(effectivePriceValue, 'price', { allowClear: true });
        const parsedPriceMax = (0, productPriceRange_1.parseProductPrice)(effectiveMaxValue, 'price_max', { allowClear: true });
        if (parsedPrice.kind === 'invalid' || parsedPriceMax.kind === 'invalid') {
            await connection.rollback();
            return res.status(400).json({ error: parsedPrice.error || parsedPriceMax.error });
        }
        const boundsError = (0, productPriceRange_1.validateProductPriceRange)(parsedPrice, parsedPriceMax);
        if (boundsError) {
            await connection.rollback();
            return res.status(400).json({ error: boundsError });
        }
        if (has('title')) {
            sets.push('title = ?');
            params.push(body.title?.trim() || null);
        }
        if (has('category')) {
            sets.push('category = ?');
            params.push(body.category || null);
        }
        if (has('description')) {
            sets.push('description = ?');
            params.push(body.description ?? null);
        }
        if (has('price')) {
            sets.push('price = ?');
            params.push(parsedPrice.kind === 'valid' ? parsedPrice.value : null);
        }
        if (has('price_max')) {
            sets.push('price_max = ?');
            params.push(parsedPriceMax.kind === 'valid' ? parsedPriceMax.value : null);
        }
        if (has('price_unit')) {
            sets.push('price_unit = ?');
            params.push(body.price_unit || null);
        }
        if (has('price_currency')) {
            // 白名单外一律落 null，展示层回落到国家默认币种（与 supplierProductController.normalizeCurrency 同源）
            sets.push('price_currency = ?');
            params.push(SUPPORTED_PRICE_CURRENCIES.includes(body.price_currency) ? body.price_currency : null);
        }
        if (has('price_from')) {
            sets.push('price_from = ?');
            params.push(body.price_from ? 1 : 0); // tinyint(1) 布尔,绝不 null
        }
        if (Array.isArray(body.specs)) {
            sets.push('specs = ?');
            params.push(JSON.stringify(body.specs));
        }
        if (Array.isArray(body.certifications)) {
            sets.push('certifications = ?');
            params.push(JSON.stringify(body.certifications));
        }
        if (Array.isArray(body.application_scenes)) {
            sets.push('application_scenes = ?');
            params.push(JSON.stringify(body.application_scenes));
        }
        if (sets.length > 0) {
            params.push(productId);
            await connection.execute(`UPDATE supplier_products SET ${sets.join(', ')} WHERE id = ?`, params);
        }
        const [updated] = await connection.execute('SELECT * FROM supplier_products WHERE id = ?', [productId]);
        await connection.commit();
        connection.release();
        connection = null;
        await logSupplierAction(req, 'supplier_product_update', id, `供应商#${id} 编辑商品#${productId}`);
        res.json({ product: updated[0] });
    }
    catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            }
            catch (rollbackError) {
                console.error('Admin update product rollback error:', rollbackError);
            }
        }
        console.error('Admin update product error:', error);
        res.status(500).json({ error: 'Failed to update product.' });
    }
    finally {
        if (connection)
            connection.release();
    }
}
/** Upload a single image file for use in a project; returns the stored URL. */
async function adminUploadProjectImage(req, res) {
    try {
        const supplierId = Number(req.params.id);
        if (!supplierId)
            return res.status(400).json({ error: 'invalid id' });
        if (!req.file?.buffer)
            return res.status(400).json({ error: 'no file uploaded' });
        const [supRows] = await database_1.default.execute('SELECT id, slug FROM supplier_profiles WHERE id = ?', [supplierId]);
        const sup = supRows[0];
        if (!sup)
            return res.status(404).json({ error: 'supplier not found' });
        const { buffer: processedBuffer, ext: processedExt } = await (0, imageVariants_1.processUploadedImage)(req.file.buffer);
        const ts = Date.now();
        const dirSlug = (sup.slug || `id${sup.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const relPath = `suppliers/${dirSlug}/projects/${ts}.${processedExt}`;
        const absPath = path_1.default.resolve(process.cwd(), 'public/uploads', relPath);
        await promises_1.default.mkdir(path_1.default.dirname(absPath), { recursive: true, mode: 0o755 });
        await promises_1.default.writeFile(absPath, processedBuffer, { mode: 0o644 });
        (0, variantWorker_1.enqueueVariants)(absPath);
        res.json({ url: `/uploads/${relPath}` });
    }
    catch (error) {
        console.error('Admin upload project image error:', error);
        res.status(500).json({ error: 'Failed to upload image.' });
    }
}
async function adminAddProject(req, res) {
    try {
        const supplierId = Number(req.params.id);
        const [supRows] = await database_1.default.execute('SELECT id FROM supplier_profiles WHERE id = ?', [supplierId]);
        if (supRows.length === 0)
            return res.status(404).json({ error: 'Supplier not found.' });
        const { title, description, location, area_sqm, budget, year, images } = req.body;
        if (!title?.trim())
            return res.status(400).json({ error: 'Title is required.' });
        const imgs = Array.isArray(images) ? images : [];
        const [result] = await database_1.default.execute(`INSERT INTO supplier_projects
         (supplier_profile_id, title, description, location, area_sqm, budget, year, images, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`, [
            supplierId,
            title.trim(),
            description?.trim() || null,
            location?.trim() || null,
            area_sqm ? Number(area_sqm) : null,
            budget?.trim() || null,
            year?.trim() || null,
            JSON.stringify(imgs),
        ]);
        const insertId = result.insertId;
        const [created] = await database_1.default.execute('SELECT * FROM supplier_projects WHERE id = ?', [insertId]);
        await logSupplierAction(req, 'supplier_project_add', supplierId, `供应商#${supplierId} 新增项目#${insertId}`);
        res.status(201).json({ project: created[0] });
    }
    catch (error) {
        console.error('Admin add project error:', error);
        res.status(500).json({ error: 'Failed to add project.' });
    }
}
async function adminUpdateProject(req, res) {
    try {
        const { id, projectId } = req.params;
        const [rows] = await database_1.default.execute('SELECT id FROM supplier_projects WHERE id = ? AND supplier_profile_id = ?', [projectId, id]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Project not found.' });
        const { title, description, location, area_sqm, budget, year, images } = req.body;
        if (!title?.trim())
            return res.status(400).json({ error: 'Title is required.' });
        const imgs = Array.isArray(images) ? images : [];
        await database_1.default.execute(`UPDATE supplier_projects
       SET title=?, description=?, location=?, area_sqm=?, budget=?, year=?, images=?
       WHERE id=?`, [
            title.trim(),
            description?.trim() || null,
            location?.trim() || null,
            area_sqm ? Number(area_sqm) : null,
            budget?.trim() || null,
            year?.trim() || null,
            JSON.stringify(imgs),
            projectId,
        ]);
        const [updated] = await database_1.default.execute('SELECT * FROM supplier_projects WHERE id = ?', [projectId]);
        await logSupplierAction(req, 'supplier_project_update', id, `供应商#${id} 编辑项目#${projectId}`);
        res.json({ project: updated[0] });
    }
    catch (error) {
        console.error('Admin update project error:', error);
        res.status(500).json({ error: 'Failed to update project.' });
    }
}
async function adminDeleteProject(req, res) {
    try {
        const { id, projectId } = req.params;
        const [rows] = await database_1.default.execute('SELECT id FROM supplier_projects WHERE id = ? AND supplier_profile_id = ?', [projectId, id]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Project not found.' });
        await database_1.default.execute('DELETE FROM supplier_projects WHERE id = ?', [projectId]);
        await logSupplierAction(req, 'supplier_project_delete', id, `供应商#${id} 删除项目#${projectId}`);
        res.json({ message: 'Project deleted.' });
    }
    catch (error) {
        console.error('Admin delete project error:', error);
        res.status(500).json({ error: 'Failed to delete project.' });
    }
}
async function setSupplierHomeOrder(req, res) {
    try {
        const id = Number(req.params.id);
        if (!id)
            return res.status(400).json({ error: 'invalid id' });
        const value = parseInt(req.body?.home_display_order) || 0;
        const [rows] = await database_1.default.execute('SELECT id FROM supplier_profiles WHERE id = ?', [id]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Supplier not found.' });
        if (value > 0) {
            await database_1.default.execute('UPDATE supplier_profiles SET home_display_order = 0 WHERE home_display_order = ? AND id != ?', [value, id]);
        }
        await database_1.default.execute('UPDATE supplier_profiles SET home_display_order = ? WHERE id = ?', [value, id]);
        await logSupplierAction(req, 'supplier_home_order', id, `供应商#${id} 首页排序→${value}`);
        res.json({ id, home_display_order: value });
    }
    catch (error) {
        console.error('Set supplier home order error:', error);
        res.status(500).json({ error: 'Failed to update home display order.' });
    }
}
async function setSupplierListOrder(req, res) {
    try {
        const id = Number(req.params.id);
        if (!id)
            return res.status(400).json({ error: 'invalid id' });
        const value = parseInt(req.body?.list_display_order) || 0;
        const [rows] = await database_1.default.execute('SELECT id FROM supplier_profiles WHERE id = ?', [id]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Supplier not found.' });
        if (value > 0) {
            await database_1.default.execute('UPDATE supplier_profiles SET list_display_order = 0 WHERE list_display_order = ? AND id != ?', [value, id]);
        }
        await database_1.default.execute('UPDATE supplier_profiles SET list_display_order = ? WHERE id = ?', [value, id]);
        await logSupplierAction(req, 'supplier_list_order', id, `供应商#${id} 列表排序→${value}`);
        res.json({ id, list_display_order: value });
    }
    catch (error) {
        console.error('Set supplier list order error:', error);
        res.status(500).json({ error: 'Failed to update list display order.' });
    }
}
// PUT /admin/suppliers/:id/toggle-published
async function toggleSupplierPublished(req, res) {
    try {
        const { id } = req.params;
        const { is_published } = req.body;
        if (is_published) {
            // 首次上架记录 published_at；再次上架(曾下架)保留首次时间,不覆盖(COALESCE)
            await database_1.default.execute('UPDATE supplier_profiles SET is_published = 1, published_at = COALESCE(published_at, NOW()) WHERE id = ?', [id]);
        }
        else {
            await database_1.default.execute('UPDATE supplier_profiles SET is_published = 0 WHERE id = ?', [id]);
        }
        await logSupplierAction(req, 'supplier_toggle_published', id, `供应商#${id} ${is_published ? '上架' : '下架'}`);
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Toggle supplier published error:', error);
        res.status(500).json({ error: 'Failed to update published status.' });
    }
}
// PUT /admin/suppliers/:id/projects/:projectId/toggle-published
async function toggleSupplierProjectPublished(req, res) {
    try {
        const { id, projectId } = req.params;
        const { is_published } = req.body;
        const [rows] = await database_1.default.execute('SELECT id FROM supplier_projects WHERE id = ? AND supplier_profile_id = ?', [projectId, id]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Project not found.' });
        await database_1.default.execute('UPDATE supplier_projects SET is_published = ? WHERE id = ?', [is_published ? 1 : 0, projectId]);
        await logSupplierAction(req, 'supplier_project_toggle_published', id, `供应商#${id} 项目#${projectId} ${is_published ? '发布' : '取消发布'}`);
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Toggle supplier project published error:', error);
        res.status(500).json({ error: 'Failed to update project published status.' });
    }
}
// 供应商上架报表：按日期范围统计当天上架了几家 + 按「号」(supplier_user 账号) 分组哪个号传了哪几家。
// 国家隔离：WHERE sp.country=?（admin 传当前 country）。
// "上架"=已发布(is_published=1)，时间按 published_at(首次发布上架时刻,toggleSupplierPublished 里写入)——
// 团队常先批量开号、之后每天挑老号填资料+发布上架，published_at 精确记录上架当天且不随后续编辑漂移。
// COALESCE(published_at, updated_at) 兜底历史行(回填前 published_at 为 NULL 时退回 updated_at)。
async function getSupplierReport(req, res) {
    try {
        const country = req.query.country || req.country || 'ae';
        const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
        let from = isDate(req.query.from) ? req.query.from : new Date().toISOString().slice(0, 10);
        let to = isDate(req.query.to) ? req.query.to : from;
        if (from > to) { const tmp = from; from = to; to = tmp; } // 直连 API 可能传反,保证 from<=to
        const [rows] = await database_1.default.execute(`SELECT sp.id, sp.company_name, sp.name_zh, sp.categories, sp.status, sp.is_published, sp.source, sp.created_at, sp.updated_at, sp.published_at,
                COALESCE(sp.published_at, sp.updated_at) AS listed_ts,
                DATE_FORMAT(COALESCE(sp.published_at, sp.updated_at), '%Y-%m-%d') AS listed_date,
                sp.supplier_user_id, su.email AS account_email, su.full_name AS account_name
         FROM supplier_profiles sp
         LEFT JOIN supplier_users su ON su.id = sp.supplier_user_id
         WHERE sp.country = ? AND sp.is_published = 1 AND DATE(COALESCE(sp.published_at, sp.updated_at)) BETWEEN ? AND ?
         ORDER BY COALESCE(sp.published_at, sp.updated_at) DESC, sp.id DESC`, [country, from, to]);
        // 按天统计（用 DB 格式化的日期，避免时区漂移）
        const byDayMap = {};
        for (const r of rows)
            byDayMap[r.listed_date] = (byDayMap[r.listed_date] || 0) + 1;
        const byDay = Object.entries(byDayMap).map(([date, count]) => ({ date, count })).sort((a, b) => (a.date < b.date ? 1 : -1));
        // 扁平表格：一行一家（含「号」=供应商账号 email）。已按 updated_at DESC 排序。
        const parseArr = (v) => { if (Array.isArray(v)) return v; if (!v) return []; try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
        const suppliers = rows.map(r => ({
            id: r.id, company_name: r.company_name, name_zh: r.name_zh,
            categories: parseArr(r.categories), status: r.status, is_published: r.is_published,
            listed_at: r.listed_ts,
            account_id: r.supplier_user_id, account_email: r.account_email || null, account_name: r.account_name || null,
        }));
        res.json({ from, to, country, total: rows.length, byDay, suppliers });
    }
    catch (error) {
        console.error('getSupplierReport error:', error);
        res.status(500).json({ error: 'Failed to load supplier report.' });
    }
}
