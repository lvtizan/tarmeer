import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateSupplier } from '../middleware/supplierAuth';
import * as profile from '../controllers/supplierProfileController';
import * as products from '../controllers/supplierProductController';
import * as catalogs from '../controllers/supplierCatalogController';
import * as leads from '../controllers/supplierLeadController';
import * as projects from '../controllers/supplierProjectController';

const router = Router();

const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many submissions. Please try again later.',
});

// ── Public ──
router.get('/', profile.listPublicSuppliers);
router.get('/detail/:slug', profile.getPublicProfile);
router.get('/detail/:slug/products', products.listProducts);
router.get('/detail/:slug/catalogs', catalogs.listCatalogs);
router.get('/detail/:slug/projects', projects.listPublicProjects);
router.get('/detail/:slug/projects/:id', projects.getPublicProject);
router.post('/leads', leadLimiter, leads.submitLead);

// ── Authenticated supplier ──
router.get('/me/profile', authenticateSupplier, profile.getMyProfile);
router.post('/me/profile', authenticateSupplier, profile.upsertProfile);
router.get('/me/products', authenticateSupplier, products.listMyProducts);
router.post('/me/products', authenticateSupplier, products.addProduct);
router.put('/me/products/:id', authenticateSupplier, products.updateProduct);
router.delete('/me/products/:id', authenticateSupplier, products.deleteProduct);
router.put('/me/products-reorder', authenticateSupplier, products.reorderProducts);
router.get('/me/catalogs', authenticateSupplier, catalogs.listMyCatalogs);
router.post('/me/catalogs', authenticateSupplier, catalogs.uploadCatalog);
router.delete('/me/catalogs/:id', authenticateSupplier, catalogs.deleteCatalog);
router.get('/me/projects', authenticateSupplier, projects.listMyProjects);
router.post('/me/projects', authenticateSupplier, projects.addProject);
router.delete('/me/projects/:id', authenticateSupplier, projects.deleteProject);

export default router;
