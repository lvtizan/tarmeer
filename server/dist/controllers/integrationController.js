"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmSsoIssue = crmSsoIssue;
exports.ssoConsume = ssoConsume;
exports.partnerActivated = partnerActivated;
/**
 * integrationController.ts
 * Handles endpoints called BY CRM (reverse direction: CRM→Mall).
 * All endpoints require X-Crm-Timestamp + X-Crm-Signature HMAC verification.
 */
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../config/database"));
const config_1 = __importDefault(require("../config"));
const crmIntegrationService_1 = require("../lib/crmIntegrationService");
const MALL_ORIGIN = (process.env.MALL_BASE_URL || 'https://mall.tarmeer.com').replace(/\/+$/, '');
function generateCompanyToken(user) {
    return jsonwebtoken_1.default.sign({ userId: user.id, email: user.email, role: user.role }, config_1.default.jwt.secret, { expiresIn: '7d' });
}
function getRawBody(req) {
    // Use rawBody if middleware captured it, otherwise reconstruct from parsed body.
    // Note: reconstructed body may differ from wire bytes if CRM sends non-compact JSON.
    // Verify with CRM team that they send compact JSON (no extra whitespace).
    if (req.rawBody)
        return req.rawBody;
    return JSON.stringify(req.body);
}
/**
 * POST /api/integration/crm/sso/issue
 * CRM calls this to request a Mall SSO token for a partner user.
 * Returns a consumeUrl that CRM redirects the user to.
 */
async function crmSsoIssue(req, res) {
    try {
        const timestamp = req.headers['x-crm-timestamp'] || '';
        const sig = req.headers['x-crm-signature'] || '';
        if (!(0, crmIntegrationService_1.verifyCrmRequest)(timestamp, getRawBody(req), sig)) {
            return res.status(401).json({ error: 'Invalid signature' });
        }
        const { mallPartnerId, adminEmail, redirectUrl } = req.body;
        if (!mallPartnerId)
            return res.status(400).json({ error: 'mallPartnerId required' });
        const partnerId = parseInt(mallPartnerId);
        if (isNaN(partnerId))
            return res.status(400).json({ error: 'Invalid mallPartnerId' });
        const [rows] = await database_1.default.execute('SELECT id FROM company_profiles WHERE id = ? AND deleted_at IS NULL', [partnerId]);
        if (rows.length === 0)
            return res.status(404).json({ error: 'Partner not found' });
        // Generate single-use token, store sha256 hash
        const rawToken = crypto_1.default.randomBytes(32).toString('hex');
        const tokenHash = crypto_1.default.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await database_1.default.execute(`INSERT INTO mall_sso_tokens (token_hash, partner_id, admin_email, redirect_url, expires_at)
       VALUES (?, ?, ?, ?, ?)`, [tokenHash, partnerId, adminEmail || '', redirectUrl || '/company/dashboard', expiresAt]);
        const consumeUrl = `${MALL_ORIGIN}/sso/consume?token=${rawToken}`;
        res.json({ consumeUrl });
    }
    catch (err) {
        console.error('[SSO] crmSsoIssue error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
}
/**
 * GET /api/sso/consume?token=<rawToken>
 * Validates single-use token, returns company JWT + redirect URL.
 * Frontend SsoConsumePage calls this, stores JWT, navigates to redirect.
 */
async function ssoConsume(req, res) {
    try {
        const { token } = req.query;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ error: 'token required' });
        }
        const tokenHash = crypto_1.default.createHash('sha256').update(token).digest('hex');
        const [rows] = await database_1.default.execute(`SELECT t.*, u.id AS user_id, u.email, u.full_name, u.role
       FROM mall_sso_tokens t
       JOIN company_profiles cp ON cp.id = t.partner_id
       JOIN users u ON u.id = cp.user_id
       WHERE t.token_hash = ?`, [tokenHash]);
        const row = rows[0];
        if (!row)
            return res.status(400).json({ error: 'Invalid token' });
        if (row.consumed_at)
            return res.status(400).json({ error: 'Token already used' });
        if (new Date(row.expires_at) < new Date())
            return res.status(400).json({ error: 'Token expired' });
        await database_1.default.execute('UPDATE mall_sso_tokens SET consumed_at = NOW() WHERE token_hash = ?', [tokenHash]);
        const jwtToken = generateCompanyToken({ id: row.user_id, email: row.email, role: 'company' });
        res.json({ token: jwtToken, redirectUrl: row.redirect_url || '/company/dashboard' });
    }
    catch (err) {
        console.error('[SSO] consume error:', err);
        res.status(500).json({ error: 'Internal error' });
    }
}
/**
 * POST /api/integration/crm/partner/activated
 * CRM calls this when a provisioned partner first logs into CRM.
 * Stores firstLoginAt (idempotent: won't overwrite existing value).
 * Always returns { code: 0 } on success so CRM won't re-queue.
 */
async function partnerActivated(req, res) {
    try {
        const timestamp = req.headers['x-crm-timestamp'] || '';
        const sig = req.headers['x-crm-signature'] || '';
        if (!(0, crmIntegrationService_1.verifyCrmRequest)(timestamp, getRawBody(req), sig)) {
            return res.status(401).json({ code: 1, error: 'Invalid signature' });
        }
        const { mallPartnerId, adminEmail, firstLoginAt, source } = req.body;
        if (!mallPartnerId)
            return res.status(400).json({ code: 1, error: 'mallPartnerId required' });
        const partnerId = parseInt(mallPartnerId);
        if (isNaN(partnerId))
            return res.status(400).json({ code: 1, error: 'Invalid mallPartnerId' });
        const [rows] = await database_1.default.execute('SELECT id, crm_tenant_id, crm_first_login_at FROM company_profiles WHERE id = ? AND deleted_at IS NULL', [partnerId]);
        const row = rows[0];
        if (!row)
            return res.status(404).json({ code: 1, error: 'Partner not found' });
        if (!row.crm_tenant_id)
            return res.status(400).json({ code: 1, error: 'Partner not provisioned' });
        // Idempotent write: only set if not already recorded
        if (!row.crm_first_login_at && firstLoginAt) {
            const loginAt = new Date(firstLoginAt);
            if (!isNaN(loginAt.getTime())) {
                await database_1.default.execute('UPDATE company_profiles SET crm_first_login_at = ? WHERE id = ? AND crm_first_login_at IS NULL', [loginAt, partnerId]);
            }
        }
        console.log(`[CRM] partner ${partnerId} activated via ${source || 'unknown'} (${adminEmail})`);
        return res.json({ code: 0 });
    }
    catch (err) {
        console.error('[CRM] partnerActivated error:', err);
        return res.status(500).json({ code: 1, error: 'Internal error' });
    }
}
