import pool from '../config/database';
import { analyticsEvents } from '../lib/analyticsEvents';

// Submit company application
export async function applyAsCompany(req: any, res: any) {
  try {
    const userId = req.user.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });

    // Check for existing pending/approved application
    const [existing] = await pool.execute(
      "SELECT id, status FROM company_applications WHERE user_id = ? AND status IN ('pending', 'approved')",
      [userId]
    );
    if ((existing as any[]).length > 0) {
      const app = (existing as any[])[0];
      return res.status(400).json({
        error: 'You already have a company application.',
        status: app.status,
      });
    }

    const { company_name, license_number, phone, city, address, description } = req.body;

    if (!company_name) {
      return res.status(400).json({ error: 'Company name is required.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO company_applications (user_id, company_name, license_number, phone, city, address, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, company_name, license_number || null, phone || null, city || null, address || null, description || null]
    );

    const applicationId = (result as any).insertId;

    // Push to admin SSE subscribers
    analyticsEvents.notifyChange('company_application');

    res.status(201).json({
      message: 'Company application submitted successfully. It will be reviewed by our team.',
      applicationId,
      status: 'pending',
    });
  } catch (error) {
    console.error('Apply as company error:', error);
    res.status(500).json({ error: 'Failed to submit application.' });
  }
}

// Get current user's company application status
export async function getMyCompanyStatus(req: any, res: any) {
  try {
    const userId = req.user.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });

    const [rows] = await pool.execute(
      'SELECT id, company_name, status, admin_notes, linked_company_id, created_at FROM company_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if ((rows as any[]).length === 0) {
      return res.json({ applied: false });
    }

    const app = (rows as any[])[0];

    // If approved and linked, get company info
    let company = null;
    if (app.linked_company_id) {
      const [companyRows] = await pool.execute(
        'SELECT id, name, slug, logo_url, city FROM uae_companies WHERE id = ?',
        [app.linked_company_id]
      );
      if ((companyRows as any[]).length > 0) {
        company = (companyRows as any[])[0];
      }
    }

    res.json({
      applied: true,
      applicationId: app.id,
      companyName: app.company_name,
      status: app.status,
      adminNotes: app.admin_notes,
      linkedCompany: company,
      appliedAt: app.created_at,
    });
  } catch (error) {
    console.error('Get company status error:', error);
    res.status(500).json({ error: 'Failed to get status.' });
  }
}
