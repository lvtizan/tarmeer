import { Response } from 'express';
import pool from '../config/database';

// POST /api/field/interviews — create draft
export async function createDraft(req: any, res: Response) {
  const interviewerId = req.admin.id;
  try {
    const [result] = await pool.execute(
      `INSERT INTO company_interviews (interviewer_id, status) VALUES (?, 'draft')`,
      [interviewerId]
    );
    const id = (result as any).insertId;
    res.status(201).json({ id });
  } catch (e) {
    console.error('createDraft error:', e);
    res.status(500).json({ error: 'Failed to create draft.' });
  }
}

// GET /api/field/interviews/draft — get latest draft for current user
export async function getMyDraft(req: any, res: Response) {
  const interviewerId = req.admin.id;
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM company_interviews
       WHERE interviewer_id = ? AND status = 'draft'
       ORDER BY updated_at DESC LIMIT 1`,
      [interviewerId]
    );
    const drafts = rows as any[];
    if (drafts.length === 0) return res.json({ draft: null });
    res.json({ draft: drafts[0] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch draft.' });
  }
}

// PATCH /api/field/interviews/:id — auto-save
export async function saveDraft(req: any, res: Response) {
  const { id } = req.params;
  const interviewerId = req.admin.id;
  const {
    company_name, company_ref_id,
    section_1, section_2, section_3, section_4, section_5,
    section_6, section_7, section_8, section_9,
  } = req.body;

  try {
    // Verify ownership and draft status
    const [rows] = await pool.execute(
      `SELECT id FROM company_interviews WHERE id = ? AND interviewer_id = ? AND status = 'draft'`,
      [id, interviewerId]
    );
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: 'Draft not found or already submitted.' });
    }

    const fields: Record<string, any> = {};
    if (company_name !== undefined) fields.company_name = String(company_name).slice(0, 200);
    if (company_ref_id !== undefined) fields.company_ref_id = company_ref_id || null;
    if (section_1 !== undefined) fields.section_1 = JSON.stringify(section_1);
    if (section_2 !== undefined) fields.section_2 = JSON.stringify(section_2);
    if (section_3 !== undefined) fields.section_3 = JSON.stringify(section_3);
    if (section_4 !== undefined) fields.section_4 = JSON.stringify(section_4);
    if (section_5 !== undefined) fields.section_5 = JSON.stringify(section_5);
    if (section_6 !== undefined) fields.section_6 = JSON.stringify(section_6);
    if (section_7 !== undefined) fields.section_7 = JSON.stringify(section_7);
    if (section_8 !== undefined) fields.section_8 = JSON.stringify(section_8);
    if (section_9 !== undefined) fields.section_9 = JSON.stringify(section_9);

    if (Object.keys(fields).length === 0) return res.json({ ok: true });

    const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await pool.execute(`UPDATE company_interviews SET ${setClauses} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (e) {
    console.error('saveDraft error:', e);
    res.status(500).json({ error: 'Failed to save.' });
  }
}

// POST /api/field/interviews/:id/submit — submit
export async function submitInterview(req: any, res: Response) {
  const { id } = req.params;
  const interviewerId = req.admin.id;
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM company_interviews WHERE id = ? AND interviewer_id = ? AND status = ?',
      [id, interviewerId, 'draft']
    );
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: 'Draft not found.' });
    }
    await pool.execute(
      `UPDATE company_interviews SET status = 'submitted', submitted_at = NOW() WHERE id = ?`,
      [id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit.' });
  }
}

// GET /api/field/companies/search?q= — search uae_companies for linking
export async function searchCompanies(req: any, res: Response) {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.json({ results: [] });
  try {
    const [rows] = await pool.execute(
      `SELECT id, name_en AS name, city FROM uae_companies WHERE name_en LIKE ? LIMIT 10`,
      [`%${q}%`]
    );
    res.json({ results: rows });
  } catch (e) {
    res.status(500).json({ error: 'Search failed.' });
  }
}
