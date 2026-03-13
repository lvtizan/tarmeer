import { Router } from 'express';
import { getDesigners, getDesignerById, updateDesigner } from '../controllers/designerController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', getDesigners);
router.get('/:id', getDesignerById);
router.put('/:id', authenticate, updateDesigner);

export default router;
