"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminAuth_1 = require("../middleware/adminAuth");
const fieldInterviewController_1 = require("../controllers/fieldInterviewController");
const surveyQuestionsController_1 = require("../controllers/surveyQuestionsController");
const surveySchemaEditorController_1 = require("../controllers/surveySchemaEditorController");
const router = (0, express_1.Router)();

// Honour an authenticated operator's fixed country even on public form endpoints.
router.use((req,res,next)=> {
    if(!req.headers.authorization) return next();
    adminAuth_1.authenticateAdmin(req,res,()=>adminAuth_1.requireAdmin(req,res,next));
});
// Public routes (no auth needed)
router.get('/survey-schema', fieldInterviewController_1.getSurveySchema);
// The context endpoint is intentionally readable without authentication so the
// public form can decide whether to render edit controls. It never returns a
// schema unless the already-authenticated request has schema-edit permission.
router.get('/survey-schema/editor', surveySchemaEditorController_1.getSurveySchemaEditor);
router.get('/survey-questions', surveyQuestionsController_1.listQuestions);
// 问卷公开填写（无需登录）：国家归属按站点 x-country；interviewer_id 为空
router.post('/interviews', fieldInterviewController_1.createDraft);
router.get('/interviews/draft', fieldInterviewController_1.getMyDraft);
router.get('/interviews/:id/application', fieldInterviewController_1.getContractorApplication);
router.patch('/interviews/:id', fieldInterviewController_1.saveDraft);
router.patch('/interviews/:id/profile', fieldInterviewController_1.saveContractorProfile);
router.post('/interviews/:id/submit', fieldInterviewController_1.submitInterview);
router.post('/interviews/:id/profile-submit', fieldInterviewController_1.submitContractorProfile);
router.post('/interviews/:id/photos', fieldInterviewController_1.guardDraftUpload, fieldInterviewController_1.uploadPhotoMiddleware, fieldInterviewController_1.uploadPhoto);
router.post('/interviews/:id/attachments', fieldInterviewController_1.guardDraftUpload, (req,res,next)=>{try{const schema=typeof req.interview?.schema_snapshot==='string'?JSON.parse(req.interview.schema_snapshot):req.interview?.schema_snapshot;if(schema?.workflow==='contractor-two-stage')return res.status(400).json({error:'Contractor application evidence must use private upload handling.'});next();}catch{return res.status(400).json({error:'Invalid survey schema.'});}}, fieldInterviewController_1.uploadAttachmentMiddleware, fieldInterviewController_1.uploadAttachment);
router.post('/interviews/:id/contractor-attachments', fieldInterviewController_1.guardDraftUpload, (req,res,next)=>{req.privateContractorAttachment=true;fieldInterviewController_1.uploadContractorAttachmentMiddleware(req,res,next);}, fieldInterviewController_1.uploadAttachment);
router.get('/interviews/:id/attachments/:filename', fieldInterviewController_1.downloadContractorAttachment);

// Protected routes
// authenticateAdmin sets req.adminId; requireAdmin fetches from DB and sets req.admin
router.use(adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin);
// 公司搜索：任何已登录 admin（含 sub_admin，后台绑定访谈用）均可；仍按人员所属国家过滤，
// 禁止跨国家关联（sub_admin/field_staff 用本人国家，super_admin 可 ?country= 指定）。
// 注：sub_admin 本就能通过 /api/admin/interviews/:id 绑定公司，此处仅补齐"搜索"能力。
router.get('/companies/search', fieldInterviewController_1.searchCompanies);
// Keep this before requireFieldOrSuperAdmin: permitted sub_admins may edit the
// V7 schema. Field staff also require an explicit DB capability; ordinary
// field staff remain unable to edit the schema.
router.patch('/survey-schema/editor', surveySchemaEditorController_1.updateSurveySchemaEditor);
// 以下为外勤/超管专用（加载完整访谈数据、重提）= admin 编辑专用，保持登录避免数据暴露
router.use(adminAuth_1.requireFieldOrSuperAdmin);
router.get('/interviews/:id/load', fieldInterviewController_1.loadInterview);
router.post('/interviews/:id/re-submit', fieldInterviewController_1.reSubmitInterview);

exports.default = router;
