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
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = decoded as { id?: number; email?: string };

    if (!user.id) {
      return res.status(401).json({ error: 'Invalid authentication token.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, email FROM designers WHERE id = ?',
      [user.id]
    );

    const designers = rows as any[];
    if (designers.length === 0) {
      return res.status(401).json({ error: 'Designer account not found.' });
    }

    req.user = { id: designers[0].id, email: designers[0].email };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid authentication token.' });
  }
}
