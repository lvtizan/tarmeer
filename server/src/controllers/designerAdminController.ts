import { Request, Response } from 'express';
import pool from '../config/database';
import { logActivity } from './adminController';
import { canAdminReviewProject } from '../lib/projectReview';
import { parseJsonField } from '../lib/parseJsonField';

// Get all designers with filters and pagination
export async function getDesignersForAdmin(req: any, res: Response) {
  const {
    status,
    search,
    sortBy = 'created_at',
    sortOrder = 'DESC',
    page = 1,
    limit = 20
  } = req.query;
  
  // Sanitize pagination params
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  const safePage = Math.max(1, parseInt(page) || 1);
  const offset = (safePage - 1) * safeLimit;
  
  const values: any[] = [];
  const conditions: string[] = [];
  
  // Filter by status
  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    conditions.push('d.status = ?');
    values.push(status);
  }
  
  // Search
  if (search) {
    conditions.push('(d.full_name LIKE ? OR d.email LIKE ? OR d.city LIKE ?)');
    const searchPattern = `%${search}%`;
    values.push(searchPattern, searchPattern, searchPattern);
  }
  
  const whereClause = conditions.length > 0 
    ? 'WHERE ' + conditions.join(' AND ')
    : '';
  
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
    const [rows] = await pool.execute(
      `SELECT 
        d.id,
        d.email,
        d.full_name,
        d.phone,
        d.city,
        d.avatar_url,
        d.style,
        d.expertise,
        d.status,
        d.is_approved,
        d.display_order,
        d.rejection_reason,
        d.created_at,
        d.updated_at,
        COALESCE(SUM(ds.profile_views), 0) as total_profile_views,
        COALESCE(SUM(ds.contact_clicks), 0) as total_contact_clicks,
        (SELECT COUNT(*) FROM projects p WHERE p.designer_id = d.id) as project_count
      FROM designers d
      LEFT JOIN designer_stats ds ON d.id = ds.designer_id
      ${whereClause}
      GROUP BY d.id
      ORDER BY ${safeSortBy === 'profile_views' ? 'total_profile_views' : `d.${safeSortBy}`} ${safeSortOrder}
      LIMIT ${safeLimit} OFFSET ${offset}`,
      values
    );
    
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
  return {
    ...project,
    images: parseJsonField(project.images) || [],
    tags: parseJsonField(project.tags) || [],
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
    
    await pool.execute(
      `UPDATE designers 
       SET status = 'approved', is_approved = 1, rejection_reason = NULL, updated_at = NOW()
       WHERE id = ?`,
      [id]
    );
    
    await logActivity(req.admin.id, 'approve_designer', 'designer', parseInt(id), {
      name: designer.full_name,
      email: designer.email
    });
    
    res.json({ 
      message: 'Designer approved successfully.',
      designer: { id, status: 'approved' }
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
    
    const [result] = await pool.execute(
      `UPDATE designers 
       SET status = 'approved', is_approved = 1, rejection_reason = NULL, updated_at = NOW()
       WHERE id IN (${placeholders}) AND status != 'approved'`,
      designerIds
    );
    
    const affectedRows = (result as any).affectedRows;
    
    await logActivity(req.admin.id, 'bulk_approve_designers', 'designer', null, {
      count: affectedRows,
      ids: designerIds
    });
    
    res.json({ 
      message: `${affectedRows} designer(s) approved.`,
      approvedCount: affectedRows
    });
  } catch (error) {
    console.error('Error bulk approving designers:', error);
    res.status(500).json({ error: 'Failed to approve designers.' });
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
    
    // Daily stats for chart
    const [dailyStatsRows] = await pool.execute(
      `SELECT 
        stat_date,
        SUM(profile_views) as profile_views,
        SUM(project_views) as project_views,
        SUM(contact_clicks) as contact_clicks,
        SUM(phone_clicks) as phone_clicks,
        SUM(whatsapp_clicks) as whatsapp_clicks
       FROM designer_stats
       WHERE stat_date BETWEEN ? AND ?
       GROUP BY stat_date
       ORDER BY stat_date ASC`,
      [start, end]
    );
    
    // Top designers by views
    const [topDesignersRows] = await pool.execute(
      `SELECT 
        d.id,
        d.full_name,
        d.avatar_url,
        d.city,
        d.display_order,
        COALESCE(SUM(ds.profile_views), 0) as total_views,
        COALESCE(SUM(ds.contact_clicks), 0) as total_clicks
       FROM designers d
       LEFT JOIN designer_stats ds ON d.id = ds.designer_id
       WHERE d.status = 'approved'
       GROUP BY d.id
       ORDER BY total_views DESC
       LIMIT 10`
    );
    
    res.json({
      overview: (overviewRows as any[])[0],
      dailyStats: dailyStatsRows,
      topDesigners: topDesignersRows,
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
