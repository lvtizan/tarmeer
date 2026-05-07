import pool from '../config/database';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

async function getProfileId(supplierUserId: number): Promise<number | null> {
  const [rows] = await pool.execute(
    'SELECT id FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1',
    [supplierUserId]
  );
  return (rows as any[])[0]?.id || null;
}

export async function uploadCatalogFile(req: any, res: any) {
  try {
    const userId = req.supplierUser.id;
    const { data_url, original_name } = req.body;
    if (!data_url) return res.status(400).json({ error: 'No file data provided.' });
    const matches = data_url.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid file format.' });
    const mimeType = matches[1];
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowed.includes(mimeType) && !mimeType.startsWith('image/')) {
      return res.status(400).json({ error: 'Only PDF and image files are allowed.' });
    }
    const extMap: Record<string, string> = {
      'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
      'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    };
    const ext = extMap[mimeType] || 'bin';
    const buffer = Buffer.from(matches[2], 'base64');
    const fileName = `${userId}-${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs');
    await fs.mkdir(uploadDir, { recursive: true, mode: 0o755 });
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer, { mode: 0o644 });
    const baseName = original_name ? path.basename(original_name, path.extname(original_name)) : '';
    res.json({ url: `/uploads/suppliers/catalogs/${fileName}`, original_name: baseName });
  } catch (error) {
    console.error('Upload catalog file error:', error);
    res.status(500).json({ error: 'Failed to upload file.' });
  }
}

export async function listCatalogs(req: any, res: any) {
  try {
    const { slug } = req.params;
    const [profileRows] = await pool.execute(
      "SELECT id FROM supplier_profiles WHERE slug = ? AND status = 'approved'",
      [slug]
    );
    const profile = (profileRows as any[])[0];
    if (!profile) return res.status(404).json({ error: 'Supplier not found.' });

    const [catalogs] = await pool.execute(
      'SELECT * FROM supplier_catalogs WHERE supplier_profile_id = ? ORDER BY created_at DESC',
      [profile.id]
    );
    res.json({ catalogs });
  } catch (error) {
    console.error('List catalogs error:', error);
    res.status(500).json({ error: 'Failed to load catalogs.' });
  }
}

export async function listMyCatalogs(req: any, res: any) {
  try {
    const profileId = await getProfileId(req.supplierUser.id);
    if (!profileId) return res.json({ catalogs: [] });
    const [catalogs] = await pool.execute(
      'SELECT * FROM supplier_catalogs WHERE supplier_profile_id = ? ORDER BY created_at DESC',
      [profileId]
    );
    res.json({ catalogs });
  } catch (error) {
    console.error('List my catalogs error:', error);
    res.status(500).json({ error: 'Failed to load catalogs.' });
  }
}

export async function uploadCatalog(req: any, res: any) {
  try {
    const profileId = await getProfileId(req.supplierUser.id);
    if (!profileId) return res.status(400).json({ error: 'Create your profile first.' });

    const { title, file_url, file_size } = req.body;
    if (!title || !file_url) return res.status(400).json({ error: 'Title and file URL are required.' });

    const [result] = await pool.execute(
      'INSERT INTO supplier_catalogs (supplier_profile_id, title, file_url, file_size) VALUES (?, ?, ?, ?)',
      [profileId, title, file_url, file_size || null]
    );
    const id = (result as any).insertId;
    const [created] = await pool.execute('SELECT * FROM supplier_catalogs WHERE id = ?', [id]);
    res.status(201).json({ catalog: (created as any[])[0] });
  } catch (error) {
    console.error('Upload catalog error:', error);
    res.status(500).json({ error: 'Failed to upload catalog.' });
  }
}

export async function deleteCatalog(req: any, res: any) {
  try {
    const profileId = await getProfileId(req.supplierUser.id);
    if (!profileId) return res.status(403).json({ error: 'Forbidden.' });

    const { id } = req.params;
    const [existing] = await pool.execute(
      'SELECT id FROM supplier_catalogs WHERE id = ? AND supplier_profile_id = ?',
      [id, profileId]
    );
    if ((existing as any[]).length === 0) return res.status(404).json({ error: 'Catalog not found.' });

    await pool.execute('DELETE FROM supplier_catalogs WHERE id = ?', [id]);
    res.json({ message: 'Catalog deleted.' });
  } catch (error) {
    console.error('Delete catalog error:', error);
    res.status(500).json({ error: 'Failed to delete catalog.' });
  }
}
