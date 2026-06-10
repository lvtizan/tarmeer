"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueCrmSso = issueCrmSso;
/**
 * companyCrmController.ts
 * Company-facing CRM endpoints (called by the company's own frontend).
 */
const database_1 = __importDefault(require("../config/database"));
const crmIntegrationService_1 = require("../lib/crmIntegrationService");
/**
 * POST /api/auth/company/crm-sso
 * Issue a CRM SSO token for the logged-in company.
 * Returns consumeUrl which the frontend opens in a new tab.
 */
async function issueCrmSso(req, res) {
    try {
        const userId = req.user.userId;
        const [rows] = await database_1.default.execute('SELECT id, crm_tenant_id FROM company_profiles WHERE user_id = ? AND deleted_at IS NULL', [userId]);
        const cp = rows[0];
        if (!cp)
            return res.status(404).json({ error: 'Company profile not found' });
        if (!cp.crm_tenant_id)
            return res.status(400).json({ error: 'CRM not provisioned for this company' });
        const { consumeUrl } = await (0, crmIntegrationService_1.ssoIssue)(cp.id);
        res.json({ consumeUrl });
    }
    catch (err) {
        console.error('[CRM] company SSO issue error:', err);
        res.status(502).json({ error: err.message || 'CRM SSO failed' });
    }
}
