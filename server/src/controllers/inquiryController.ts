import pool from '../config/database';
import * as XLSX from 'xlsx';
import { notifyNewInquiry } from '../services/notificationService';

const VALID_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
const VALID_AREA_RANGES = ['< 50m²', '50-100m²', '100-200m²', '200-500m²', '500m²+'];

// Submit inquiry (public, no auth required)
export async function submitInquiry(req: any, res: any) {
  try {
    const { name, phone, city, area_range, message, company_id } = req.body;

    if (!name || !phone || !city || !area_range) {
      return res.status(400).json({ error: 'Name, phone, city, and area range are required.' });
    }

    if (!VALID_CITIES.includes(city)) {
      return res.status(400).json({ error: 'Invalid city.' });
    }

    if (!VALID_AREA_RANGES.includes(area_range)) {
      return res.status(400).json({ error: 'Invalid area range.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO design_inquiries (name, phone, city, area_range, message, company_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, phone, city, area_range, message || null, company_id || null]
    );

    const inquiryId = (result as any).insertId;

    // Async notification (don't block response)
    let companyName: string | undefined;
    if (company_id) {
      const [cRows] = await pool.execute('SELECT company_name FROM company_profiles WHERE id = ?', [company_id]);
      companyName = (cRows as any[])[0]?.company_name;
    }
    setImmediate(() => {
      notifyNewInquiry({ id: inquiryId, name, phone, city, area_range, message, companyName }).catch(() => {});
    });

    res.status(201).json({
      message: 'Inquiry submitted successfully. We will contact you soon.',
      inquiryId,
    });
  } catch (error) {
    console.error('Submit inquiry error:', error);
    res.status(500).json({ error: 'Failed to submit inquiry.' });
  }
}

// List inquiries (admin only)
export async function getInquiries(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status, designer_id, company_id, search } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status) {
      where += ' AND di.status = ?';
      params.push(status);
    }
    if (company_id) {
      where += ' AND di.company_id = ?';
      params.push(company_id);
    }
    if (search) {
      where += ' AND (di.name LIKE ? OR di.phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM design_inquiries di ${where}`,
      params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT di.*,
        cp.company_name
       FROM design_inquiries di
       LEFT JOIN company_profiles cp ON di.company_id = cp.id
       ${where}
       ORDER BY di.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    res.json({
      inquiries: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get inquiries error:', error);
    res.status(500).json({ error: 'Failed to load inquiries.' });
  }
}

// Update inquiry status (admin only)
export async function updateInquiryStatus(req: any, res: any) {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const validStatuses = ['new', 'contacted', 'resolved', 'archived'];
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
    await pool.execute(`UPDATE design_inquiries SET ${updates.join(', ')} WHERE id = ?`, values);

    res.json({ message: 'Inquiry updated.' });
  } catch (error) {
    console.error('Update inquiry error:', error);
    res.status(500).json({ error: 'Failed to update inquiry.' });
  }
}

// Export inquiries as Excel (admin only)
export async function exportInquiries(req: any, res: any) {
  try {
    const { status, designer_id, company_id } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status) { where += ' AND di.status = ?'; params.push(status); }
    if (company_id) { where += ' AND di.company_id = ?'; params.push(company_id); }

    const [rows] = await pool.execute(
      `SELECT di.*,
        cp.company_name
       FROM design_inquiries di
       LEFT JOIN company_profiles cp ON di.company_id = cp.id
       ${where}
       ORDER BY di.created_at DESC`,
      params
    );

    const data = (rows as any[]).map((row) => ({
      'ID': row.id,
      'Name': row.name,
      'Phone': row.phone,
      'City': row.city,
      'Area Range': row.area_range,
      'Message': row.message || '',
      'Company': row.company_name || '',
      'Status': row.status,
      'Admin Notes': row.admin_notes || '',
      'Created At': row.created_at,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Inquiries');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=inquiries-${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('Export inquiries error:', error);
    res.status(500).json({ error: 'Failed to export inquiries.' });
  }
}

// Get inquiries for current designer/company (authenticated)
export async function getMyInquiries(req: any, res: any) {
  try {
    const userId = req.user.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Find company profile for this user
    const [companyRows] = await pool.execute(
      'SELECT id FROM company_profiles WHERE user_id = ?', [userId]
    );

    const companyId = (companyRows as any[])[0]?.id;

    if (!companyId) {
      return res.json({ inquiries: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    const where = 'WHERE company_id = ?';
    const params: any[] = [companyId];

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM design_inquiries ${where}`, params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT * FROM design_inquiries ${where} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    res.json({
      inquiries: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get my inquiries error:', error);
    res.status(500).json({ error: 'Failed to load inquiries.' });
  }
}
