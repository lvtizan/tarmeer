import pool from '../config/database';
import path from 'path';
import fs from 'fs/promises';

/**
 * 管理员替换 catalog PDF 文件 —— 用于"把联系方式打白后回写"工作流。
 * multipart/form-data，字段名 file。保存到 public/uploads/catalogs/redacted/<supplier_id>/<id>.pdf，
 * UPDATE supplier_catalogs.file_url 指向新路径。
 */
export async function adminReplaceCatalogFile(req: any, res: any) {
  try {
    const catalogId = Number(req.params.id);
    if (!catalogId) return res.status(400).json({ error: 'invalid catalog id' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'no file uploaded' });

    const [rows] = await pool.execute(
      'SELECT id, supplier_profile_id, file_url FROM supplier_catalogs WHERE id = ?',
      [catalogId],
    );
    const cat = (rows as any[])[0];
    if (!cat) return res.status(404).json({ error: 'catalog not found' });

    const supplierId = cat.supplier_profile_id;
    const relPath = `catalogs/redacted/${supplierId}/${catalogId}.pdf`;
    const absPath = path.resolve(process.cwd(), 'public/uploads', relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, req.file.buffer, { mode: 0o644 });

    const newUrl = `/uploads/${relPath}`;
    await pool.execute(
      'UPDATE supplier_catalogs SET file_url = ? WHERE id = ?',
      [newUrl, catalogId],
    );

    res.json({ id: catalogId, file_url: newUrl, file_size: req.file.size });
  } catch (error) {
    console.error('Admin replace catalog file error:', error);
    res.status(500).json({ error: 'Failed to replace catalog file.' });
  }
}

/**
 * 管理员替换某个供应商产品的封面图。multipart/form-data，字段名 file。
 * 保存到 public/uploads/suppliers/<slug 或 id>/photos/<productId>_<ts>.<ext>，
 * UPDATE supplier_products.image_url 指向新路径。
 */
