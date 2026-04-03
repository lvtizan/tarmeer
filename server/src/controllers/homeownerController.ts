import pool from '../config/database';

/**
 * POST /api/homeowner/profile
 * Create or update homeowner profile (renovation requirements)
 */
export async function upsertProfile(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const { area_range, city, address, phone, stage, budget_range, notes } = req.body;

    if (!area_range || !city || !phone) {
      return res.status(400).json({ error: 'Area range, city, and phone are required.' });
    }

    // Check if profile exists
    const [existing] = await pool.execute('SELECT id FROM homeowner_profiles WHERE user_id = ?', [userId]);

    if ((existing as any[]).length > 0) {
      // Update
      await pool.execute(
        `UPDATE homeowner_profiles SET area_range = ?, city = ?, address = ?, phone = ?, stage = ?, budget_range = ?, notes = ? WHERE user_id = ?`,
        [area_range, city, address || null, phone, stage || null, budget_range || null, notes || null, userId]
      );
    } else {
      // Create
      await pool.execute(
        `INSERT INTO homeowner_profiles (user_id, area_range, city, address, phone, stage, budget_range, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, area_range, city, address || null, phone, stage || null, budget_range || null, notes || null]
      );
    }

    // Ensure active_role is set
    await pool.execute('UPDATE users SET active_role = ?, onboarding_completed = 1 WHERE id = ? AND active_role IS NULL', ['homeowner', userId]);

    const [rows] = await pool.execute('SELECT * FROM homeowner_profiles WHERE user_id = ?', [userId]);
    res.json({ profile: (rows as any[])[0] });
  } catch (error) {
    console.error('Upsert homeowner profile error:', error);
    res.status(500).json({ error: 'Failed to save profile.' });
  }
}

/**
 * GET /api/homeowner/profile
 */
export async function getProfile(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const [rows] = await pool.execute('SELECT * FROM homeowner_profiles WHERE user_id = ?', [userId]);

    if ((rows as any[]).length === 0) {
      return res.json({ profile: null });
    }

    res.json({ profile: (rows as any[])[0] });
  } catch (error) {
    console.error('Get homeowner profile error:', error);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
}

/**
 * GET /api/homeowner/assigned-designer
 * Get the designer assigned to this homeowner
 */
export async function getAssignedDesigner(req: any, res: any) {
  try {
    const userId = req.user.userId;

    const [profileRows] = await pool.execute(
      'SELECT assigned_designer_id, assigned_at FROM homeowner_profiles WHERE user_id = ?',
      [userId]
    );

    if ((profileRows as any[]).length === 0 || !(profileRows as any[])[0].assigned_designer_id) {
      return res.json({ designer: null, assigned_at: null });
    }

    const designerId = (profileRows as any[])[0].assigned_designer_id;
    const assignedAt = (profileRows as any[])[0].assigned_at;

    const [designerRows] = await pool.execute(
      `SELECT d.id, d.full_name, d.email, d.phone, d.city, d.bio, d.avatar_url, d.title, d.style,
              (SELECT COUNT(*) FROM projects WHERE designer_id = d.id AND status = 'published') as project_count
       FROM designers d WHERE d.id = ? AND d.deleted_at IS NULL`,
      [designerId]
    );

    if ((designerRows as any[]).length === 0) {
      return res.json({ designer: null, assigned_at: null });
    }

    // Get designer's recent projects
    const [projectRows] = await pool.execute(
      `SELECT id, title, description, style, image_urls FROM projects WHERE designer_id = ? AND status = 'published' ORDER BY created_at DESC LIMIT 6`,
      [designerId]
    );

    const designer = (designerRows as any[])[0];
    designer.recent_projects = projectRows;

    res.json({ designer, assigned_at: assignedAt });
  } catch (error) {
    console.error('Get assigned designer error:', error);
    res.status(500).json({ error: 'Failed to get assigned designer.' });
  }
}
