/**
 * integration.ts
 * Routes for CRM→Mall integration (called by CRM, not by web clients).
 * Mounted at /api/integration in app.ts.
 */
import { Router } from 'express';
import { crmSsoIssue, partnerActivated } from '../controllers/integrationController';

const router = Router();

// CRM→Mall: CRM requests a Mall SSO consume token
router.post('/crm/sso/issue', crmSsoIssue);

// CRM→Mall: CRM notifies Mall that a partner first logged in
router.post('/crm/partner/activated', partnerActivated);

export default router;
