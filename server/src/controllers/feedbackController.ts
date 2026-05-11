import pool from '../config/database';

// Submit feedback (public, no auth required)
export async function submitFeedback(req: any, res: any) {
  try {
    const { title, content, source, user_id, user_name, user_email } = req.body;

    if (!title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    await pool.execute(
      `INSERT INTO feedback (title, content, source, user_id, user_name, user_email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title.trim().slice(0, 200),
        content.trim().slice(0, 2000),
        source || 'website',
        user_id || null,
        user_name?.trim().slice(0, 100) || null,
        user_email?.trim().slice(0, 255) || null,
      ]
    );

    res.status(201).json({ message: 'Feedback submitted. Thank you!' });
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Failed to submit feedback.' });
  }
}

// List feedback (admin only)
export async function listFeedback(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { unread } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (unread === 'true') {
      where += ' AND is_read = 0';
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM feedback ${where}`,
      params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT id, title, content, source, user_id, user_name, user_email, is_read, created_at
       FROM feedback ${where}
       ORDER BY created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    // Count unread total for badge
    const [unreadRows] = await pool.execute(
      `SELECT COUNT(*) as count FROM feedback WHERE is_read = 0`
    );
    const unreadCount = (unreadRows as any[])[0].count;

    res.json({
      feedback: rows,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List feedback error:', error);
    res.status(500).json({ error: 'Failed to load feedback.' });
  }
}

// Get single feedback (admin only), marks as read
export async function getFeedback(req: any, res: any) {
  try {
    const { id } = req.params;

    const [rows] = await pool.execute(
      `SELECT id, title, content, source, user_id, user_name, user_email, is_read, created_at
       FROM feedback WHERE id = ?`,
      [id]
    );

    const item = (rows as any[])[0];
    if (!item) return res.status(404).json({ error: 'Feedback not found.' });

    // Mark as read if not already
    if (!item.is_read) {
      await pool.execute('UPDATE feedback SET is_read = 1 WHERE id = ?', [id]);
      item.is_read = 1;
    }

    res.json({ feedback: item });
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to load feedback.' });
  }
}

// Count unread feedback (used by notification system)
export async function getUnreadFeedbackCount(): Promise<number> {
  try {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count FROM feedback WHERE is_read = 0`
    );
    return Number((rows as any[])[0]?.count || 0);
  } catch {
    return 0;
  }
}

// Mark all feedback as read (admin)
export async function markAllFeedbackRead(req: any, res: any) {
  try {
    await pool.execute('UPDATE feedback SET is_read = 1 WHERE is_read = 0');
    res.json({ ok: true });
  } catch (error) {
    console.error('Mark all feedback read error:', error);
    res.status(500).json({ error: 'Failed to mark feedback as read.' });
  }
}
