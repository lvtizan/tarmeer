import pool from '../config/database';
import { invalidateEnumCache } from '../lib/enumCache';

// ── Company Types ─────────────────────────────────────────────────────────────

export async function listCompanyTypes(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      'SELECT slug, label, sort_order, active FROM company_types ORDER BY sort_order, slug'
    );
    res.json({ types: rows });
  } catch (error) {
    console.error('listCompanyTypes error:', error);
    res.status(500).json({ error: 'Failed to load company types.' });
  }
}

export async function createCompanyType(req: any, res: any) {
  try {
    const { slug, label, sort_order = 0 } = req.body;
    if (!slug?.trim() || !label?.trim()) {
      return res.status(400).json({ error: 'slug and label are required.' });
    }
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    await pool.execute(
      'INSERT INTO company_types (slug, label, sort_order, active) VALUES (?, ?, ?, 1)',
      [cleanSlug, label.trim(), Number(sort_order) || 0]
    );
    invalidateEnumCache();
    res.status(201).json({ slug: cleanSlug });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Slug already exists.' });
    }
    console.error('createCompanyType error:', error);
    res.status(500).json({ error: 'Failed to create company type.' });
  }
}

export async function updateCompanyType(req: any, res: any) {
  try {
    const { slug } = req.params;
    const { label, sort_order, active } = req.body;
    const sets: string[] = [];
    const values: any[] = [];
    if (label !== undefined) { sets.push('label = ?'); values.push(String(label).trim()); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); values.push(Number(sort_order)); }
    if (active !== undefined) { sets.push('active = ?'); values.push(active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    values.push(slug);
    await pool.execute(`UPDATE company_types SET ${sets.join(', ')} WHERE slug = ?`, values);
    invalidateEnumCache();
    res.json({ message: 'Updated.' });
  } catch (error) {
    console.error('updateCompanyType error:', error);
    res.status(500).json({ error: 'Failed to update company type.' });
  }
}

export async function deleteCompanyType(req: any, res: any) {
  try {
    const { slug } = req.params;
    const [inUse] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM company_profiles WHERE company_type = ?', [slug]
    );
    if ((inUse as any[])[0].cnt > 0) {
      return res.status(409).json({ error: 'Cannot delete: type is used by existing companies.' });
    }
    await pool.execute('DELETE FROM company_types WHERE slug = ?', [slug]);
    invalidateEnumCache();
    res.json({ message: 'Deleted.' });
  } catch (error) {
    console.error('deleteCompanyType error:', error);
    res.status(500).json({ error: 'Failed to delete company type.' });
  }
}

// ── Company Services ──────────────────────────────────────────────────────────

export async function listCompanyServices(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      'SELECT name, sort_order, active FROM company_services ORDER BY sort_order, name'
    );
    res.json({ services: rows });
  } catch (error) {
    console.error('listCompanyServices error:', error);
    res.status(500).json({ error: 'Failed to load services.' });
  }
}

export async function createCompanyService(req: any, res: any) {
  try {
    const { name, sort_order = 0 } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required.' });
    await pool.execute(
      'INSERT INTO company_services (name, sort_order, active) VALUES (?, ?, 1)',
      [name.trim(), Number(sort_order) || 0]
    );
    invalidateEnumCache();
    res.status(201).json({ name: name.trim() });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Service name already exists.' });
    }
    console.error('createCompanyService error:', error);
    res.status(500).json({ error: 'Failed to create service.' });
  }
}

export async function updateCompanyService(req: any, res: any) {
  try {
    const name = decodeURIComponent(req.params.name);
    const { sort_order, active } = req.body;
    const sets: string[] = [];
    const values: any[] = [];
    if (sort_order !== undefined) { sets.push('sort_order = ?'); values.push(Number(sort_order)); }
    if (active !== undefined) { sets.push('active = ?'); values.push(active ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    values.push(name);
    await pool.execute(`UPDATE company_services SET ${sets.join(', ')} WHERE name = ?`, values);
    invalidateEnumCache();
    res.json({ message: 'Updated.' });
  } catch (error) {
    console.error('updateCompanyService error:', error);
    res.status(500).json({ error: 'Failed to update service.' });
  }
}

export async function deleteCompanyService(req: any, res: any) {
  try {
    const name = decodeURIComponent(req.params.name);
    await pool.execute('DELETE FROM company_services WHERE name = ?', [name]);
    invalidateEnumCache();
    res.json({ message: 'Deleted.' });
  } catch (error) {
    console.error('deleteCompanyService error:', error);
    res.status(500).json({ error: 'Failed to delete service.' });
  }
}
