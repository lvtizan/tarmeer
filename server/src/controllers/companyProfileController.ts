import pool from '../config/database';
import { notifyCompanyRegistration } from '../services/notificationService';
import {
  normalizeCompanyProfilePayload,
  validateCompanyProfilePayload,
} from '../lib/companyProfileDraft';
import { slugify } from '../lib/slugify';
import { parseJsonField } from '../lib/parseJsonField';
import { logActivity, getClientIp } from '../lib/activityLogger';

/**
 * POST /api/company/profile
 * Create or update company profile
 */
export async function upsertProfile(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const payload = normalizeCompanyProfilePayload(req.body);
    const validationError = await validateCompanyProfilePayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const servicesJson = JSON.stringify(payload.services);
    const specialtiesJson = JSON.stringify(payload.specialties);
    const slug = slugify(payload.company_name);
    const onboardingStep = typeof req.body.onboarding_step === 'number' ? req.body.onboarding_step : null;
    const signupSource = typeof req.body.signup_source === 'string' ? req.body.signup_source.slice(0, 64) : null;

    // Check if profile exists (fetch old onboarding_step for notification trigger)
    const [existing] = await pool.execute('SELECT id, onboarding_step, signup_source FROM company_profiles WHERE user_id = ?', [userId]);
    const oldStep = (existing as any[])[0]?.onboarding_step ?? -1;
    const existingSource = (existing as any[])[0]?.signup_source;

    if ((existing as any[]).length > 0) {
      await pool.execute(
        `UPDATE company_profiles SET company_name = ?, description = ?, contact_person = ?, phone = ?, website = ?, city = ?, address = ?, logo_url = ?, services = ?, company_type = ?, trade_license_number = ?, establishment_year = ?, specialties = ?, slug = ?, onboarding_step = GREATEST(COALESCE(onboarding_step, 0), ?), signup_source = COALESCE(signup_source, ?) WHERE user_id = ?`,
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
          payload.trade_license_number,
          payload.establishment_year,
          specialtiesJson,
          slug,
          onboardingStep || 0,
          signupSource,
          userId,
        ]
      );
    } else {
      await pool.execute(
        `INSERT INTO company_profiles (user_id, company_name, description, contact_person, phone, website, city, address, logo_url, services, company_type, trade_license_number, establishment_year, specialties, slug, status, onboarding_step, signup_source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
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
          payload.trade_license_number,
          payload.establishment_year,
          specialtiesJson,
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
  res.json({
    services: [
      'Interior Design', 'Architecture', 'Fit-Out', 'Renovation', 'Construction', 'Landscape',
      'Furniture', 'Joinery', 'MEP', 'Project Management', 'Design & Build', 'Turnkey Solutions', 'Maintenance',
    ],
  });
}
