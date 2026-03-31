import { Router } from 'express';
import { getDesigners, getDesignerById, updateDesigner } from '../controllers/designerController';
import { applyAsDesigner, getMyDesignerStatus } from '../controllers/designerApplicationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Designer application routes (must be before /:id to avoid conflict)
router.post('/apply', authenticate, applyAsDesigner);
router.get('/my-status', authenticate, getMyDesignerStatus);

router.get('/', getDesigners);
router.get('/:id', getDesignerById);
router.put('/:id', authenticate, updateDesigner);

export default router;
