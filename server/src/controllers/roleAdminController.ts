import pool from '../config/database';
import { logActivity } from './adminController';
import { logActivity as logActivityEvent, getClientIp } from '../lib/activityLogger';

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

    let whereClause = 'WHERE cp.deleted_at IS NULL';
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

    const sortBy = req.query.sort_by;
    const sortDir = req.query.sort_dir === 'asc' ? 'ASC' : 'DESC';
    const orderClause = sortBy === 'project_count'
      ? `ORDER BY project_count ${sortDir}, cp.id DESC`
      : sortBy === 'updated_at'
      ? `ORDER BY cp.updated_at ${sortDir}, cp.id DESC`
      : 'ORDER BY CASE WHEN GREATEST(COALESCE(cp.home_display_order, 0), COALESCE(cp.list_display_order, 0)) > 0 THEN 0 ELSE 1 END, LEAST(CASE WHEN cp.home_display_order > 0 THEN cp.home_display_order ELSE 999999 END, CASE WHEN cp.list_display_order > 0 THEN cp.list_display_order ELSE 999999 END) ASC, cp.display_order DESC, cp.created_at DESC';

    const [rows] = await pool.execute(
      `SELECT cp.*, u.email as user_email, u.full_name as user_name,
              uc.name_en as linked_company_name, uc.slug as linked_company_slug,
              COALESCE(pc.project_count, 0) as project_count,
              (SELECT COUNT(*) FROM projects p WHERE p.company_profile_id = cp.id AND p.deleted_at IS NULL AND DATE(p.created_at) = CURDATE()) as today_project_count
       FROM company_profiles cp
       JOIN users u ON u.id = cp.user_id
       LEFT JOIN uae_companies uc ON uc.id = cp.linked_uae_company_id
       LEFT JOIN (
         SELECT company_profile_id, COUNT(*) as project_count
         FROM projects
         WHERE company_profile_id IS NOT NULL
         GROUP BY company_profile_id
       ) pc ON pc.company_profile_id = cp.id
       ${whereClause}
       ${orderClause}
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

    // 公司审核通过后，自动发布所有项目（审批在公司层面，不需逐个审批项目）
    await pool.execute(
      `UPDATE projects SET status = 'published' WHERE company_profile_id = ? AND status IN ('pending', 'draft')`,
      [id]
    );

    // Fetch profile name for logging
    const [profileRows] = await pool.execute('SELECT company_name FROM company_profiles WHERE id = ? LIMIT 1', [id]);
    const profile = (profileRows as any[])[0];

    setImmediate(() => {
      logActivityEvent({
        userId: req.admin?.id || null, userName: req.admin?.name || 'Admin', userRole: 'admin',
        action: 'approve', targetType: 'company_profile', targetId: Number(id),
        targetName: profile?.company_name, description: `审批通过了装企「${profile?.company_name}」`,
        ip: getClientIp(req),
      }).catch(() => {});
    });

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
 * POST /api/admin/roles/companies/bulk-unapprove
 * Revert approved companies back to pending (for testing)
 */
export async function bulkUnapproveCompanies(req: any, res: any) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids must be a non-empty array.' });
    }

    const placeholders = ids.map(() => '?').join(',');
    await pool.execute(
      `UPDATE company_profiles SET status = 'pending', home_display_order = 0, list_display_order = 0 WHERE id IN (${placeholders}) AND status = 'approved'`,
      ids
    );

    // Unpublish their projects too
    await pool.execute(
      `UPDATE projects SET status = 'draft' WHERE company_profile_id IN (${placeholders}) AND status = 'published'`,
      ids
    );

    res.json({ message: `${ids.length} company(s) reverted to pending.` });
  } catch (error) {
    console.error('Bulk unapprove error:', error);
    res.status(500).json({ error: 'Failed to unapprove companies.' });
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
         WHERE (
           COALESCE(display_order, 0) = ?
           OR COALESCE(home_display_order, 0) = ?
           OR COALESCE(list_display_order, 0) = ?
         ) AND id <> ?
         UNION ALL
         SELECT 'uae_companies' AS source, id
         FROM uae_companies
         WHERE COALESCE(display_order, 0) = ?
            OR COALESCE(home_display_order, 0) = ?
            OR COALESCE(list_display_order, 0) = ?
         LIMIT 1`,
        [displayOrder, displayOrder, displayOrder, profileId, displayOrder, displayOrder, displayOrder]
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

async function updateCompanySingleOrderField(
  profileId: number,
  orderValue: number,
  field: 'home_display_order' | 'list_display_order'
) {
  const [currentRows] = await pool.execute(
    `SELECT COALESCE(${field}, 0) AS current_value FROM company_profiles WHERE id = ? LIMIT 1`,
    [profileId]
  );
  const current = (currentRows as any[])[0];
  if (!current) throw new Error(`${field}#NOT_FOUND#${profileId}`);

  if (orderValue !== Number(current.current_value || 0) && orderValue > 0) {
    // Max 6 home companies check
    if (field === 'home_display_order') {
      const [countRows] = await pool.execute(
        `SELECT
          (SELECT COUNT(*) FROM company_profiles WHERE home_display_order > 0 AND deleted_at IS NULL) +
          (SELECT COUNT(*) FROM uae_companies WHERE home_display_order > 0)
        AS total`
      );
      let total = Number((countRows as any[])[0]?.total || 0);
      // If this record already has a home_display_order > 0, it's being updated not added
      if (Number(current.current_value || 0) > 0) total -= 1;
      if (total >= 6) {
        throw new Error(`${field}#MAX_REACHED#6`);
      }
    }

    // Check cross-table conflict: same field, same value
    const [conflicts] = await pool.execute(
      `SELECT 'company_profiles' AS source, id, company_name AS name
       FROM company_profiles
       WHERE COALESCE(${field}, 0) = ? AND id <> ? AND deleted_at IS NULL
       UNION ALL
       SELECT 'uae_companies' AS source, id, name_en AS name
       FROM uae_companies
       WHERE COALESCE(${field}, 0) = ?
       LIMIT 1`,
      [orderValue, profileId, orderValue]
    );
    if ((conflicts as any[]).length > 0) {
      const conflict = (conflicts as any[])[0];
      throw new Error(`${field}#CONFLICT#${orderValue}#${conflict.name}`);
    }
  }

  await pool.execute(`UPDATE company_profiles SET ${field} = ? WHERE id = ?`, [orderValue, profileId]);
}

export async function updateCompanyHomeDisplayOrder(req: any, res: any) {
  try {
    const profileId = Number(req.params.id);
    const raw = req.body?.home_display_order;
    const orderValue = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;
    await updateCompanySingleOrderField(profileId, orderValue, 'home_display_order');
    res.json({ message: 'Home display order updated.' });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('home_display_order#NOT_FOUND#')) {
      return res.status(404).json({ error: 'Company profile not found.' });
    }
    if (error instanceof Error && error.message.includes('home_display_order#MAX_REACHED#')) {
      return res.status(400).json({ error: '首页最多展示 6 家公司，请先移除一家' });
    }
    if (error instanceof Error && error.message.includes('home_display_order#CONFLICT#')) {
      const parts = error.message.split('#');
      const orderValue = parts[2] || '0';
      const conflictName = parts[3] || '';
      return res.status(409).json({
        error: `Home order ${orderValue} already used by "${conflictName}"`,
      });
    }
    console.error('Update company home display order error:', error);
    res.status(500).json({ error: 'Failed to update home display order.' });
  }
}

