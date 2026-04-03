import pool from '../config/database';

// List users with pagination, filters, search
export async function listUsers(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { role, status, search } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (role) { where += ' AND role = ?'; params.push(role); }
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (search) {
      where += ' AND (full_name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM users ${where}`, params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT id, email, full_name, phone, city, avatar_url, role, status, email_verified, created_at, updated_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    res.json({
      users: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users.' });
  }
}

// Get user detail with linked designer/company info
export async function getUserDetail(req: any, res: any) {
  try {
    const { id } = req.params;

    const [userRows] = await pool.execute(
      'SELECT id, email, full_name, phone, city, avatar_url, role, status, email_verified, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if ((userRows as any[]).length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = (userRows as any[])[0];

    // Get linked designer
    const [designerRows] = await pool.execute(
      'SELECT id, full_name, status, is_approved, bio, style, city, avatar_url, created_at FROM designers WHERE user_id = ? AND deleted_at IS NULL',
      [id]
    );

    const designer = (designerRows as any[])[0] || null;

    // Get designer's projects if linked
    let projects: any[] = [];
    if (designer) {
      const [projectRows] = await pool.execute(
        'SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, created_at, updated_at FROM projects WHERE designer_id = ? ORDER BY created_at DESC',
        [designer.id]
      );
      projects = (projectRows as any[]).map((p: any) => {
        let parsedImages = p.images;
        if (typeof parsedImages === 'string') {
          try { parsedImages = JSON.parse(parsedImages); } catch { parsedImages = []; }
        }
        return { ...p, images: Array.isArray(parsedImages) ? parsedImages : [] };
      });
    }

    // Get linked company
    const [companyRows] = await pool.execute(
      'SELECT id, slug, city FROM uae_companies WHERE owner_user_id = ?',
      [id]
    );

    // Get company applications
    const [appRows] = await pool.execute(
      'SELECT id, company_name, status, created_at FROM company_applications WHERE user_id = ? ORDER BY created_at DESC',
      [id]
    );

    res.json({
      user,
      designer,
      projects,
      company: (companyRows as any[])[0] || null,
      companyApplications: appRows,
    });
  } catch (error) {
    console.error('Get user detail error:', error);
    res.status(500).json({ error: 'Failed to get user.' });
  }
}

// Update user status (activate/suspend)
export async function updateUserStatus(req: any, res: any) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be active or suspended.' });
    }

    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: `User ${status === 'active' ? 'activated' : 'suspended'}.` });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
}

// Update user role
export async function updateUserRole(req: any, res: any) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'designer', 'company'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ message: `User role updated to ${role}.` });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update role.' });
  }
}
