import pool from '../config/database';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export async function uploadProductImage(req: any, res: any) {
  try {
    const userId = req.supplierUser.id;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No image data provided.' });
    const mimeType = file.mimetype;
    if (!mimeType.startsWith('image/')) return res.status(400).json({ error: 'Only images allowed.' });
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
      'image/webp': 'webp', 'image/gif': 'gif',
    };
    const ext = extMap[mimeType] || 'jpg';
    const buffer = file.buffer;
    const fileName = `${userId}-${randomUUID()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'suppliers', 'products');
    await fs.mkdir(uploadDir, { recursive: true, mode: 0o755 });
    const filePath = path.join(uploadDir, fileName);
    await fs.writeFile(filePath, buffer, { mode: 0o644 });
    res.json({ url: `/uploads/suppliers/products/${fileName}` });
  } catch (error) {
    console.error('Upload product image error:', error);
    res.status(500).json({ error: 'Failed to upload image.' });
  }
}

async function getProfileId(supplierUserId: number): Promise<number | null> {
  const [rows] = await pool.execute(
    'SELECT id FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1',
    [supplierUserId]
  );
  return (rows as any[])[0]?.id || null;
}

export async function listProducts(req: any, res: any) {
  try {
    const { slug } = req.params;
    const [profileRows] = await pool.execute(
      "SELECT id FROM supplier_profiles WHERE slug = ? AND status = 'approved'",
      [slug]
    );
    const profile = (profileRows as any[])[0];
    if (!profile) return res.status(404).json({ error: 'Supplier not found.' });

    const [products] = await pool.execute(
      'SELECT * FROM supplier_products WHERE supplier_profile_id = ? ORDER BY sort_order, id',
      [profile.id]
    );
    res.json({ products });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ error: 'Failed to load products.' });
  }
}

export async function listMyProducts(req: any, res: any) {
  try {
    const profileId = await getProfileId(req.supplierUser.id);
    if (!profileId) return res.json({ products: [] });
    const [products] = await pool.execute(
      'SELECT * FROM supplier_products WHERE supplier_profile_id = ? ORDER BY sort_order, id',
      [profileId]
    );
    res.json({ products });
  } catch (error) {
    console.error('List my products error:', error);
    res.status(500).json({ error: 'Failed to load products.' });
  }
}

export async function addProduct(req: any, res: any) {
  try {
    const profileId = await getProfileId(req.supplierUser.id);
    if (!profileId) return res.status(400).json({ error: 'Create your profile first.' });

    const { title, description, category, image_url, image_urls, sort_order } = req.body;
    // Support multi-image: image_urls takes precedence; image_url is kept for backward compat
    const urls: string[] = Array.isArray(image_urls) && image_urls.length > 0
      ? image_urls
      : image_url ? [image_url] : [];
    if (urls.length === 0) return res.status(400).json({ error: 'At least one image is required.' });

    const primaryUrl = urls[0];
    const urlsJson = JSON.stringify(urls);

    const [result] = await pool.execute(
      'INSERT INTO supplier_products (supplier_profile_id, title, description, category, image_url, image_urls, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [profileId, title || null, description || null, category || null, primaryUrl, urlsJson, sort_order || 0]
    );
    const id = (result as any).insertId;
    const [created] = await pool.execute('SELECT * FROM supplier_products WHERE id = ?', [id]);
    const product = (created as any[])[0];
    if (product?.image_urls && typeof product.image_urls === 'string') {
      product.image_urls = JSON.parse(product.image_urls);
    }
    res.status(201).json({ product });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({ error: 'Failed to add product.' });
  }
}

export async function updateProduct(req: any, res: any) {
  try {
    const profileId = await getProfileId(req.supplierUser.id);
    if (!profileId) return res.status(403).json({ error: 'Forbidden.' });

    const { id } = req.params;
    const { title, description, category, image_url, image_urls, sort_order } = req.body;

    const [existing] = await pool.execute(
      'SELECT id FROM supplier_products WHERE id = ? AND supplier_profile_id = ?',
      [id, profileId]
    );
    if ((existing as any[]).length === 0) return res.status(404).json({ error: 'Product not found.' });

    const urls: string[] | null = Array.isArray(image_urls) && image_urls.length > 0 ? image_urls : null;
    const primaryUrl = urls ? urls[0] : (image_url || null);
    const urlsJson = urls ? JSON.stringify(urls) : null;

    await pool.execute(
      'UPDATE supplier_products SET title=?, description=?, category=?, image_url=COALESCE(?, image_url), image_urls=COALESCE(?, image_urls), sort_order=? WHERE id=?',
      [title || null, description || null, category || null, primaryUrl, urlsJson, sort_order ?? 0, id]
    );
    const [updated] = await pool.execute('SELECT * FROM supplier_products WHERE id = ?', [id]);
    res.json({ product: (updated as any[])[0] });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product.' });
  }
}

export async function deleteProduct(req: any, res: any) {
  try {
    const profileId = await getProfileId(req.supplierUser.id);
    if (!profileId) return res.status(403).json({ error: 'Forbidden.' });

    const { id } = req.params;
    const [existing] = await pool.execute(
      'SELECT id FROM supplier_products WHERE id = ? AND supplier_profile_id = ?',
      [id, profileId]
    );
    if ((existing as any[]).length === 0) return res.status(404).json({ error: 'Product not found.' });

    await pool.execute('DELETE FROM supplier_products WHERE id = ?', [id]);
    res.json({ message: 'Product deleted.' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
}

export async function reorderProducts(req: any, res: any) {
  try {
    const profileId = await getProfileId(req.supplierUser.id);
    if (!profileId) return res.status(403).json({ error: 'Forbidden.' });

    const { order } = req.body; // [{ id: number, sort_order: number }]
    if (!Array.isArray(order)) return res.status(400).json({ error: 'order array is required.' });

    for (const item of order) {
      await pool.execute(
        'UPDATE supplier_products SET sort_order = ? WHERE id = ? AND supplier_profile_id = ?',
        [item.sort_order, item.id, profileId]
      );
    }
    res.json({ message: 'Reordered.' });
  } catch (error) {
    console.error('Reorder products error:', error);
    res.status(500).json({ error: 'Failed to reorder.' });
  }
}
