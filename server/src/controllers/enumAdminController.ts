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
    const cleanCat = category?.trim() || null;
    await pool.execute(
      'INSERT INTO company_services (name, sort_order, active, category) VALUES (?, ?, 1, ?)',
      [name.trim(), Number(sort_order) || 0, cleanCat]
    );
    // Auto-register the category in company_service_categories if it doesn't exist yet
    if (cleanCat) {
      await pool.execute(
        `INSERT IGNORE INTO company_service_categories (name, sort_order, is_enabled)
         VALUES (?, COALESCE((SELECT MAX(sort_order) + 1 FROM company_service_categories AS _t), 0), 1)`,
        [cleanCat]
      );
    }
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

export async function renameServiceCategory(req: any, res: any) {
  try {
    const { oldName, newName } = req.body;
    if (!oldName?.trim() || !newName?.trim()) {
      return res.status(400).json({ error: 'oldName and newName are required.' });
    }
    const cleanNew = newName.trim().slice(0, 100);
    await pool.execute(
      'UPDATE company_services SET category = ? WHERE category = ?',
      [cleanNew, oldName.trim()]
    );
    invalidateEnumCache();
    res.json({ message: 'Category renamed.', newName: cleanNew });
  } catch (error) {
    console.error('renameServiceCategory error:', error);
    res.status(500).json({ error: 'Failed to rename category.' });
  }
}

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

// ── Service Category Management (admin) ───────────────────────────────────────

export async function createServiceCategory(req: any, res: any) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required.' });
    const cleanName = name.trim().slice(0, 100);
    const [existing] = await pool.execute(
      'SELECT name FROM company_service_categories WHERE name = ?', [cleanName]
    );
    if ((existing as any[]).length > 0) {
      return res.status(200).json({ name: cleanName, existed: true });
    }
    const [allRows] = await pool.execute('SELECT MAX(sort_order) AS maxOrd FROM company_service_categories');
    const maxOrd = (allRows as any[])[0]?.maxOrd ?? -1;
    await pool.execute(
      'INSERT INTO company_service_categories (name, sort_order, is_enabled) VALUES (?, ?, 1)',
      [cleanName, maxOrd + 1]
    );
    invalidateEnumCache();
    res.status(201).json({ name: cleanName });
  } catch (error) {
    console.error('createServiceCategory error:', error);
    res.status(500).json({ error: 'Failed to create category.' });
  }
}

export async function listServiceCategories(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      'SELECT name, sort_order, is_enabled FROM company_service_categories ORDER BY sort_order, name'
    );
    res.json({ categories: rows });
  } catch (error) {
    console.error('listServiceCategories error:', error);
    res.status(500).json({ error: 'Failed to load categories.' });
  }
}

export async function toggleServiceCategory(req: any, res: any) {
  try {
    const name = decodeURIComponent(req.params.name);
    await pool.execute(
      'UPDATE company_service_categories SET is_enabled = 1 - is_enabled WHERE name = ?',
      [name]
    );
    invalidateEnumCache();
    res.json({ message: 'Toggled.' });
  } catch (error) {
    console.error('toggleServiceCategory error:', error);
    res.status(500).json({ error: 'Failed to toggle category.' });
  }
}

export async function reorderServiceCategories(req: any, res: any) {
  try {
    const { names } = req.body;
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'names array is required.' });
    }
    for (let i = 0; i < names.length; i++) {
      await pool.execute(
        'UPDATE company_service_categories SET sort_order = ? WHERE name = ?',
        [i, names[i]]
      );
    }
    invalidateEnumCache();
    res.json({ message: 'Reordered.' });
  } catch (error) {
    console.error('reorderServiceCategories error:', error);
    res.status(500).json({ error: 'Failed to reorder categories.' });
  }
}

export async function renameServiceCategory2(req: any, res: any) {
  try {
    const oldName = decodeURIComponent(req.params.name);
    const { newName } = req.body;
    if (!newName?.trim()) return res.status(400).json({ error: 'newName is required.' });
    const cleanNew = newName.trim().slice(0, 100);
    await pool.execute(
      'UPDATE company_service_categories SET name = ? WHERE name = ?',
      [cleanNew, oldName]
    );
    await pool.execute(
      'UPDATE company_services SET category = ? WHERE category = ?',
      [cleanNew, oldName]
    );
    invalidateEnumCache();
    res.json({ message: 'Renamed.', newName: cleanNew });
  } catch (error) {
    console.error('renameServiceCategory2 error:', error);
    res.status(500).json({ error: 'Failed to rename category.' });
  }
}

export async function deleteServiceCategory(req: any, res: any) {
  try {
    const name = decodeURIComponent(req.params.name);
    await pool.execute('DELETE FROM company_service_categories WHERE name = ?', [name]);
    invalidateEnumCache();
    res.json({ message: 'Deleted.' });
  } catch (error) {
    console.error('deleteServiceCategory error:', error);
    res.status(500).json({ error: 'Failed to delete category.' });
  }
}

// ── Supplier Category Management ─────────────────────────────────────────────

