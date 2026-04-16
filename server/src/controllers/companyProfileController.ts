import pool from '../config/database';
import { notifyCompanyRegistration } from '../services/notificationService';
import {
  normalizeCompanyProfilePayload,
  validateCompanyProfilePayload,
} from '../lib/companyProfileDraft';
import { slugify } from '../lib/slugify';
import { parseJsonField } from '../lib/parseJsonField';

/**
 * POST /api/company/profile
 * Create or update company profile
 */
export async function upsertProfile(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const payload = normalizeCompanyProfilePayload(req.body);
    const validationError = validateCompanyProfilePayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const servicesJson = JSON.stringify(payload.services);
    const specialtiesJson = JSON.stringify(payload.specialties);
    const slug = slugify(payload.company_name);
    const onboardingStep = typeof req.body.onboarding_step === 'number' ? req.body.onboarding_step : null;
    const signupSource = typeof req.body.signup_source === 'string' ? req.body.signup_source.slice(0, 64) : null;

    // Check if profile exists
    const [existing] = await pool.execute('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);

    if ((existing as any[]).length > 0) {
      await pool.execute(
        `UPDATE company_profiles SET company_name = ?, description = ?, contact_person = ?, phone = ?, website = ?, city = ?, address = ?, logo_url = ?, services = ?, company_type = ?, trade_license_number = ?, establishment_year = ?, specialties = ?, slug = ?, onboarding_step = GREATEST(COALESCE(onboarding_step, 0), ?) WHERE user_id = ?`,
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

      // Notify admins of new company registration
      setImmediate(() => {
        notifyCompanyRegistration({
          companyName: payload.company_name, contactPerson: payload.contact_person,
          phone: payload.phone, city: payload.city, companyType: payload.company_type, services: payload.services,
          signupSource: signupSource || undefined,
        }).catch(() => {});
      });
    }

    // Ensure active_role is set
    await pool.execute(
      'UPDATE users SET active_role = ?, onboarding_completed = 1 WHERE id = ?',
      ['company', userId]
    );

    const [rows] = await pool.execute('SELECT * FROM company_profiles WHERE user_id = ?', [userId]);
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
    const [rows] = await pool.execute('SELECT * FROM company_profiles WHERE user_id = ?', [userId]);

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
