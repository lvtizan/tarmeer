import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { authenticateAdmin, requireAdmin } from '../middleware/adminAuth';
import {
  generateArticleDraft,
  createArticle,
  updateArticle,
  deleteArticle,
  getMyArticles,
  getPublicArticles,
  getPublicArticleBySlug,
  adminGetArticles,
  adminDeleteArticle,
} from '../controllers/articleController';

const router = Router();

const generateLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many generation requests.' });

// Public
router.get('/public', getPublicArticles);
router.get('/public/:slug', getPublicArticleBySlug);

// Company (authenticated)
router.get('/mine', authenticate, getMyArticles);
router.post('/generate', authenticate, generateLimiter, generateArticleDraft);
router.post('/', authenticate, [body('title').notEmpty()], createArticle);
router.put('/:id', authenticate, updateArticle);
router.delete('/:id', authenticate, deleteArticle);

// Admin
router.get('/admin', authenticateAdmin, requireAdmin, adminGetArticles);
router.delete('/admin/:id', authenticateAdmin, requireAdmin, adminDeleteArticle);

export default router;
