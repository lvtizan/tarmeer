import pool from '../config/database';
import { logActivity } from './adminController';

// List users with pagination, filters, search
export async function listUsers(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { role, status, search } = req.query;

    let where = 'WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (role) { where += ' AND role = ?'; params.push(role); }
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (search) {
      where += ' AND (full_name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM users ${where}`, params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT id, email, full_name, phone, city, avatar_url, role, status, email_verified, created_at, updated_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    res.json({
      users: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to list users.' });
  }
}

// Get user detail with linked designer/company info
export async function getUserDetail(req: any, res: any) {
  try {
    const { id } = req.params;

    const [userRows] = await pool.execute(
      'SELECT id, email, full_name, phone, city, avatar_url, role, status, email_verified, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if ((userRows as any[]).length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = (userRows as any[])[0];

    // Get linked designer
    const [designerRows] = await pool.execute(
      'SELECT id, full_name, status, is_approved, bio, style, city, avatar_url, created_at FROM designers WHERE user_id = ? AND deleted_at IS NULL',
      [id]
    );

    const designer = (designerRows as any[])[0] || null;

    // Get designer's projects if linked
    let projects: any[] = [];
    if (designer) {
      const [projectRows] = await pool.execute(
        'SELECT id, title, description, style, location, year, images, tags, status, rejection_reason, created_at, updated_at FROM projects WHERE designer_id = ? ORDER BY created_at DESC',
        [designer.id]
      );
      projects = (projectRows as any[]).map((p: any) => {
        let parsedImages = p.images;
        if (typeof parsedImages === 'string') {
          try { parsedImages = JSON.parse(parsedImages); } catch { parsedImages = []; }
        }
        const normalizedImages = Array.isArray(parsedImages)
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
          : [];
        return { ...p, images: normalizedImages };
      });
    }

    // Get linked company
    const [companyRows] = await pool.execute(
      'SELECT id, slug, city FROM uae_companies WHERE owner_user_id = ?',
      [id]
    );

    // Get company applications
    const [appRows] = await pool.execute(
      'SELECT id, company_name, status, created_at FROM company_applications WHERE user_id = ? ORDER BY created_at DESC',
      [id]
    );

    res.json({
      user,
      designer,
      projects,
      company: (companyRows as any[])[0] || null,
      companyApplications: appRows,
    });
  } catch (error) {
    console.error('Get user detail error:', error);
    res.status(500).json({ error: 'Failed to get user.' });
  }
}

// Update user status (activate/suspend)
export async function updateUserStatus(req: any, res: any) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be active or suspended.' });
    }

    await pool.execute('UPDATE users SET status = ? WHERE id = ?', [status, id]);
    res.json({ message: `User ${status === 'active' ? 'activated' : 'suspended'}.` });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
}

// Update user role
export async function updateUserRole(req: any, res: any) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'designer', 'company'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }

    await pool.execute('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ message: `User role updated to ${role}.` });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update role.' });
  }
}

// Edit user profile fields
export async function editUser(req: any, res: any) {
  try {
    const { id } = req.params;
    const { full_name, phone, city, email } = req.body;

    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }

    const [rows] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Build dynamic update
    const updates: string[] = [];
    const params: any[] = [];

    if (full_name !== undefined) { updates.push('full_name = ?'); params.push(String(full_name).trim()); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(String(phone).trim() || null); }
    if (city !== undefined) { updates.push('city = ?'); params.push(String(city).trim() || null); }
    if (email !== undefined) {
      const trimmedEmail = String(email).trim().toLowerCase();
      if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Invalid email format.' });
      }
      // Check uniqueness
      const [existing] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [trimmedEmail, userId]);
      if ((existing as any[]).length > 0) {
        return res.status(400).json({ error: 'Email already in use by another user.' });
      }
      updates.push('email = ?');
      params.push(trimmedEmail);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    params.push(userId);
    await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    const adminId = req.admin?.id;
    await logActivity(adminId, 'edit_user', 'user', userId, { updated_fields: updates.map(u => u.split(' = ')[0]) });

    res.json({ message: 'User updated successfully.' });
  } catch (error) {
    console.error('Edit user error:', error);
    res.status(500).json({ error: 'Failed to update user.' });
  }
}

