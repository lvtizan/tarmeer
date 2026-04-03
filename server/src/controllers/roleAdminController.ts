import pool from '../config/database';

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
       LEFT JOIN designers d ON d.id = hp.assigned_designer_id AND d.deleted_at IS NULL
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
      'SELECT id, full_name FROM designers WHERE id = ? AND deleted_at IS NULL AND is_approved = 1',
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

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM company_profiles cp ${whereClause}`,
      params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT cp.*, u.email as user_email, u.full_name as user_name, cp.company_type,
              uc.name_en as linked_company_name, uc.slug as linked_company_slug
       FROM company_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN uae_companies uc ON uc.id = cp.linked_uae_company_id
       ${whereClause}
       ORDER BY cp.display_order DESC, cp.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
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
    const { display_order } = req.body;

    await pool.execute('UPDATE company_profiles SET display_order = ? WHERE id = ?', [display_order || 0, id]);
    res.json({ message: 'Display order updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update display order.' });
  }
}
