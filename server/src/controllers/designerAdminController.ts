import { Request, Response } from 'express';
import pool from '../config/database';
import { logActivity } from './adminController';
import { canAdminReviewProject } from '../lib/projectReview';
import { parseJsonField } from '../lib/parseJsonField';
import {
  buildDesignerAdminWhereClause,
  validateDeleteReason,
} from '../lib/designerSoftDelete';
import { buildAdminDesignersListQuery } from '../lib/adminDesignersQuery';
import { buildAutoPublishPendingProjectsQuery } from '../lib/designerApproval';

// Get all designers with filters and pagination
export async function getDesignersForAdmin(req: any, res: Response) {
  const {
    status,
    search,
    deleted,
    sortBy = 'created_at',
    sortOrder = 'DESC',
    page = 1,
    limit = 20
  } = req.query;
  
  // Sanitize pagination params
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  const safePage = Math.max(1, parseInt(page) || 1);
  const offset = (safePage - 1) * safeLimit;
  
  const { whereClause, values } = buildDesignerAdminWhereClause({
    status,
    search,
    deleted,
  });
  
  // Validate sort
  const validSorts = ['created_at', 'full_name', 'email', 'display_order', 'profile_views'];
  const safeSortBy = validSorts.includes(sortBy) ? sortBy : 'created_at';
  const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  try {
    // Get total count
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM designers d ${whereClause}`,
      values
    );
    const total = (countRows as any[])[0].total;
    
    // Get designers with stats
    const query = buildAdminDesignersListQuery({
      whereClause,
      safeSortBy,
      safeSortOrder,
      safeLimit,
      offset,
    });

    const [rows] = await pool.execute(query.sql, values);
    
    res.json({
      designers: rows,
      pagination: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit)
      }
    });
  } catch (error) {
    console.error('Error getting designers:', error);
    res.status(500).json({ error: 'Failed to get designers.' });
  }
}

// Get single designer details
export async function getDesignerDetails(req: any, res: Response) {
  const { id } = req.params;
  
  try {
    // Get designer
    const [designerRows] = await pool.execute(
      `SELECT * FROM designers WHERE id = ?`,
      [id]
    );
    
    const designers = designerRows as any[];
    
    if (designers.length === 0) {
      return res.status(404).json({ error: 'Designer not found.' });
    }
    
    const designer = designers[0];
    
    // Get projects
    const [projectRows] = await pool.execute(
      `SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, created_at, updated_at
       FROM projects WHERE designer_id = ?
       ORDER BY created_at DESC`,
      [id]
    );
    
    // Get stats summary
    const [statsRows] = await pool.execute(
      `SELECT 
        COALESCE(SUM(profile_views), 0) as total_profile_views,
        COALESCE(SUM(project_views), 0) as total_project_views,
        COALESCE(SUM(contact_clicks), 0) as total_contact_clicks,
        COALESCE(SUM(phone_clicks), 0) as total_phone_clicks,
        COALESCE(SUM(whatsapp_clicks), 0) as total_whatsapp_clicks
       FROM designer_stats WHERE designer_id = ?`,
      [id]
    );
    
    // Get recent activity (last 30 days)
    const [recentStatsRows] = await pool.execute(
      `SELECT stat_date, profile_views, project_views, contact_clicks, phone_clicks, whatsapp_clicks
       FROM designer_stats 
       WHERE designer_id = ? AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY stat_date ASC`,
      [id]
    );
    
    res.json({
      designer: sanitizeAdminDesigner(designer),
      projects: (projectRows as any[]).map(normalizeProject),
      stats: (statsRows as any[])[0],
      recentStats: recentStatsRows
    });
  } catch (error) {
    console.error('Error getting designer details:', error);
    res.status(500).json({ error: 'Failed to get designer details.' });
  }
}

function normalizeProject(project: any) {
  const parsedImages = parseJsonField(project.images);
  const parsedTags = parseJsonField(project.tags);

  return {
    ...project,
    images: Array.isArray(parsedImages)
      ? parsedImages
        .map((item: any) => {
          if (typeof item === 'string') return item;
          if (item && typeof item === 'object') {
            if (typeof item.url === 'string') return item.url;
            if (typeof item.src === 'string') return item.src;
            if (typeof item.imageUrl === 'string') return item.imageUrl;
          }
          return '';
        })
        .filter(Boolean)
      : [],
    tags: Array.isArray(parsedTags) ? parsedTags.filter((tag: any) => typeof tag === 'string') : [],
  };
}

function sanitizeAdminDesigner(designer: any) {
  return {
    id: designer.id,
    email: designer.email,
    full_name: designer.full_name,
    title: designer.title || '',
    phone: designer.phone,
    city: designer.city,
    address: designer.address,
    bio: designer.bio,
    avatar_url: designer.avatar_url,
    style: designer.style,
    expertise: parseJsonField(designer.expertise) || [],
    status: designer.status,
    is_approved: designer.is_approved,
    display_order: designer.display_order,
    rejection_reason: designer.rejection_reason,
    deleted_at: designer.deleted_at,
    deleted_by_admin_id: designer.deleted_by_admin_id,
    delete_reason: designer.delete_reason,
    created_at: designer.created_at,
    updated_at: designer.updated_at,
  };
}

// Approve designer
export async function approveDesigner(req: any, res: Response) {
  const { id } = req.params;
  
  try {
    const [existing] = await pool.execute(
      'SELECT id, full_name, email, status FROM designers WHERE id = ?',
      [id]
    );
    
    const designers = existing as any[];
    
    if (designers.length === 0) {
      return res.status(404).json({ error: 'Designer not found.' });
    }
    
    const designer = designers[0];
    
    if (designer.status === 'approved') {
      return res.status(400).json({ error: 'Designer is already approved.' });
    }

    const conn = await pool.getConnection();
    let autoApprovedProjects = 0;

    try {
      await conn.beginTransaction();

      await conn.execute(
        `UPDATE designers 
         SET status = 'approved', is_approved = 1, rejection_reason = NULL, updated_at = NOW()
         WHERE id = ?`,
        [id]
      );

      const projectUpdate = buildAutoPublishPendingProjectsQuery([Number(id)]);
      const [projectResult] = await conn.execute(projectUpdate.sql, projectUpdate.params);
      autoApprovedProjects = (projectResult as any).affectedRows || 0;

      await conn.commit();
    } catch (txError) {
      await conn.rollback();
      throw txError;
    } finally {
      conn.release();
    }
    
    await logActivity(req.admin.id, 'approve_designer', 'designer', parseInt(id), {
      name: designer.full_name,
      email: designer.email,
      autoApprovedProjects,
    });
    
    res.json({ 
      message: 'Designer approved successfully.',
      designer: { id, status: 'approved' },
      autoApprovedProjects,
    });
  } catch (error) {
    console.error('Error approving designer:', error);
    res.status(500).json({ error: 'Failed to approve designer.' });
  }
}

// Reject designer
export async function rejectDesigner(req: any, res: Response) {
  const { id } = req.params;
  const { reason } = req.body;
  
  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({ error: 'Rejection reason is required.' });
  }
  
  try {
    const [existing] = await pool.execute(
      'SELECT id, full_name, email, status FROM designers WHERE id = ?',
      [id]
    );
    
    const designers = existing as any[];
    
    if (designers.length === 0) {
      return res.status(404).json({ error: 'Designer not found.' });
    }
    
    const designer = designers[0];
    
    if (designer.status === 'rejected') {
      return res.status(400).json({ error: 'Designer is already rejected.' });
    }
    
    await pool.execute(
      `UPDATE designers 
       SET status = 'rejected', is_approved = 0, rejection_reason = ?, updated_at = NOW()
       WHERE id = ?`,
      [reason.trim(), id]
    );
    
    await logActivity(req.admin.id, 'reject_designer', 'designer', parseInt(id), {
      name: designer.full_name,
      email: designer.email,
      reason: reason.trim()
    });
    
    res.json({ 
      message: 'Designer rejected.',
      designer: { id, status: 'rejected', rejectionReason: reason.trim() }
    });
  } catch (error) {
    console.error('Error rejecting designer:', error);
    res.status(500).json({ error: 'Failed to reject designer.' });
  }
}

export async function deleteDesigner(req: any, res: Response) {
  const { id } = req.params;
  const reason = validateDeleteReason(req.body?.reason);

  if (!reason) {
    return res.status(400).json({ error: 'Delete reason is required.' });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT id, full_name, email, deleted_at FROM designers WHERE id = ?',
      [id]
    );

    const designers = existing as any[];
    if (designers.length === 0) {
      return res.status(404).json({ error: 'Designer not found.' });
    }

    const designer = designers[0];
    if (designer.deleted_at) {
      return res.status(400).json({ error: 'Designer is already deleted.' });
    }

    await pool.execute(
      `UPDATE designers
       SET deleted_at = NOW(), deleted_by_admin_id = ?, delete_reason = ?, updated_at = NOW()
       WHERE id = ?`,
      [req.admin.id, reason, id]
    );

    await logActivity(req.admin.id, 'delete_designer', 'designer', parseInt(id, 10), {
      name: designer.full_name,
      email: designer.email,
      reason,
    });

    res.json({
      message: 'Designer deleted successfully.',
      designer: { id: Number(id), deletedAt: new Date().toISOString(), deleteReason: reason },
    });
  } catch (error) {
    console.error('Error deleting designer:', error);
    res.status(500).json({ error: 'Failed to delete designer.' });
  }
}

export async function restoreDesigner(req: any, res: Response) {
  const { id } = req.params;

  try {
    const [existing] = await pool.execute(
      'SELECT id, full_name, email, deleted_at FROM designers WHERE id = ?',
      [id]
    );

    const designers = existing as any[];
    if (designers.length === 0) {
      return res.status(404).json({ error: 'Designer not found.' });
    }

    const designer = designers[0];
    if (!designer.deleted_at) {
      return res.status(400).json({ error: 'Designer is not deleted.' });
    }

    await pool.execute(
      `UPDATE designers
       SET deleted_at = NULL, deleted_by_admin_id = NULL, delete_reason = NULL, updated_at = NOW()
       WHERE id = ?`,
      [id]
    );

    await logActivity(req.admin.id, 'restore_designer', 'designer', parseInt(id, 10), {
      name: designer.full_name,
      email: designer.email,
    });

    res.json({
      message: 'Designer restored successfully.',
      designer: { id: Number(id), deletedAt: null, deleteReason: null },
    });
  } catch (error) {
    console.error('Error restoring designer:', error);
    res.status(500).json({ error: 'Failed to restore designer.' });
  }
}

// Bulk approve designers
export async function bulkApproveDesigners(req: any, res: Response) {
  const { designerIds } = req.body;
  
  if (!designerIds || !Array.isArray(designerIds) || designerIds.length === 0) {
    return res.status(400).json({ error: 'Designer IDs are required.' });
  }
  
  // Limit batch size to prevent abuse
  const MAX_BATCH = 100;
  if (designerIds.length > MAX_BATCH) {
    return res.status(400).json({ error: `Maximum ${MAX_BATCH} designers can be approved at once.` });
  }
  
  try {
    const placeholders = designerIds.map(() => '?').join(',');
    
    const conn = await pool.getConnection();
    let affectedRows = 0;
    let autoApprovedProjects = 0;

    try {
      await conn.beginTransaction();

      const [result] = await conn.execute(
        `UPDATE designers 
         SET status = 'approved', is_approved = 1, rejection_reason = NULL, updated_at = NOW()
         WHERE id IN (${placeholders}) AND status != 'approved'`,
        designerIds
      );
      affectedRows = (result as any).affectedRows || 0;

      const projectUpdate = buildAutoPublishPendingProjectsQuery(designerIds.map((value: any) => Number(value)));
      const [projectResult] = await conn.execute(projectUpdate.sql, projectUpdate.params);
      autoApprovedProjects = (projectResult as any).affectedRows || 0;

      await conn.commit();
    } catch (txError) {
      await conn.rollback();
      throw txError;
    } finally {
      conn.release();
    }
    
    await logActivity(req.admin.id, 'bulk_approve_designers', 'designer', null, {
      count: affectedRows,
      ids: designerIds,
      autoApprovedProjects,
    });
    
    res.json({ 
      message: `${affectedRows} designer(s) approved.`,
      approvedCount: affectedRows,
      autoApprovedProjects,
    });
  } catch (error) {
    console.error('Error bulk approving designers:', error);
    res.status(500).json({ error: 'Failed to approve designers.' });
  }
}

export async function bulkDeleteDesigners(req: any, res: Response) {
  const { designerIds } = req.body;
  const reason = validateDeleteReason(req.body?.reason);

  if (!designerIds || !Array.isArray(designerIds) || designerIds.length === 0) {
    return res.status(400).json({ error: 'Designer IDs are required.' });
  }

  if (!reason) {
    return res.status(400).json({ error: 'Delete reason is required.' });
  }

  const MAX_BATCH = 100;
  if (designerIds.length > MAX_BATCH) {
    return res.status(400).json({ error: `Maximum ${MAX_BATCH} designers can be deleted at once.` });
  }

  const normalizedIds = designerIds
    .map((value: any) => Number(value))
    .filter((value: number) => Number.isInteger(value) && value > 0);

  if (normalizedIds.length === 0) {
    return res.status(400).json({ error: 'No valid designer IDs provided.' });
  }

  try {
    const placeholders = normalizedIds.map(() => '?').join(',');
    const [result] = await pool.execute(
      `UPDATE designers
       SET deleted_at = NOW(), deleted_by_admin_id = ?, delete_reason = ?, updated_at = NOW()
       WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      [req.admin.id, reason, ...normalizedIds]
    );

    const deletedCount = (result as any).affectedRows || 0;

    await logActivity(req.admin.id, 'bulk_delete_designers', 'designer', null, {
      count: deletedCount,
      ids: normalizedIds,
      reason,
    });

    res.json({
      message: `${deletedCount} designer(s) deleted.`,
      deletedCount,
    });
  } catch (error) {
    console.error('Error bulk deleting designers:', error);
    res.status(500).json({ error: 'Failed to delete designers.' });
  }
}