export async function updateCompanyListDisplayOrder(req: any, res: any) {
  try {
    const profileId = Number(req.params.id);
    const raw = req.body?.list_display_order;
    const orderValue = Number.isFinite(Number(raw)) ? Math.max(0, Number(raw)) : 0;
    await updateCompanySingleOrderField(profileId, orderValue, 'list_display_order');
    res.json({ message: 'List display order updated.' });
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('list_display_order#NOT_FOUND#')) {
      return res.status(404).json({ error: 'Company profile not found.' });
    }
    if (error instanceof Error && error.message.includes('list_display_order#CONFLICT#')) {
      const parts = error.message.split('#');
      const orderValue = parts[2] || '0';
      const conflictName = parts[3] || '';
      return res.status(409).json({
        error: `List order ${orderValue} already used by "${conflictName}"`,
      });
    }
    console.error('Update company list display order error:', error);
    res.status(500).json({ error: 'Failed to update list display order.' });
  }
}

function normalizeDeleteReason(rawReason: unknown): string | null {
  if (typeof rawReason !== 'string') return null;
  const trimmed = rawReason.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return trimmed.slice(0, 500);
  return trimmed;
}

/**
 * PUT /api/admin/roles/companies/:id/delete
 * Cascading hard delete: company_profile + user + all related data
 */
