"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../middleware/adminAuth");
const fieldInterviewController_1 = require("../controllers/fieldInterviewController");
const surveyQuestionsController_1 = require("../controllers/surveyQuestionsController");
const router = (0, express_1.Router)();

// Public routes (no auth needed)
router.get('/survey-schema', fieldInterviewController_1.getSurveySchema);
router.get('/survey-questions', surveyQuestionsController_1.listQuestions);

// Protected routes (field staff or super admin)
// authenticateAdmin sets req.adminId; requireAdmin fetches from DB and sets req.admin;
// requireFieldOrSuperAdmin then checks req.admin.role
router.use(adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, adminAuth_1.requireFieldOrSuperAdmin);
// 公司搜索必须登录：按人员所属国家过滤，禁止跨国家关联（国家数据隔离规则）
router.get('/companies/search', fieldInterviewController_1.searchCompanies);
router.post('/interviews', fieldInterviewController_1.createDraft);
router.get('/interviews/draft', fieldInterviewController_1.getMyDraft);
router.get('/interviews/:id/load', fieldInterviewController_1.loadInterview);
router.patch('/interviews/:id', fieldInterviewController_1.saveDraft);
router.post('/interviews/:id/submit', fieldInterviewController_1.submitInterview);
router.post('/interviews/:id/re-submit', fieldInterviewController_1.reSubmitInterview);
router.post('/interviews/:id/photos', fieldInterviewController_1.uploadPhotoMiddleware, fieldInterviewController_1.uploadPhoto);

exports.default = router;
