import pool from '../config/database';
import { analyticsEvents } from '../lib/analyticsEvents';
import { notifyCompanyRegistration } from '../services/notificationService';
import {
  normalizeCompanyProfilePayload,
  validateCompanyProfilePayload,
} from '../lib/companyProfileDraft';
import { generateEmailHandle, slugify } from '../lib/slugify';
import { parseJsonField } from '../lib/parseJsonField';
import { logActivity, getClientIp } from '../lib/activityLogger';
import { getValidServices } from '../lib/enumCache';

/**
 * POST /api/company/profile
 * Create or update company profile
 */
export async function upsertProfile(req: any, res: any) {
  try {
    const userId = req.user.userId;

    // Only company-role users may create/update a company profile
    if (req.user.role !== 'company' && req.user.active_role !== 'company') {
      return res.status(403).json({ error: 'Only company accounts can create a company profile.' });
    }

    const payload = normalizeCompanyProfilePayload(req.body);
    const validationError = await validateCompanyProfilePayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const servicesJson = JSON.stringify(payload.services);
    const specialtiesJson = JSON.stringify(payload.specialties);
    const companyTypesJson = JSON.stringify(payload.company_types);
    const emiratesServedJson = JSON.stringify(payload.emirates_served);
    const onboardingStep = typeof req.body.onboarding_step === 'number' ? req.body.onboarding_step : null;
    const signupSource = typeof req.body.signup_source === 'string' ? req.body.signup_source.slice(0, 64) : null;

    // Check if profile exists (fetch old onboarding_step for notification trigger)
    const [existing] = await pool.execute('SELECT id, onboarding_step, signup_source FROM company_profiles WHERE user_id = ?', [userId]);
    const oldStep = (existing as any[])[0]?.onboarding_step ?? -1;
    const existingSource = (existing as any[])[0]?.signup_source;

    if ((existing as any[]).length > 0) {
      // UPDATE: preserve existing slug so public URLs don't break
      await pool.execute(
        `UPDATE company_profiles SET company_name = ?, description = ?, contact_person = ?, phone = ?, website = ?, city = ?, address = ?, logo_url = ?, services = ?, company_type = ?, company_types = ?, trade_license_number = ?, establishment_year = ?, specialties = ?, emirates_served = ?, onboarding_step = GREATEST(COALESCE(onboarding_step, 0), ?), signup_source = COALESCE(signup_source, ?) WHERE user_id = ?`,
        [
          payload.company_name,
          payload.description,
          payload.contact_person,
          payload.phone,
          payload.website,
          payload.city,
          payload.address,
          payload.logo_url,
          servicesJson,
          payload.company_type,
          companyTypesJson,
          payload.trade_license_number,
          payload.establishment_year,
          specialtiesJson,
          emiratesServedJson,
          onboardingStep || 0,
          signupSource,
          userId,
        ]
      );
    } else {
      // INSERT: generate slug from user's email prefix, with collision handling
      const [userRows] = await pool.execute('SELECT email FROM users WHERE id = ?', [userId]);
      const userEmail: string = (userRows as any[])[0]?.email || '';
      const baseHandle = generateEmailHandle(userEmail);

      let slug = baseHandle;
      let suffix = 2;
      while (true) {
        const [conflict] = await pool.execute('SELECT id FROM company_profiles WHERE slug = ?', [slug]);
        if ((conflict as any[]).length === 0) break;
        slug = `${baseHandle}-${suffix++}`;
      }

      await pool.execute(
        `INSERT INTO company_profiles (user_id, company_name, description, contact_person, phone, website, city, address, logo_url, services, company_type, company_types, trade_license_number, establishment_year, specialties, emirates_served, slug, status, onboarding_step, signup_source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        [
          userId,
          payload.company_name,
          payload.description,
          payload.contact_person,
          payload.phone,
          payload.website,
          payload.city,
          payload.address,
          payload.logo_url,
          servicesJson,
          payload.company_type,
          companyTypesJson,
          payload.trade_license_number,
          payload.establishment_year,
          specialtiesJson,
          emiratesServedJson,
          slug,
          onboardingStep || 0,
          signupSource,
        ]
      );
    }

    // Notify admins when onboarding reaches step 2+ (user has filled all info + uploaded project)
    const newStep = Math.max(onboardingStep || 0, oldStep);
    if (oldStep < 2 && newStep >= 2) {
      const effectiveSource = signupSource || existingSource || undefined;
      setImmediate(() => {
        notifyCompanyRegistration({
          companyName: payload.company_name, contactPerson: payload.contact_person,
          phone: payload.phone, city: payload.city, companyType: payload.company_type, services: payload.services,
          signupSource: effectiveSource,
        }).catch(() => {});
      });
    }
    // Push to admin SSE subscribers (map dashboard real-time animation)
    analyticsEvents.notifyChange('company');

    // Ensure active_role is set
    await pool.execute(
      'UPDATE users SET active_role = ?, onboarding_completed = 1 WHERE id = ?',
      ['company', userId]
    );

    const [rows] = await pool.execute('SELECT * FROM company_profiles WHERE user_id = ?', [userId]);

    setImmediate(() => {
      logActivity({
        userId, userName: payload.company_name, userRole: 'company',
        action: (existing as any[]).length > 0 ? 'update' : 'create', targetType: 'company_profile',
        targetName: payload.company_name, description: (existing as any[]).length > 0 ? `编辑了公司资料「${payload.company_name}」` : `创建了公司资料「${payload.company_name}」`,
        ip: getClientIp(req),
      }).catch(() => {});
    });

    res.json({ profile: (rows as any[])[0] });
  } catch (error) {
    console.error('Upsert company profile error:', error);
    res.status(500).json({ error: 'Failed to save company profile.' });
  }
}

/**
 * GET /api/company/profile
 */
export async function getProfile(req: any, res: any) {
  try {
    const userId = req.user.userId;
    let [rows] = await pool.execute('SELECT * FROM company_profiles WHERE user_id = ?', [userId]);

    // Auto-create profile from company_leads if user has no profile yet
    if ((rows as any[]).length === 0) {
      const [userRows] = await pool.execute('SELECT phone, email FROM users WHERE id = ?', [userId]);
      const userPhone = (userRows as any[])[0]?.phone;
      const userEmail = (userRows as any[])[0]?.email;

      // Match by phone first, then by email as fallback (covers Google OAuth without phone)
      let lead: any = null;
      if (userPhone) {
        const [leadRows] = await pool.execute(
          'SELECT contact_name, phone, company_name, company_type, city, year_established FROM company_leads WHERE phone = ? ORDER BY created_at DESC LIMIT 1',
          [userPhone]
        );
        lead = (leadRows as any[])[0];
      }
      if (!lead && userEmail) {
        const [leadRows] = await pool.execute(
          'SELECT contact_name, phone, company_name, company_type, city, year_established FROM company_leads WHERE email = ? ORDER BY created_at DESC LIMIT 1',
          [userEmail]
        );
        lead = (leadRows as any[])[0];
      }

      if (lead) {
        const leadSlug = slugify(lead.company_name || '');
        await pool.execute(
          `INSERT INTO company_profiles (user_id, company_name, contact_person, phone, city, address, company_type, establishment_year, slug, status, description, services, specialties, onboarding_step, signup_source)
           VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, 'pending', '', '["Interior Design"]', '[]', 0, 'company-lead-backfill')`,
          [userId, lead.company_name, lead.contact_name, lead.phone, lead.city || null, lead.company_type || null, lead.year_established || null, leadSlug]
        );
        await pool.execute("UPDATE users SET active_role = 'company' WHERE id = ?", [userId]);
        [rows] = await pool.execute('SELECT * FROM company_profiles WHERE user_id = ?', [userId]);
        // Lead-backfill creates a real company_profile row → push event
        analyticsEvents.notifyChange('company');
      }
    }

    if ((rows as any[]).length === 0) {
      return res.json({ profile: null, projectCount: 0 });
    }

    const profile = (rows as any[])[0];
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as cnt FROM projects WHERE company_profile_id = ? AND deleted_at IS NULL',
      [profile.id]
    );
    const projectCount = (countRows as any[])[0]?.cnt || 0;

    res.json({ profile, projectCount });
  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({ error: 'Failed to get company profile.' });
  }
}

/**
 * GET /api/company/projects
 * List projects owned by this company
 */
export async function getCompanyProjects(req: any, res: any) {
  try {
    const userId = req.user.userId;

    const [companyRows] = await pool.execute('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);
    if ((companyRows as any[]).length === 0) {
      return res.json({ projects: [] });
    }

    const companyProfileId = (companyRows as any[])[0].id;

    const [projects] = await pool.execute(
      `SELECT * FROM projects WHERE company_profile_id = ? ORDER BY created_at DESC`,
      [companyProfileId]
    );

    const normalized = (projects as any[]).map((p) => ({
      ...p,
      images: parseJsonField(p.images) || [],
      tags: parseJsonField(p.tags) || [],
    }));

    res.json({ projects: normalized });
  } catch (error) {
    console.error('Get company projects error:', error);
    res.status(500).json({ error: 'Failed to get projects.' });
  }
}

/**
 * GET /api/company/services
 * Return available service options
 */
export async function getServiceOptions(_req: any, res: any) {
  try {
    const services = await getValidServices();
    res.json({ services });
  } catch {
    res.status(500).json({ error: 'Failed to load services.' });
  }
}

/**
 * GET /api/company/service-groups
 * Return services grouped by category, for the service-picker UI.
 * Services with DB category set take precedence; others fall back to hardcoded mapping.
 */
export async function getServiceGroups(_req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      'SELECT name, category FROM company_services WHERE active = 1 ORDER BY sort_order, name'
    ) as any[];

    // Build category → names map from DB
    const dbCat = new Map<string, string[]>();
    const noCat: string[] = [];
    for (const row of rows) {
      if (row.category) {
        if (!dbCat.has(row.category)) dbCat.set(row.category, []);
        dbCat.get(row.category)!.push(row.name);
      } else {
        noCat.push(row.name);
      }
    }

    // Merge with hardcoded SERVICE_CATEGORIES (source of truth for category names + base subs)
    const HARDCODED: { name: string; subs: string[] }[] = [
      { name: 'Design & Planning', subs: ['Interior Design', 'Architecture', 'Spatial Planning', 'Project Management'] },
      { name: 'Construction', subs: ['Construction', 'Fit-Out', 'Civil Works'] },
      { name: 'Design & Build', subs: ['Design & Build', 'Turnkey Solutions', 'Full Package'] },
      { name: 'Renovation', subs: ['Full Renovation', 'Kitchen Renovation', 'Bathroom Renovation', 'Partial Renovation'] },
      { name: 'Outdoor & Pools', subs: ['Landscape Design', 'Pool Construction', 'Garden Design', 'Outdoor Lighting'] },
      { name: 'Home Systems', subs: ['MEP', 'Smart Home & Automation', 'HVAC & Ducting', 'Electrical', 'Plumbing'] },
      { name: 'Interiors & Furniture', subs: ['Furniture Supply', 'Custom Joinery', 'Curtains & Blinds', 'Flooring', 'Wallpaper & Finishes'] },
      { name: 'Maintenance', subs: ['General Maintenance', 'Deep Cleaning', 'Handyman Services', 'AC Maintenance'] },
      { name: 'Specialty Works', subs: ['Glass & Aluminium', 'Stone & Marble', 'Steel Works', 'Waterproofing', 'Fire Fighting & Safety'] },
    ];

    const result = HARDCODED.map((cat) => {
      // Start with base subs, add DB-categorized services for this category
      const subsSet = new Set(cat.subs);
      const dbSubs = dbCat.get(cat.name) || [];
      dbSubs.forEach((s) => subsSet.add(s));
      return { name: cat.name, subs: Array.from(subsSet) };
    });

    // Add any DB categories not in HARDCODED
    for (const [catName, subs] of dbCat) {
      if (!HARDCODED.find((c) => c.name === catName)) {
        result.push({ name: catName, subs });
      }
    }

    res.json({ categories: result });
  } catch (error) {
    console.error('getServiceGroups error:', error);
    res.status(500).json({ error: 'Failed to load service groups.' });
  }
}
