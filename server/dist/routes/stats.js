"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const statsController_1 = require("../controllers/statsController");
const router = (0, express_1.Router)();
// Public routes (no auth required)
router.post('/page-view', statsController_1.recordPageView);
router.post('/click', statsController_1.recordClick);
router.post('/batch', statsController_1.batchRecord);
router.post('/visit', statsController_1.recordSiteVisit);
router.post('/event', statsController_1.recordAnalyticsEvent);
router.get('/designer/:id', statsController_1.getDesignerPublicStats);
exports.default = router;