// Update display order
export async function updateDesignerOrder(req: any, res: Response) {
  const { orders } = req.body;
  // orders: [{ id: 1, displayOrder: 1 }, { id: 2, displayOrder: 2 }, ...]
  
  if (!orders || !Array.isArray(orders) || orders.length === 0) {
    return res.status(400).json({ error: 'Orders array is required.' });
  }
  
  try {
    // Use transaction for atomic update
    const conn = await pool.getConnection();
    
    await conn.beginTransaction();
    
    try {
      for (const item of orders) {
        await conn.execute(
          'UPDATE designers SET display_order = ? WHERE id = ?',
          [item.displayOrder, item.id]
        );
      }
      
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    
    await logActivity(req.admin.id, 'update_designer_order', 'designer', null, {
      count: orders.length
    });
    
    res.json({ message: 'Display order updated successfully.' });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Failed to update order.' });
  }
}

export async function approveProject(req: any, res: Response) {
  const { projectId } = req.params;

  try {
    const [rows] = await pool.execute(
      'SELECT id, designer_id, title, status FROM projects WHERE id = ?',
      [projectId]
    );

    const projects = rows as any[];
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = projects[0];
    if (!canAdminReviewProject(project.status)) {
      return res.status(400).json({ error: 'Only pending projects can be approved.' });
    }

    await pool.execute(
      `UPDATE projects
       SET status = 'published', rejection_reason = NULL, updated_at = NOW()
       WHERE id = ?`,
      [projectId]
    );

    await logActivity(req.admin.id, 'approve_project', 'project', parseInt(projectId, 10), {
      title: project.title,
      designerId: project.designer_id
    });

    res.json({
      message: 'Project approved successfully.',
      project: { id: Number(projectId), status: 'published' }
    });
  } catch (error) {
    console.error('Error approving project:', error);
    res.status(500).json({ error: 'Failed to approve project.' });
  }
}

export async function rejectProject(req: any, res: Response) {
  const { projectId } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Rejection reason is required.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, designer_id, title, status FROM projects WHERE id = ?',
      [projectId]
    );

    const projects = rows as any[];
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const project = projects[0];
    if (!canAdminReviewProject(project.status)) {
      return res.status(400).json({ error: 'Only pending projects can be rejected.' });
    }

    await pool.execute(
      `UPDATE projects
       SET status = 'rejected', rejection_reason = ?, updated_at = NOW()
       WHERE id = ?`,
      [reason.trim(), projectId]
    );

    await logActivity(req.admin.id, 'reject_project', 'project', parseInt(projectId, 10), {
      title: project.title,
      designerId: project.designer_id,
      reason: reason.trim()
    });

    res.json({
      message: 'Project rejected.',
      project: { id: Number(projectId), status: 'rejected', rejectionReason: reason.trim() }
    });
  } catch (error) {
    console.error('Error rejecting project:', error);
    res.status(500).json({ error: 'Failed to reject project.' });
  }
}

