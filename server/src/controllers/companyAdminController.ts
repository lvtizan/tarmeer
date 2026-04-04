import pool from '../config/database';
import { extractPortfolioData } from '../lib/publicCompaniesSerialization';

function normalizeLegacyImageUrl(url: string): string {
  const value = url.trim();
  const legacyMatch = value.match(/^https?:\/\/(?:www\.)?tarmeer\.com\/images\/showcase\/cover-(\d+)\.(?:png|jpg|jpeg|webp)$/i);
  if (legacyMatch) {
    const coverId = String(Number(legacyMatch[1])).padStart(3, '0');
    return `/images/designers/projects/covers/cover-${coverId}.jpg`;
  }
  const legacyProjectMatch = value.match(/^https?:\/\/(?:www\.)?tarmeer\.com\/images\/showcase\/project-(\d+)\.(?:png|jpg|jpeg|webp)$/i);
  if (legacyProjectMatch) {
    const coverId = String(Number(legacyProjectMatch[1])).padStart(3, '0');
    return `/images/designers/projects/covers/cover-${coverId}.jpg`;
  }
  return value;
}

function parseJsonField(value: any) {
  if (value == null) return null;
  if (Array.isArray(value) || typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

function toStringArray(value: any): string[] {
  const parsed = parseJsonField(value);

  const collect = (node: any): string[] => {
    if (node == null) return [];
    if (typeof node === 'string') return node ? [normalizeLegacyImageUrl(node)] : [];
    if (Array.isArray(node)) return node.flatMap((item) => collect(item));
    if (typeof node === 'object') {
      const direct = [node.url, node.src, node.imageUrl]
        .filter((v) => typeof v === 'string')
        .map((v) => normalizeLegacyImageUrl(String(v)));
      const nested = Object.values(node).flatMap((item) => collect(item));
      return [...direct, ...nested];
    }
    return [];
  };

  return Array.from(new Set(collect(parsed)));
}

function toCategorizedPortfolioItems(value: any): Array<{ url: string; category: string | null }> {
  const parsed = parseJsonField(value);
  if (!parsed) return [];

  const items: Array<{ url: string; category: string | null }> = [];

  if (Array.isArray(parsed)) {
    const urls = toStringArray(parsed);
    urls.forEach((url) => items.push({ url, category: null }));
    return items;
  }

  if (typeof parsed === 'object') {
    for (const [key, node] of Object.entries(parsed)) {
      const category = typeof key === 'string' && key.trim() ? key.trim() : null;
      const urls = toStringArray(node);
      urls.forEach((url) => items.push({ url, category }));
    }
  }

  return items;
}

// List companies with pagination and claimed/unclaimed filter
export async function listCompanies(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { claimed, search } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (claimed === 'claimed') { where += ' AND c.owner_user_id IS NOT NULL'; }
    if (claimed === 'unclaimed') { where += ' AND c.owner_user_id IS NULL'; }
    if (search) {
      where += ' AND (c.name_en LIKE ? OR c.slug LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM uae_companies c ${where}`, params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT c.id, c.name_en, c.slug, c.city, c.logo_url, c.owner_user_id, COALESCE(c.display_order, 0) as display_order,
        u.full_name as owner_name, u.email as owner_email,
        CASE
          WHEN COALESCE(p.project_count, 0) > 0 THEN p.project_count
          ELSE COALESCE(JSON_LENGTH(c.portfolio_images), 0)
        END as project_count
       FROM uae_companies c
       LEFT JOIN users u ON c.owner_user_id = u.id
       LEFT JOIN (
         SELECT
           uc.id AS uae_company_id,
           COUNT(DISTINCT p.id) AS project_count
         FROM uae_companies uc
         LEFT JOIN company_profiles cp
           ON cp.linked_uae_company_id = uc.id
           OR (uc.owner_user_id IS NOT NULL AND cp.user_id = uc.owner_user_id)
         LEFT JOIN projects p ON p.company_profile_id = cp.id
         GROUP BY uc.id
       ) p ON p.uae_company_id = c.id
       ${where}
       ORDER BY COALESCE(c.display_order, 0) DESC, c.id ASC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    res.json({
      companies: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List companies error:', error);
    res.status(500).json({ error: 'Failed to list companies.' });
  }
}

export async function updateCompanyDisplayOrder(req: any, res: any) {
  try {
    const { companyId } = req.params;
    const raw = req.body?.display_order;
    const displayOrder = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;

    if (displayOrder > 0) {
      const [conflicts] = await pool.execute(
        `SELECT id, 'uae_companies' as source
         FROM uae_companies
         WHERE COALESCE(display_order, 0) = ? AND id <> ?
         UNION ALL
         SELECT id, 'company_profiles' as source
         FROM company_profiles
         WHERE display_order = ?
         LIMIT 1`,
        [displayOrder, companyId, displayOrder]
      );

      if ((conflicts as any[]).length > 0) {
        return res.status(409).json({
          error: `Display order ${displayOrder} is already in use. Please choose another number.`,
        });
      }
    }

    await pool.execute('UPDATE uae_companies SET display_order = ? WHERE id = ?', [displayOrder, companyId]);
    res.json({ message: 'Display order updated.' });
  } catch (error) {
    console.error('Update scraped company display order error:', error);
    res.status(500).json({ error: 'Failed to update display order.' });
  }
}

// List company applications
export async function listCompanyApplications(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status) { where += ' AND ca.status = ?'; params.push(status); }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM company_applications ca ${where}`, params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT ca.*, u.full_name as user_name, u.email as user_email
       FROM company_applications ca
       JOIN users u ON ca.user_id = u.id
       ${where}
       ORDER BY ca.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    res.json({
      applications: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List company applications error:', error);
    res.status(500).json({ error: 'Failed to list applications.' });
  }
}

// Review (approve/reject) company application
export async function reviewCompanyApplication(req: any, res: any) {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected.' });
    }

    const adminId = req.admin?.id || null;

    await pool.execute(
      'UPDATE company_applications SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [status, admin_notes || null, adminId, id]
    );

    res.json({ message: `Application ${status}.` });
  } catch (error) {
    console.error('Review company application error:', error);
    res.status(500).json({ error: 'Failed to review application.' });
  }
}

// Bind user to company
export async function bindUserToCompany(req: any, res: any) {
  try {
    const { companyId } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required.' });

    // Check user exists
    const [userRows] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
    if ((userRows as any[]).length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check company exists
    const [companyRows] = await pool.execute('SELECT id FROM uae_companies WHERE id = ?', [companyId]);
    if ((companyRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    // Bind
    await pool.execute('UPDATE uae_companies SET owner_user_id = ? WHERE id = ?', [userId, companyId]);
    await pool.execute("UPDATE users SET role = 'company' WHERE id = ?", [userId]);

    // If there's a pending application from this user, link it
    await pool.execute(
      "UPDATE company_applications SET linked_company_id = ?, status = 'approved', reviewed_at = NOW() WHERE user_id = ? AND status = 'pending'",
      [companyId, userId]
    );

    res.json({ message: 'User bound to company successfully.' });
  } catch (error) {
    console.error('Bind user to company error:', error);
    res.status(500).json({ error: 'Failed to bind user.' });
  }
}

// Get single scraped company detail (for edit form)
export async function getScrapedCompany(req: any, res: any) {
  try {
    const [rows] = await pool.execute('SELECT * FROM uae_companies WHERE id = ?', [req.params.companyId]);
    if ((rows as any[]).length === 0) return res.status(404).json({ error: 'Company not found.' });
    res.json({ company: (rows as any[])[0] });
  } catch (error) {
    console.error('Get scraped company error:', error);
    res.status(500).json({ error: 'Failed to get company.' });
  }
}

// Edit scraped company (uae_companies)
export async function editScrapedCompany(req: any, res: any) {
  try {
    const { companyId } = req.params;
    const { name_en, name_ar, phone, email, website, whatsapp, city, area, address, services, specialties, year_established, license_number, instagram, facebook, linkedin, description } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_ar !== undefined) { updates.push('name_ar = ?'); values.push(name_ar); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone || null); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email || null); }
    if (website !== undefined) { updates.push('website = ?'); values.push(website || null); }
    if (whatsapp !== undefined) { updates.push('whatsapp = ?'); values.push(whatsapp || null); }
    if (city !== undefined) { updates.push('city = ?'); values.push(city || null); }
    if (area !== undefined) { updates.push('area = ?'); values.push(area || null); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address || null); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description || null); }
    if (services !== undefined) { updates.push('services = ?'); values.push(JSON.stringify(services)); }
    if (specialties !== undefined) { updates.push('specialties = ?'); values.push(JSON.stringify(specialties)); }
    if (year_established !== undefined) { updates.push('year_established = ?'); values.push(year_established || null); }
    if (license_number !== undefined) { updates.push('license_number = ?'); values.push(license_number || null); }
    if (instagram !== undefined) { updates.push('instagram = ?'); values.push(instagram || null); }
    if (facebook !== undefined) { updates.push('facebook = ?'); values.push(facebook || null); }
    if (linkedin !== undefined) { updates.push('linkedin = ?'); values.push(linkedin || null); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    values.push(companyId);
    await pool.execute(`UPDATE uae_companies SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.execute('SELECT * FROM uae_companies WHERE id = ?', [companyId]);
    res.json({ company: (rows as any[])[0] });
  } catch (error) {
    console.error('Edit scraped company error:', error);
    res.status(500).json({ error: 'Failed to edit company.' });
  }
}

// Get single company profile detail (for edit form)
export async function getCompanyProfile(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      `SELECT cp.*, u.email as user_email, u.full_name as user_name
       FROM company_profiles cp JOIN users u ON cp.user_id = u.id WHERE cp.id = ?`,
      [req.params.id]
    );
    if ((rows as any[]).length === 0) return res.status(404).json({ error: 'Profile not found.' });
    res.json({ profile: (rows as any[])[0] });
  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
}

// Edit company profile (company_profiles) by admin
export async function editCompanyProfile(req: any, res: any) {
  try {
    const { id } = req.params;
    const { company_name, description, contact_person, phone, website, city, address, services, specialties, company_type, trade_license_number, establishment_year, status } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (company_name !== undefined) { updates.push('company_name = ?'); values.push(company_name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (contact_person !== undefined) { updates.push('contact_person = ?'); values.push(contact_person); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (website !== undefined) { updates.push('website = ?'); values.push(website || null); }
    if (city !== undefined) { updates.push('city = ?'); values.push(city); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (company_type !== undefined) { updates.push('company_type = ?'); values.push(company_type); }
    if (trade_license_number !== undefined) { updates.push('trade_license_number = ?'); values.push(trade_license_number || null); }
    if (establishment_year !== undefined) { updates.push('establishment_year = ?'); values.push(establishment_year || null); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (services !== undefined) { updates.push('services = ?'); values.push(JSON.stringify(services)); }
    if (specialties !== undefined) { updates.push('specialties = ?'); values.push(JSON.stringify(specialties)); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    values.push(id);
    await pool.execute(`UPDATE company_profiles SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.execute('SELECT * FROM company_profiles WHERE id = ?', [id]);
    res.json({ profile: (rows as any[])[0] });
  } catch (error) {
    console.error('Edit company profile error:', error);
    res.status(500).json({ error: 'Failed to edit profile.' });
  }
}

// Unbind company
export async function unbindCompany(req: any, res: any) {
  try {
    const { companyId } = req.params;

    // Get current owner
    const [rows] = await pool.execute('SELECT owner_user_id FROM uae_companies WHERE id = ?', [companyId]);
    const company = (rows as any[])[0];
    if (!company) return res.status(404).json({ error: 'Company not found.' });

    if (company.owner_user_id) {
      // Reset user role to 'user' (unless they have other company bindings)
      const [otherCompanies] = await pool.execute(
        'SELECT id FROM uae_companies WHERE owner_user_id = ? AND id != ?',
        [company.owner_user_id, companyId]
      );
      if ((otherCompanies as any[]).length === 0) {
        await pool.execute("UPDATE users SET role = 'user' WHERE id = ?", [company.owner_user_id]);
      }
    }

    await pool.execute('UPDATE uae_companies SET owner_user_id = NULL WHERE id = ?', [companyId]);

    res.json({ message: 'Company unbound.' });
  } catch (error) {
    console.error('Unbind company error:', error);
    res.status(500).json({ error: 'Failed to unbind.' });
  }
}

// Get full company_profiles detail (info + portfolio) for admin detail page
export async function getCompanyProfileFullDetail(req: any, res: any) {
  try {
    const { id } = req.params;

    const [companyRows] = await pool.execute(
      `SELECT cp.*, u.email as user_email, u.full_name as user_name
       FROM company_profiles cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.id = ?`,
      [id]
    );
    if ((companyRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }
    const company = (companyRows as any[])[0];

    const [projectRows] = await pool.execute(
      `SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, created_at
       FROM projects WHERE company_profile_id = ? ORDER BY created_at DESC`,
      [id]
    );
    const projects = (projectRows as any[]).map((p: any) => ({
      ...p,
      images: toStringArray(p.images),
      tags: toStringArray(p.tags),
    }));

    res.json({ company, projects });
  } catch (error) {
    console.error('Get company profile full detail error:', error);
    res.status(500).json({ error: 'Failed to get company profile detail.' });
  }
}

// Get full company detail (info + portfolio) for admin detail page
export async function getCompanyFullDetail(req: any, res: any) {
  try {
    const { companyId } = req.params;

    // Get company info
    const [companyRows] = await pool.execute(
      `SELECT c.*, u.full_name as owner_name, u.email as owner_email, u.id as owner_id
       FROM uae_companies c
       LEFT JOIN users u ON c.owner_user_id = u.id
       WHERE c.id = ?`,
      [companyId]
    );
    if ((companyRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }
    const company = (companyRows as any[])[0];

    // Get portfolio projects with v3 company_profile relationship first, and
    // keep legacy designer fallback for older rows.
    let projects: any[] = [];
    const [profileRows] = await pool.execute(
      `SELECT id
       FROM company_profiles
       WHERE linked_uae_company_id = ?
          OR (? IS NOT NULL AND user_id = ?)`,
      [companyId, company.owner_user_id, company.owner_user_id]
    );
    const profileIds = (profileRows as any[]).map((row: any) => Number(row.id)).filter(Boolean);

    if (profileIds.length > 0) {
      const placeholders = profileIds.map(() => '?').join(',');
      const [projectRows] = await pool.execute(
        `SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, created_at
         FROM projects
         WHERE company_profile_id IN (${placeholders})
         ORDER BY created_at DESC`,
        profileIds
      );
      projects = (projectRows as any[]).map((p: any) => ({
        ...p,
        images: toStringArray(p.images),
        tags: toStringArray(p.tags),
      }));
    } else if (company.owner_user_id) {
      const [designerRows] = await pool.execute(
        'SELECT id FROM designers WHERE user_id = ?',
        [company.owner_user_id]
      );
      if ((designerRows as any[]).length > 0) {
        const designerId = (designerRows as any[])[0].id;
        const [projectRows] = await pool.execute(
          `SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, created_at
           FROM projects WHERE designer_id = ? ORDER BY created_at DESC`,
          [designerId]
        );
        projects = (projectRows as any[]).map((p: any) => ({
          ...p,
          images: toStringArray(p.images),
          tags: toStringArray(p.tags),
        }));
      }
    }

    // Fallback: scraped companies may only have portfolio_images, not rows in projects table.
    if (projects.length === 0) {
      const { portfolio_categories } = extractPortfolioData(company.portfolio_images);
      const portfolioItems = Object.entries(portfolio_categories).flatMap(([category, items]) =>
        (items || []).map((item: any) => ({
          url: normalizeLegacyImageUrl(String(item?.url || '')),
          category: category || null,
        }))
      ).filter((item) => !!item.url);

      projects = portfolioItems.map((item, index) => ({
        id: -(index + 1),
        title: `${company.name_en} Portfolio ${index + 1}`,
        description: null,
        style: item.category,
        location: company.city || null,
        year: company.year_established || null,
        images: [item.url],
        tags: [],
        status: 'published',
        rejection_reason: null,
        created_at: company.created_at || new Date().toISOString(),
      }));
    }

    res.json({ company, projects });
  } catch (error) {
    console.error('Get company full detail error:', error);
    res.status(500).json({ error: 'Failed to get company detail.' });
  }
}
