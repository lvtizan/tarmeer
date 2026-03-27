import { Router } from 'express';
import { getCompanies, getCompanyBySlug } from '../controllers/companyController';

const router = Router();

router.get('/', getCompanies);
router.get('/:slug', getCompanyBySlug);

export default router;
