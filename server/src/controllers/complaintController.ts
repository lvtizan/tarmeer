import pool from '../config/database';

// Submit complaint (public, no auth required)
export async function submitComplaint(req: any, res: any) {
  try {
    const { name, email, phone, content_url, original_url, description } = req.body;

    if (!name || !email || !content_url || !description) {
      return res.status(400).json({ error: 'Name, email, content URL, and description are required.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO copyright_complaints (name, email, phone, content_url, original_url, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, phone || null, content_url, original_url || null, description]
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
      where += ' AND cc.status = ?';
      params.push(status);
    }
    if (search) {
      where += ' AND (cc.name LIKE ? OR cc.email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM copyright_complaints cc ${where}`,
      params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT cc.*
       FROM copyright_complaints cc
       ${where}
       ORDER BY cc.created_at DESC
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

    const validStatuses = ['new', 'processing', 'resolved', 'rejected'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (status) { updates.push('status = ?'); values.push(status); }
    if (admin_notes !== undefined) { updates.push('admin_notes = ?'); values.push(admin_notes); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    values.push(id);
    await pool.execute(`UPDATE copyright_complaints SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'Complaint updated.' });
  } catch (error) {
    console.error('Update complaint error:', error);
    res.status(500).json({ error: 'Failed to update complaint.' });
  }
}

// Get new notification counts (admin only)
export async function getNewCounts(req: any, res: any) {
  try {
    const [complaintRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM copyright_complaints WHERE status = 'new'`
    );
    const newComplaints = (complaintRows as any[])[0].count;

    const [designerRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM designers WHERE status = 'pending'`
    );
    const newDesignerApps = (designerRows as any[])[0].count;

    res.json({ newComplaints, newDesignerApps });
  } catch (error) {
    console.error('Get new counts error:', error);
    res.status(500).json({ error: 'Failed to get notification counts.' });
  }
}
