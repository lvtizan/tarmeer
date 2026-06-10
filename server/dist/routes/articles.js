"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const adminAuth_1 = require("../middleware/adminAuth");
const articleController_1 = require("../controllers/articleController");
const router = (0, express_1.Router)();
const generateLimiter = (0, express_rate_limit_1.default)({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many generation requests.' });
// Public
router.get('/public', articleController_1.getPublicArticles);
router.get('/public/:slug/related', articleController_1.getRelatedContent);
router.get('/public/:slug', articleController_1.getPublicArticleBySlug);
// Company (authenticated)
router.get('/mine', auth_1.authenticate, articleController_1.getMyArticles);
router.post('/generate', auth_1.authenticate, generateLimiter, articleController_1.generateArticleDraft);
router.post('/', auth_1.authenticate, [(0, express_validator_1.body)('title').notEmpty()], articleController_1.createArticle);
router.put('/:id', auth_1.authenticate, articleController_1.updateArticle);
router.delete('/:id', auth_1.authenticate, articleController_1.deleteArticle);
// Admin
router.get('/admin', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, articleController_1.adminGetArticles);
router.delete('/admin/:id', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, articleController_1.adminDeleteArticle);
exports.default = router;
