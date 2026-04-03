import jwt from 'jsonwebtoken';
import config from '../config';
import pool from '../config/database';
import { findOrLinkDesignerForUser } from '../lib/linkedDesigner';

export interface AuthRequest extends Request {
  user?: any;
}

export async function authenticate(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token is required.' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;

    // New token format: { userId, email, role }
    if (decoded.userId) {
      const [rows] = await pool.execute(
        'SELECT id, email, role, active_role, status FROM users WHERE id = ?',
        [decoded.userId]
      );
      const users = rows as any[];
      if (users.length === 0) {
        return res.status(401).json({ error: 'User account not found.' });
      }
      if (users[0].status === 'suspended') {
        return res.status(403).json({ error: 'Account suspended.' });
      }
      const linkedDesigner = await findOrLinkDesignerForUser({
        id: users[0].id,
        email: users[0].email,
      });
      req.user = {
        userId: users[0].id,
        id: linkedDesigner ? linkedDesigner.id : users[0].id,
        email: users[0].email,
        role: users[0].role,
        active_role: users[0].active_role,
      };
      return next();
    }

    // Legacy token format: { id, email } (designer tokens)
    // These users should re-login to get a new token, but handle gracefully
    if (decoded.id) {
      const [rows] = await pool.execute(
        'SELECT id, email, user_id FROM designers WHERE id = ? AND deleted_at IS NULL',
        [decoded.id]
      );
      const designers = rows as any[];
      if (designers.length === 0) {
        return res.status(401).json({ error: 'Account not found. Please log in again.' });
      }

      const designer = designers[0];
      // If designer is linked to a user, use user info
      if (designer.user_id) {
        const [userRows] = await pool.execute(
          'SELECT id, email, role, active_role, status FROM users WHERE id = ?',
          [designer.user_id]
        );
        if ((userRows as any[]).length > 0) {
          const user = (userRows as any[])[0];
          req.user = { userId: user.id, id: user.id, email: user.email, role: user.role, active_role: user.active_role };
          return next();
        }
      }

      // Unlinked designer — prompt re-login
      return res.status(401).json({ error: 'Please log in again to continue.' });
    }

    return res.status(401).json({ error: 'Invalid authentication token.' });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid authentication token.' });
  }
}