const AVAILABLE_PERMISSIONS = [
  'manage_projects',
  'manage_company',
  'view_analytics',
  'manage_inquiries',
  'manage_users',
  'import_companies',
  'manage_complaints',
  'export_data',
] as const;

// Get user permissions
export async function getUserPermissions(req: any, res: any) {
  try {
    const { id } = req.params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, permissions FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [userId]
    );

    const user = (rows as any[])[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });

    let permissions: string[] = [];
    if (user.permissions) {
      try {
        permissions = typeof user.permissions === 'string'
          ? JSON.parse(user.permissions)
          : user.permissions;
        if (!Array.isArray(permissions)) permissions = [];
      } catch { permissions = []; }
    }

    res.json({ permissions, available: AVAILABLE_PERMISSIONS });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ error: 'Failed to get permissions.' });
  }
}

// Update user permissions
export async function updateUserPermissions(req: any, res: any) {
  try {
    const { id } = req.params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }

    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array.' });
    }

    // Filter to only known permissions
    const filtered = permissions.filter((p: any) =>
      typeof p === 'string' && (AVAILABLE_PERMISSIONS as readonly string[]).includes(p)
    );

    const [rows] = await pool.execute(
      'SELECT id FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1',
      [userId]
    );
    if ((rows as any[]).length === 0) return res.status(404).json({ error: 'User not found.' });

    await pool.execute(
      'UPDATE users SET permissions = ? WHERE id = ?',
      [JSON.stringify(filtered), userId]
    );

    await logActivity(req.admin?.id, 'update_user_permissions', 'user', userId, { permissions: filtered });

    res.json({ message: 'Permissions updated.', permissions: filtered });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({ error: 'Failed to update permissions.' });
  }
}

function normalizeDeleteReason(rawReason: unknown): string | null {
  if (typeof rawReason !== 'string') return null;
  const trimmed = rawReason.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return trimmed.slice(0, 500);
  return trimmed;
}

// Soft delete user
export async function deleteUser(req: any, res: any) {
  try {
    const { id } = req.params;
    const adminId = req.admin?.id;
    const reason = normalizeDeleteReason(req.body?.reason);
    if (!reason) {
      return res.status(400).json({ error: 'Delete reason is required.' });
    }

    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }
    if (adminId === userId) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, email, full_name, deleted_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const user = (rows as any[])[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.deleted_at) return res.status(400).json({ error: 'User is already deleted.' });

    await pool.execute(
      `UPDATE users
       SET deleted_at = NOW(), deleted_by_admin_id = ?, delete_reason = ?, status = 'suspended'
       WHERE id = ?`,
      [adminId, reason, userId]
    );

    await logActivity(adminId, 'delete_user', 'user', userId, {
      email: user.email,
      full_name: user.full_name,
      reason,
    });

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
}

// Restore soft deleted user
export async function restoreUser(req: any, res: any) {
  try {
    const { id } = req.params;
    const adminId = req.admin?.id;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, email, full_name, deleted_at FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    const user = (rows as any[])[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (!user.deleted_at) return res.status(400).json({ error: 'User is not deleted.' });

    await pool.execute(
      `UPDATE users
       SET deleted_at = NULL, deleted_by_admin_id = NULL, delete_reason = NULL
       WHERE id = ?`,
      [userId]
    );

    await logActivity(adminId, 'restore_user', 'user', userId, {
      email: user.email,
      full_name: user.full_name,
    });

    res.json({ message: 'User restored successfully.' });
  } catch (error) {
    console.error('Restore user error:', error);
    res.status(500).json({ error: 'Failed to restore user.' });
  }
}
