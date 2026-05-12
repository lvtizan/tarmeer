import pool from '../config/database';
import fs from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { enqueueVariants } from '../lib/variantWorker';

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
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file data provided.' });
    const mimeType = file.mimetype;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowed.includes(mimeType) && !mimeType.startsWith('image/')) {
      return res.status(400).json({ error: 'Only PDF and image files are allowed.' });
    }
    const extMap: Record<string, string> = {
      'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
      'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
    };
    const ext = extMap[mimeType] || 'bin';
    const fileName = `${userId}-${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs');
    await fs.mkdir(uploadDir, { recursive: true, mode: 0o755 });
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, file.buffer, { mode: 0o644 });
    if (mimeType.startsWith('image/')) enqueueVariants(filePath);
    const originalName = req.body.original_name || file.originalname || '';
    const baseName = originalName ? path.basename(originalName, path.extname(originalName)) : '';
    res.json({ url: `/uploads/suppliers/catalogs/${fileName}`, original_name: baseName });
  } catch (error) {
    console.error('Upload catalog file error:', error);
    res.status(500).json({ error: 'Failed to upload file.' });
  }
}

export async function uploadCatalogChunk(req: any, res: any) {
  try {
    const userId = req.supplierUser.id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No chunk data.' });

    const { upload_id, chunk_index, total_chunks, original_name } = req.body;
    if (!upload_id || chunk_index === undefined || !total_chunks) {
      return res.status(400).json({ error: 'Missing chunk metadata.' });
    }

    const chunkDir = path.join(os.tmpdir(), 'tarmeer-chunks', upload_id);
    await fs.mkdir(chunkDir, { recursive: true });
    await fs.writeFile(path.join(chunkDir, `chunk_${chunk_index}`), file.buffer);

    const idx = parseInt(chunk_index, 10);
    const total = parseInt(total_chunks, 10);

    if (idx < total - 1) {
      return res.json({ done: false });
    }

    // Last chunk received — assemble
    const ext = original_name ? path.extname(original_name).replace('.', '') || 'bin' : 'bin';
    const fileName = `${userId}-${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'suppliers', 'catalogs');
    await fs.mkdir(uploadDir, { recursive: true, mode: 0o755 });
    const finalPath = path.join(uploadDir, fileName);

    const ws = createWriteStream(finalPath);
    for (let i = 0; i < total; i++) {
      const buf = await fs.readFile(path.join(chunkDir, `chunk_${i}`));
      await new Promise<void>((resolve, reject) => { ws.write(buf, err => err ? reject(err) : resolve()); });
    }
    await new Promise<void>(resolve => ws.end(resolve));
    await fs.chmod(finalPath, 0o644);
    await fs.rm(chunkDir, { recursive: true, force: true });

    const baseName = original_name ? path.basename(original_name, path.extname(original_name)) : '';
    res.json({ done: true, url: `/uploads/suppliers/catalogs/${fileName}`, original_name: baseName });
  } catch (error) {
    console.error('Upload catalog chunk error:', error);
    res.status(500).json({ error: 'Failed to process chunk.' });
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
