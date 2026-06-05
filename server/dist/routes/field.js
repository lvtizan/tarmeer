"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../middleware/adminAuth");
const fieldInterviewController_1 = require("../controllers/fieldInterviewController");
const router = (0, express_1.Router)();

// Public routes (no auth needed)
router.get('/survey-schema', fieldInterviewController_1.getSurveySchema);
router.get('/companies/search', fieldInterviewController_1.searchCompanies);

// Protected routes (field staff or super admin)
// authenticateAdmin sets req.adminId; requireAdmin fetches from DB and sets req.admin;
// requireFieldOrSuperAdmin then checks req.admin.role
router.use(adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, adminAuth_1.requireFieldOrSuperAdmin);
router.post('/interviews', fieldInterviewController_1.createDraft);
router.get('/interviews/draft', fieldInterviewController_1.getMyDraft);
router.get('/interviews/:id/load', fieldInterviewController_1.loadInterview);
router.patch('/interviews/:id', fieldInterviewController_1.saveDraft);
router.post('/interviews/:id/submit', fieldInterviewController_1.submitInterview);
router.post('/interviews/:id/re-submit', fieldInterviewController_1.reSubmitInterview);
router.post('/interviews/:id/photos', fieldInterviewController_1.uploadPhotoMiddleware, fieldInterviewController_1.uploadPhoto);

exports.default = router;
