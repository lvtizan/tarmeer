import pool from '../config/database';

// List companies with pagination and claimed/unclaimed filter
export async function listCompanies(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { claimed, search } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (claimed === 'claimed') { where += ' AND c.owner_user_id IS NOT NULL'; }
    if (claimed === 'unclaimed') { where += ' AND c.owner_user_id IS NULL'; }
    if (search) {
      where += ' AND (c.name_en LIKE ? OR c.slug LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM uae_companies c ${where}`, params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT c.id, c.name_en, c.slug, c.city, c.logo_url, c.owner_user_id,
        u.full_name as owner_name, u.email as owner_email
       FROM uae_companies c
       LEFT JOIN users u ON c.owner_user_id = u.id
       ${where}
       ORDER BY c.id ASC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    res.json({
      companies: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List companies error:', error);
    res.status(500).json({ error: 'Failed to list companies.' });
  }
}

// List company applications
export async function listCompanyApplications(req: any, res: any) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status } = req.query;

    let where = 'WHERE 1=1';
    const params: any[] = [];

    if (status) { where += ' AND ca.status = ?'; params.push(status); }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM company_applications ca ${where}`, params
    );
    const total = (countRows as any[])[0].total;

    const [rows] = await pool.execute(
      `SELECT ca.*, u.full_name as user_name, u.email as user_email
       FROM company_applications ca
       JOIN users u ON ca.user_id = u.id
       ${where}
       ORDER BY ca.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    res.json({
      applications: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('List company applications error:', error);
    res.status(500).json({ error: 'Failed to list applications.' });
  }
}

// Review (approve/reject) company application
export async function reviewCompanyApplication(req: any, res: any) {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected.' });
    }

    const adminId = req.admin?.id || null;

    await pool.execute(
      'UPDATE company_applications SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [status, admin_notes || null, adminId, id]
    );

    res.json({ message: `Application ${status}.` });
  } catch (error) {
    console.error('Review company application error:', error);
    res.status(500).json({ error: 'Failed to review application.' });
  }
}