// Get designer stats overview
export async function getStatsOverview(req: any, res: Response) {
  const { startDate, endDate } = req.query;
  
  // Default to last 30 days
  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  try {
    // Overview stats
    const [overviewRows] = await pool.execute(
      `SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(*) as total_count
       FROM designers`
    );
    
    // Daily page views from analytics_events (real data)
    const [dailyStatsRows] = await pool.execute(
      `SELECT
        DATE(created_at) as stat_date,
        COUNT(*) as profile_views
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?
         AND event_name = 'page_view'
       GROUP BY DATE(created_at)
       ORDER BY stat_date ASC`,
      [start, end]
    );

    // Contact interactions from analytics_events (real data)
    const [contactRows] = await pool.execute(
      `SELECT
        COALESCE(SUM(CASE WHEN event_name = 'click_whatsapp' THEN 1 ELSE 0 END), 0) as whatsapp_clicks,
        COALESCE(SUM(CASE WHEN event_name = 'apply_click' THEN 1 ELSE 0 END), 0) as contact_clicks,
        COALESCE(SUM(CASE WHEN event_name = 'view_designer_profile' THEN 1 ELSE 0 END), 0) as profile_views,
        COALESCE(SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END), 0) as page_views
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?`,
      [start, end]
    );

    // Visitor count
    const [visitorRows] = await pool.execute(
      `SELECT COUNT(DISTINCT viewer_ip) as unique_visitors
       FROM analytics_events
       WHERE DATE(created_at) BETWEEN ? AND ?`,
      [start, end]
    );

    // Top pages by views
    const [topPagesRows] = await pool.execute(
      `SELECT
        page_path,
        COUNT(*) as total_views,
        COUNT(DISTINCT viewer_ip) as unique_visitors
       FROM analytics_events
       WHERE event_name = 'page_view'
         AND DATE(created_at) BETWEEN ? AND ?
         AND page_path IS NOT NULL
       GROUP BY page_path
       ORDER BY total_views DESC
       LIMIT 10`,
      [start, end]
    );

    const contact = (contactRows as any[])[0] || {};

    // Top companies by page views (company detail pages)
    const [topCompanyRows] = await pool.execute(
      `SELECT
        REPLACE(REPLACE(page_path, '/companies/', ''), '?preview=1', '') as company_slug,
        COUNT(*) as views
       FROM analytics_events
       WHERE event_name = 'page_view'
         AND page_path LIKE '/companies/%'
         AND page_path NOT LIKE '/companies?%'
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY company_slug
       ORDER BY views DESC
       LIMIT 7`,
      [start, end]
    );

    res.json({
      overview: {
        ...(overviewRows as any[])[0],
        unique_visitors: (visitorRows as any[])[0]?.unique_visitors || 0,
      },
      dailyStats: dailyStatsRows,
      contactStats: {
        whatsapp_clicks: Number(contact.whatsapp_clicks) || 0,
        contact_clicks: Number(contact.contact_clicks) || 0,
        profile_views: Number(contact.profile_views) || 0,
        page_views: Number(contact.page_views) || 0,
      },
      topDesigners: [],
      topPages: topPagesRows,
      topCompanies: topCompanyRows,
      dateRange: { start, end }
    });
  } catch (error) {
    console.error('Error getting stats overview:', error);
    res.status(500).json({ error: 'Failed to get stats.' });
  }
}

