import pool from '../config/database';

async function hasColumn(table: string, column: string) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number((rows as any[])[0]?.count || 0) > 0;
}

/**
 * GET /api/admin/roles/homeowners
 * List homeowner users (no approval needed, just listing)
 */
export async function listHomeowners(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM homeowner_profiles hp JOIN users u ON u.id = hp.user_id'
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT hp.*, u.email, u.full_name as user_name, u.avatar_url, u.created_at as user_created_at,
              d.full_name as assigned_designer_name
       FROM homeowner_profiles hp
       JOIN users u ON u.id = hp.user_id
       LEFT JOIN designers d ON d.id = hp.assigned_designer_id
       ORDER BY hp.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({ homeowners: rows, total, page, limit });
  } catch (error) {
    console.error('List homeowners error:', error);
    res.status(500).json({ error: 'Failed to list homeowners.' });
  }
}

/**
 * POST /api/admin/homeowners/:id/assign
 * Assign a designer to a homeowner
 */
export async function assignDesigner(req: any, res: any) {
  try {
    const { id } = req.params;
    const { designer_id } = req.body;

    if (!designer_id) {
      return res.status(400).json({ error: 'designer_id is required.' });
    }

    // Verify designer exists
    const [designerRows] = await pool.execute(
      'SELECT id, full_name FROM designers WHERE id = ? AND (status = \'approved\' OR is_approved = 1)',
      [designer_id]
    );
    if ((designerRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Approved designer not found.' });
    }

    await pool.execute(
      'UPDATE homeowner_profiles SET assigned_designer_id = ?, assigned_at = NOW() WHERE id = ?',
      [designer_id, id]
    );

    res.json({
      message: 'Designer assigned successfully.',
      designer_name: (designerRows as any[])[0].full_name,
    });
  } catch (error) {
    console.error('Assign designer error:', error);
    res.status(500).json({ error: 'Failed to assign designer.' });
  }
}


/**
 * GET /api/admin/roles/companies
 * List company profiles with approval status
 */
export async function listCompanies(req: any, res: any) {
  try {
    const status = req.query.status || 'all';
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status !== 'all') {
      whereClause += ' AND cp.status = ?';
      params.push(status);
    }

    const companyType = req.query.company_type;
    const companyTypeColumnExists = await hasColumn('company_profiles', 'company_type');
    if (companyType && companyType !== 'all' && companyTypeColumnExists) {
      whereClause += ' AND cp.company_type = ?';
      params.push(companyType);
    }

    const search = req.query.search;
    if (search) {
      whereClause += ' AND (cp.company_name LIKE ? OR u.email LIKE ? OR u.full_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM company_profiles cp JOIN users u ON u.id = cp.user_id ${whereClause}`,
      params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT cp.*, u.email as user_email, u.full_name as user_name,
              uc.name_en as linked_company_name, uc.slug as linked_company_slug,
              COALESCE(pc.project_count, 0) as project_count
       FROM company_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN uae_companies uc ON uc.id = cp.linked_uae_company_id
       LEFT JOIN (
         SELECT company_profile_id, COUNT(*) as project_count
         FROM projects
         GROUP BY company_profile_id
       ) pc ON pc.company_profile_id = cp.id
       ${whereClause}
       ORDER BY cp.display_order DESC, cp.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    res.json({ companies: rows, total, page, limit });
  } catch (error) {
    console.error('List companies error:', error);
    res.status(500).json({ error: 'Failed to list companies.' });
  }
}

/**
 * POST /api/admin/roles/companies/:id/approve
 */
export async function approveCompany(req: any, res: any) {
  try {
    const { id } = req.params;
    const adminId = req.admin?.id;

    await pool.execute(
      `UPDATE company_profiles SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [adminId, id]
    );

    res.json({ message: 'Company approved.' });
  } catch (error) {
    console.error('Approve company error:', error);
    res.status(500).json({ error: 'Failed to approve company.' });
  }
}

/**
 * POST /api/admin/roles/companies/:id/reject
 */
export async function rejectCompany(req: any, res: any) {
  try {
    const { id } = req.params;
    const adminId = req.admin?.id;
    const { reason } = req.body;

    await pool.execute(
      `UPDATE company_profiles SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [reason || null, adminId, id]
    );

    res.json({ message: 'Company rejected.' });
  } catch (error) {
    console.error('Reject company error:', error);
    res.status(500).json({ error: 'Failed to reject company.' });
  }
}

/**
 * PUT /api/admin/roles/companies/:id/display-order
 * Set display weight
 */
export async function updateCompanyDisplayOrder(req: any, res: any) {
  try {
    const { id } = req.params;
    const displayOrder = Number.isFinite(Number(req.body?.display_order))
      ? Math.max(0, Number(req.body.display_order))
      : 0;

    const profileId = Number(id);
    const [currentRows] = await pool.execute(
      'SELECT COALESCE(display_order, 0) AS display_order FROM company_profiles WHERE id = ? LIMIT 1',
      [profileId]
    );
    const current = (currentRows as any[])[0];
    if (!current) return res.status(404).json({ error: 'Company profile not found.' });

    // No-op update should always pass.
    if (displayOrder !== Number(current.display_order || 0) && displayOrder > 0) {
      const [conflicts] = await pool.execute(
        `SELECT 'company_profiles' AS source, id
         FROM company_profiles
         WHERE COALESCE(display_order, 0) = ? AND id <> ?
         UNION ALL
         SELECT 'uae_companies' AS source, id
         FROM uae_companies
         WHERE COALESCE(display_order, 0) = ?
            OR COALESCE(home_display_order, 0) = ?
            OR COALESCE(list_display_order, 0) = ?
         LIMIT 1`,
        [displayOrder, profileId, displayOrder, displayOrder, displayOrder]
      );

      if ((conflicts as any[]).length > 0) {
        return res.status(409).json({
          error: `序号 ${displayOrder} 已占用，请用新的序号 / Order ${displayOrder} is occupied, please use a new order number.`,
        });
      }
    }

    await pool.execute('UPDATE company_profiles SET display_order = ? WHERE id = ?', [displayOrder, id]);
    res.json({ message: 'Display order updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update display order.' });
  }
}
