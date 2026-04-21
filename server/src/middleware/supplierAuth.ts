import jwt from 'jsonwebtoken';
import config from '../config';
import pool from '../config/database';

export async function authenticateSupplier(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Authentication token is required.' });
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    if (!decoded.supplierUserId) {
      return res.status(401).json({ error: 'Invalid supplier token.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, email, full_name FROM supplier_users WHERE id = ?',
      [decoded.supplierUserId]
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(401).json({ error: 'Supplier account not found.' });
    }

    req.supplierUser = {
      id: users[0].id,
      email: users[0].email,
      full_name: users[0].full_name,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid authentication token.' });
  }
}
