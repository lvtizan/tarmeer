import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import config from '../config';
import { AdminUser } from '../middleware/adminAuth';

// Check if system is installed (has any admin)
export async function checkInstallation(req: Request, res: Response) {
  try {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) as count FROM admin_users'
    );
    
    const count = (rows as any[])[0].count;
    
    res.json({ 
      installed: count > 0,
      adminCount: count 
    });
  } catch (error) {
    console.error('Error checking installation:', error);
    res.status(500).json({ error: 'Failed to check installation status.' });
  }
}

// Install: Create first super admin
export async function install(req: Request, res: Response) {
  const { email, password, fullName } = req.body;
  
  // Validate input
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Email, password, and full name are required.' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  
  try {
    // Check if already installed
    const [existingAdmins] = await pool.execute(
      'SELECT COUNT(*) as count FROM admin_users'
    );
    
    if ((existingAdmins as any[])[0].count > 0) {
      return res.status(400).json({ error: 'System already installed. Use login endpoint.' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create super admin
    const [result] = await pool.execute(
      `INSERT INTO admin_users (email, password, full_name, role, permissions)
       VALUES (?, ?, ?, 'super_admin', NULL)`,
      [email.toLowerCase().trim(), hashedPassword, fullName.trim()]
    );
    
    const adminId = (result as any).insertId;
    
    // Generate JWT token with admin type marker
    const token = jwt.sign(
      { adminId, type: 'admin' },
      config.jwt.secret,
      { expiresIn: '7d' }
    );
    
    // Log activity
    await logActivity(adminId, 'install', 'system', null, { email });
    
    res.status(201).json({
      message: 'Super admin created successfully.',
      token,
      admin: {
        id: adminId,
        email: email.toLowerCase(),
        fullName: fullName.trim(),
        role: 'super_admin'
      }
    });
  } catch (error) {
    console.error('Error during installation:', error);
    res.status(500).json({ error: 'Failed to create super admin.' });
  }
}

// Admin login
export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, password, full_name, role, permissions, is_active FROM admin_users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    
    const admins = rows as any[];
    
    if (admins.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    const admin = admins[0];
    
    if (!admin.is_active) {
      return res.status(403).json({ error: 'Admin account is deactivated.' });
    }
    
    const isValidPassword = await bcrypt.compare(password, admin.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    
    // Update last login
    await pool.execute(
      'UPDATE admin_users SET last_login = NOW() WHERE id = ?',
      [admin.id]
    );
    
    // Generate JWT token with admin type marker
    const token = jwt.sign(
      { adminId: admin.id, type: 'admin' },
      config.jwt.secret,
      { expiresIn: '7d' }
    );
    
    // Log activity
    await logActivity(admin.id, 'login', 'admin', admin.id, { email: admin.email });
    
    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Failed to login.' });
  }
}

// Get current admin profile
export async function getProfile(req: any, res: Response) {
  try {
    const admin = req.admin;
    
    res.json({
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      role: admin.role,
      permissions: admin.permissions
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
}

// Create sub-admin (super admin only)
export async function createSubAdmin(req: any, res: Response) {
  const { email, password, fullName, permissions } = req.body;
  
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Email, password, and full name are required.' });
  }
  
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  
  // Validate permissions
  const validPerms = ['can_approve', 'can_sort', 'can_view_stats'];
  const permsObj: any = {};
  
  if (permissions) {
    for (const key of Object.keys(permissions)) {
      if (validPerms.includes(key)) {
        permsObj[key] = !!permissions[key];
      }
    }
  }
  
  try {
    // Check if email already exists
    const [existing] = await pool.execute(
      'SELECT id FROM admin_users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    
    if ((existing as any[]).length > 0) {
      return res.status(400).json({ error: 'Email already registered.' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create sub-admin
    const [result] = await pool.execute(
      `INSERT INTO admin_users (email, password, full_name, role, permissions)
       VALUES (?, ?, ?, 'sub_admin', ?)`,
      [email.toLowerCase().trim(), hashedPassword, fullName.trim(), JSON.stringify(permsObj)]
    );
    
    const adminId = (result as any).insertId;
    
    // Log activity
    await logActivity(req.admin.id, 'create_admin', 'admin', adminId, { email, permissions: permsObj });
    
    res.status(201).json({
      message: 'Sub-admin created successfully.',
      admin: {
        id: adminId,
        email: email.toLowerCase(),
        fullName: fullName.trim(),
        role: 'sub_admin',
        permissions: permsObj
      }
    });
  } catch (error) {
    console.error('Error creating sub-admin:', error);
    res.status(500).json({ error: 'Failed to create sub-admin.' });
  }
}

// List all admins (super admin only)
export async function listAdmins(req: any, res: Response) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, email, full_name, role, permissions, is_active, last_login, created_at
       FROM admin_users
       ORDER BY created_at DESC`
    );
    
    res.json({ admins: rows });
  } catch (error) {
    console.error('Error listing admins:', error);
    res.status(500).json({ error: 'Failed to list admins.' });
  }
}

// Update admin (super admin only)
export async function updateAdmin(req: any, res: Response) {
  const { id } = req.params;
  const { fullName, permissions, isActive } = req.body;
  
  try {
    const [existing] = await pool.execute(
      'SELECT id, role FROM admin_users WHERE id = ?',
      [id]
    );
    
    const admins = existing as any[];
    
    if (admins.length === 0) {
      return res.status(404).json({ error: 'Admin not found.' });
    }
    
    // Cannot modify super admin's role or active status
    const targetAdmin = admins[0];
    if (targetAdmin.role === 'super_admin' && isActive === false) {
      return res.status(400).json({ error: 'Cannot deactivate super admin.' });
    }
    
    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    
    if (fullName !== undefined) {
      updates.push('full_name = ?');
      values.push(fullName.trim());
    }
    
    if (permissions !== undefined && targetAdmin.role === 'sub_admin') {
      updates.push('permissions = ?');
      values.push(JSON.stringify(permissions));
    }
    
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }
    
    values.push(id);
    
    await pool.execute(
      `UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // Log activity
    await logActivity(req.admin.id, 'update_admin', 'admin', parseInt(id), { updates });
    
    res.json({ message: 'Admin updated successfully.' });
  } catch (error) {
    console.error('Error updating admin:', error);
    res.status(500).json({ error: 'Failed to update admin.' });
  }
}

// Delete admin (super admin only)
export async function deleteAdmin(req: any, res: Response) {
  const { id } = req.params;
  
  try {
    const [existing] = await pool.execute(
      'SELECT id, role, email FROM admin_users WHERE id = ?',
      [id]
    );
    
    const admins = existing as any[];
    
    if (admins.length === 0) {
      return res.status(404).json({ error: 'Admin not found.' });
    }
    
    if (admins[0].role === 'super_admin') {
      return res.status(400).json({ error: 'Cannot delete super admin.' });
    }
    
    await pool.execute('DELETE FROM admin_users WHERE id = ?', [id]);
    
    // Log activity
    await logActivity(req.admin.id, 'delete_admin', 'admin', parseInt(id), { email: admins[0].email });
    
    res.json({ message: 'Admin deleted successfully.' });
  } catch (error) {
    console.error('Error deleting admin:', error);
    res.status(500).json({ error: 'Failed to delete admin.' });
  }
}

// Change password
export async function changePassword(req: any, res: Response) {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new passwords are required.' });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  
  try {
    const [rows] = await pool.execute(
      'SELECT password FROM admin_users WHERE id = ?',
      [req.admin.id]
    );
    
    const admins = rows as any[];
    
    if (admins.length === 0) {
      return res.status(401).json({ error: 'Admin not found.' });
    }
    
    const isValid = await bcrypt.compare(currentPassword, admins[0].password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await pool.execute(
      'UPDATE admin_users SET password = ? WHERE id = ?',
      [hashedPassword, req.admin.id]
    );
    
    await logActivity(req.admin.id, 'change_password', 'admin', req.admin.id);
    
    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password.' });
  }
}

// Helper: Log activity
async function logActivity(
  adminId: number,
  action: string,
  targetType: string | null,
  targetId: number | null,
  details: any = null
) {
  try {
    await pool.execute(
      `INSERT INTO admin_activity_logs (admin_id, action, target_type, target_id, details)
       VALUES (?, ?, ?, ?, ?)`,
      [adminId, action, targetType, targetId, details ? JSON.stringify(details) : null]
    );
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

export { logActivity };
