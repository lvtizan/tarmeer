import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { authenticateSupplier } from '../middleware/supplierAuth';
import * as userAuth from '../controllers/userAuthController';
import * as profile from '../controllers/supplierProfileController';
import * as products from '../controllers/supplierProductController';
import * as catalogs from '../controllers/supplierCatalogController';
import * as leads from '../controllers/supplierLeadController';
import { getPublicSupplierCategories } from '../controllers/enumAdminController';
import * as projects from '../controllers/supplierProjectController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many submissions. Please try again later.',
});

// ── Public ──
router.get('/categories', getPublicSupplierCategories);
router.get('/', profile.listPublicSuppliers);
router.get('/detail/:slug', profile.getPublicProfile);
router.get('/detail/:slug/products', products.listProducts);
router.get('/detail/:slug/catalogs', catalogs.listCatalogs);
router.get('/detail/:slug/projects', projects.listPublicProjects);
router.get('/detail/:slug/projects/:id', projects.getPublicProject);
router.post('/leads', leadLimiter, leads.submitLead);

// ── Authenticated supplier ──
router.get('/me/linked-portals', authenticateSupplier, userAuth.getLinkedPortals);
router.post('/me/cross-portal-token', authenticateSupplier, userAuth.crossPortalToken);
router.get('/me/profile', authenticateSupplier, profile.getMyProfile);
router.post('/me/profile', authenticateSupplier, profile.upsertProfile);
router.post('/me/upload-license', authenticateSupplier, profile.uploadLicense);
router.post('/me/upload-image', authenticateSupplier, upload.single('file'), products.uploadProductImage);
router.get('/me/products', authenticateSupplier, products.listMyProducts);
router.post('/me/products', authenticateSupplier, products.addProduct);
router.put('/me/products/:id', authenticateSupplier, products.updateProduct);
router.delete('/me/products/:id', authenticateSupplier, products.deleteProduct);
router.put('/me/products-reorder', authenticateSupplier, products.reorderProducts);
router.post('/me/upload-catalog-file', authenticateSupplier, upload.single('file'), catalogs.uploadCatalogFile);
router.post('/me/upload-catalog-chunk', authenticateSupplier, upload.single('file'), catalogs.uploadCatalogChunk);
router.get('/me/catalogs', authenticateSupplier, catalogs.listMyCatalogs);
router.post('/me/catalogs', authenticateSupplier, catalogs.uploadCatalog);
router.delete('/me/catalogs/:id', authenticateSupplier, catalogs.deleteCatalog);
router.get('/me/projects', authenticateSupplier, projects.listMyProjects);
router.post('/me/projects', authenticateSupplier, projects.addProject);
router.put('/me/projects/:id', authenticateSupplier, projects.updateProject);
router.delete('/me/projects/:id', authenticateSupplier, projects.deleteProject);

export default router;
