/**
 * companyCrmController.ts
 * Company-facing CRM endpoints (called by the company's own frontend).
 */
import pool from '../config/database';
import { ssoIssue } from '../lib/crmIntegrationService';

/**
 * POST /api/auth/company/crm-sso
 * Issue a CRM SSO token for the logged-in company.
 * Returns consumeUrl which the frontend opens in a new tab.
 */
export async function issueCrmSso(req: any, res: any) {
  try {
    const userId = req.user.userId;

    const [rows] = await pool.execute(
      'SELECT id, crm_tenant_id FROM company_profiles WHERE user_id = ? AND deleted_at IS NULL',
      [userId]
    );
    const cp = (rows as any[])[0];
    if (!cp) return res.status(404).json({ error: 'Company profile not found' });
    if (!cp.crm_tenant_id) return res.status(400).json({ error: 'CRM not provisioned for this company' });

    const { consumeUrl } = await ssoIssue(cp.id);
    res.json({ consumeUrl });
  } catch (err: any) {
    console.error('[CRM] company SSO issue error:', err);
    res.status(502).json({ error: err.message || 'CRM SSO failed' });
  }
}
