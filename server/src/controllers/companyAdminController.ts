import pool from '../config/database';
import { extractPortfolioData, sanitizeCompanyImage } from '../lib/publicCompaniesSerialization';
import { persistProjectImages, isImageDataUrl } from '../lib/projectImageStorage';
import type { NormalizedImage } from '../lib/projectPersistence';
import { notifyIndexNow } from '../lib/indexNow';
import { calculateAllWeights } from '../lib/weightCalculator';
import { slugify } from '../lib/slugify';
import fs from 'fs';
import path from 'path';

// Runtime note:
// - ts-node/dev: __dirname => server/src/controllers
// - build/prod: __dirname => server/dist/controllers
// In both cases, ../../public/uploads points to server/public/uploads.
const PUBLIC_UPLOADS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

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
        .filter((v) => typeof v === 'string' && v)
        .map((v) => normalizeLegacyImageUrl(String(v)));
      if (direct.length > 0) return direct;
      return Object.values(node).flatMap((item) => collect(item));
    }
    return [];
  };

  return Array.from(new Set(collect(parsed)));
}

function normalizeUploadsPath(url: string): string {
  let value = url.trim();
  if (!value) return '';

  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      const parsed = new URL(value);
      value = parsed.pathname;
    }
  } catch {
    // keep original value
  }

  if (value.startsWith('/api/uploads/')) {
    return value.replace(/^\/api/, '');
  }
  if (value.startsWith('/uploads/')) {
    return value;
  }
  if (value.startsWith('uploads/')) {
    return `/${value}`;
  }
  if (value.startsWith('./uploads/')) {
    return `/${value.replace(/^\.\/+/, '')}`;
  }
  return value;
}

