import { Router } from 'express';
import * as publicCompany from '../controllers/publicCompanyController';

const router = Router();

// Get service categories (BEFORE /:id to avoid route conflict)
router.get('/categories', publicCompany.getServiceCategories);

// List all approved companies with filtering
router.get('/', publicCompany.listApprovedCompanies);

// Get company detail by ID
router.get('/:id', publicCompany.getCompanyDetail);

export default router;
