import pool from '../config/database';

const VALID_ROLES = ['homeowner', 'company'] as const;
type ActiveRole = typeof VALID_ROLES[number];

/**
 * POST /api/users/select-role
 * First-time role selection after registration
 */
export async function selectRole(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const { role } = req.body as { role: ActiveRole };

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be homeowner or company.' });
    }

    // Check current state
    const [rows] = await pool.execute('SELECT active_role, onboarding_completed FROM users WHERE id = ?', [userId]);
    const user = (rows as any[])[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Set active role
    await pool.execute(
      'UPDATE users SET active_role = ?, role = ?, onboarding_completed = 1 WHERE id = ?',
      [role, role, userId]
    );

    res.json({ message: 'Role selected successfully.', active_role: role });
  } catch (error) {
    console.error('Select role error:', error);
    res.status(500).json({ error: 'Failed to select role.' });
  }
}

/**
 * POST /api/users/switch-role
 * Switch to a different role (keeps all existing profile data)
 */
export async function switchRole(req: any, res: any) {
  try {
    const userId = req.user.userId;
    const { role } = req.body as { role: ActiveRole };

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be homeowner or company.' });
    }

    // Check if user has profile for this role
    let hasProfile = false;
    if (role === 'homeowner') {
      const [rows] = await pool.execute('SELECT id FROM homeowner_profiles WHERE user_id = ?', [userId]);
      hasProfile = (rows as any[]).length > 0;
    } else if (role === 'company') {
      const [rows] = await pool.execute('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);
      hasProfile = (rows as any[]).length > 0;
    }

    await pool.execute(
      'UPDATE users SET active_role = ? WHERE id = ?',
      [role, userId]
    );

    res.json({
      message: 'Role switched successfully.',
      active_role: role,
      has_profile: hasProfile,
      needs_onboarding: !hasProfile,
    });
  } catch (error) {
    console.error('Switch role error:', error);
    res.status(500).json({ error: 'Failed to switch role.' });
  }
}

/**
 * GET /api/users/me (enhanced)
 * Returns user info + active_role + corresponding profile data
 */
export async function getMeEnhanced(req: any, res: any) {
  try {
    const userId = req.user.userId;

    const [userRows] = await pool.execute(
      'SELECT id, email, full_name, phone, city, avatar_url, role, active_role, onboarding_completed, status, email_verified, created_at FROM users WHERE id = ?',
      [userId]
    );
    const user = (userRows as any[])[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Load all profiles
    const profiles: any = {};

    // Homeowner profile
    const [homeRows] = await pool.execute('SELECT * FROM homeowner_profiles WHERE user_id = ?', [userId]);
    if ((homeRows as any[]).length > 0) profiles.homeowner = (homeRows as any[])[0];

    // Company profile
    const [companyRows] = await pool.execute('SELECT * FROM company_profiles WHERE user_id = ?', [userId]);
    if ((companyRows as any[]).length > 0) profiles.company = (companyRows as any[])[0];

    res.json({
      user,
      profiles,
      active_role: user.active_role,
      needs_onboarding: !user.active_role,
    });
  } catch (error) {
    console.error('Get me enhanced error:', error);
    res.status(500).json({ error: 'Failed to get user info.' });
  }
}