// Get activity logs
export async function getActivityLogs(req: any, res: Response) {
  const { page = 1, limit = 50, adminId, action } = req.query;
  
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions: string[] = [];
  const values: any[] = [];
  
  if (adminId) {
    conditions.push('l.admin_id = ?');
    values.push(adminId);
  }
  
  if (action) {
    conditions.push('l.action = ?');
    values.push(action);
  }
  
  const whereClause = conditions.length > 0 
    ? 'WHERE ' + conditions.join(' AND ')
    : '';
  
  try {
    const [rows] = await pool.execute(
      `SELECT 
        l.id,
        l.action,
        l.target_type,
        l.target_id,
        l.details,
        l.ip_address,
        l.created_at,
        a.email as admin_email,
        a.full_name as admin_name
       FROM admin_activity_logs l
       LEFT JOIN admin_users a ON l.admin_id = a.id
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT ${Math.min(parseInt(limit as string) || 50, 100)} OFFSET ${offset}`,
      values
    );
    
    res.json({ logs: rows });
  } catch (error) {
    console.error('Error getting activity logs:', error);
    res.status(500).json({ error: 'Failed to get activity logs.' });
  }
}

export async function getDailyStatsReport(req: any, res: Response) {
  const days = Math.min(parseInt(req.query.days as string) || 30, 90);
  try {
    // Generate a date series for the requested range
    const [dateRows] = await pool.query(
      `SELECT DATE(DATE_SUB(CURDATE(), INTERVAL seq DAY)) as d
       FROM (SELECT 0 seq UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
             UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9
             UNION SELECT 10 UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14
             UNION SELECT 15 UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19
             UNION SELECT 20 UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24
             UNION SELECT 25 UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29
             UNION SELECT 30 UNION SELECT 31 UNION SELECT 32 UNION SELECT 33 UNION SELECT 34
             UNION SELECT 35 UNION SELECT 36 UNION SELECT 37 UNION SELECT 38 UNION SELECT 39
             UNION SELECT 40 UNION SELECT 41 UNION SELECT 42 UNION SELECT 43 UNION SELECT 44
             UNION SELECT 45 UNION SELECT 46 UNION SELECT 47 UNION SELECT 48 UNION SELECT 49
             UNION SELECT 50 UNION SELECT 51 UNION SELECT 52 UNION SELECT 53 UNION SELECT 54
             UNION SELECT 55 UNION SELECT 56 UNION SELECT 57 UNION SELECT 58 UNION SELECT 59
             UNION SELECT 60 UNION SELECT 61 UNION SELECT 62 UNION SELECT 63 UNION SELECT 64
             UNION SELECT 65 UNION SELECT 66 UNION SELECT 67 UNION SELECT 68 UNION SELECT 69
             UNION SELECT 70 UNION SELECT 71 UNION SELECT 72 UNION SELECT 73 UNION SELECT 74
             UNION SELECT 75 UNION SELECT 76 UNION SELECT 77 UNION SELECT 78 UNION SELECT 79
             UNION SELECT 80 UNION SELECT 81 UNION SELECT 82 UNION SELECT 83 UNION SELECT 84
             UNION SELECT 85 UNION SELECT 86 UNION SELECT 87 UNION SELECT 88 UNION SELECT 89) t
       WHERE seq < ${days}
       ORDER BY d ASC`
    ) as any[];

    const dates: string[] = dateRows.map((r: any) => r.d instanceof Date ? r.d.toISOString().slice(0, 10) : String(r.d).slice(0, 10));

    const [userRows] = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY) AND deleted_at IS NULL
       GROUP BY DATE(created_at)`
    ) as any[];

    const [companyRows] = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM company_profiles
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY) AND deleted_at IS NULL
       GROUP BY DATE(created_at)`
    ) as any[];

    const [inquiryRows] = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM inquiries
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ${days} DAY)
       GROUP BY DATE(created_at)`
    ) as any[];

    const toMap = (rows: any[]) => {
      const m: Record<string, number> = {};
      for (const r of rows) {
        const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
        m[d] = Number(r.count);
      }
      return m;
    };

    const uMap = toMap(userRows);
    const cMap = toMap(companyRows);
    const iMap = toMap(inquiryRows);

    const data = dates.map((date) => ({
      date,
      new_homeowners: uMap[date] || 0,
      new_companies: cMap[date] || 0,
      new_inquiries: iMap[date] || 0,
    }));

    const totals = data.reduce(
      (acc, r) => ({
        new_homeowners: acc.new_homeowners + r.new_homeowners,
        new_companies: acc.new_companies + r.new_companies,
        new_inquiries: acc.new_inquiries + r.new_inquiries,
      }),
      { new_homeowners: 0, new_companies: 0, new_inquiries: 0 }
    );

    res.json({ data, totals, days });
  } catch (error) {
    console.error('Daily stats error:', error);
    res.status(500).json({ error: 'Failed to get daily stats.' });
  }
}

export async function getRegistrationStats(req: any, res: Response) {
  const days = Math.min(parseInt(req.query.days as string) || 30, 90);
  try {
    const [userRows] = await pool.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND deleted_at IS NULL
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [days]
    );
    const [companyRows] = await pool.execute(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM company_profiles
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND deleted_at IS NULL
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [days]
    );
    res.json({ users: userRows, companies: companyRows });
  } catch (error) {
    console.error('Registration stats error:', error);
    res.status(500).json({ error: 'Failed to get registration stats.' });
  }
}