export async function adminReplaceProductImage(req: any, res: any) {
  try {
    const supplierId = Number(req.params.id);
    const productId = Number(req.params.productId);
    if (!supplierId || !productId) return res.status(400).json({ error: 'invalid id' });
    if (!req.file?.buffer) return res.status(400).json({ error: 'no file uploaded' });

    const [supRows] = await pool.execute(
      'SELECT id, slug FROM supplier_profiles WHERE id = ?', [supplierId]);
    const sup = (supRows as any[])[0];
    if (!sup) return res.status(404).json({ error: 'supplier not found' });

    const [prodRows] = await pool.execute(
      'SELECT id FROM supplier_products WHERE id = ? AND supplier_profile_id = ?',
      [productId, supplierId]);
    if ((prodRows as any[]).length === 0) return res.status(404).json({ error: 'product not found' });

    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    };
    const ext = mimeToExt[req.file.mimetype] || 'jpg';
    const ts = Date.now();
    const dirSlug = (sup.slug || `id${sup.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const relPath = `suppliers/${dirSlug}/photos/${productId}_${ts}.${ext}`;
    const absPath = path.resolve(process.cwd(), 'public/uploads', relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, req.file.buffer, { mode: 0o644 });

    const newUrl = `/uploads/${relPath}`;
    await pool.execute(
      'UPDATE supplier_products SET image_url = ? WHERE id = ?', [newUrl, productId]);

    res.json({ id: productId, image_url: newUrl });
  } catch (error) {
    console.error('Admin replace product image error:', error);
    res.status(500).json({ error: 'Failed to replace product image.' });
  }
}

export async function listSuppliers(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const origin = req.query.origin;
    const search = req.query.search;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status) { where += ' AND sp.status = ?'; params.push(status); }
    if (origin) { where += ' AND sp.origin = ?'; params.push(origin); }
    if (search) { where += ' AND (sp.company_name LIKE ? OR su.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM supplier_profiles sp JOIN supplier_users su ON su.id = sp.supplier_user_id ${where}`,
      params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.query(
      `SELECT sp.*, su.email as user_email, su.full_name as user_name,
              (SELECT COUNT(*) FROM supplier_products WHERE supplier_profile_id = sp.id) as product_count,
              (SELECT COUNT(*) FROM supplier_catalogs WHERE supplier_profile_id = sp.id) as catalog_count
       FROM supplier_profiles sp
       JOIN supplier_users su ON su.id = sp.supplier_user_id
       ${where}
       ORDER BY sp.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({ suppliers: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('Admin list suppliers error:', error);
    res.status(500).json({ error: 'Failed to load suppliers.' });
  }
}

export async function getSupplierDetail(req: any, res: any) {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      `SELECT sp.*, su.email as user_email, su.full_name as user_name, su.phone as user_phone, su.created_at as user_created_at
       FROM supplier_profiles sp
       JOIN supplier_users su ON su.id = sp.supplier_user_id
       WHERE sp.id = ?`,
      [id]
    );
    const supplier = (rows as any[])[0];
    if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

    const [products] = await pool.execute(
      'SELECT * FROM supplier_products WHERE supplier_profile_id = ? ORDER BY sort_order, id', [id]
    );
    const [catalogs] = await pool.execute(
      'SELECT * FROM supplier_catalogs WHERE supplier_profile_id = ? ORDER BY created_at DESC', [id]
    );
    const [projects] = await pool.execute(
      'SELECT * FROM supplier_projects WHERE supplier_profile_id = ? ORDER BY sort_order ASC, id DESC', [id]
    );

    res.json({ supplier, products, catalogs, projects });
  } catch (error) {
    console.error('Admin get supplier detail error:', error);
    res.status(500).json({ error: 'Failed to load supplier.' });
  }
}

export async function updateSupplierStatus(req: any, res: any) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    await pool.execute('UPDATE supplier_profiles SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: 'Status updated.' });
  } catch (error) {
    console.error('Admin update supplier status error:', error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
}

export async function updateSupplier(req: any, res: any) {
  try {
    const { id } = req.params;
    const fields = req.body;
    const allowed = [
      'company_name', 'description', 'origin', 'categories', 'has_physical_store',
      'store_address', 'store_lat', 'store_lng', 'google_maps_url',
      'contact_phone', 'whatsapp', 'website', 'status', 'logo_url', 'cover_image_url',
    ];
    const sets: string[] = [];
    const values: any[] = [];

    for (const key of allowed) {
      if (key in fields) {
        sets.push(`${key} = ?`);
        let val = fields[key];
        if (key === 'categories' && Array.isArray(val)) val = JSON.stringify(val);
        values.push(val);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    values.push(id);
    await pool.execute(`UPDATE supplier_profiles SET ${sets.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Supplier updated.' });
  } catch (error) {
    console.error('Admin update supplier error:', error);
    res.status(500).json({ error: 'Failed to update supplier.' });
  }
}

export async function deleteSupplier(req: any, res: any) {
  try {
    const { id } = req.params;

    // Get supplier_user_id
    const [rows] = await pool.execute('SELECT supplier_user_id FROM supplier_profiles WHERE id = ?', [id]);
    const profile = (rows as any[])[0];
    if (!profile) return res.status(404).json({ error: 'Supplier not found.' });

    // Cascade delete: products → catalogs → profile → user
    await pool.execute('DELETE FROM supplier_products WHERE supplier_profile_id = ?', [id]);
    await pool.execute('DELETE FROM supplier_catalogs WHERE supplier_profile_id = ?', [id]);
    await pool.execute('DELETE FROM supplier_profiles WHERE id = ?', [id]);
    await pool.execute('DELETE FROM supplier_users WHERE id = ?', [profile.supplier_user_id]);

    res.json({ message: 'Supplier deleted.' });
  } catch (error) {
    console.error('Admin delete supplier error:', error);
    res.status(500).json({ error: 'Failed to delete supplier.' });
  }
}

export async function adminAddProduct(req: any, res: any) {
  try {
    const { id } = req.params;
    const [profileRows] = await pool.execute('SELECT id FROM supplier_profiles WHERE id = ?', [id]);
    if ((profileRows as any[]).length === 0) return res.status(404).json({ error: 'Supplier not found.' });

    const { title, description, category, image_url, sort_order } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url is required.' });

    const [result] = await pool.execute(
      'INSERT INTO supplier_products (supplier_profile_id, title, description, category, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [id, title || null, description || null, category || null, image_url, sort_order ?? 0]
    );
    const [created] = await pool.execute('SELECT * FROM supplier_products WHERE id = ?', [(result as any).insertId]);
    res.status(201).json({ product: (created as any[])[0] });
  } catch (error) {
    console.error('Admin add product error:', error);
    res.status(500).json({ error: 'Failed to add product.' });
  }
}

export async function adminDeleteProduct(req: any, res: any) {
  try {
    const { id, productId } = req.params;
    const [rows] = await pool.execute(
      'SELECT id FROM supplier_products WHERE id = ? AND supplier_profile_id = ?',
      [productId, id]
    );
    if ((rows as any[]).length === 0) return res.status(404).json({ error: 'Product not found.' });

    await pool.execute('DELETE FROM supplier_products WHERE id = ?', [productId]);
    res.json({ message: 'Product deleted.' });
  } catch (error) {
    console.error('Admin delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
}
