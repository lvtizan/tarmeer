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
// 问卷公开填写（无需登录）：国家归属按站点 x-country；interviewer_id 为空
router.post('/interviews', fieldInterviewController_1.createDraft);
router.get('/interviews/draft', fieldInterviewController_1.getMyDraft);
router.patch('/interviews/:id', fieldInterviewController_1.saveDraft);
router.post('/interviews/:id/submit', fieldInterviewController_1.submitInterview);
router.post('/interviews/:id/photos', fieldInterviewController_1.uploadPhotoMiddleware, fieldInterviewController_1.uploadPhoto);
router.post('/interviews/:id/attachments', fieldInterviewController_1.uploadAttachmentMiddleware, fieldInterviewController_1.uploadAttachment);

// Protected routes
// authenticateAdmin sets req.adminId; requireAdmin fetches from DB and sets req.admin
router.use(adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin);
// 公司搜索：任何已登录 admin（含 sub_admin，后台绑定访谈用）均可；仍按人员所属国家过滤，
// 禁止跨国家关联（sub_admin/field_staff 用本人国家，super_admin 可 ?country= 指定）。
// 注：sub_admin 本就能通过 /api/admin/interviews/:id 绑定公司，此处仅补齐"搜索"能力。
router.get('/companies/search', fieldInterviewController_1.searchCompanies);
// 以下为外勤/超管专用（加载完整访谈数据、重提）= admin 编辑专用，保持登录避免数据暴露
router.use(adminAuth_1.requireFieldOrSuperAdmin);
router.get('/interviews/:id/load', fieldInterviewController_1.loadInterview);
router.post('/interviews/:id/re-submit', fieldInterviewController_1.reSubmitInterview);

exports.default = router;
