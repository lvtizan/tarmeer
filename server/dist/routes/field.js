"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../middleware/adminAuth");
const fieldInterviewController_1 = require("../controllers/fieldInterviewController");
const router = (0, express_1.Router)();
// All field routes are public — no login required
router.get('/survey-schema', fieldInterviewController_1.getSurveySchema);
router.get('/companies/search', fieldInterviewController_1.searchCompanies);
router.post('/interviews', fieldInterviewController_1.createDraft);
router.get('/interviews/draft', fieldInterviewController_1.getMyDraft);
router.patch('/interviews/:id', fieldInterviewController_1.saveDraft);
router.post('/interviews/:id/submit', fieldInterviewController_1.submitInterview);
router.post('/interviews/:id/photos', fieldInterviewController_1.uploadPhotoMiddleware, fieldInterviewController_1.uploadPhoto);
exports.default = router;
