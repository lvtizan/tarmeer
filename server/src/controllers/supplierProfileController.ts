import pool from '../config/database';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export async function uploadLicense(req: any, res: any) {
  try {
    const userId = req.supplierUser.id;
    const { data_url } = req.body;
    if (!data_url) return res.status(400).json({ error: 'No file data provided.' });
    const matches = data_url.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid file format.' });
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/gif': 'gif', 'application/pdf': 'pdf',
    };
    const ext = extMap[mimeType] || 'bin';
    const fileName = `${userId}-${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'suppliers', 'licenses');
    await fs.mkdir(uploadDir, { recursive: true, mode: 0o755 });
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer, { mode: 0o644 });
    res.json({ url: `/uploads/suppliers/licenses/${fileName}` });
  } catch (error) {
    console.error('Upload license error:', error);
    res.status(500).json({ error: 'Failed to upload file.' });
  }
}

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
       ORDER BY sp.sort_order ASC, sp.created_at DESC
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
      company_name, description, origin, categories, cover_image_url, license_url,
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
          company_name=?, description=?, origin=?, categories=?, cover_image_url=?, license_url=?,
          has_physical_store=?, store_address=?, store_lat=?, store_lng=?, google_maps_url=?,
          contact_phone=?, whatsapp=?, website=?
         WHERE id=?`,
        [
          company_name, description || '', origin || 'china', cats, cover_image_url || null, license_url || null,
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
          (supplier_user_id, company_name, slug, description, origin, categories, cover_image_url, license_url,
           has_physical_store, store_address, store_lat, store_lng, google_maps_url,
           contact_phone, whatsapp, website)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, company_name, slug, description || '', origin || 'china', cats, cover_image_url || null, license_url || null,
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
