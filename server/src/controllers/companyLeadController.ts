import pool from '../config/database';

export async function submitCompanyLead(req: any, res: any) {
  try {
    const { contactName, phone, companyName, yearEstablished, scopeOfBusiness, lang } = req.body;
    const sourcePage = req.headers.referer || null;

    const [result] = await pool.execute(
      `INSERT INTO company_leads (contact_name, phone, company_name, year_established, scope_of_business, lang, source_page)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [contactName, phone, companyName, yearEstablished || null, scopeOfBusiness || null, lang || 'en', sourcePage]
    );

    const leadId = (result as any).insertId;

    const [lead] = await pool.execute(
      'SELECT * FROM company_leads WHERE id = ?',
      [leadId]
    );

    res.status(201).json({
      message: 'Submitted successfully. We will contact you soon.',
      lead: (lead as any[])[0],
    });
  } catch (error) {
    console.error('Submit company lead error:', error);
    res.status(500).json({ error: 'Submission failed. Please try again.' });
  }
}

export async function getCompanyLeads(req: any, res: any) {
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
      `SELECT COUNT(*) as total FROM company_leads ${whereClause}`,
      params
    );

    const total = (countResult as any[])[0].total;

    const [leads] = await pool.execute(
      `SELECT * FROM company_leads ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      leads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get company leads error:', error);
    res.status(500).json({ error: 'Failed to load company leads.' });
  }
}
