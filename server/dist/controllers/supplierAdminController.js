"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRenameCatalog = adminRenameCatalog;
exports.adminReplaceCatalogFile = adminReplaceCatalogFile;
exports.adminReplaceProductImage = adminReplaceProductImage;
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
const database_1 = __importDefault(require("../config/database"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const variantWorker_1 = require("../lib/variantWorker");
const imageVariants_1 = require("../lib/imageVariants");
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
        res.json({ id: catalogId, file_url: newUrl, file_size: req.file.size });
    }
    catch (error) {
        console.error('Admin replace catalog file error:', error);
        res.status(500).json({ error: 'Failed to replace catalog file.' });
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
        const search = req.query.search;
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
        if (search) {
            where += ' AND (sp.company_name LIKE ? OR su.email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        const [countRows] = await database_1.default.execute(`SELECT COUNT(*) as total FROM supplier_profiles sp LEFT JOIN supplier_users su ON su.id = sp.supplier_user_id ${where}`, params);
        const total = countRows[0].total;
        // 合作方同步统计（按国家全量，不受分页/状态筛选影响）
        const [partnerRows] = await database_1.default.execute(`SELECT COUNT(*) as pc FROM supplier_profiles WHERE country = ? AND source = 'partner'`, [country]);
        const partnerCount = partnerRows[0].pc;
        const [rows] = await database_1.default.query(`SELECT sp.*, su.email as user_email, su.full_name as user_name,
              (SELECT COUNT(*) FROM supplier_products WHERE supplier_profile_id = sp.id) as product_count,
              (SELECT COUNT(*) FROM supplier_catalogs WHERE supplier_profile_id = sp.id) as catalog_count
       FROM supplier_profiles sp
       LEFT JOIN supplier_users su ON su.id = sp.supplier_user_id
       ${where}
       ORDER BY CASE WHEN GREATEST(COALESCE(sp.home_display_order,0), COALESCE(sp.list_display_order,0)) > 0 THEN 0 ELSE 1 END,
                LEAST(CASE WHEN sp.home_display_order > 0 THEN sp.home_display_order ELSE 999999 END,
                      CASE WHEN sp.list_display_order > 0 THEN sp.list_display_order ELSE 999999 END) ASC,
                sp.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`, params);
        res.json({ suppliers: rows, partnerCount, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
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
            'company_name', 'description', 'origin', 'categories', 'has_physical_store',
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
        // Get supplier_user_id
        const [rows] = await database_1.default.execute('SELECT supplier_user_id FROM supplier_profiles WHERE id = ?', [id]);
        const profile = rows[0];
        if (!profile)
            return res.status(404).json({ error: 'Supplier not found.' });
        // Cascade delete: products → catalogs → profile → user
        await database_1.default.execute('DELETE FROM supplier_products WHERE supplier_profile_id = ?', [id]);
        await database_1.default.execute('DELETE FROM supplier_catalogs WHERE supplier_profile_id = ?', [id]);
        await database_1.default.execute('DELETE FROM supplier_profiles WHERE id = ?', [id]);
        await database_1.default.execute('DELETE FROM supplier_users WHERE id = ?', [profile.supplier_user_id]);
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
        const { title, description, category, image_url, sort_order } = req.body;
        if (!image_url)
            return res.status(400).json({ error: 'image_url is required.' });
        const [result] = await database_1.default.execute('INSERT INTO supplier_products (supplier_profile_id, title, description, category, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [id, title || null, description || null, category || null, image_url, sort_order ?? 0]);
        const [created] = await database_1.default.execute('SELECT * FROM supplier_products WHERE id = ?', [result.insertId]);
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
        res.json({ message: 'Product deleted.' });
    }
    catch (error) {
        console.error('Admin delete product error:', error);
        res.status(500).json({ error: 'Failed to delete product.' });
    }
}
async function adminUpdateProduct(req, res) {
    try {
        const { id, productId } = req.params;
        const [rows] = await database_1.default.execute('SELECT id FROM supplier_products WHERE id = ? AND supplier_profile_id = ?', [productId, id]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Product not found.' });
        const { title, category } = req.body;
        await database_1.default.execute('UPDATE supplier_products SET title = ?, category = ? WHERE id = ?', [title?.trim() || null, category || null, productId]);
        const [updated] = await database_1.default.execute('SELECT * FROM supplier_products WHERE id = ?', [productId]);
        res.json({ product: updated[0] });
    }
    catch (error) {
        console.error('Admin update product error:', error);
        res.status(500).json({ error: 'Failed to update product.' });
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
        await database_1.default.execute('UPDATE supplier_profiles SET is_published = ? WHERE id = ?', [is_published ? 1 : 0, id]);
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
        res.json({ ok: true });
    }
    catch (error) {
        console.error('Toggle supplier project published error:', error);
        res.status(500).json({ error: 'Failed to update project published status.' });
    }
}
