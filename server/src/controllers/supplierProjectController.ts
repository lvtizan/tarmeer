import pool from '../config/database';
import { persistProjectImages } from '../lib/projectImageStorage';

async function getProfile(supplierUserId: number): Promise<{ id: number; slug: string } | null> {
  const [rows] = await pool.execute(
    'SELECT id, slug FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1',
    [supplierUserId]
  );
  return (rows as any[])[0] || null;
}

export async function listPublicProjects(req: any, res: any) {
  try {
    const { slug } = req.params;
    const [profiles] = await pool.execute(
      "SELECT id FROM supplier_profiles WHERE slug = ? AND status = 'approved'",
      [slug]
    );
    const profile = (profiles as any[])[0];
    if (!profile) return res.status(404).json({ error: 'Supplier not found.' });

    const [projects] = await pool.execute(
      'SELECT * FROM supplier_projects WHERE supplier_profile_id = ? AND is_published = 1 ORDER BY sort_order ASC, id DESC',
      [profile.id]
    );
    res.json({ projects });
  } catch (error) {
    console.error('List public projects error:', error);
    res.status(500).json({ error: 'Failed to load projects.' });
  }
}

export async function getPublicProject(req: any, res: any) {
  try {
    const { slug, id } = req.params;
    const [profiles] = await pool.execute(
      "SELECT id, company_name, slug, logo_url FROM supplier_profiles WHERE slug = ? AND status = 'approved'",
      [slug]
    );
    const profile = (profiles as any[])[0];
    if (!profile) return res.status(404).json({ error: 'Supplier not found.' });

    const [rows] = await pool.execute(
      'SELECT * FROM supplier_projects WHERE id = ? AND supplier_profile_id = ? AND is_published = 1',
      [id, profile.id]
    );
    const project = (rows as any[])[0];
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const [allProjects] = await pool.execute(
      'SELECT id, title, images FROM supplier_projects WHERE supplier_profile_id = ? AND is_published = 1 ORDER BY sort_order ASC, id DESC',
      [profile.id]
    );

    res.json({ project, supplier: profile, allProjects });
  } catch (error) {
    console.error('Get public project error:', error);
    res.status(500).json({ error: 'Failed to load project.' });
  }
}

export async function listMyProjects(req: any, res: any) {
  try {
    const profile = await getProfile(req.supplierUser.id);
    if (!profile) return res.json({ projects: [] });

    const [projects] = await pool.execute(
      'SELECT * FROM supplier_projects WHERE supplier_profile_id = ? ORDER BY sort_order ASC, id DESC',
      [profile.id]
    );
    res.json({ projects });
  } catch (error) {
    console.error('List supplier projects error:', error);
    res.status(500).json({ error: 'Failed to load projects.' });
  }
}

export async function addProject(req: any, res: any) {
  try {
    const profile = await getProfile(req.supplierUser.id);
    if (!profile) return res.status(400).json({ error: 'Create your profile first.' });

    const { title, description, location, area_sqm, budget, year, images } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });

    const rawImages: string[] = Array.isArray(images) ? images : [];
    // Persist base64 data URLs → local files; pass-through already-local paths
    const persistedImages = rawImages.length > 0
      ? await persistProjectImages(rawImages, { designerId: profile.id, projectId: 'new' })
      : [];

    const [result] = await pool.execute(
      `INSERT INTO supplier_projects
         (supplier_profile_id, title, description, location, area_sqm, budget, year, images, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        profile.id,
        title.trim(),
        description?.trim() || null,
        location?.trim() || null,
        area_sqm ? Number(area_sqm) : null,
        budget?.trim() || null,
        year?.trim() || null,
        JSON.stringify(persistedImages),
      ]
    );
    const id = (result as any).insertId;
    const [created] = await pool.execute('SELECT * FROM supplier_projects WHERE id = ?', [id]);
    res.status(201).json({ project: (created as any[])[0] });
  } catch (error) {
    console.error('Add supplier project error:', error);
    res.status(500).json({ error: 'Failed to add project.' });
  }
}

export async function updateProject(req: any, res: any) {
  try {
    const profile = await getProfile(req.supplierUser.id);
    if (!profile) return res.status(403).json({ error: 'Forbidden.' });

    const { id } = req.params;
    const [existing] = await pool.execute(
      'SELECT id FROM supplier_projects WHERE id = ? AND supplier_profile_id = ?',
      [id, profile.id]
    );
    if ((existing as any[]).length === 0) return res.status(404).json({ error: 'Project not found.' });

    const { title, description, location, area_sqm, budget, year, images } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required.' });

    const rawImages: string[] = Array.isArray(images) ? images : [];
    const persistedImages = rawImages.length > 0
      ? await persistProjectImages(rawImages, { designerId: profile.id, projectId: String(id) })
      : [];

    await pool.execute(
      `UPDATE supplier_projects
       SET title=?, description=?, location=?, area_sqm=?, budget=?, year=?, images=?
       WHERE id=?`,
      [
        title.trim(),
        description?.trim() || null,
        location?.trim() || null,
        area_sqm ? Number(area_sqm) : null,
        budget?.trim() || null,
        year?.trim() || null,
        JSON.stringify(persistedImages),
        id,
      ]
    );
    const [updated] = await pool.execute('SELECT * FROM supplier_projects WHERE id = ?', [id]);
    res.json({ project: (updated as any[])[0] });
  } catch (error) {
    console.error('Update supplier project error:', error);
    res.status(500).json({ error: 'Failed to update project.' });
  }
}

export async function deleteProject(req: any, res: any) {
  try {
    const profile = await getProfile(req.supplierUser.id);
    if (!profile) return res.status(403).json({ error: 'Forbidden.' });

    const { id } = req.params;
    const [existing] = await pool.execute(
      'SELECT id FROM supplier_projects WHERE id = ? AND supplier_profile_id = ?',
      [id, profile.id]
    );
    if ((existing as any[]).length === 0) return res.status(404).json({ error: 'Project not found.' });

    await pool.execute('DELETE FROM supplier_projects WHERE id = ?', [id]);
    res.json({ message: 'Project deleted.' });
  } catch (error) {
    console.error('Delete supplier project error:', error);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
}