export async function deleteCompanyProfile(req: any, res: any) {
  try {
    const id = Number(req.params.id);
    const adminId = req.admin?.id;
    const reason = normalizeDeleteReason(req.body?.reason);
    if (!reason) return res.status(400).json({ error: 'Delete reason is required.' });
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid company profile id.' });

    const [rows] = await pool.execute(
      'SELECT id, company_name, user_id, deleted_at FROM company_profiles WHERE id = ? LIMIT 1',
      [id]
    );
    const profile = (rows as any[])[0];
    if (!profile) return res.status(404).json({ error: 'Company profile not found.' });

    const userId = profile.user_id;

    // Log before deletion (audit trail preserved)
    await logActivity(adminId, 'delete_company_profile', 'company_profile', id, {
      company_name: profile.company_name,
      user_id: userId,
      reason,
    });

    // Cascading hard delete — child tables first to respect FK constraints
    await pool.execute('DELETE FROM projects WHERE company_profile_id = ?', [id]);
    await pool.execute('DELETE FROM articles WHERE company_profile_id = ?', [id]);
    await pool.execute('DELETE FROM company_profiles WHERE id = ?', [id]);

    if (userId) {
      await pool.execute('DELETE FROM designers WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM company_applications WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM notifications WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM design_inquiries WHERE user_id = ?', [userId]);
      await pool.execute('DELETE FROM homeowner_profiles WHERE user_id = ?', [userId]);
      await pool.execute('UPDATE uae_companies SET owner_user_id = NULL WHERE owner_user_id = ?', [userId]);
      await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
    }

    setImmediate(() => {
      logActivityEvent({
        userId: req.admin?.id || null, userName: req.admin?.name || 'Admin', userRole: 'admin',
        action: 'delete', targetType: 'company_profile', targetId: id,
        targetName: profile.company_name, description: `删除了装企「${profile.company_name}」，原因: ${reason}`,
        ip: getClientIp(req),
      }).catch(() => {});
    });

    res.json({ message: 'Company profile and all related data deleted successfully.' });
  } catch (error) {
    console.error('Delete company profile error:', error);
    res.status(500).json({ error: 'Failed to delete company profile.' });
  }
}

/**
 * POST /api/admin/roles/companies/:id/restore
 */
export async function restoreCompanyProfile(req: any, res: any) {
  try {
    const id = Number(req.params.id);
    const adminId = req.admin?.id;
    if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid company profile id.' });

    const [rows] = await pool.execute(
      'SELECT id, company_name, user_id, deleted_at FROM company_profiles WHERE id = ? LIMIT 1',
      [id]
    );
    const profile = (rows as any[])[0];
    if (!profile) return res.status(404).json({ error: 'Company profile not found.' });
    if (!profile.deleted_at) return res.status(400).json({ error: 'Company profile is not deleted.' });

    await pool.execute(
      `UPDATE company_profiles
       SET deleted_at = NULL, deleted_by_admin_id = NULL, delete_reason = NULL
       WHERE id = ?`,
      [id]
    );

    await logActivity(adminId, 'restore_company_profile', 'company_profile', id, {
      company_name: profile.company_name,
      user_id: profile.user_id,
    });

    res.json({ message: 'Company profile restored successfully.' });
  } catch (error) {
    console.error('Restore company profile error:', error);
    res.status(500).json({ error: 'Failed to restore company profile.' });
  }
}
