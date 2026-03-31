import pool from '../config/database';

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
        u.full_name as owner_name, u.email as owner_email
       FROM uae_companies c
       LEFT JOIN users u ON c.owner_user_id = u.id
       ${where}
       ORDER BY c.id ASC
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
