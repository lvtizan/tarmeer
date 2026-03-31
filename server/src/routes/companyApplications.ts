import { Router } from 'express';
import { applyAsCompany, getMyCompanyStatus } from '../controllers/companyApplicationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, applyAsCompany);
router.get('/mine', authenticate, getMyCompanyStatus);

export default router;
