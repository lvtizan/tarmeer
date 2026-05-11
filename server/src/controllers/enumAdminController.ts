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
      'SELECT name, sort_order, active, category FROM company_services ORDER BY sort_order, name'
    );
    res.json({ services: rows });
  } catch (error) {
    console.error('listCompanyServices error:', error);
    res.status(500).json({ error: 'Failed to load services.' });
  }
}

export async function createCompanyService(req: any, res: any) {
  try {
    const { name, sort_order = 0, category } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required.' });
    await pool.execute(
      'INSERT INTO company_services (name, sort_order, active, category) VALUES (?, ?, 1, ?)',
      [name.trim(), Number(sort_order) || 0, category?.trim() || null]
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
    const { sort_order, active, name: newName, category } = req.body;
    const sets: string[] = [];
    const values: any[] = [];
    if (newName !== undefined) { sets.push('name = ?'); values.push(String(newName).slice(0, 200)); }
    if (sort_order !== undefined) { sets.push('sort_order = ?'); values.push(Number(sort_order)); }
    if (active !== undefined) { sets.push('active = ?'); values.push(active ? 1 : 0); }
    if (category !== undefined) { sets.push('category = ?'); values.push(category ? String(category).trim() : null); }
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

// ── Reorder Company Services ──────────────────────────────────────────────────

export async function reorderCompanyServices(req: any, res: any) {
  try {
    const { names } = req.body; // ordered array of service names
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'names array is required.' });
    }
    // Batch update sort_order based on position in the array
    for (let i = 0; i < names.length; i++) {
      await pool.execute(
        'UPDATE company_services SET sort_order = ? WHERE name = ?',
        [i, names[i]]
      );
    }
    invalidateEnumCache();
    res.json({ message: 'Reordered.' });
  } catch (error) {
    console.error('reorderCompanyServices error:', error);
    res.status(500).json({ error: 'Failed to reorder services.' });
  }
}

// ── Public: grouped service categories ───────────────────────────────────────

const CATEGORY_ORDER = [
  'Design & Planning', 'Construction', 'Design & Build', 'Renovation',
  'Outdoor & Pools', 'Home Systems', 'Interiors & Furniture', 'Maintenance', 'Specialty Works',
];

export async function getPublicServiceCategories(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      'SELECT name, category FROM company_services WHERE active = 1 ORDER BY sort_order, name'
    );
    const grouped = new Map<string, string[]>();
    const uncategorised: string[] = [];
    for (const row of rows as { name: string; category: string | null }[]) {
      const cat = row.category?.trim() || null;
      if (cat) {
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(row.name);
      } else {
        uncategorised.push(row.name);
      }
    }
    // Build ordered result
    const categories: { name: string; subs: string[] }[] = [];
    for (const catName of CATEGORY_ORDER) {
      const subs = grouped.get(catName);
      if (subs && subs.length > 0) {
        categories.push({ name: catName, subs });
        grouped.delete(catName);
      }
    }
    // Any remaining categories not in CATEGORY_ORDER
    for (const [catName, subs] of grouped.entries()) {
      if (subs.length > 0) categories.push({ name: catName, subs });
    }
    res.json({ categories });
  } catch (error) {
    console.error('getPublicServiceCategories error:', error);
    res.status(500).json({ error: 'Failed to load service categories.' });
  }
}
