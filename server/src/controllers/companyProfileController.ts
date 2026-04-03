import pool from '../config/database';
import { notifyCompanyRegistration } from '../services/notificationService';

const VALID_SERVICES = [
  'Interior Design', 'Architecture', 'Fit-Out', 'Renovation', 'Construction', 'Landscape',
  'Furniture', 'Joinery', 'MEP', 'Project Management', 'Design & Build', 'Turnkey Solutions', 'Maintenance'
];

const VALID_SPECIALTIES = [
  'Residential', 'Villa', 'Commercial', 'Hospitality', 'Retail', 'Office',
  'Education', 'Healthcare', 'F&B', 'Luxury Residential', 'Mixed-Use'
];

/**
 * POST /api/company/profile
 * Create or update company profile
 */
export async function upsertProfile(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const { company_name, description, contact_person, phone, website, city, address, logo_url, services, company_type, trade_license_number, establishment_year, specialties } = req.body;

    if (!company_name || !description || !contact_person || !phone || !city || !address || !company_type) {
      return res.status(400).json({ error: 'Company name, description, contact person, phone, city, address, and company type are required.' });
    }

    if (!['design_studio', 'renovation_company'].includes(company_type)) {
      return res.status(400).json({ error: 'Company type must be either design_studio or renovation_company.' });
    }

    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ error: 'At least one service must be selected.' });
    }

    // Validate services
    const invalidServices = services.filter((s: string) => !VALID_SERVICES.includes(s));
    if (invalidServices.length > 0) {
      return res.status(400).json({ error: `Invalid services: ${invalidServices.join(', ')}` });
    }

    // Validate specialties if provided
    if (specialties && Array.isArray(specialties)) {
      const invalidSpecialties = specialties.filter((s: string) => !VALID_SPECIALTIES.includes(s));
      if (invalidSpecialties.length > 0) {
        return res.status(400).json({ error: `Invalid specialties: ${invalidSpecialties.join(', ')}` });
      }
    }

    const servicesJson = JSON.stringify(services);
    const specialtiesJson = specialties ? JSON.stringify(specialties) : null;

    // Check if profile exists
    const [existing] = await pool.execute('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);

    if ((existing as any[]).length > 0) {
      await pool.execute(
        `UPDATE company_profiles SET company_name = ?, description = ?, contact_person = ?, phone = ?, website = ?, city = ?, address = ?, logo_url = ?, services = ?, company_type = ?, trade_license_number = ?, establishment_year = ?, specialties = ? WHERE user_id = ?`,
        [company_name, description, contact_person, phone, website || null, city, address, logo_url || null, servicesJson, company_type, trade_license_number || null, establishment_year || null, specialtiesJson, userId]
      );
    } else {
      await pool.execute(
        `INSERT INTO company_profiles (user_id, company_name, description, contact_person, phone, website, city, address, logo_url, services, company_type, trade_license_number, establishment_year, specialties, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [userId, company_name, description, contact_person, phone, website || null, city, address, logo_url || null, servicesJson, company_type, trade_license_number || null, establishment_year || null, specialtiesJson]
      );

      // Notify admins of new company registration
      setImmediate(() => {
        notifyCompanyRegistration({
          companyName: company_name, contactPerson: contact_person,
          phone, city, companyType: company_type, services,
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
      return res.json({ profile: null });
    }

    res.json({ profile: (rows as any[])[0] });
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

    res.json({ projects });
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
  res.json({ services: VALID_SERVICES });
}

