import pool from '../config/database';

/**
 * GET /api/admin/activity-log
 * Paginated, filterable activity log
 */
export async function getActivityLogs(req: any, res: any) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const offset = (page - 1) * limit;

    const { role, action, target_type, search, start_date, end_date } = req.query;

    let where = 'WHERE created_at > NOW() - INTERVAL 90 DAY';
    const params: any[] = [];

    if (role) { where += ' AND user_role = ?'; params.push(role); }
    if (action) { where += ' AND action = ?'; params.push(action); }
    if (target_type) { where += ' AND target_type = ?'; params.push(target_type); }
    if (search) {
      where += ' AND (user_name LIKE ? OR target_name LIKE ? OR description LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (start_date) { where += ' AND created_at >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND created_at <= ?'; params.push(`${end_date} 23:59:59`); }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM activity_log ${where}`, params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.query(
      `SELECT al.*,
        COALESCE(NULLIF(al.user_name, ''), au.full_name, au.email, u.full_name, u.email) AS user_name
       FROM activity_log al
       LEFT JOIN admin_users au ON au.id = al.user_id AND al.user_role = 'admin'
       LEFT JOIN users u ON u.id = al.user_id AND al.user_role != 'admin'
       ${where} ORDER BY al.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      logs: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to load activity logs.' });
  }
}

/**
 * GET /api/admin/activity-log/stats
 * Dashboard stats + charts data for activity log page
 */
export async function getActivityLogStats(req: any, res: any) {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 7));

    // Today's stats
    const [todayRows] = await pool.execute(
      `SELECT
        COUNT(*) as total,
        COUNT(DISTINCT CASE WHEN user_role = 'company' THEN user_id END) as active_companies,
        COUNT(DISTINCT CASE WHEN user_role = 'homeowner' THEN user_id END) as active_homeowners,
        SUM(CASE WHEN user_role = 'admin' THEN 1 ELSE 0 END) as admin_actions
       FROM activity_log WHERE DATE(created_at) = CURDATE()`
    );

    // Action distribution (last N days)
    const [actionDist] = await pool.execute(
      `SELECT action, COUNT(*) as count FROM activity_log
       WHERE created_at > NOW() - INTERVAL ? DAY
       GROUP BY action ORDER BY count DESC`,
      [days]
    );

    // Daily trend by role (last N days)
    const [dailyTrend] = await pool.execute(
      `SELECT DATE(created_at) as date,
        SUM(CASE WHEN user_role = 'admin' THEN 1 ELSE 0 END) as admin,
        SUM(CASE WHEN user_role = 'company' THEN 1 ELSE 0 END) as company,
        SUM(CASE WHEN user_role = 'homeowner' THEN 1 ELSE 0 END) as homeowner
       FROM activity_log
       WHERE created_at > NOW() - INTERVAL ? DAY
       GROUP BY DATE(created_at) ORDER BY date`,
      [days]
    );

    res.json({
      today: (todayRows as any[])[0],
      action_distribution: actionDist,
      daily_trend: dailyTrend,
    });
  } catch (error) {
    console.error('Get activity log stats error:', error);
    res.status(500).json({ error: 'Failed to load activity log stats.' });
  }
}

/**
 * GET /api/admin/activity-log/export
 * CSV export of activity logs
 */
export async function exportActivityLogs(req: any, res: any) {
  try {
    const { role, action, start_date, end_date } = req.query;

    let where = 'WHERE created_at > NOW() - INTERVAL 90 DAY';
    const params: any[] = [];

    if (role) { where += ' AND user_role = ?'; params.push(role); }
    if (action) { where += ' AND action = ?'; params.push(action); }
    if (start_date) { where += ' AND created_at >= ?'; params.push(start_date); }
    if (end_date) { where += ' AND created_at <= ?'; params.push(`${end_date} 23:59:59`); }

    const [rows] = await pool.query(
      `SELECT created_at, user_name, user_role, action, target_type, target_name, description, ip, country, city
       FROM activity_log ${where} ORDER BY created_at DESC LIMIT 5000`,
      params
    );

    const header = 'Time,User,Role,Action,Type,Target,Description,IP,Country,City\n';
    const csv = (rows as any[]).map(r =>
      [r.created_at, r.user_name, r.user_role, r.action, r.target_type, r.target_name, `"${(r.description || '').replace(/"/g, '""')}"`, r.ip, r.country, r.city].join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=activity-log-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send('\uFEFF' + header + csv);
  } catch (error) {
    console.error('Export activity logs error:', error);
    res.status(500).json({ error: 'Failed to export.' });
  }
}
