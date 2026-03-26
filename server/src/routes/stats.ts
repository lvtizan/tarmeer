import { Router } from 'express';
import {
  recordPageView,
  recordClick,
  batchRecord,
  getDesignerPublicStats,
  recordSiteVisit,
  recordAnalyticsEvent
} from '../controllers/statsController';

const router = Router();

// Public routes (no auth required)
router.post('/page-view', recordPageView);
router.post('/click', recordClick);
router.post('/batch', batchRecord);
router.post('/visit', recordSiteVisit);
router.post('/event', recordAnalyticsEvent);
router.get('/designer/:id', getDesignerPublicStats);

export default router;
