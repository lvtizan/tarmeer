import jwt from 'jsonwebtoken';
import config from '../config';

export interface AuthRequest extends Request {
  user?: any;
}

export function authenticate(req: any, res: any, next: any) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication token is required.' });
  }
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid authentication token.' });
  }
}
