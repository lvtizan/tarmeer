import pool from '../config/database';

async function getProfileId(supplierUserId: number): Promise<number | null> {
  const [rows] = await pool.execute(
    'SELECT id FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1',
    [supplierUserId]
  );
  return (rows as any[])[0]?.id || null;
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