export async function listSupplierCategories(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      'SELECT value, label, sort_order, is_enabled, group_value FROM supplier_categories ORDER BY sort_order, label'
    );
    res.json({ categories: rows });
  } catch (error) {
    console.error('listSupplierCategories error:', error);
    res.status(500).json({ error: 'Failed to load supplier categories.' });
  }
}

export async function createSupplierCategory(req: any, res: any) {
  try {
    const { value, label, group_value } = req.body;
    if (!value?.trim() || !label?.trim()) {
      return res.status(400).json({ error: 'value and label are required.' });
    }
    const cleanValue = value.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 50);
    const cleanLabel = label.trim().slice(0, 100);
    const [existing] = await pool.execute('SELECT value FROM supplier_categories WHERE value = ?', [cleanValue]);
    if ((existing as any[]).length > 0) {
      return res.status(200).json({ value: cleanValue, existed: true });
    }
    const [allRows] = await pool.execute('SELECT MAX(sort_order) AS maxOrd FROM supplier_categories');
    const maxOrd = (allRows as any[])[0]?.maxOrd ?? -1;
    await pool.execute(
      'INSERT INTO supplier_categories (value, label, sort_order, is_enabled, group_value) VALUES (?, ?, ?, 1, ?)',
      [cleanValue, cleanLabel, maxOrd + 1, group_value || null]
    );
    res.status(201).json({ value: cleanValue, label: cleanLabel });
  } catch (error) {
    console.error('createSupplierCategory error:', error);
    res.status(500).json({ error: 'Failed to create supplier category.' });
  }
}

export async function updateSupplierCategory(req: any, res: any) {
  try {
    const value = decodeURIComponent(req.params.value);
    const { label, group_value } = req.body;
    const sets: string[] = [];
    const params: any[] = [];
    if (label?.trim()) { sets.push('label = ?'); params.push(label.trim().slice(0, 100)); }
    if ('group_value' in req.body) { sets.push('group_value = ?'); params.push(group_value || null); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nothing to update.' });
    params.push(value);
    await pool.execute(`UPDATE supplier_categories SET ${sets.join(', ')} WHERE value = ?`, params);
    res.json({ message: 'Updated.' });
  } catch (error) {
    console.error('updateSupplierCategory error:', error);
    res.status(500).json({ error: 'Failed to update supplier category.' });
  }
}

export async function reorderSupplierCategories(req: any, res: any) {
  try {
    const { values } = req.body;
    if (!Array.isArray(values) || values.length === 0) {
      return res.status(400).json({ error: 'values array is required.' });
    }
    for (let i = 0; i < values.length; i++) {
      await pool.execute(
        'UPDATE supplier_categories SET sort_order = ? WHERE value = ?',
        [i, values[i]]
      );
    }
    res.json({ message: 'Reordered.' });
  } catch (error) {
    console.error('reorderSupplierCategories error:', error);
    res.status(500).json({ error: 'Failed to reorder supplier categories.' });
  }
}

export async function toggleSupplierCategory(req: any, res: any) {
  try {
    const value = decodeURIComponent(req.params.value);
    await pool.execute(
      'UPDATE supplier_categories SET is_enabled = 1 - is_enabled WHERE value = ?',
      [value]
    );
    res.json({ message: 'Toggled.' });
  } catch (error) {
    console.error('toggleSupplierCategory error:', error);
    res.status(500).json({ error: 'Failed to toggle supplier category.' });
  }
}

export async function deleteSupplierCategory(req: any, res: any) {
  try {
    const value = decodeURIComponent(req.params.value);
    await pool.execute('DELETE FROM supplier_categories WHERE value = ?', [value]);
    res.json({ message: 'Deleted.' });
  } catch (error) {
    console.error('deleteSupplierCategory error:', error);
    res.status(500).json({ error: 'Failed to delete supplier category.' });
  }
}

// ── Admin: supplier category groups ─────────────────────────────────────────

export async function listSupplierCategoryGroups(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      'SELECT value, label, sort_order, is_enabled FROM supplier_category_groups ORDER BY sort_order, label'
    );
    res.json({ groups: rows });
  } catch (error) {
    console.error('listSupplierCategoryGroups error:', error);
    res.status(500).json({ error: 'Failed to load supplier category groups.' });
  }
}

export async function createSupplierCategoryGroup(req: any, res: any) {
  try {
    const { value, label } = req.body;
    if (!value?.trim() || !label?.trim()) {
      return res.status(400).json({ error: 'value and label are required.' });
    }
    const cleanValue = value.trim().toLowerCase().replace(/\s+/g, '_').slice(0, 50);
    const cleanLabel = label.trim().slice(0, 100);
    const [existing] = await pool.execute('SELECT value FROM supplier_category_groups WHERE value = ?', [cleanValue]);
    if ((existing as any[]).length > 0) {
      return res.status(409).json({ error: 'Group already exists.' });
    }
    const [allRows] = await pool.execute('SELECT MAX(sort_order) AS maxOrd FROM supplier_category_groups');
    const maxOrd = (allRows as any[])[0]?.maxOrd ?? -1;
    await pool.execute(
      'INSERT INTO supplier_category_groups (value, label, sort_order, is_enabled) VALUES (?, ?, ?, 1)',
      [cleanValue, cleanLabel, maxOrd + 1]
    );
    res.status(201).json({ value: cleanValue, label: cleanLabel });
  } catch (error) {
    console.error('createSupplierCategoryGroup error:', error);
    res.status(500).json({ error: 'Failed to create supplier category group.' });
  }
}

