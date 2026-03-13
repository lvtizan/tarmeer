import pool from '../config/database';
import { sendContactFormEmail } from '../services/emailService';

export async function createContact(req: any, res: any) {
  try {
    const { name, email, phone, type, message, designer_id, project_id } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO contacts (name, email, phone, type, message, designer_id, project_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone, type, message, designer_id, project_id]
    );
    
    const contactId = (result as any).insertId;
    
    const [contact] = await pool.execute(
      'SELECT * FROM contacts WHERE id = ?',
      [contactId]
    );
    
    await sendContactFormEmail((contact as any[])[0]);
    
    res.status(201).json({
      message: 'Submitted successfully. We will contact you soon.',
      contact: (contact as any[])[0]
    });
  } catch (error) {
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Submission failed. Please try again.' });
  }
}

export async function getContacts(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM contacts ${whereClause}`,
      params
    );
    
    const total = (countResult as any[])[0].total;
    
    const [contacts] = await pool.execute(
      `SELECT c.*, d.full_name as designer_name, p.title as project_title
       FROM contacts c
       LEFT JOIN designers d ON c.designer_id = d.id
       LEFT JOIN projects p ON c.project_id = p.id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    
    res.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to load contacts.' });
  }
}

export async function updateContactStatus(req: any, res: any) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    await pool.execute(
      'UPDATE contacts SET status = ? WHERE id = ?',
      [status, id]
    );
    
    const [contact] = await pool.execute(
      'SELECT * FROM contacts WHERE id = ?',
      [id]
    );
    
    res.json({
      message: 'Status updated successfully.',
      contact: (contact as any[])[0]
    });
  } catch (error) {
    console.error('Update contact status error:', error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
}
