import jwt from 'jsonwebtoken';
import config from '../config';
import pool from '../config/database';

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
        'SELECT id, email, role, status FROM users WHERE id = ?',
        [decoded.userId]
      );
      const users = rows as any[];
      if (users.length === 0) {
        return res.status(401).json({ error: 'User account not found.' });
      }
      if (users[0].status === 'suspended') {
        return res.status(403).json({ error: 'Account suspended.' });
      }
      // If user has a linked designer, set id to designer.id for backward compat
      const [designerRows] = await pool.execute(
        'SELECT id FROM designers WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
        [users[0].id]
      );
      const linkedDesigner = (designerRows as any[])[0];
      req.user = {
        userId: users[0].id,
        id: linkedDesigner ? linkedDesigner.id : users[0].id,
        email: users[0].email,
        role: users[0].role,
      };
      return next();
    }

    // Legacy token format: { id, email } (designer tokens)
    if (decoded.id) {
      const [rows] = await pool.execute(
        'SELECT id, email, user_id FROM designers WHERE id = ? AND deleted_at IS NULL',
        [decoded.id]
      );
      const designers = rows as any[];
      if (designers.length === 0) {
        return res.status(401).json({ error: 'Designer account not found.' });
      }

      const designer = designers[0];
      // If designer is linked to a user, use user info
      if (designer.user_id) {
        const [userRows] = await pool.execute(
          'SELECT id, email, role, status FROM users WHERE id = ?',
          [designer.user_id]
        );
        if ((userRows as any[]).length > 0) {
          const user = (userRows as any[])[0];
          req.user = { userId: user.id, id: designer.id, email: user.email, role: user.role };
          return next();
        }
      }

      // Fallback: use designer directly (for unlinked designers)
      req.user = { id: designer.id, email: designer.email, role: 'designer' };
      return next();
    }

    return res.status(401).json({ error: 'Invalid authentication token.' });
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid authentication token.' });
  }
}
