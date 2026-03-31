import pool from '../config/database';
import { sanitizePublicCompany } from '../lib/publicCompaniesSerialization';
import {
  buildPublicCompaniesListQuery,
  buildPublicCompanyDetailQuery,
} from '../lib/publicCompaniesQuery';

const PUBLIC_COMPANY_WHERE = `WHERE is_active = 1`;

export async function getCompanies(req: any, res: any) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 26, 100);
    const offset = (page - 1) * limit;

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM uae_companies ${PUBLIC_COMPANY_WHERE}`
    );
    const total = (countResult as any[])[0]?.total || 0;

    const listQuery = buildPublicCompaniesListQuery({ limit, offset });
    const [companies] = await pool.execute(listQuery.sql, listQuery.params);

    res.json({
      companies: (companies as any[]).map(sanitizePublicCompany),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to load companies.' });
  }
}

export async function getCompanyBySlug(req: any, res: any) {
  try {
    const { slug } = req.params;
    const query = buildPublicCompanyDetailQuery(slug);
    const [rows] = await pool.execute(query.sql, query.params);
    const company = (rows as any[])[0];

    if (!company) {
      return res.status(404).json({ error: 'Company not found.' });
    }

    res.json({
      company: sanitizePublicCompany(company),
    });
  } catch (error) {
    console.error('Get company detail error:', error);
    res.status(500).json({ error: 'Failed to load company.' });
  }
}
