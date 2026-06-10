"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * integration.ts
 * Routes for CRM→Mall integration (called by CRM, not by web clients).
 * Mounted at /api/integration in app.ts.
 */
const express_1 = require("express");
const integrationController_1 = require("../controllers/integrationController");
const router = (0, express_1.Router)();
// CRM→Mall: CRM requests a Mall SSO consume token
router.post('/crm/sso/issue', integrationController_1.crmSsoIssue);
// CRM→Mall: CRM notifies Mall that a partner first logged in
router.post('/crm/partner/activated', integrationController_1.partnerActivated);
exports.default = router;
