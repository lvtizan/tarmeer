import pool from '../config/database';

function parseChannel(sourcePageUrl?: string | null): string {
  if (!sourcePageUrl) return '官网';
  try {
    const u = new URL(sourcePageUrl, 'https://www.tarmeer.com');
    const src = u.searchParams.get('utm_source')?.toLowerCase();
    if (!src) return '官网';
    const MAP: Record<string, string> = {
      tiktok: 'TikTok', tk: 'TikTok',
      instagram: 'Instagram', ig: 'Instagram',
      google: 'Google', facebook: 'Facebook', fb: 'Facebook',
      whatsapp: 'WhatsApp', wa: 'WhatsApp', linkedin: 'LinkedIn',
    };
    return MAP[src] || src;
  } catch {
    return '官网';
  }
}

export async function globalSearch(req: any, res: any) {
  const q = (req.query.q as string || '').trim();
  if (q.length < 2) return res.json({ homeownerLeads: [], companyLeads: [], users: [], registeredCompanies: [], directoryCompanies: [] });

  const like = `%${q}%`;

  try {
    const [hlRows, clRows, userRows, cpRows, ucRows] = await Promise.all([
      // Homeowner leads
      pool.execute(
        `SELECT di.id, di.name, di.phone, di.city, di.source_company_name, di.crm_sync_status, di.crm_action, di.created_at
         FROM design_inquiries di
         WHERE di.deleted_at IS NULL
           AND (di.message IS NULL OR di.message NOT LIKE '[Company Inquiry]%')
           AND (di.name LIKE ? OR di.phone LIKE ? OR di.source_company_name LIKE ?)
         ORDER BY di.created_at DESC LIMIT 5`,
        [like, like, like]
      ),
      // Company leads — join company_leads for source_page channel
      pool.execute(
        `SELECT di.id, di.name, di.phone, di.city, di.source_company_name, di.crm_sync_status, di.crm_action, di.created_at,
                cl.source_page, cl.company_name as cl_company_name, cl.company_type
         FROM design_inquiries di
         LEFT JOIN company_leads cl ON cl.phone COLLATE utf8mb4_unicode_ci = di.phone COLLATE utf8mb4_unicode_ci
         WHERE di.deleted_at IS NULL
           AND di.message LIKE '[Company Inquiry]%'
           AND (di.name LIKE ? OR di.phone LIKE ? OR di.source_company_name LIKE ?)
         GROUP BY di.id
         ORDER BY di.created_at DESC LIMIT 5`,
        [like, like, like]
      ),
      // Users
      pool.execute(
        `SELECT id, full_name, phone, email, role, active_role, signup_source, status, created_at
         FROM users
         WHERE deleted_at IS NULL
           AND (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)
         ORDER BY created_at DESC LIMIT 5`,
        [like, like, like]
      ),
      // Registered companies
      pool.execute(
        `SELECT cp.id, cp.name, cp.phone, cp.city, cp.status, u.email
         FROM company_profiles cp
         LEFT JOIN users u ON u.id = cp.user_id
         WHERE cp.deleted_at IS NULL
           AND (cp.name LIKE ? OR cp.phone LIKE ? OR u.email LIKE ?)
         ORDER BY cp.created_at DESC LIMIT 5`,
        [like, like, like]
      ),
      // Directory companies
      pool.execute(
        `SELECT id, name, phone, city, 'directory' as source
         FROM uae_companies
         WHERE name LIKE ? OR phone LIKE ?
         ORDER BY name LIMIT 5`,
        [like, like]
      ),
    ]);

    const homeownerLeads = (hlRows as any[][])[0].map((r: any) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      city: r.city,
      source: r.source_company_name || '官网',
      crmStatus: r.crm_action || r.crm_sync_status,
      type: 'homeowner' as const,
      createdAt: r.created_at,
    }));

    const companyLeads = (clRows as any[][])[0].map((r: any) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      city: r.city,
      companyName: r.cl_company_name || r.source_company_name,
      channel: parseChannel(r.source_page),
      companyType: r.company_type,
      crmStatus: r.crm_action || r.crm_sync_status,
      type: 'company' as const,
      createdAt: r.created_at,
    }));

    const users = (userRows as any[][])[0].map((r: any) => ({
      id: r.id,
      name: r.full_name,
      phone: r.phone,
      email: r.email,
      role: r.active_role || r.role,
      status: r.status,
      source: r.signup_source || '官网',
      createdAt: r.created_at,
    }));

    const registeredCompanies = (cpRows as any[][])[0].map((r: any) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      city: r.city,
      status: r.status,
      email: r.email,
      type: 'registered' as const,
    }));

    const directoryCompanies = (ucRows as any[][])[0].map((r: any) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      city: r.city,
      type: 'directory' as const,
    }));

    res.json({ homeownerLeads, companyLeads, users, registeredCompanies, directoryCompanies });
  } catch (err: any) {
    console.error('[GlobalSearch]', err);
    res.status(500).json({ error: 'Search failed' });
  }
}
