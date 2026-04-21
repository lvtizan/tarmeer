import pool from '../config/database';

function slugify(name: string): string {
  return name.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function listPublicSuppliers(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const origin = req.query.origin; // 'china' | 'dubai'
    const category = req.query.category;

    let where = "WHERE sp.status = 'approved'";
    const params: any[] = [];

    if (origin && (origin === 'china' || origin === 'dubai')) {
      where += ' AND sp.origin = ?';
      params.push(origin);
    }
    if (category) {
      where += ' AND JSON_CONTAINS(sp.categories, ?)';
      params.push(JSON.stringify(category));
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM supplier_profiles sp ${where}`, params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.query(
      `SELECT sp.*, su.email as user_email
       FROM supplier_profiles sp
       JOIN supplier_users su ON su.id = sp.supplier_user_id
       ${where}
       ORDER BY sp.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({ suppliers: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('List suppliers error:', error);
    res.status(500).json({ error: 'Failed to load suppliers.' });
  }
}

export async function getPublicProfile(req: any, res: any) {
  try {
    const { slug } = req.params;
    const [rows] = await pool.execute(
      `SELECT sp.*, su.email as user_email, su.full_name as user_name
       FROM supplier_profiles sp
       JOIN supplier_users su ON su.id = sp.supplier_user_id
       WHERE sp.slug = ? AND sp.status = 'approved'`,
      [slug]
    );
    const supplier = (rows as any[])[0];
    if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

    // Get products
    const [products] = await pool.execute(
      'SELECT * FROM supplier_products WHERE supplier_profile_id = ? ORDER BY sort_order, id',
      [supplier.id]
    );

    // Get catalogs
    const [catalogs] = await pool.execute(
      'SELECT * FROM supplier_catalogs WHERE supplier_profile_id = ? ORDER BY created_at DESC',
      [supplier.id]
    );

    res.json({ supplier, products, catalogs });
  } catch (error) {
    console.error('Get supplier profile error:', error);
    res.status(500).json({ error: 'Failed to load supplier.' });
  }
}

export async function getMyProfile(req: any, res: any) {
  try {
    const userId = req.supplierUser.id;
    const [rows] = await pool.execute(
      'SELECT * FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1',
      [userId]
    );
    const profile = (rows as any[])[0] || null;
    res.json({ profile });
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
}

export async function upsertProfile(req: any, res: any) {
  try {
    const userId = req.supplierUser.id;
    const {
      company_name, description, origin, categories,
      has_physical_store, store_address, store_lat, store_lng, google_maps_url,
      contact_phone, whatsapp, website,
    } = req.body;

    if (!company_name) return res.status(400).json({ error: 'Company name is required.' });

    const [existing] = await pool.execute(
      'SELECT id, slug FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1',
      [userId]
    );
    const existingProfile = (existing as any[])[0];

    const cats = Array.isArray(categories) ? JSON.stringify(categories) : categories || '[]';

    if (existingProfile) {
      await pool.execute(
        `UPDATE supplier_profiles SET
          company_name=?, description=?, origin=?, categories=?,
          has_physical_store=?, store_address=?, store_lat=?, store_lng=?, google_maps_url=?,
          contact_phone=?, whatsapp=?, website=?
         WHERE id=?`,
        [
          company_name, description || '', origin || 'china', cats,
          has_physical_store ? 1 : 0, store_address || null, store_lat || null, store_lng || null, google_maps_url || null,
          contact_phone || null, whatsapp || null, website || null,
          existingProfile.id,
        ]
      );
      const [updated] = await pool.execute('SELECT * FROM supplier_profiles WHERE id = ?', [existingProfile.id]);
      res.json({ profile: (updated as any[])[0] });
    } else {
      let slug = slugify(company_name);
      // Ensure unique slug
      const [slugCheck] = await pool.execute('SELECT id FROM supplier_profiles WHERE slug = ?', [slug]);
      if ((slugCheck as any[]).length > 0) slug += `-${Date.now()}`;

      await pool.execute(
        `INSERT INTO supplier_profiles
          (supplier_user_id, company_name, slug, description, origin, categories,
           has_physical_store, store_address, store_lat, store_lng, google_maps_url,
           contact_phone, whatsapp, website)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, company_name, slug, description || '', origin || 'china', cats,
          has_physical_store ? 1 : 0, store_address || null, store_lat || null, store_lng || null, google_maps_url || null,
          contact_phone || null, whatsapp || null, website || null,
        ]
      );
      const [created] = await pool.execute('SELECT * FROM supplier_profiles WHERE supplier_user_id = ?', [userId]);
      res.status(201).json({ profile: (created as any[])[0] });
    }
  } catch (error) {
    console.error('Upsert supplier profile error:', error);
    res.status(500).json({ error: 'Failed to save profile.' });
  }
}
