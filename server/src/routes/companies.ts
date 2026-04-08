import { Router } from 'express';
import { getCompanies, getPortfolioFeed, getPublicProjectDetail, getCompanyBySlug } from '../controllers/companyController';

const router = Router();

router.get('/', getCompanies);
router.get('/portfolio', getPortfolioFeed);
router.get('/:companySlug/projects/:projectSlug', getPublicProjectDetail);
router.get('/:slug', getCompanyBySlug);

export default router;
