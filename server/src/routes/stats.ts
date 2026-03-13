import { Router } from 'express';
import {
  recordPageView,
  recordClick,
  batchRecord,
  getDesignerPublicStats
} from '../controllers/statsController';

const router = Router();

// Public routes (no auth required)
router.post('/page-view', recordPageView);
router.post('/click', recordClick);
router.post('/batch', batchRecord);
router.get('/designer/:id', getDesignerPublicStats);

export default router;
