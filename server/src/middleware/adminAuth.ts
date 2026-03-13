import jwt from 'jsonwebtoken';
import config from '../config';
import pool from '../config/database';

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: 'super_admin' | 'sub_admin';
  permissions: {
    can_approve?: boolean;
    can_sort?: boolean;
    can_view_stats?: boolean;
  } | null;
  is_active: boolean;
}

export interface AdminRequest extends Request {
  admin?: AdminUser;
}

export function authenticateAdmin(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication token is required.' });
  }
  
  try {
    // Verify token with admin-specific payload structure
    const decoded = jwt.verify(token, config.jwt.secret) as { adminId?: number; id?: number; type?: string };
    
    // Check if this is an admin token (not a designer token)
    if (!decoded.adminId || decoded.type !== 'admin') {
      return res.status(401).json({ error: 'Invalid token type. Admin access required.' });
    }
    
    req.adminId = decoded.adminId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

export async function requireAdmin(req: any, res: any, next: any) {
  if (!req.adminId) {
    return res.status(401).json({ error: 'Admin ID not found in token.' });
  }
  
  try {
    const [rows] = await pool.execute(
      'SELECT id, email, full_name, role, permissions, is_active FROM admin_users WHERE id = ?',
      [req.adminId]
    );
    
    const admins = rows as AdminUser[];
    
    if (admins.length === 0) {
      return res.status(401).json({ error: 'Admin not found.' });
    }
    
    const admin = admins[0];
    
    if (!admin.is_active) {
      return res.status(403).json({ error: 'Admin account is deactivated.' });
    }
    
    req.admin = admin;
    next();
  } catch (error) {
    console.error('Error fetching admin:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

export function requireSuperAdmin(req: any, res: any, next: any) {
  if (!req.admin) {
    return res.status(401).json({ error: 'Admin not authenticated.' });
  }
  
  if (req.admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin privileges required.' });
  }
  
  next();
}

export function requirePermission(permission: 'can_approve' | 'can_sort' | 'can_view_stats') {
  return (req: any, res: any, next: any) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Admin not authenticated.' });
    }
    
    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      return next();
    }
    
    // Check specific permission for sub-admin
    const permissions = req.admin.permissions || {};
    if (!permissions[permission]) {
      return res.status(403).json({ 
        error: `You don't have permission: ${permission}` 
      });
    }
    
    next();
  };
}
