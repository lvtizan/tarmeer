import { Router } from 'express';
import { getCompanies, getPortfolioFeed, getCompanyBySlug } from '../controllers/companyController';

const router = Router();

router.get('/', getCompanies);
router.get('/portfolio', getPortfolioFeed);
router.get('/:slug', getCompanyBySlug);

export default router;