// Bind user to company
export async function bindUserToCompany(req: any, res: any) {
  try {
    const { companyId } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required.' });

    // Check user exists
    const [userRows] = await pool.execute('SELECT id, role FROM users WHERE id = ?', [userId]);
    if ((userRows as any[]).length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Check company exists
    const [companyRows] = await pool.execute('SELECT id FROM uae_companies WHERE id = ?', [companyId]);
    if ((companyRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    // Bind
    await pool.execute('UPDATE uae_companies SET owner_user_id = ? WHERE id = ?', [userId, companyId]);
    await pool.execute("UPDATE users SET role = 'company' WHERE id = ?", [userId]);

    // If there's a pending application from this user, link it
    await pool.execute(
      "UPDATE company_applications SET linked_company_id = ?, status = 'approved', reviewed_at = NOW() WHERE user_id = ? AND status = 'pending'",
      [companyId, userId]
    );

    res.json({ message: 'User bound to company successfully.' });
  } catch (error) {
    console.error('Bind user to company error:', error);
    res.status(500).json({ error: 'Failed to bind user.' });
  }
}

// Get single scraped company detail (for edit form)
export async function getScrapedCompany(req: any, res: any) {
  try {
    const [rows] = await pool.execute('SELECT * FROM uae_companies WHERE id = ?', [req.params.companyId]);
    if ((rows as any[]).length === 0) return res.status(404).json({ error: 'Company not found.' });
    res.json({ company: (rows as any[])[0] });
  } catch (error) {
    console.error('Get scraped company error:', error);
    res.status(500).json({ error: 'Failed to get company.' });
  }
}

// Edit scraped company (uae_companies)
export async function editScrapedCompany(req: any, res: any) {
  try {
    const { companyId } = req.params;
    const { name_en, name_ar, phone, email, website, whatsapp, city, area, address, services, specialties, year_established, license_number, instagram, facebook, linkedin, description } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
    if (name_ar !== undefined) { updates.push('name_ar = ?'); values.push(name_ar); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone || null); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email || null); }
    if (website !== undefined) { updates.push('website = ?'); values.push(website || null); }
    if (whatsapp !== undefined) { updates.push('whatsapp = ?'); values.push(whatsapp || null); }
    if (city !== undefined) { updates.push('city = ?'); values.push(city || null); }
    if (area !== undefined) { updates.push('area = ?'); values.push(area || null); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address || null); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description || null); }
    if (services !== undefined) { updates.push('services = ?'); values.push(JSON.stringify(services)); }
    if (specialties !== undefined) { updates.push('specialties = ?'); values.push(JSON.stringify(specialties)); }
    if (year_established !== undefined) { updates.push('year_established = ?'); values.push(year_established || null); }
    if (license_number !== undefined) { updates.push('license_number = ?'); values.push(license_number || null); }
    if (instagram !== undefined) { updates.push('instagram = ?'); values.push(instagram || null); }
    if (facebook !== undefined) { updates.push('facebook = ?'); values.push(facebook || null); }
    if (linkedin !== undefined) { updates.push('linkedin = ?'); values.push(linkedin || null); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    values.push(companyId);
    await pool.execute(`UPDATE uae_companies SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.execute('SELECT * FROM uae_companies WHERE id = ?', [companyId]);
    res.json({ company: (rows as any[])[0] });
  } catch (error) {
    console.error('Edit scraped company error:', error);
    res.status(500).json({ error: 'Failed to edit company.' });
  }
}

// Get single company profile detail (for edit form)
export async function getCompanyProfile(req: any, res: any) {
  try {
    const [rows] = await pool.execute(
      `SELECT cp.*, u.email as user_email, u.full_name as user_name
       FROM company_profiles cp JOIN users u ON cp.user_id = u.id WHERE cp.id = ?`,
      [req.params.id]
    );
    if ((rows as any[]).length === 0) return res.status(404).json({ error: 'Profile not found.' });
    res.json({ profile: (rows as any[])[0] });
  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({ error: 'Failed to get profile.' });
  }
}

// Edit company profile (company_profiles) by admin
export async function editCompanyProfile(req: any, res: any) {
  try {
    const { id } = req.params;
    const { company_name, description, contact_person, phone, website, city, address, services, specialties, company_type, trade_license_number, establishment_year, status } = req.body;

    const updates: string[] = [];
    const values: any[] = [];

    if (company_name !== undefined) { updates.push('company_name = ?'); values.push(company_name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (contact_person !== undefined) { updates.push('contact_person = ?'); values.push(contact_person); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (website !== undefined) { updates.push('website = ?'); values.push(website || null); }
    if (city !== undefined) { updates.push('city = ?'); values.push(city); }
    if (address !== undefined) { updates.push('address = ?'); values.push(address); }
    if (company_type !== undefined) { updates.push('company_type = ?'); values.push(company_type); }
    if (trade_license_number !== undefined) { updates.push('trade_license_number = ?'); values.push(trade_license_number || null); }
    if (establishment_year !== undefined) { updates.push('establishment_year = ?'); values.push(establishment_year || null); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (services !== undefined) { updates.push('services = ?'); values.push(JSON.stringify(services)); }
    if (specialties !== undefined) { updates.push('specialties = ?'); values.push(JSON.stringify(specialties)); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    values.push(id);
    await pool.execute(`UPDATE company_profiles SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await pool.execute('SELECT * FROM company_profiles WHERE id = ?', [id]);
    res.json({ profile: (rows as any[])[0] });
  } catch (error) {
    console.error('Edit company profile error:', error);
    res.status(500).json({ error: 'Failed to edit profile.' });
  }
}

// Unbind company
export async function unbindCompany(req: any, res: any) {
  try {
    const { companyId } = req.params;

    // Get current owner
    const [rows] = await pool.execute('SELECT owner_user_id FROM uae_companies WHERE id = ?', [companyId]);
    const company = (rows as any[])[0];
    if (!company) return res.status(404).json({ error: 'Company not found.' });

    if (company.owner_user_id) {
      // Reset user role to 'user' (unless they have other company bindings)
      const [otherCompanies] = await pool.execute(
        'SELECT id FROM uae_companies WHERE owner_user_id = ? AND id != ?',
        [company.owner_user_id, companyId]
      );
      if ((otherCompanies as any[]).length === 0) {
        await pool.execute("UPDATE users SET role = 'user' WHERE id = ?", [company.owner_user_id]);
      }
    }

    await pool.execute('UPDATE uae_companies SET owner_user_id = NULL WHERE id = ?', [companyId]);

    res.json({ message: 'Company unbound.' });
  } catch (error) {
    console.error('Unbind company error:', error);
    res.status(500).json({ error: 'Failed to unbind.' });
  }
}
