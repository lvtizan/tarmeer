import { Router } from 'express';
import { authenticateAdmin, requireAdmin, requireFieldOrSuperAdmin } from '../middleware/adminAuth';
import {
  createDraft, getMyDraft, saveDraft, submitInterview, searchCompanies,
} from '../controllers/fieldInterviewController';

const router = Router();

// All field routes require admin auth
router.use(authenticateAdmin, requireAdmin, requireFieldOrSuperAdmin);

router.post('/interviews', createDraft);
router.get('/interviews/draft', getMyDraft);
router.patch('/interviews/:id', saveDraft);
router.post('/interviews/:id/submit', submitInterview);
router.get('/companies/search', searchCompanies);

export default router;