function collapseLegacyProjectPath(uploadPath: string): string {
  return uploadPath.replace(
    /^\/uploads\/projects\/(\d+)\/\d+\/(\d{4})\/(\d{2})\/([^/?#]+)$/i,
    '/uploads/projects/$1/$2/$3/$4'
  );
}

function buildProjectImageCandidates(rawUrl: string): string[] {
  const normalized = normalizeUploadsPath(rawUrl);
  if (!normalized) return [];

  if (!normalized.startsWith('/uploads/')) {
    return [normalized];
  }

  const noQuery = normalized.split('?')[0].split('#')[0];
  const collapsed = collapseLegacyProjectPath(noQuery);
  const match = noQuery.match(/^(.*)\.(png|jpe?g|webp|avif)$/i);
  const extensions = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (value: string) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    candidates.push(value);
  };

  add(noQuery);
  add(collapsed);

  if (match) {
    const base = match[1];
    const collapsedBase = collapsed.replace(/\.(png|jpe?g|webp|avif)$/i, '');
    for (const ext of extensions) {
      add(`${base}.${ext}`);
      add(`${collapsedBase}.${ext}`);
    }
  }

  return candidates;
}

function uploadPathExists(uploadPath: string): boolean {
  if (!uploadPath.startsWith('/uploads/')) return false;
  const localPath = path.join(PUBLIC_UPLOADS_DIR, uploadPath.replace(/^\/uploads\//, ''));
  return fs.existsSync(localPath);
}

function resolveExistingProjectImage(url: string): string {
  const normalized = normalizeLegacyImageUrl(url || '');
  if (!normalized) return '';

  const candidates = buildProjectImageCandidates(normalized);
  if (candidates.length === 0) return '';

  // Non-upload sources are left as-is (e.g., static /images/... or external URL).
  if (!candidates[0].startsWith('/uploads/')) {
    return candidates[0];
  }

  for (const candidate of candidates) {
    if (uploadPathExists(candidate)) {
      return candidate;
    }
  }
  return '';
}

function sanitizeProjectImages(imagesField: any): string[] {
  const rawImages = toStringArray(imagesField);
  const out: string[] = [];
  const seen = new Set<string>();

  for (const rawImage of rawImages) {
    const normalized = resolveExistingProjectImage(rawImage);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out;
}

/**
 * Admin view: extract all image URLs without filtering by file existence.
 * Admins need to see every image (including /images/uae-companies/... paths)
 * regardless of whether the file exists on this server's filesystem.
 */
function extractAllProjectImageUrls(imagesField: any): string[] {
  const rawImages = toStringArray(imagesField);
  const seen = new Set<string>();
  return rawImages.filter((url) => {
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
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
      `SELECT c.id, c.name_en, c.slug, c.city, c.logo_url, c.owner_user_id,
              COALESCE(c.display_order, 0) as display_order,
              COALESCE(c.home_display_order, 0) as home_display_order,
              COALESCE(c.list_display_order, 0) as list_display_order,
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
       ORDER BY ${req.query.sort_by === 'project_count' ? `project_count ${req.query.sort_dir === 'asc' ? 'ASC' : 'DESC'}, c.id DESC` : 'CASE WHEN GREATEST(COALESCE(c.home_display_order, 0), COALESCE(c.list_display_order, 0)) > 0 THEN 0 ELSE 1 END, LEAST(CASE WHEN c.home_display_order > 0 THEN c.home_display_order ELSE 999999 END, CASE WHEN c.list_display_order > 0 THEN c.list_display_order ELSE 999999 END) ASC, c.id ASC'}
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

    const companyIdNum = Number(companyId);
    const [currentRows] = await pool.execute(
      'SELECT COALESCE(display_order, 0) AS display_order FROM uae_companies WHERE id = ? LIMIT 1',
      [companyIdNum]
    );
    const current = (currentRows as any[])[0];
    if (!current) return res.status(404).json({ error: 'Company not found.' });

    // No-op update should always pass.
    if (displayOrder !== Number(current.display_order || 0) && displayOrder > 0) {
      const [conflicts] = await pool.execute(
        `SELECT 'company_profiles' AS source, id
         FROM company_profiles
         WHERE COALESCE(display_order, 0) = ?
         UNION ALL
         SELECT 'uae_companies' AS source, id
         FROM uae_companies
         WHERE (
           COALESCE(display_order, 0) = ?
           OR COALESCE(home_display_order, 0) = ?
           OR COALESCE(list_display_order, 0) = ?
         )
           AND id <> ?
         LIMIT 1`,
        [displayOrder, displayOrder, displayOrder, displayOrder, companyIdNum]
      );

      if ((conflicts as any[]).length > 0) {
        return res.status(409).json({
          error: `序号 ${displayOrder} 已占用，请用新的序号 / Order ${displayOrder} is occupied, please use a new order number.`,
        });
      }
    }

    await pool.execute('UPDATE uae_companies SET display_order = ? WHERE id = ?', [displayOrder, companyIdNum]);
    res.json({ message: 'Display order updated.' });
  } catch (error) {
    console.error('Update scraped company display order error:', error);
    res.status(500).json({ error: 'Failed to update display order.' });
  }
}

async function updateSingleOrderField(
  companyId: number,
  orderValue: number,
  field: 'home_display_order' | 'list_display_order'
) {
  const [currentRows] = await pool.execute(
    `SELECT COALESCE(${field}, 0) AS current_value FROM uae_companies WHERE id = ? LIMIT 1`,
    [companyId]
  );
  const current = (currentRows as any[])[0];
  if (!current) {
    throw new Error(`${field}#NOT_FOUND#${companyId}`);
  }

  // No-op update should always pass.
  if (orderValue !== Number(current.current_value || 0) && orderValue > 0) {
    // Max 6 home companies check
    if (field === 'home_display_order') {
      const [countRows] = await pool.execute(
        `SELECT
          (SELECT COUNT(*) FROM company_profiles WHERE home_display_order > 0 AND deleted_at IS NULL) +
          (SELECT COUNT(*) FROM uae_companies WHERE home_display_order > 0)
        AS total`
      );
      let total = Number((countRows as any[])[0]?.total || 0);
      // If this record already has a home_display_order > 0, it's being updated not added
      if (Number(current.current_value || 0) > 0) total -= 1;
      if (total >= 9) {
        throw new Error(`${field}#MAX_REACHED#9`);
      }
    }

    // Check cross-table conflict: same field, same value
    const [conflicts] = await pool.execute(
      `SELECT 'company_profiles' AS source, id, company_name AS name
       FROM company_profiles
       WHERE COALESCE(${field}, 0) = ? AND deleted_at IS NULL
       UNION ALL
       SELECT 'uae_companies' AS source, id, name_en AS name
       FROM uae_companies
       WHERE COALESCE(${field}, 0) = ? AND id <> ?
       LIMIT 1`,
      [orderValue, orderValue, companyId]
    );
    if ((conflicts as any[]).length > 0) {
      const conflict = (conflicts as any[])[0];
      throw new Error(`${field}#CONFLICT#${orderValue}#${conflict.name}`);
    }
  }

  await pool.execute(`UPDATE uae_companies SET ${field} = ? WHERE id = ?`, [orderValue, companyId]);
}

export async function updateCompanyHomeDisplayOrder(req: any, res: any) {
  try {
    const companyId = Number(req.params.companyId);
    const raw = req.body?.home_display_order;
    const orderValue = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;
    await updateSingleOrderField(companyId, orderValue, 'home_display_order');
    res.json({ message: 'Home display order updated.' });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('home_display_order#NOT_FOUND#')) {
      return res.status(404).json({ error: 'Company not found.' });
    }
    if (error instanceof Error && error.message.includes('home_display_order#MAX_REACHED#')) {
      return res.status(400).json({ error: '首页最多展示 9 家公司，请先移除一家' });
    }
    if (error instanceof Error && error.message.includes('home_display_order#CONFLICT#')) {
      const parts = error.message.split('#');
      const orderValue = parts[2] || '0';
      const conflictName = parts[3] || '';
      return res.status(409).json({
        error: `Home order ${orderValue} already used by "${conflictName}"`,
      });
    }
    console.error('Update home display order error:', error);
    res.status(500).json({ error: 'Failed to update home display order.' });
  }
}

export async function updateCompanyListDisplayOrder(req: any, res: any) {
  try {
    const companyId = Number(req.params.companyId);
    const raw = req.body?.list_display_order;
    const orderValue = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;
    await updateSingleOrderField(companyId, orderValue, 'list_display_order');
    res.json({ message: 'List display order updated.' });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('list_display_order#NOT_FOUND#')) {
      return res.status(404).json({ error: 'Company not found.' });
    }
    if (error instanceof Error && error.message.includes('list_display_order#CONFLICT#')) {
      const parts = error.message.split('#');
      const orderValue = parts[2] || '0';
      const conflictName = parts[3] || '';
      return res.status(409).json({
        error: `List order ${orderValue} already used by "${conflictName}"`,
      });
    }
    console.error('Update list display order error:', error);
    res.status(500).json({ error: 'Failed to update list display order.' });
  }
}

// Get current home order count (across both tables)
export async function getHomeOrderCount(_req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      `SELECT
        (SELECT COUNT(*) FROM company_profiles WHERE home_display_order > 0 AND deleted_at IS NULL) +
        (SELECT COUNT(*) FROM uae_companies WHERE home_display_order > 0)
      AS count`
    );
    const count = Number((rows as any[])[0]?.count || 0);
    res.json({ count, max: 9 });
  } catch (error) {
    console.error('Get home order count error:', error);
    res.status(500).json({ error: 'Failed to get home order count.' });
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

// Set / clear admin-pinned cover image (one of the company's portfolio photos)
export async function setCompanyCoverImage(req: any, res: any) {
  try {
    const { id } = req.params;
    const { url } = req.body || {};
    const value = (typeof url === 'string' && url.trim()) ? url.trim() : null;
    await pool.execute('UPDATE company_profiles SET cover_image_url = ? WHERE id = ?', [value, id]);
    res.json({ id: Number(id), cover_image_url: value });
  } catch (error) {
    console.error('Set company cover image error:', error);
    res.status(500).json({ error: 'Failed to set cover image.' });
  }
}

export async function setDirectoryCompanyCoverImage(req: any, res: any) {
  try {
    const { companyId } = req.params;
    const { url } = req.body || {};
    const value = (typeof url === 'string' && url.trim()) ? url.trim() : null;
    await pool.execute('UPDATE uae_companies SET cover_image = ? WHERE id = ?', [value, companyId]);
    res.json({ id: Number(companyId), cover_image: value });
  } catch (error) {
    console.error('Set directory company cover image error:', error);
    res.status(500).json({ error: 'Failed to set cover image.' });
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
    if (company_type !== undefined) {
      const _typeArr = Array.isArray(company_type) ? company_type : (company_type ? [company_type] : []);
      updates.push('company_type = ?'); values.push(JSON.stringify(_typeArr));
      updates.push('company_types = ?'); values.push(JSON.stringify(_typeArr));
    }
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
      `SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, is_published, is_portfolio_hidden, created_at
       FROM projects WHERE company_profile_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [id]
    );
    const projects = (projectRows as any[]).map((p: any) => ({
      ...p,
      images: sanitizeProjectImages(p.images),
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
        `SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, is_portfolio_hidden, created_at
         FROM projects
         WHERE company_profile_id IN (${placeholders}) AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        profileIds
      );
      projects = (projectRows as any[]).map((p: any) => ({
        ...p,
        images: sanitizeProjectImages(p.images),
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
          `SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, is_portfolio_hidden, created_at
           FROM projects WHERE designer_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
          [designerId]
        );
        projects = (projectRows as any[]).map((p: any) => ({
          ...p,
          images: sanitizeProjectImages(p.images),
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

      // Check which image URLs are hidden from portfolio
      const [hiddenRows] = await pool.execute('SELECT image_url FROM portfolio_hidden_images');
      const hiddenUrls = new Set((hiddenRows as any[]).map((r: any) => r.image_url as string));

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
        is_portfolio_hidden: hiddenUrls.has(item.url) ? 1 : 0,
        created_at: company.created_at || new Date().toISOString(),
      }));
    }

    res.json({ company, projects });
  } catch (error) {
    console.error('Get company full detail error:', error);
    res.status(500).json({ error: 'Failed to get company detail.' });
  }
}

// DELETE /admin/companies/:companyId/portfolio-image
// Removes a single image URL from portfolio_images (scraped directory companies).
export async function deleteDirectoryPortfolioImage(req: any, res: any) {
  try {
    const { companyId } = req.params;
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' });
    }

    const [rows] = await pool.execute(
      'SELECT portfolio_images FROM uae_companies WHERE id = ?',
      [companyId]
    );
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ error: 'Company not found.' });

    let raw = row.portfolio_images;
    let parsed: any;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { parsed = null; }

    // Normalize a raw stored URL through the same pipeline used on the read path,
    // so hotfix renames (e.g. .png → .jpg) and legacy URL formats match correctly.
    const normalizeStored = (raw: unknown) =>
      normalizeLegacyImageUrl(sanitizeCompanyImage(String(raw ?? '')));

    if (Array.isArray(parsed)) {
      // Legacy flat array of URL strings
      parsed = parsed.filter((u: string) => normalizeStored(u) !== url);
    } else if (parsed && typeof parsed === 'object') {
      // Object with category keys
      for (const key of Object.keys(parsed)) {
        const entry = parsed[key];
        if (Array.isArray(entry)) {
          parsed[key] = entry.filter((item: any) => normalizeStored(item?.url) !== url);
        } else if (entry && typeof entry === 'object' && Array.isArray(entry.items)) {
          entry.items = entry.items.filter((item: any) => normalizeStored(item?.url) !== url);
        }
      }
    }

    await pool.execute(
      'UPDATE uae_companies SET portfolio_images = ? WHERE id = ?',
      [JSON.stringify(parsed), companyId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Delete portfolio image error:', error);
    res.status(500).json({ error: 'Failed to delete image.' });
  }
}

// ====== Project CRUD for admin ======

// Helper: resolve designerId from company_profile for image storage paths
async function resolveDesignerIdForProfile(companyProfileId: number): Promise<number> {
  const [rows] = await pool.execute(
    'SELECT user_id FROM company_profiles WHERE id = ? LIMIT 1',
    [companyProfileId]
  );
  const profile = (rows as any[])[0];
  return profile ? Number(profile.user_id) : 0;
}

// GET single project
export async function getAdminProject(req: any, res: any) {
  try {
    const { companyId, projectId } = req.params;

    const [rows] = await pool.execute(
      'SELECT * FROM projects WHERE id = ? AND company_profile_id = ? AND deleted_at IS NULL',
      [projectId, companyId]
    );
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = (rows as any[])[0];
    project.images = extractAllProjectImageUrls(project.images);
    project.tags = toStringArray(project.tags);

    res.json({ project });
  } catch (error) {
    console.error('Get admin project error:', error);
    res.status(500).json({ error: 'Failed to get project.' });
  }
}

// PUT update project
export async function updateAdminProject(req: any, res: any) {
  try {
    const { companyId, projectId } = req.params;
    const { title, description, style, location, year, images, tags } = req.body;

    // Verify project exists
    const [existing] = await pool.execute(
      'SELECT id FROM projects WHERE id = ? AND company_profile_id = ? AND deleted_at IS NULL',
      [projectId, companyId]
    );
    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    // Handle base64 images
    let finalImages: any[] | undefined;
    if (Array.isArray(images)) {
      const designerId = await resolveDesignerIdForProfile(Number(companyId));
      const persistedUrls = await persistProjectImages(images, {
        designerId,
        projectId: Number(projectId),
      });

      // Preserve AI tag metadata for existing images
      const [currentRows] = await pool.execute(
        'SELECT images FROM projects WHERE id = ? AND company_profile_id = ?',
        [projectId, companyId]
      );
      const currentRaw = (currentRows as any[])[0]?.images;
      const currentParsed = parseJsonField(currentRaw);
      const currentArray = Array.isArray(currentParsed) ? currentParsed : [];
      const metaByUrl = new Map<string, any>();
      for (const item of currentArray) {
        if (item && typeof item === 'object' && typeof item.url === 'string') {
          metaByUrl.set(item.url, item);
        }
      }

      finalImages = persistedUrls.map((img: NormalizedImage) => {
        const url = typeof img === 'string' ? img : img.url;
        const dbMeta = metaByUrl.get(url);
        if (dbMeta) {
          // Merge AI metadata from DB with user-assigned tag from incoming image
          return (typeof img === 'object' && img.tag) ? { ...dbMeta, tag: img.tag } : dbMeta;
        }
        return img;
      });
    }

    await pool.execute(
      `UPDATE projects
       SET title = ?, description = ?, style = ?, location = ?, year = ?,
           images = ?, tags = ?, updated_at = NOW()
       WHERE id = ? AND company_profile_id = ?`,
      [
        title ?? null,
        description ?? null,
        style ?? null,
        location ?? null,
        year ?? null,
        JSON.stringify(finalImages ?? []),
        JSON.stringify(tags ?? []),
        projectId,
        companyId,
      ]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Update admin project error:', error);
    res.status(500).json({ error: 'Failed to update project.' });
  }
}

// POST create project
export async function createAdminProject(req: any, res: any) {
  try {
    const { companyId } = req.params;
    const { title, description, style, location, year, images, tags } = req.body;

    // Check company status to determine project status
    const [companyRows] = await pool.execute(
      'SELECT id, status FROM company_profiles WHERE id = ?',
      [companyId]
    );
    if ((companyRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Company profile not found.' });
    }
    const company = (companyRows as any[])[0];
    const projectStatus = company.status === 'approved' ? 'published' : 'pending';

    // Handle base64 images
    let persistedImages: NormalizedImage[] = [];
    if (Array.isArray(images)) {
      const designerId = await resolveDesignerIdForProfile(Number(companyId));
      persistedImages = await persistProjectImages(images, { designerId });
    }

    const [result] = await pool.execute(
      `INSERT INTO projects (company_profile_id, title, description, style, location, year, images, tags, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        companyId,
        title ?? null,
        description ?? null,
        style ?? null,
        location ?? null,
        year ?? null,
        JSON.stringify(persistedImages),
        JSON.stringify(tags ?? []),
        projectStatus,
      ]
    );

    const newProjectId = (result as any).insertId;

    // Generate and save slug
    if (title) {
      const slug = slugify(title);
      await pool.execute('UPDATE projects SET slug = ? WHERE id = ?', [slug, newProjectId]);
    }

    res.json({ id: newProjectId });
  } catch (error) {
    console.error('Create admin project error:', error);
    res.status(500).json({ error: 'Failed to create project.' });
  }
}

// DELETE soft-delete project
export async function deleteAdminProject(req: any, res: any) {
  try {
    const { companyId, projectId } = req.params;

    const [existing] = await pool.execute(
      'SELECT id FROM projects WHERE id = ? AND company_profile_id = ? AND deleted_at IS NULL',
      [projectId, companyId]
    );
    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    await pool.execute(
      'UPDATE projects SET deleted_at = NOW() WHERE id = ? AND company_profile_id = ?',
      [projectId, companyId]
    );

    // Write audit log
    const adminId = req.admin?.id || 0;
    const adminName = req.admin?.username || req.admin?.full_name || 'unknown';
    await pool.execute(
      `INSERT INTO admin_audit_log (admin_id, admin_name, action, target_type, target_ids, metadata)
       VALUES (?, ?, 'delete_project', 'project', ?, ?)`,
      [
        adminId,
        adminName,
        JSON.stringify([Number(projectId)]),
        JSON.stringify({ company_profile_id: Number(companyId) }),
      ]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Delete admin project error:', error);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
}

// PUT restore soft-deleted project
export async function restoreAdminProject(req: any, res: any) {
  try {
    const { companyId, projectId } = req.params;

    const [existing] = await pool.execute(
      'SELECT id FROM projects WHERE id = ? AND company_profile_id = ?',
      [projectId, companyId]
    );
    if ((existing as any[]).length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    await pool.execute(
      'UPDATE projects SET deleted_at = NULL WHERE id = ? AND company_profile_id = ?',
      [projectId, companyId]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('Restore admin project error:', error);
    res.status(500).json({ error: 'Failed to restore project.' });
  }
}

// ====== Weight System ======

// GET /admin/signed-companies — 列出所有 is_signed=1 的公司（合并 company_profiles + uae_companies）
export async function listSignedCompanies(_req: any, res: any) {
  try {
    // 注意：uae_companies 没有 company_type 列（只有 categories JSON），不要 SELECT
    const [profileRows] = await pool.execute(
      `SELECT cp.id, cp.slug, cp.company_name, cp.company_type, cp.city, cp.logo_url,
              cp.weight_score, cp.created_at, cp.linked_uae_company_id
       FROM company_profiles cp
       WHERE cp.is_signed = 1 AND cp.deleted_at IS NULL
       ORDER BY cp.weight_score DESC, cp.created_at DESC`
    );
    const [scrapedRows] = await pool.execute(
      `SELECT uc.id, uc.slug, uc.name_en AS company_name, NULL AS company_type, uc.city, uc.logo_url,
              uc.weight_score, uc.created_at
       FROM uae_companies uc
       WHERE uc.is_signed = 1
       ORDER BY uc.weight_score DESC, uc.created_at DESC`
    );
    const profiles = (profileRows as any[]).map((r) => ({ ...r, source: 'profile' as const }));
    const linkedIds = new Set(profiles.map((p) => p.linked_uae_company_id).filter(Boolean));
    const scraped = (scrapedRows as any[])
      .filter((s) => !linkedIds.has(s.id))
      .map((r) => ({ ...r, source: 'scraped' as const }));
    res.json({ companies: [...profiles, ...scraped], total: profiles.length + scraped.length });
  } catch (error) {
    console.error('List signed companies error:', error);
    res.status(500).json({ error: 'Failed to list signed companies.' });
  }
}

// PUT /admin/roles/companies/:id/toggle-signed
export async function toggleCompanyProfileSigned(req: any, res: any) {
  try {
    const { id } = req.params;
    const { is_signed } = req.body;
    await pool.execute('UPDATE company_profiles SET is_signed = ? WHERE id = ?', [is_signed ? 1 : 0, id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Toggle company profile signed error:', error);
    res.status(500).json({ error: 'Failed to update signed status.' });
  }
}

// PUT /admin/companies/:id/toggle-signed (for directory companies)
export async function toggleDirectorySigned(req: any, res: any) {
  try {
    const { id } = req.params;
    const { is_signed } = req.body;
    await pool.execute('UPDATE uae_companies SET is_signed = ? WHERE id = ?', [is_signed ? 1 : 0, id]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Toggle directory signed error:', error);
    res.status(500).json({ error: 'Failed to update signed status.' });
  }
}

// PUT /admin/roles/companies/:id/toggle-published
export async function toggleCompanyProfilePublished(req: any, res: any) {
  try {
    const { id } = req.params;
    const { is_published } = req.body;
    await pool.execute('UPDATE company_profiles SET is_published = ? WHERE id = ?', [is_published ? 1 : 0, id]);
    res.json({ ok: true });
    // Fire-and-forget IndexNow notification — isolated from main error handler
    (async () => {
      try {
        if (is_published) {
          const [rows] = await pool.execute('SELECT slug FROM company_profiles WHERE id = ?', [id]);
          const slug = (rows as any[])[0]?.slug;
          if (slug) await notifyIndexNow([`/companies/${slug}`]);
        }
      } catch (err) {
        console.warn('[IndexNow] slug lookup failed (company_profiles):', err);
      }
    })();
  } catch (error) {
    console.error('Toggle company profile published error:', error);
    res.status(500).json({ error: 'Failed to update published status.' });
  }
}

// PUT /admin/companies/:companyId/toggle-published (for directory companies)
export async function toggleDirectoryPublished(req: any, res: any) {
  try {
    const { companyId } = req.params;
    const { is_published } = req.body;
    await pool.execute('UPDATE uae_companies SET is_published = ? WHERE id = ?', [is_published ? 1 : 0, companyId]);
    res.json({ ok: true });
    // Fire-and-forget IndexNow notification — isolated from main error handler
    (async () => {
      try {
        if (is_published) {
          const [rows] = await pool.execute('SELECT slug FROM uae_companies WHERE id = ?', [companyId]);
          const slug = (rows as any[])[0]?.slug;
          if (slug) await notifyIndexNow([`/companies/${slug}`]);
        }
      } catch (err) {
        console.warn('[IndexNow] slug lookup failed (uae_companies):', err);
      }
    })();
  } catch (error) {
    console.error('Toggle directory published error:', error);
    res.status(500).json({ error: 'Failed to update published status.' });
  }
}

// PUT /admin/roles/companies/:companyId/projects/:projectId/toggle-published
export async function toggleProjectPublished(req: any, res: any) {
  try {
    const { projectId } = req.params;
    const { is_published } = req.body;
    await pool.execute('UPDATE projects SET is_published = ? WHERE id = ?', [is_published ? 1 : 0, projectId]);
    res.json({ ok: true });
    // Fire-and-forget IndexNow notification — isolated from main error handler
    (async () => {
      try {
        if (is_published) {
          const [rows] = await pool.execute(
            `SELECT p.slug AS project_slug, cp.slug AS company_slug
             FROM projects p
             LEFT JOIN company_profiles cp ON p.company_profile_id = cp.id
             WHERE p.id = ?`,
            [projectId]
          );
          const row = (rows as any[])[0];
          if (row?.project_slug && row?.company_slug) {
            await notifyIndexNow([`/companies/${row.company_slug}/${row.project_slug}`]);
          }
        }
      } catch (err) {
        console.warn('[IndexNow] slug lookup failed (projects):', err);
      }
    })();
  } catch (error) {
    console.error('Toggle project published error:', error);
    res.status(500).json({ error: 'Failed to update project published status.' });
  }
}

// GET /admin/weight-config
export async function getWeightConfigList(req: any, res: any) {
  try {
    const [rows] = await pool.execute('SELECT * FROM weight_config ORDER BY id');
    res.json({ configs: rows });
  } catch (error) {
    console.error('Get weight config error:', error);
    res.status(500).json({ error: 'Failed to load weight config.' });
  }
}

// PUT /admin/weight-config/:key
export async function updateWeightConfig(req: any, res: any) {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await pool.execute('UPDATE weight_config SET config_value = ? WHERE config_key = ?', [Number(value), key]);
    res.json({ ok: true });
  } catch (error) {
    console.error('Update weight config error:', error);
    res.status(500).json({ error: 'Failed to update weight config.' });
  }
}

// POST /admin/weight-config/recalculate (manual trigger)
export async function triggerWeightRecalculation(req: any, res: any) {
  try {
    const result = await calculateAllWeights();
    res.json(result);
  } catch (error) {
    console.error('Weight recalculation error:', error);
    res.status(500).json({ error: 'Failed to recalculate weights.' });
  }
}

/**
 * POST /api/admin/profile-companies/:id/crm-provision
 * Admin manually provisions a registered company into CRM.
 * Idempotent: safe to call again if crm_tenant_id already set.
 */
export async function adminCrmProvisionCompany(req: any, res: any) {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid company id' });

    const [rows] = await pool.execute(
      'SELECT id, crm_tenant_id, status FROM company_profiles WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    const company = (rows as any[])[0];
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (company.status !== 'approved') return res.status(400).json({ error: 'Company must be approved before CRM provisioning' });

    const { provision } = await import('../lib/crmIntegrationService');
    const result = await provision(id);
    res.json({ crm_tenant_id: result.crm_tenant_id });
  } catch (err: any) {
    console.error('[Admin CRM] provision error:', err);
    res.status(502).json({ error: err.message || 'CRM provision failed' });
  }
}
