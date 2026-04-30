import pool from '../config/database';

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

    const { title, description, image_url, sort_order } = req.body;
    if (!image_url) return res.status(400).json({ error: 'Image URL is required.' });

    const [result] = await pool.execute(
      'INSERT INTO supplier_products (supplier_profile_id, title, description, image_url, sort_order) VALUES (?, ?, ?, ?, ?)',
      [profileId, title || null, description || null, image_url, sort_order || 0]
    );
    const id = (result as any).insertId;
    const [created] = await pool.execute('SELECT * FROM supplier_products WHERE id = ?', [id]);
    res.status(201).json({ product: (created as any[])[0] });
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
    const { title, description, image_url, sort_order } = req.body;

    const [existing] = await pool.execute(
      'SELECT id FROM supplier_products WHERE id = ? AND supplier_profile_id = ?',
      [id, profileId]
    );
    if ((existing as any[]).length === 0) return res.status(404).json({ error: 'Product not found.' });

    await pool.execute(
      'UPDATE supplier_products SET title=?, description=?, image_url=COALESCE(?, image_url), sort_order=? WHERE id=?',
      [title || null, description || null, image_url || null, sort_order ?? 0, id]
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
