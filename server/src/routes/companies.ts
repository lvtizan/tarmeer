import { Router } from 'express';
import { getCompanies, getPortfolioFeed, getPublicProjectDetail, getCompanyBySlug, getActiveServices, getPortfolioImage, getPortfolioTags } from '../controllers/companyController';

const router = Router();

router.get('/', getCompanies);
router.get('/active-services', getActiveServices);
router.get('/portfolio', getPortfolioFeed);
router.get('/portfolio/tags', getPortfolioTags);
router.get('/portfolio/image/:companySlug/:projectSlug/:imageIndex', getPortfolioImage);
router.get('/:companySlug/projects/:projectSlug', getPublicProjectDetail);
router.get('/:slug', getCompanyBySlug);

export default router;
