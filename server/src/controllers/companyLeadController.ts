import pool from '../config/database';
import { pushCompanyLeadToCRM, pushLeadToCRM } from '../lib/crmPush';

export async function submitCompanyLead(req: any, res: any) {
  try {
    const { contactName, phone, companyName, city, companyType, yearEstablished, scopeOfBusiness, lang } = req.body;
    const sourcePage = req.headers.referer || null;

    // Check if phone number already registered
    if (phone) {
      const [userRows] = await pool.execute(
        `SELECT u.id,
                (SELECT COUNT(*) FROM company_profiles cp WHERE cp.user_id = u.id LIMIT 1) AS has_company
         FROM users u WHERE u.phone = ? AND u.deleted_at IS NULL LIMIT 1`,
        [phone]
      );
      const existingUser = (userRows as any[])[0];
      if (existingUser) {
        return res.status(409).json({
          phoneExists: true,
          hasCompanyProfile: existingUser.has_company > 0,
        });
      }
    }

    const [result] = await pool.execute(
      `INSERT INTO company_leads (contact_name, phone, company_name, company_type, city, year_established, scope_of_business, lang, source_page)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [contactName, phone, companyName, companyType || null, city || null, yearEstablished || null, scopeOfBusiness || null, lang || 'en', sourcePage]
    );

    const leadId = (result as any).insertId;

    // Mirror into design_inquiries so it appears in the admin Company inquiries tab
    const inquiryMessage = [
      `[Company Inquiry]`,
      `Company: ${companyName}`,
      companyType ? `Type: ${companyType}` : '',
      yearEstablished ? `Est. ${yearEstablished}` : '',
    ].filter(Boolean).join(' | ');

    const [mirrorResult] = await pool.execute(
      `INSERT INTO design_inquiries (name, phone, city, area_range, message, source_company_name)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [contactName, phone, city || null, companyType || 'company-lead', inquiryMessage, companyName]
    ).catch(() => [{ insertId: 0 }]);
    const mirrorInquiryId = (mirrorResult as any).insertId;

    // Sync the mirrored inquiry to CRM so it shows "已同步" in admin
    if (mirrorInquiryId) {
      pushLeadToCRM({
        inquiryId: mirrorInquiryId,
        externalId: `inquiry-${mirrorInquiryId}`,
        name: contactName || 'Anonymous',
        phone,
        city: city || undefined,
        notes: `Company: ${companyName}${companyType ? ` | ${companyType}` : ''}`,
        page: sourcePage || '/for-companies',
        company: companyName || undefined,
      }).catch(() => {});
    }

    // Fire-and-forget CRM push (company tenant)
    // notes field carries company_type so CRM sales team sees it
    // Send full info — CRM notes field supports 1500 chars
    const crmNotes = [
      companyType ? `Type: ${companyType}` : '',
      yearEstablished ? `Est. ${yearEstablished}` : '',
    ].filter(Boolean).join(', ') || undefined;
    pushCompanyLeadToCRM({
      applicationId: leadId,
      contactName: contactName || undefined,
      companyName: companyName || contactName,
      phone: phone || undefined,
      city: city || undefined,
      licenseNumber: undefined,
      page: sourcePage || '/for-companies',
      description: crmNotes,
    }).catch(() => {});

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
