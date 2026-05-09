import pool from '../config/database';
import * as XLSX from 'xlsx';
import { analyticsEvents } from '../lib/analyticsEvents';
import { notifyNewInquiry } from '../services/notificationService';
import { pushLeadToCRM, type LeadPayload } from '../lib/crmPush';
import { logActivity, getClientIp } from '../lib/activityLogger';

// Build the LeadPayload from a design_inquiries DB row. Used by both initial
// submit (fire-and-forget) and admin manual resend.
function buildLeadFromRow(row: any): LeadPayload {
  const companyName: string | undefined = row.source_company_name || undefined;
  const notes = [
    companyName ? `Company: ${companyName}` : '',
    row.message || '',
  ]
    .filter(Boolean)
    .join(' | ') || undefined;
  return {
    inquiryId: row.id,
    externalId: `inquiry-${row.id}`,
    name: row.name || 'Anonymous',
    phone: row.phone,
    city: row.city || undefined,
    area: row.area_range || undefined,
    notes,
    page: undefined,
  };
}

const VALID_CITIES = ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];
// Area is stored as a free-form short string (e.g. "2500m²"). Validate length only.
const MAX_AREA_LENGTH = 64;

// Submit inquiry (public, no auth required)
export async function submitInquiry(req: any, res: any) {
  try {
    const { name, phone, city, area_range, message, company_id, source_company_name, source_company_slug, source_page } = req.body;

    if (!phone || !area_range) {
      return res.status(400).json({ error: 'Phone and area range are required.' });
    }

    if (city && !VALID_CITIES.includes(city)) {
      return res.status(400).json({ error: 'Invalid city.' });
    }

    if (typeof area_range !== 'string' || area_range.length === 0 || area_range.length > MAX_AREA_LENGTH) {
      return res.status(400).json({ error: 'Invalid area.' });
    }

    const [result] = await pool.execute(
      `INSERT INTO design_inquiries (name, phone, city, area_range, message, company_id, source_company_name, source_company_slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name || null, phone, city || null, area_range, message || null, company_id || null, source_company_name || null, source_company_slug || null]
    );

    const inquiryId = (result as any).insertId;

    // Push to admin SSE subscribers (real-time map animation)
    analyticsEvents.notifyChange('inquiry');

    setImmediate(() => {
      logActivity({
        userId: req.user?.userId || null, userName: req.body.name || 'Anonymous', userRole: 'homeowner',
        action: 'create', targetType: 'inquiry', targetId: inquiryId,
        targetName: req.body.source_company_name || '', description: `提交了询盘`,
        ip: getClientIp(req),
      }).catch(() => {});
    });

    // Async notification (don't block response)
    const companyName = source_company_name || undefined;
    setImmediate(() => {
      notifyNewInquiry({ id: inquiryId, name: name || 'Anonymous', phone, city, area_range, message, companyName, sourcePage: source_page || undefined }).catch(() => {});
    });

    // Push to CRM (fire-and-forget)
    pushLeadToCRM({
      inquiryId,
      externalId: `inquiry-${inquiryId}`,
      name: name || 'Anonymous',
      phone,
      city: city || undefined,
      area: area_range || undefined,
      notes: [companyName ? `Company: ${companyName}` : '', message || ''].filter(Boolean).join(' | ') || undefined,
      page: source_page || undefined,
      company: source_company_name || undefined,
    }).catch(() => {});

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
    const { status, designer_id, company_id, search, type } = req.query;

    const showDeleted = req.query.deleted === 'true';

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (showDeleted) {
      where += ' AND di.deleted_at IS NOT NULL';
    } else {
      where += ' AND di.deleted_at IS NULL';
    }

    if (status) {
      where += ' AND di.status = ?';
      params.push(status);
    }
    if (company_id) {
      where += ' AND di.company_id = ?';
      params.push(company_id);
    }
    if (type === 'homeowner') {
      where += " AND (di.message IS NULL OR di.message NOT LIKE '[Company Inquiry]%')";
    } else if (type === 'company') {
      where += " AND di.message LIKE '[Company Inquiry]%'";
    }
    if (search) {
      where += ' AND (di.name LIKE ? OR di.phone LIKE ? OR di.source_company_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Group by phone: count duplicates, keep only the latest row per phone.
    // Use a derived column alias via a subquery to satisfy ONLY_FULL_GROUP_BY.
    const groupExpr = "COALESCE(NULLIF(di.phone,''), CAST(di.id AS CHAR))";

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM (
         SELECT ${groupExpr} as gk FROM design_inquiries di ${where} GROUP BY gk
       ) grouped`,
      params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT latest.*,
        cp.company_name,
        dup.dup_count
       FROM design_inquiries latest
       LEFT JOIN company_profiles cp ON latest.company_id = cp.id
       INNER JOIN (
         SELECT MAX(di.id) as max_id, COUNT(*) as dup_count
         FROM design_inquiries di ${where}
         GROUP BY ${groupExpr}
       ) dup ON latest.id = dup.max_id
       ORDER BY latest.created_at DESC
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
      'Source Company': row.source_company_name || row.company_name || '',
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

// Batch soft-delete inquiries (admin only)
export async function batchDeleteInquiries(req: any, res: any) {
  try {
    const { ids, reason } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array.' });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return res.status(400).json({ error: 'reason is required.' });
    }

    const adminId = (req as any).adminId;

    // Get admin name
    const [adminRows] = await pool.execute('SELECT full_name FROM admin_users WHERE id = ?', [adminId]);
    const adminName = (adminRows as any[])[0]?.full_name || 'Unknown';

    // Snapshot rows before deletion
    const placeholders = ids.map(() => '?').join(',');
    const [snapshot] = await pool.execute(
      `SELECT * FROM design_inquiries WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      ids
    );
    const snapshotRows = snapshot as any[];

    if (snapshotRows.length === 0) {
      return res.status(404).json({ error: 'No matching active inquiries found.' });
    }

    const activeIds = snapshotRows.map((r: any) => r.id);
    const activePlaceholders = activeIds.map(() => '?').join(',');

    // Soft delete
    const [result] = await pool.execute(
      `UPDATE design_inquiries SET deleted_at = NOW(), deleted_by = ?, deleted_reason = ? WHERE id IN (${activePlaceholders})`,
      [adminId, reason.trim(), ...activeIds]
    );

    // Audit log
    await pool.execute(
      `INSERT INTO admin_audit_log (admin_id, admin_name, action, target_type, target_ids, reason, metadata)
       VALUES (?, ?, 'delete_inquiry', 'inquiry', ?, ?, ?)`,
      [adminId, adminName, JSON.stringify(activeIds), reason.trim(), JSON.stringify({ snapshot: snapshotRows })]
    );

    res.json({ deleted: (result as any).affectedRows });
  } catch (error) {
    console.error('Batch delete inquiries error:', error);
    res.status(500).json({ error: 'Failed to delete inquiries.' });
  }
}

// Batch restore soft-deleted inquiries (admin only)
export async function batchRestoreInquiries(req: any, res: any) {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array.' });
    }

    const adminId = (req as any).adminId;

    // Get admin name
    const [adminRows] = await pool.execute('SELECT full_name FROM admin_users WHERE id = ?', [adminId]);
    const adminName = (adminRows as any[])[0]?.full_name || 'Unknown';

    const placeholders = ids.map(() => '?').join(',');

    // Restore
    const [result] = await pool.execute(
      `UPDATE design_inquiries SET deleted_at = NULL, deleted_by = NULL WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`,
      ids
    );

    // Audit log
    await pool.execute(
      `INSERT INTO admin_audit_log (admin_id, admin_name, action, target_type, target_ids, reason, metadata)
       VALUES (?, ?, 'restore_inquiry', 'inquiry', ?, NULL, NULL)`,
      [adminId, adminName, JSON.stringify(ids)]
    );

    res.json({ restored: (result as any).affectedRows });
  } catch (error) {
    console.error('Batch restore inquiries error:', error);
    res.status(500).json({ error: 'Failed to restore inquiries.' });
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

// Manually retry pushing an inquiry to CRM (admin only).
// Used to recover from transient failures or to re-push after fixing an
// upstream issue. Unlike submitInquiry, this one AWAITS the result so the
// admin immediately sees whether it succeeded.
export async function resendCrmSync(req: any, res: any) {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(
      'SELECT * FROM design_inquiries WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    const row = (rows as any[])[0];
    if (!row) {
      return res.status(404).json({ error: 'Inquiry not found.' });
    }

    const lead = buildLeadFromRow(row);
    const result = await pushLeadToCRM(lead);

    // Reload the row so the client sees the updated sync status / error
    const [updatedRows] = await pool.execute(
      'SELECT * FROM design_inquiries WHERE id = ?',
      [id],
    );
    const updated = (updatedRows as any[])[0];

    if (result) {
      return res.json({
        success: true,
        leadId: result?.data?.leadId ?? null,
        action: result?.data?.action ?? null,
        inquiry: updated,
      });
    }
    // pushLeadToCRM returned null → either config missing or failure
    // (markFailed already wrote the error). Surface it.
    return res.status(502).json({
      success: false,
      error: 'CRM push failed. See crm_last_error on the inquiry.',
      inquiry: updated,
    });
  } catch (error) {
    console.error('Resend CRM sync error:', error);
    res.status(500).json({ error: 'Failed to resend CRM sync.' });
  }
}