export async function updateSupplierCategoryGroup(req: any, res: any) {
  try {
    const value = decodeURIComponent(req.params.value);
    const { label } = req.body;
    if (!label?.trim()) return res.status(400).json({ error: 'label is required.' });
    await pool.execute(
      'UPDATE supplier_category_groups SET label = ? WHERE value = ?',
      [label.trim().slice(0, 100), value]
    );
    res.json({ message: 'Updated.' });
  } catch (error) {
    console.error('updateSupplierCategoryGroup error:', error);
    res.status(500).json({ error: 'Failed to update supplier category group.' });
  }
}

export async function reorderSupplierCategoryGroups(req: any, res: any) {
  try {
    const { values } = req.body;
    if (!Array.isArray(values) || values.length === 0) {
      return res.status(400).json({ error: 'values array is required.' });
    }
    for (let i = 0; i < values.length; i++) {
      await pool.execute('UPDATE supplier_category_groups SET sort_order = ? WHERE value = ?', [i, values[i]]);
    }
    res.json({ message: 'Reordered.' });
  } catch (error) {
    console.error('reorderSupplierCategoryGroups error:', error);
    res.status(500).json({ error: 'Failed to reorder supplier category groups.' });
  }
}

export async function toggleSupplierCategoryGroup(req: any, res: any) {
  try {
    const value = decodeURIComponent(req.params.value);
    await pool.execute('UPDATE supplier_category_groups SET is_enabled = 1 - is_enabled WHERE value = ?', [value]);
    res.json({ message: 'Toggled.' });
  } catch (error) {
    console.error('toggleSupplierCategoryGroup error:', error);
    res.status(500).json({ error: 'Failed to toggle supplier category group.' });
  }
}

export async function deleteSupplierCategoryGroup(req: any, res: any) {
  try {
    const value = decodeURIComponent(req.params.value);
    await pool.execute('UPDATE supplier_categories SET group_value = NULL WHERE group_value = ?', [value]);
    await pool.execute('DELETE FROM supplier_category_groups WHERE value = ?', [value]);
    res.json({ message: 'Deleted.' });
  } catch (error) {
    console.error('deleteSupplierCategoryGroup error:', error);
    res.status(500).json({ error: 'Failed to delete supplier category group.' });
  }
}

export async function getPublicSupplierCategories(req: any, res: any) {
  try {
    const [groupRows] = await pool.execute(
      'SELECT value, label FROM supplier_category_groups WHERE is_enabled = 1 ORDER BY sort_order, label'
    );
    const [catRows] = await pool.execute(
      'SELECT value, label, group_value FROM supplier_categories WHERE is_enabled = 1 ORDER BY sort_order, label'
    );
    const cats = catRows as { value: string; label: string; group_value: string | null }[];
    const groups = (groupRows as { value: string; label: string }[]).map(g => ({
      ...g,
      categories: cats.filter(c => c.group_value === g.value),
    }));
    const ungrouped = cats.filter(c => !c.group_value);
    res.json({ groups, ungrouped });
  } catch (error) {
    console.error('getPublicSupplierCategories error:', error);
    res.status(500).json({ error: 'Failed to load supplier categories.' });
  }
}

// ── Public: grouped service categories ───────────────────────────────────────

export async function getPublicServiceCategories(req: any, res: any) {
  try {
    // Get enabled categories in DB-defined order
    const [catRows] = await pool.execute(
      'SELECT name FROM company_service_categories WHERE is_enabled = 1 ORDER BY sort_order, name'
    );
    const orderedCats = (catRows as { name: string }[]).map((r) => r.name);

    // Get all active sub-services
    const [svcRows] = await pool.execute(
      'SELECT name, category FROM company_services WHERE active = 1 ORDER BY sort_order, name'
    );
    const grouped = new Map<string, string[]>();
    for (const row of svcRows as { name: string; category: string | null }[]) {
      const cat = row.category?.trim() || null;
      if (cat) {
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(row.name);
      }
    }

    // Build result following enabled-category order, skip empty categories
    const categories: { name: string; subs: string[] }[] = [];
    for (const catName of orderedCats) {
      const subs = grouped.get(catName);
      if (subs && subs.length > 0) categories.push({ name: catName, subs });
    }

    // Fallback: if categories table is empty, include any remaining grouped subs
    if (orderedCats.length === 0) {
      for (const [catName, subs] of grouped.entries()) {
        if (subs.length > 0) categories.push({ name: catName, subs });
      }
    }

    res.json({ categories });
  } catch (error) {
    console.error('getPublicServiceCategories error:', error);
    res.status(500).json({ error: 'Failed to load service categories.' });
  }
}
