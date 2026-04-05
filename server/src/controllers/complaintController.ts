import pool from '../config/database';

async function countBySql(sql: string, params: any[] = []) {
  const [rows] = await pool.execute(sql, params);
  return Number((rows as any[])[0]?.count || 0);
}

function isRecoverableSchemaError(error: any) {
  return error?.code === 'ER_NO_SUCH_TABLE' || error?.code === 'ER_BAD_FIELD_ERROR';
}

// Submit complaint (public, no auth required)
export async function submitComplaint(req: any, res: any) {
  try {
    const { company_slug, reporter_name, reporter_email, content_type, description, evidence_urls } = req.body;

    if (!reporter_name || !reporter_email || !description) {
      return res.status(400).json({ error: 'Name, email, and description are required.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO complaints (company_slug, reporter_name, reporter_email, content_type, description, evidence_urls)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [company_slug || null, reporter_name, reporter_email, content_type || 'other', description, evidence_urls ? JSON.stringify(evidence_urls) : null]
    );

    res.status(201).json({
      message: 'Complaint submitted successfully. We will review it shortly.',
      complaintId: (result as any).insertId,
    });
  } catch (error) {
    console.error('Submit complaint error:', error);
    res.status(500).json({ error: 'Failed to submit complaint.' });
  }
}

// List complaints (admin only)
export async function getComplaints(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status, search } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      where += ' AND c.status = ?';
      params.push(status);
    }
    if (search) {
      where += ' AND (c.reporter_name LIKE ? OR c.reporter_email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM complaints c ${where}`,
      params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT c.*
       FROM complaints c
       ${where}
       ORDER BY c.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    res.json({
      complaints: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get complaints error:', error);
    res.status(500).json({ error: 'Failed to load complaints.' });
  }
}

// Update complaint status (admin only)
export async function updateComplaintStatus(req: any, res: any) {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const validStatuses = ['pending', 'reviewing', 'resolved', 'dismissed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (status) {
      updates.push('status = ?');
      values.push(status);
      if (status === 'resolved') {
        updates.push('resolved_at = NOW()');
      }
    }
    if (admin_notes !== undefined) { updates.push('admin_notes = ?'); values.push(admin_notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(id);
    await pool.execute(`UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'Complaint updated.' });
  } catch (error) {
    console.error('Update complaint status error:', error);
    res.status(500).json({ error: 'Failed to update complaint.' });
  }
}

// Get new notification counts (admin only)
export async function getNewCounts(req: any, res: any) {
  try {
    let newComplaints = 0;
    let newDesignerApps = 0;
    let newCompanyApps = 0;
    let newInquiries = 0;
    let newUsers = 0;

    try {
      newComplaints = await countBySql(`SELECT COUNT(*) as count FROM complaints WHERE status = 'pending'`);
    } catch (error: any) {
      if (!isRecoverableSchemaError(error)) throw error;
    }

    try {
      newDesignerApps = await countBySql(`SELECT COUNT(*) as count FROM designers WHERE status = 'pending'`);
    } catch (error: any) {
      if (error?.code === 'ER_BAD_FIELD_ERROR') {
        newDesignerApps = await countBySql(`SELECT COUNT(*) as count FROM designers WHERE COALESCE(is_approved, 0) = 0`);
      } else if (!isRecoverableSchemaError(error)) {
        throw error;
      }
    }

    try {
      newCompanyApps = await countBySql(`SELECT COUNT(*) as count FROM company_profiles WHERE status = 'pending' AND deleted_at IS NULL`);
    } catch (error: any) {
      if (!isRecoverableSchemaError(error)) throw error;
    }

    try {
      newInquiries = await countBySql(`SELECT COUNT(*) as count FROM inquiries WHERE status = 'new'`);
    } catch (error: any) {
      if (!isRecoverableSchemaError(error)) throw error;
    }

    try {
      newUsers = await countBySql(`SELECT COUNT(*) as count FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`);
    } catch (error: any) {
      if (!isRecoverableSchemaError(error)) throw error;
    }

    res.json({ newComplaints, newDesignerApps, newCompanyApps, newInquiries, newUsers });
  } catch (error) {
    console.error('Get new counts error:', error);
    res.status(500).json({ error: 'Failed to get notification counts.' });
  }
}
