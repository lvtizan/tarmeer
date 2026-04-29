import { Response } from 'express';
import pool from '../config/database';
import bcrypt from 'bcryptjs';

// GET /api/admin/interviews
export async function listInterviews(_req: any, res: Response) {
  try {
    const [rows] = await pool.execute(`
      SELECT ci.id, ci.company_name, ci.status, ci.submitted_at, ci.created_at,
             au.full_name AS interviewer_name,
             uc.name_en AS linked_company_name
      FROM company_interviews ci
      JOIN admin_users au ON au.id = ci.interviewer_id
      LEFT JOIN uae_companies uc ON uc.id = ci.company_ref_id
      ORDER BY ci.updated_at DESC
      LIMIT 200
    `);
    res.json({ interviews: rows });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list interviews.' });
  }
}

// GET /api/admin/interviews/:id
export async function getInterview(req: any, res: Response) {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(`
      SELECT ci.*, au.full_name AS interviewer_name, uc.name_en AS linked_company_name
      FROM company_interviews ci
      JOIN admin_users au ON au.id = ci.interviewer_id
      LEFT JOIN uae_companies uc ON uc.id = ci.company_ref_id
      WHERE ci.id = ?
    `, [id]);
    const items = rows as any[];
    if (items.length === 0) return res.status(404).json({ error: 'Not found.' });
    res.json({ interview: items[0] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch interview.' });
  }
}

// PATCH /api/admin/interviews/:id — super admin edit
export async function editInterview(req: any, res: Response) {
  const { id } = req.params;
  const allowed = ['company_name','company_ref_id','section_1','section_2','section_3',
    'section_4','section_5','section_6','section_7','section_8','section_9'];
  const fields: Record<string, any> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields[key] = typeof req.body[key] === 'object'
        ? JSON.stringify(req.body[key])
        : req.body[key];
    }
  }
  if (Object.keys(fields).length === 0) return res.json({ ok: true });
  try {
    const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    await pool.execute(
      `UPDATE company_interviews SET ${setClauses} WHERE id = ?`,
      [...Object.values(fields), id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update interview.' });
  }
}

// GET /api/admin/staff
export async function listStaff(_req: any, res: Response) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, email, full_name, is_active, created_at FROM admin_users WHERE role = 'field_staff' ORDER BY created_at DESC`
    );
    res.json({ staff: rows });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list staff.' });
  }
}

// POST /api/admin/staff
export async function createStaff(req: any, res: Response) {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password, fullName required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM admin_users WHERE email = ?', [email.toLowerCase().trim()]
    );
    if ((existing as any[]).length > 0) {
      return res.status(409).json({ error: 'Email already exists.' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO admin_users (email, password, full_name, role) VALUES (?, ?, ?, 'field_staff')`,
      [email.toLowerCase().trim(), hashed, fullName.trim()]
    );
    res.status(201).json({ id: (result as any).insertId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create staff.' });
  }
}

// PATCH /api/admin/staff/:id — toggle active
export async function toggleStaff(req: any, res: Response) {
  const { id } = req.params;
  const { is_active } = req.body;
  try {
    await pool.execute(
      'UPDATE admin_users SET is_active = ? WHERE id = ? AND role = ?',
      [is_active ? 1 : 0, id, 'field_staff']
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update staff.' });
  }
}
