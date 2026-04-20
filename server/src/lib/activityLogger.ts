import pool from '../config/database';

interface ActivityEntry {
  userId: number | null;
  userName: string;
  userRole: 'admin' | 'company' | 'homeowner';
  action: string;
  targetType: string;
  targetId?: number;
  targetName?: string;
  description: string;
  ip?: string;
  country?: string;
  city?: string;
  metadata?: Record<string, any>;
}

export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO activity_log (user_id, user_name, user_role, action, target_type, target_id, target_name, description, ip, country, city, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId, entry.userName, entry.userRole,
        entry.action, entry.targetType, entry.targetId || null,
        entry.targetName || null, entry.description,
        entry.ip || null, entry.country || null, entry.city || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]
    );
  } catch (err) {
    console.error('[ActivityLog] Write failed:', err);
  }
}

export function getClientIp(req: any): string {
  return req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers?.['x-real-ip']
    || req.connection?.remoteAddress
    || '';
}
