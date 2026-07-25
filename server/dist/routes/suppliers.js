"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const multer_1 = __importDefault(require("multer"));
const supplierAuth_1 = require("../middleware/supplierAuth");
const userAuth = __importStar(require("../controllers/userAuthController"));
const profile = __importStar(require("../controllers/supplierProfileController"));
const products = __importStar(require("../controllers/supplierProductController"));
const catalogs = __importStar(require("../controllers/supplierCatalogController"));
const leads = __importStar(require("../controllers/supplierLeadController"));
const enumAdminController_1 = require("../controllers/enumAdminController");
const materialsMacro = require("../controllers/materialsMacroController");
const projects = __importStar(require("../controllers/supplierProjectController"));
const memoryCache_1 = require("../lib/memoryCache");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const leadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many submissions. Please try again later.',
});
// 翻译端点代理外部调用，按 IP 限流防滥用（每分钟 30 次，足够正常逐字段翻译）
const translateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many translation requests. Please slow down.',
});
// ── Public ──
router.get('/categories', (0, memoryCache_1.cacheMiddleware)(60), enumAdminController_1.getPublicSupplierCategories);
// By Material 大类聚合（跨供应商标签归一）
router.get('/macro-categories', (0, memoryCache_1.cacheMiddleware)(60), materialsMacro.getMacroCategories);
router.get('/macro-categories/:key/products', (0, memoryCache_1.cacheMiddleware)(60), materialsMacro.getMacroProducts);
// 中国新材料改版：跨供应商产品 feed + 产品详情（spec §3.1）。注意：必须先于 /detail/:slug 等通配路由注册。
router.get('/products/public', (0, memoryCache_1.cacheMiddleware)(60), products.listPublicProductsFeed);
router.get('/products/public/:id', products.getPublicProductDetail);
router.get('/', (0, memoryCache_1.cacheMiddleware)(60), profile.listPublicSuppliers);
router.get('/detail/:slug', profile.getPublicProfile);
router.get('/detail/:slug/products', products.listProducts);
router.get('/detail/:slug/catalogs', catalogs.listCatalogs);
router.get('/detail/:slug/projects', projects.listPublicProjects);
router.get('/detail/:slug/projects/:id', projects.getPublicProject);
router.post('/leads', leadLimiter, leads.submitLead);
// ── Authenticated supplier ──
router.get('/me/linked-portals', supplierAuth_1.authenticateSupplier, userAuth.getLinkedPortals);
router.post('/me/cross-portal-token', supplierAuth_1.authenticateSupplier, userAuth.crossPortalToken);
router.get('/me/profile', supplierAuth_1.authenticateSupplier, profile.getMyProfile);
router.post('/me/profile', supplierAuth_1.authenticateSupplier, profile.upsertProfile);
router.post('/me/upload-license', supplierAuth_1.authenticateSupplier, profile.uploadLicense);
router.post('/me/upload-image', supplierAuth_1.authenticateSupplier, upload.single('file'), products.uploadProductImage);
router.get('/me/products', supplierAuth_1.authenticateSupplier, products.listMyProducts);
router.post('/me/products', supplierAuth_1.authenticateSupplier, products.addProduct);
router.post('/me/translate', translateLimiter, supplierAuth_1.authenticateSupplier, products.translateText);
router.put('/me/products/:id', supplierAuth_1.authenticateSupplier, products.updateProduct);
router.delete('/me/products/:id', supplierAuth_1.authenticateSupplier, products.deleteProduct);
router.put('/me/products-reorder', supplierAuth_1.authenticateSupplier, products.reorderProducts);
router.post('/me/upload-catalog-file', supplierAuth_1.authenticateSupplier, upload.single('file'), catalogs.uploadCatalogFile);
router.post('/me/upload-catalog-chunk', supplierAuth_1.authenticateSupplier, upload.single('file'), catalogs.uploadCatalogChunk);
router.get('/me/catalogs', supplierAuth_1.authenticateSupplier, catalogs.listMyCatalogs);
router.post('/me/catalogs', supplierAuth_1.authenticateSupplier, catalogs.uploadCatalog);
router.delete('/me/catalogs/:id', supplierAuth_1.authenticateSupplier, catalogs.deleteCatalog);
router.get('/me/projects', supplierAuth_1.authenticateSupplier, projects.listMyProjects);
router.post('/me/projects', supplierAuth_1.authenticateSupplier, projects.addProject);
router.put('/me/projects/:id', supplierAuth_1.authenticateSupplier, projects.updateProject);
router.delete('/me/projects/:id', supplierAuth_1.authenticateSupplier, projects.deleteProject);
exports.default = router;
