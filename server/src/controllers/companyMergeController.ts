import pool from '../config/database';

/**
 * POST /api/admin/companies/:companyProfileId/merge
 * Admin merges a registered company_profile with a scraped uae_company
 * Scraped data overrides registered data, accounts merge into one
 */
export async function mergeCompanyWithScraped(req: any, res: any) {
  try {
    const adminId = req.admin?.id;
    const { companyProfileId } = req.params;
    const { uae_company_id } = req.body;

    if (!uae_company_id) {
      return res.status(400).json({ error: 'uae_company_id is required.' });
    }

    // 1. Get the registered company profile
    const [profileRows] = await pool.execute(
      'SELECT * FROM company_profiles WHERE id = ?',
      [companyProfileId]
    );
    if ((profileRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Company profile not found.' });
    }
    const profile = (profileRows as any[])[0];

    // 2. Get the scraped UAE company
    const [uaeRows] = await pool.execute(
      'SELECT * FROM uae_companies WHERE id = ?',
      [uae_company_id]
    );
    if ((uaeRows as any[]).length === 0) {
      return res.status(404).json({ error: 'UAE company not found.' });
    }
    const uaeCompany = (uaeRows as any[])[0];

    // 3. Check not already merged
    if (profile.linked_uae_company_id) {
      return res.status(400).json({ error: 'This company profile is already linked to a UAE company.' });
    }

    // 4. Override registered company data with scraped data
    await pool.execute(
      `UPDATE company_profiles SET
        company_name = COALESCE(?, company_name),
        description = COALESCE(?, description),
        phone = COALESCE(?, phone),
        website = COALESCE(?, website),
        city = COALESCE(?, city),
        address = COALESCE(?, address),
        logo_url = COALESCE(?, logo_url),
        services = COALESCE(?, services),
        linked_uae_company_id = ?,
        merged_at = NOW(),
        merged_by = ?,
        status = 'approved'
      WHERE id = ?`,
      [
        uaeCompany.name_en,
        uaeCompany.description,
        uaeCompany.phone,
        uaeCompany.website,
        uaeCompany.city,
        uaeCompany.address,
        uaeCompany.logo_url,
        uaeCompany.services,
        uae_company_id,
        adminId,
        companyProfileId,
      ]
    );

    // 5. Link the uae_company to the user (mark as claimed)
    await pool.execute(
      'UPDATE uae_companies SET owner_user_id = ?, is_verified = 1 WHERE id = ?',
      [profile.user_id, uae_company_id]
    );

    // 6. Return merged result
    const [mergedRows] = await pool.execute('SELECT * FROM company_profiles WHERE id = ?', [companyProfileId]);

    res.json({
      message: 'Companies merged successfully. Scraped data has been applied.',
      profile: (mergedRows as any[])[0],
    });
  } catch (error) {
    console.error('Merge company error:', error);
    res.status(500).json({ error: 'Failed to merge companies.' });
  }
}

/**
 * GET /api/admin/companies/merge-candidates
 * List registered company_profiles that can be merged with scraped companies
 */
export async function listMergeCandidates(_req: any, res: any) {
  try {
    // Get unmerged company profiles
    const [profiles] = await pool.execute(
      `SELECT cp.*, u.email as user_email, u.full_name as user_name
       FROM company_profiles cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.linked_uae_company_id IS NULL
       ORDER BY cp.created_at DESC`
    );

    // Get unlinked UAE companies
    const [uaeCompanies] = await pool.execute(
      `SELECT id, name_en, slug, city, phone, website, services, google_rating
       FROM uae_companies
       WHERE owner_user_id IS NULL AND is_active = 1
       ORDER BY name_en`
    );

    res.json({
      profiles,
      uae_companies: uaeCompanies,
    });
  } catch (error) {
    console.error('List merge candidates error:', error);
    res.status(500).json({ error: 'Failed to list merge candidates.' });
  }
}

/**
 * POST /api/admin/companies/:companyProfileId/unmerge
 * Admin un-merges a company (undo merge)
 */
export async function unmergeCompany(req: any, res: any) {
  try {
    const { companyProfileId } = req.params;

    const [profileRows] = await pool.execute(
      'SELECT linked_uae_company_id, user_id FROM company_profiles WHERE id = ?',
      [companyProfileId]
    );
    if ((profileRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Company profile not found.' });
    }

    const profile = (profileRows as any[])[0];
    if (!profile.linked_uae_company_id) {
      return res.status(400).json({ error: 'This company is not merged.' });
    }

    // Unlink UAE company
    await pool.execute(
      'UPDATE uae_companies SET owner_user_id = NULL, is_verified = 0 WHERE id = ?',
      [profile.linked_uae_company_id]
    );

    // Clear merge fields
    await pool.execute(
      'UPDATE company_profiles SET linked_uae_company_id = NULL, merged_at = NULL, merged_by = NULL WHERE id = ?',
      [companyProfileId]
    );

    res.json({ message: 'Company unmerged successfully.' });
  } catch (error) {
    console.error('Unmerge company error:', error);
    res.status(500).json({ error: 'Failed to unmerge company.' });
  }
}
