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
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const crypto_1 = __importDefault(require("crypto"));
const sharp_1 = __importDefault(require("sharp"));
const database_1 = __importDefault(require("../config/database"));
const variantWorker_1 = require("../lib/variantWorker");
const antiScraping_1 = require("../middleware/antiScraping");
const analyticsEvents_1 = require("../lib/analyticsEvents");
const adminController_1 = require("../controllers/adminController");
const fieldAdminController_1 = require("../controllers/fieldAdminController");
const designerAdminController_1 = require("../controllers/designerAdminController");
const activityLogController_1 = require("../controllers/activityLogController");
const visitorAdminController_1 = require("../controllers/visitorAdminController");
const userAdminController_1 = require("../controllers/userAdminController");
const inquiryController_1 = require("../controllers/inquiryController");
const complaintController_1 = require("../controllers/complaintController");
const feedbackController_1 = require("../controllers/feedbackController");
const companyAdminController_1 = require("../controllers/companyAdminController");
const analyticsAdminController_1 = require("../controllers/analyticsAdminController");
const supplierAdminController_1 = require("../controllers/supplierAdminController");
const globalSearchController_1 = require("../controllers/globalSearchController");
const companyController_1 = require("../controllers/companyController");
const roleAdmin = __importStar(require("../controllers/roleAdminController"));
const companyMergeController_1 = require("../controllers/companyMergeController");
const enumAdminController_1 = require("../controllers/enumAdminController");
const companyImportService_1 = require("../services/companyImportService");
const multer_1 = __importDefault(require("multer"));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadLargePdf = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
// ============ Public routes (no auth) ============
// Check if system needs installation
router.get('/check-installation', adminController_1.checkInstallation);
// Install: Create first super admin (only if no admins exist)
router.post('/install', adminController_1.install);
// Login (rate limited: 5 attempts per 15 min per IP)
router.post('/login', antiScraping_1.adminLoginRateLimit, adminController_1.login);
router.post('/forgot-password', antiScraping_1.adminLoginRateLimit, adminController_1.forgotPassword);
router.post('/reset-password', antiScraping_1.adminLoginRateLimit, adminController_1.resetPassword);
// ============ SSE: registration events (token via ?token= because EventSource can't set headers) ============
const sseAuthAdapter = (req, _res, next) => {
    if (!req.headers.authorization && typeof req.query.token === 'string') {
        req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
};
router.get('/stats/registration-events', sseAuthAdapter, adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, (0, adminAuth_1.requirePermission)('can_view_stats'), (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // disable nginx proxy buffering
    });
    res.flushHeaders?.();
    res.write(': hi\n\n'); // initial flush
    const heartbeat = setInterval(() => { try {
        res.write(': hb\n\n');
    }
    catch { } }, 25000);
    const onChange = (payload) => {
        try {
            res.write(`event: change\ndata: ${JSON.stringify(payload)}\n\n`);
        }
        catch { }
    };
    analyticsEvents_1.analyticsEvents.on('change', onChange);
    req.on('close', () => {
        clearInterval(heartbeat);
        analyticsEvents_1.analyticsEvents.off('change', onChange);
    });
});
// ============ Excel 导出（浏览器 window.open 无法带 Authorization header，复用 ?token= 适配）============
router.get('/activity-log/export', sseAuthAdapter, adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, activityLogController_1.exportActivityLogs);
router.get('/inquiries/export', sseAuthAdapter, adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, inquiryController_1.exportInquiries);
// ============ Protected routes (require admin auth) ============
// All routes below require authentication
router.use(adminAuth_1.authenticateAdmin);
router.use(adminAuth_1.requireAdmin);
// Profile
router.get('/profile', adminController_1.getProfile);
router.get('/search', globalSearchController_1.globalSearch);
router.put('/password', adminController_1.changePassword);
// Stats (requires can_view_stats permission)
router.get('/stats/overview', (0, adminAuth_1.requirePermission)('can_view_stats'), designerAdminController_1.getStatsOverview);
router.get('/stats/registrations', designerAdminController_1.getRegistrationStats);
router.get('/stats/registration-sources', (0, adminAuth_1.requirePermission)('can_view_stats'), designerAdminController_1.getRegistrationSources);
router.get('/stats/daily', (0, adminAuth_1.requirePermission)('can_view_stats'), designerAdminController_1.getDailyStatsReport);
router.get('/stats/today-new', analyticsAdminController_1.getTodayNew);
router.get('/activity-log/stats', activityLogController_1.getActivityLogStats);
router.get('/activity-log/top-users', activityLogController_1.getTopActiveUsers);
router.get('/activity-log/user/:userId', activityLogController_1.getUserTimeline);
router.get('/activity-log', activityLogController_1.getActivityLogs);
router.get('/visitors/overview', (0, adminAuth_1.requirePermission)('can_view_stats'), visitorAdminController_1.getVisitorOverview);
router.get('/visitors', (0, adminAuth_1.requirePermission)('can_view_stats'), visitorAdminController_1.listVisitors);
router.get('/analytics/overview', (0, adminAuth_1.requirePermission)('can_view_stats'), analyticsAdminController_1.getAnalyticsOverview);
router.get('/analytics/company-visitors', (0, adminAuth_1.requirePermission)('can_view_stats'), analyticsAdminController_1.getCompanyVisitors);
router.get('/analytics/events', (0, adminAuth_1.requirePermission)('can_view_stats'), analyticsAdminController_1.listAnalyticsEvents);
router.get('/analytics/daily-registrations', (0, adminAuth_1.requirePermission)('can_view_stats'), analyticsAdminController_1.getDailyRegistrations);
router.get('/analytics/daily-visits', (0, adminAuth_1.requirePermission)('can_view_stats'), analyticsAdminController_1.getDailyVisits);
// Designer management
router.get('/designers', designerAdminController_1.getDesignersForAdmin);
router.get('/designers/:id', designerAdminController_1.getDesignerDetails);
router.put('/designers/:id/approve', (0, adminAuth_1.requirePermission)('can_approve'), designerAdminController_1.approveDesigner);
router.put('/designers/:id/reject', (0, adminAuth_1.requirePermission)('can_approve'), designerAdminController_1.rejectDesigner);
router.delete('/designers/:id', (0, adminAuth_1.requirePermission)('can_approve'), designerAdminController_1.deleteDesigner);
router.post('/designers/:id/restore', (0, adminAuth_1.requirePermission)('can_approve'), designerAdminController_1.restoreDesigner);
router.put('/designers/bulk-approve', (0, adminAuth_1.requirePermission)('can_approve'), designerAdminController_1.bulkApproveDesigners);
router.put('/designers/bulk-delete', (0, adminAuth_1.requirePermission)('can_approve'), designerAdminController_1.bulkDeleteDesigners);
router.put('/designers/order', (0, adminAuth_1.requirePermission)('can_sort'), designerAdminController_1.updateDesignerOrder);
router.put('/projects/:projectId/approve', (0, adminAuth_1.requirePermission)('can_approve'), designerAdminController_1.approveProject);
router.put('/projects/:projectId/reject', (0, adminAuth_1.requirePermission)('can_approve'), designerAdminController_1.rejectProject);
router.get('/rejection-templates', designerAdminController_1.getRejectionTemplates);
// Inquiry management (admin)
router.get('/inquiries', inquiryController_1.getInquiries);
router.put('/inquiries/:id/status', inquiryController_1.updateInquiryStatus);
router.put('/inquiries/batch-delete', inquiryController_1.batchDeleteInquiries);
router.put('/inquiries/batch-restore', inquiryController_1.batchRestoreInquiries);
router.post('/inquiries/:id/resend-crm', inquiryController_1.resendCrmSync);
// Complaint management (admin)
router.get('/complaints', complaintController_1.getComplaints);
router.put('/complaints/:id/status', complaintController_1.updateComplaintStatus);
// Feedback management (admin)
router.get('/feedback', feedbackController_1.listFeedback);
router.get('/feedback/:id', feedbackController_1.getFeedback);
router.put('/feedback/mark-all-read', feedbackController_1.markAllFeedbackRead);
// Notification counts (admin)
router.get('/notifications/counts', complaintController_1.getNewCounts);
router.put('/notifications/mark-seen', complaintController_1.markNotificationSeen);
// Company management
router.get('/home-order-count', companyAdminController_1.getHomeOrderCount);
router.get('/companies', companyAdminController_1.listCompanies);
router.put('/companies/:companyId/display-order', (0, adminAuth_1.requirePermission)('can_sort'), companyAdminController_1.updateCompanyDisplayOrder);
router.put('/companies/:companyId/home-display-order', (0, adminAuth_1.requirePermission)('can_sort'), companyAdminController_1.updateCompanyHomeDisplayOrder);
router.put('/companies/:companyId/list-display-order', (0, adminAuth_1.requirePermission)('can_sort'), companyAdminController_1.updateCompanyListDisplayOrder);
router.get('/company-applications', companyAdminController_1.listCompanyApplications);
router.put('/company-applications/:id/review', (0, adminAuth_1.requirePermission)('can_approve'), companyAdminController_1.reviewCompanyApplication);
router.post('/companies/:companyId/bind', adminAuth_1.requireSuperAdmin, companyAdminController_1.bindUserToCompany);
router.delete('/companies/:companyId/bind', adminAuth_1.requireSuperAdmin, companyAdminController_1.unbindCompany);
router.get('/companies/:companyId/detail', companyAdminController_1.getScrapedCompany);
router.get('/companies/:companyId/full-detail', companyAdminController_1.getCompanyFullDetail);
router.delete('/companies/:companyId/portfolio-image', adminAuth_1.requireAdmin, companyAdminController_1.deleteDirectoryPortfolioImage);
router.put('/companies/:companyId/edit', companyAdminController_1.editScrapedCompany);
router.get('/companies/:uaeCompanyId/projects/:projectId', companyAdminController_1.getUAECompanyProjectDetail);
router.put('/companies/:uaeCompanyId/projects/:projectId', companyAdminController_1.updateUAECompanyProjectDetail);
router.delete('/companies/:uaeCompanyId/projects/:projectId', companyAdminController_1.deleteUAECompanyProjectDetail);
// User management
router.get('/users', userAdminController_1.listUsers);
router.get('/users/:id', userAdminController_1.getUserDetail);
router.put('/users/:id/status', adminAuth_1.requireSuperAdmin, userAdminController_1.updateUserStatus);
router.put('/users/:id/role', adminAuth_1.requireSuperAdmin, userAdminController_1.updateUserRole);
router.put('/users/:id/edit', adminAuth_1.requireSuperAdmin, userAdminController_1.editUser);
router.put('/users/:id/delete', adminAuth_1.requireSuperAdmin, userAdminController_1.deleteUser);
router.post('/users/:id/restore', adminAuth_1.requireSuperAdmin, userAdminController_1.restoreUser);
router.get('/users/:id/permissions', adminAuth_1.requireSuperAdmin, userAdminController_1.getUserPermissions);
router.put('/users/:id/permissions', adminAuth_1.requireSuperAdmin, userAdminController_1.updateUserPermissions);
router.post('/users/:id/force-verify-email', adminAuth_1.requireSuperAdmin, userAdminController_1.forceVerifyUserEmail);
// ====== Dual-Role Management (V3 User System) ======
// Homeowners (no approval needed)
router.get('/roles/homeowners', roleAdmin.listHomeowners);
router.post('/homeowners/:id/assign', (0, adminAuth_1.requirePermission)('can_approve'), roleAdmin.assignDesigner);
// Companies (with approval)
router.get('/roles/companies', roleAdmin.listCompanies);
router.post('/roles/companies/bulk-unapprove', (0, adminAuth_1.requirePermission)('can_approve'), roleAdmin.bulkUnapproveCompanies);
router.post('/roles/companies/:id/approve', (0, adminAuth_1.requirePermission)('can_approve'), roleAdmin.approveCompany);
router.post('/roles/companies/:id/reject', (0, adminAuth_1.requirePermission)('can_approve'), roleAdmin.rejectCompany);
router.put('/roles/companies/:id/display-order', (0, adminAuth_1.requirePermission)('can_sort'), roleAdmin.updateCompanyDisplayOrder);
router.put('/roles/companies/:id/home-display-order', (0, adminAuth_1.requirePermission)('can_sort'), roleAdmin.updateCompanyHomeDisplayOrder);
router.put('/roles/companies/:id/list-display-order', (0, adminAuth_1.requirePermission)('can_sort'), roleAdmin.updateCompanyListDisplayOrder);
router.put('/roles/companies/:id/delete', (0, adminAuth_1.requirePermission)('can_approve'), roleAdmin.deleteCompanyProfile);
router.post('/roles/companies/:id/restore', (0, adminAuth_1.requirePermission)('can_approve'), roleAdmin.restoreCompanyProfile);
router.get('/roles/companies/:id/detail', companyAdminController_1.getCompanyProfile);
router.get('/roles/companies/:id/full-detail', companyAdminController_1.getCompanyProfileFullDetail);
router.put('/roles/companies/:id/edit', companyAdminController_1.editCompanyProfile);
router.put('/roles/companies/:id/cover-image', companyAdminController_1.setCompanyCoverImage);
router.put('/companies/:companyId/cover-image', companyAdminController_1.setDirectoryCompanyCoverImage);
// Company project CRUD (admin)
router.get('/roles/companies/:companyId/projects/:projectId', companyAdminController_1.getAdminProject);
router.put('/roles/companies/:companyId/projects/:projectId', companyAdminController_1.updateAdminProject);
router.post('/roles/companies/:companyId/projects', companyAdminController_1.createAdminProject);
router.delete('/roles/companies/:companyId/projects/:projectId', companyAdminController_1.deleteAdminProject);
router.put('/roles/companies/:companyId/projects/:projectId/restore', companyAdminController_1.restoreAdminProject);
// Weight system: toggle signed status
router.put('/roles/companies/:id/toggle-signed', companyAdminController_1.toggleCompanyProfileSigned);
router.put('/companies/:companyId/toggle-signed', companyAdminController_1.toggleDirectorySigned);
// Admin unpublish: toggle visibility on public site
router.put('/roles/companies/:id/toggle-published', companyAdminController_1.toggleCompanyProfilePublished);
router.put('/companies/:companyId/toggle-published', companyAdminController_1.toggleDirectoryPublished);
router.put('/roles/companies/:companyId/projects/:projectId/toggle-published', companyAdminController_1.toggleProjectPublished);
router.put('/projects/:projectId/toggle-portfolio-hidden', companyController_1.toggleProjectPortfolioHidden);
router.put('/directory-companies/:companyId/images/toggle-portfolio-hidden', companyController_1.toggleDirectoryImagePortfolioHidden);
router.get('/signed-companies', companyAdminController_1.listSignedCompanies);
// Weight config management
router.get('/weight-config', adminAuth_1.requireSuperAdmin, companyAdminController_1.getWeightConfigList);
router.put('/weight-config/:key', adminAuth_1.requireSuperAdmin, companyAdminController_1.updateWeightConfig);
router.post('/weight-config/recalculate', adminAuth_1.requireSuperAdmin, companyAdminController_1.triggerWeightRecalculation);
// CRM provisioning (admin)
router.post('/profile-companies/:id/crm-provision', companyAdminController_1.adminCrmProvisionCompany);
// Company merge/claim
router.get('/companies/merge-candidates', companyMergeController_1.listMergeCandidates);
router.post('/companies/:companyProfileId/merge', adminAuth_1.requireSuperAdmin, companyMergeController_1.mergeCompanyWithScraped);
router.post('/companies/:companyProfileId/unmerge', adminAuth_1.requireSuperAdmin, companyMergeController_1.unmergeCompany);
// Company import (Word template)
router.get('/companies/import/template', async (_req, res) => {
    try {
        const buffer = await (0, companyImportService_1.generateTemplate)();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', 'attachment; filename=Tarmeer-Company-Template.docx');
        res.send(buffer);
    }
    catch (error) {
        console.error('Generate template error:', error);
        res.status(500).json({ error: 'Failed to generate template.' });
    }
});
router.post('/companies/import/parse', upload.single('file'), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: 'No file uploaded.' });
        const parsed = await (0, companyImportService_1.parseTemplate)(req.file.buffer);
        res.json({ data: parsed });
    }
    catch (error) {
        console.error('Parse template error:', error);
        res.status(500).json({ error: 'Failed to parse document.' });
    }
});
router.post('/companies/import/confirm', async (req, res) => {
    try {
        const { data } = req.body;
        if (!data || !data.company_name)
            return res.status(400).json({ error: 'Company name is required.' });
        const result = await (0, companyImportService_1.importCompany)(data, req.admin?.id || 0);
        res.json({ message: `Company "${result.name}" imported successfully.`, id: result.id });
    }
    catch (error) {
        console.error('Import company error:', error);
        res.status(500).json({ error: error.message || 'Failed to import company.' });
    }
});
// Notification email config
router.get('/notification-emails', async (_req, res) => {
    try {
        const [rows] = await database_1.default.execute('SELECT * FROM notification_emails ORDER BY created_at DESC');
        res.json({ emails: rows });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to load emails.' });
    }
});
router.post('/notification-emails', async (req, res) => {
    try {
        const { email, label } = req.body;
        if (!email)
            return res.status(400).json({ error: 'Email required.' });
        await database_1.default.execute('INSERT INTO notification_emails (email, label) VALUES (?, ?) ON DUPLICATE KEY UPDATE label = VALUES(label), is_active = 1', [email, label || null]);
        res.json({ ok: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to add email.' });
    }
});
router.put('/notification-emails/:id', async (req, res) => {
    try {
        await database_1.default.execute('UPDATE notification_emails SET is_active = ? WHERE id = ?', [req.body.is_active ? 1 : 0, req.params.id]);
        res.json({ ok: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update.' });
    }
});
router.delete('/notification-emails/:id', async (req, res) => {
    try {
        await database_1.default.execute('DELETE FROM notification_emails WHERE id = ?', [req.params.id]);
        res.json({ ok: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete.' });
    }
});
// System config (super admin only)
router.get('/system-config', adminAuth_1.requireSuperAdmin, async (_req, res) => {
    try {
        const [rows] = await database_1.default.execute('SELECT config_key, config_value FROM system_config');
        res.json({ config: rows });
    }
    catch (error) {
        console.error('Get system config error:', error);
        res.status(500).json({ error: 'Failed to load config.' });
    }
});
router.put('/system-config', adminAuth_1.requireSuperAdmin, async (req, res) => {
    try {
        const { configs } = req.body;
        if (!Array.isArray(configs))
            return res.status(400).json({ error: 'configs array required.' });
        for (const { key, value } of configs) {
            await database_1.default.execute('INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?', [key, value, value]);
        }
        res.json({ message: 'Config updated.' });
    }
    catch (error) {
        console.error('Update system config error:', error);
        res.status(500).json({ error: 'Failed to update config.' });
    }
});
// Showcase image optimization — fetch external URL, resize to 800px, convert to WebP
router.post('/showcase-images/optimize', adminAuth_1.requireSuperAdmin, async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string')
        return res.status(400).json({ error: 'url required' });
    // 相对路径（/uploads/...）直接返回原路径，无需压缩——文件在同一台服务器上
    if (url.startsWith('/'))
        return res.json({ optimizedUrl: url });
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok)
            return res.status(422).json({ error: 'Failed to fetch image' });
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/'))
            return res.status(422).json({ error: 'URL is not an image' });
        const buffer = Buffer.from(await response.arrayBuffer());
        const hash = crypto_1.default.createHash('md5').update(url).digest('hex').slice(0, 12);
        const filename = `showcase-${hash}.webp`;
        const uploadDir = path_1.default.join(process.cwd(), 'public', 'uploads', 'showcase');
        const filePath = path_1.default.join(uploadDir, filename);
        await promises_1.default.mkdir(uploadDir, { recursive: true, mode: 0o755 });
        await (0, sharp_1.default)(buffer)
            .resize({ width: 800, withoutEnlargement: true })
            .webp({ quality: 82 })
            .toFile(filePath);
        await promises_1.default.chmod(filePath, 0o644);
        (0, variantWorker_1.enqueueVariants)(filePath);
        res.json({ optimizedUrl: `/uploads/showcase/${filename}` });
    }
    catch (err) {
        console.error('Showcase optimize error:', err);
        res.status(500).json({ error: 'Optimization failed' });
    }
});
// Portfolio images picker — returns flattened image URLs from companies of given country
router.get('/portfolio-images', adminAuth_1.requireAdmin, async (req, res) => {
    const country = typeof req.query.country === 'string' ? req.query.country.trim() : 'ae';
    const VALID = new Set(['ae', 'vn', 'sa']);
    if (!VALID.has(country)) return res.status(400).json({ error: 'Invalid country.' });
    try {
        const images = [];
        if (country === 'vn') {
            // VN: scraped companies in uae_companies with country='vn'
            const [rows] = await database_1.default.execute(
                "SELECT slug, portfolio_images FROM uae_companies WHERE country = 'vn' AND portfolio_images IS NOT NULL AND portfolio_images != '[]' ORDER BY weight_score DESC LIMIT 100"
            );
            for (const row of rows) {
                let imgs = [];
                try { imgs = JSON.parse(row.portfolio_images); } catch { continue; }
                if (!Array.isArray(imgs)) continue;
                for (const url of imgs) {
                    if (typeof url === 'string' && url.trim()) images.push(url.trim());
                }
            }
        } else {
            // AE: registered company projects
            const [rows] = await database_1.default.execute(
                "SELECT p.images FROM projects p JOIN company_profiles cp ON p.company_profile_id = cp.id WHERE (cp.country = ? OR cp.country IS NULL OR cp.country = '') AND p.status = 'published' AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 200",
                [country]
            );
            for (const row of rows) {
                let imgs = [];
                try { imgs = JSON.parse(row.images); } catch { continue; }
                if (!Array.isArray(imgs)) continue;
                for (const url of imgs) {
                    if (typeof url === 'string' && url.trim()) images.push(url.trim());
                }
            }
        }
        res.json({ images: [...new Set(images)].slice(0, 500) });
    } catch (err) {
        console.error('Portfolio images error:', err);
        res.status(500).json({ error: 'Failed to load portfolio images.' });
    }
});
// Supplier management
router.get('/suppliers', supplierAdminController_1.listSuppliers);
router.get('/suppliers/:id', supplierAdminController_1.getSupplierDetail);
router.put('/suppliers/:id/status', (0, adminAuth_1.requirePermission)('can_approve'), supplierAdminController_1.updateSupplierStatus);
router.put('/suppliers/:id', supplierAdminController_1.updateSupplier);
router.delete('/suppliers/:id', (0, adminAuth_1.requirePermission)('can_approve'), supplierAdminController_1.deleteSupplier);
router.post('/suppliers/:id/products', supplierAdminController_1.adminAddProduct);
router.put('/suppliers/:id/products/:productId', supplierAdminController_1.adminUpdateProduct);
router.delete('/suppliers/:id/products/:productId', supplierAdminController_1.adminDeleteProduct);
router.put('/suppliers/catalogs/:id/file', (0, adminAuth_1.requirePermission)('can_approve'), uploadLargePdf.single('file'), supplierAdminController_1.adminReplaceCatalogFile);
router.patch('/suppliers/catalogs/:id/title', supplierAdminController_1.adminRenameCatalog);
router.put('/suppliers/:id/products/:productId/image', upload.single('file'), supplierAdminController_1.adminReplaceProductImage);
router.post('/suppliers/:id/project-image', upload.single('file'), supplierAdminController_1.adminUploadProjectImage);
router.post('/suppliers/:id/projects', supplierAdminController_1.adminAddProject);
router.put('/suppliers/:id/projects/:projectId', supplierAdminController_1.adminUpdateProject);
router.delete('/suppliers/:id/projects/:projectId', supplierAdminController_1.adminDeleteProject);
router.put('/suppliers/:id/home-order', supplierAdminController_1.setSupplierHomeOrder);
router.put('/suppliers/:id/list-order', supplierAdminController_1.setSupplierListOrder);
router.put('/suppliers/:id/toggle-published', supplierAdminController_1.toggleSupplierPublished);
router.put('/suppliers/:id/projects/:projectId/toggle-published', supplierAdminController_1.toggleSupplierProjectPublished);
// Admin management (super admin only)
router.get('/admins', adminAuth_1.requireSuperAdmin, adminController_1.listAdmins);
router.post('/admins', adminAuth_1.requireSuperAdmin, adminController_1.createSubAdmin);
router.put('/admins/:id', adminAuth_1.requireSuperAdmin, adminController_1.updateAdmin);
router.delete('/admins/:id', adminAuth_1.requireSuperAdmin, adminController_1.deleteAdmin);
// Field interviews (all admins)
router.get('/interviews', fieldAdminController_1.listInterviews);
router.get('/interviews/:id', fieldAdminController_1.getInterview);
router.patch('/interviews/:id', fieldAdminController_1.editInterview);
router.delete('/interviews', fieldAdminController_1.deleteInterviews);
// Field staff management (super_admin or can_manage_field_staff)
router.get('/staff', (0, adminAuth_1.requirePermission)('can_manage_field_staff'), fieldAdminController_1.listStaff);
router.post('/staff', (0, adminAuth_1.requirePermission)('can_manage_field_staff'), fieldAdminController_1.createStaff);
router.patch('/staff/:id', (0, adminAuth_1.requirePermission)('can_manage_field_staff'), fieldAdminController_1.toggleStaff);
router.patch('/staff/:id/permissions', (0, adminAuth_1.requirePermission)('can_manage_field_staff'), fieldAdminController_1.updateStaffPermissions);
// Enum management — company types & services
router.get('/enums/company-types', enumAdminController_1.listCompanyTypes);
router.post('/enums/company-types', adminAuth_1.requireAdmin, enumAdminController_1.createCompanyType);
router.put('/enums/company-types/:slug', adminAuth_1.requireAdmin, enumAdminController_1.updateCompanyType);
router.delete('/enums/company-types/:slug', adminAuth_1.requireAdmin, enumAdminController_1.deleteCompanyType);
router.get('/enums/company-services', enumAdminController_1.listCompanyServices);
router.post('/enums/company-services', adminAuth_1.requireAdmin, enumAdminController_1.createCompanyService);
router.put('/enums/company-services/reorder', adminAuth_1.requireAdmin, enumAdminController_1.reorderCompanyServices);
router.put('/enums/company-services/rename-category', adminAuth_1.requireAdmin, enumAdminController_1.renameServiceCategory);
router.put('/enums/company-services/:name', adminAuth_1.requireAdmin, enumAdminController_1.updateCompanyService);
router.delete('/enums/company-services/:name', adminAuth_1.requireAdmin, enumAdminController_1.deleteCompanyService);
// Enum management — service categories (parent level)
router.get('/enums/service-categories', enumAdminController_1.listServiceCategories);
router.post('/enums/service-categories', adminAuth_1.requireAdmin, enumAdminController_1.createServiceCategory);
router.put('/enums/service-categories/reorder', adminAuth_1.requireAdmin, enumAdminController_1.reorderServiceCategories);
router.put('/enums/service-categories/:name/toggle', adminAuth_1.requireAdmin, enumAdminController_1.toggleServiceCategory);
router.put('/enums/service-categories/:name/rename', adminAuth_1.requireAdmin, enumAdminController_1.renameServiceCategory2);
router.delete('/enums/service-categories/:name', adminAuth_1.requireAdmin, enumAdminController_1.deleteServiceCategory);
// Enum management — supplier categories
router.get('/enums/supplier-categories', enumAdminController_1.listSupplierCategories);
router.post('/enums/supplier-categories', adminAuth_1.requireAdmin, enumAdminController_1.createSupplierCategory);
router.put('/enums/supplier-categories/reorder', adminAuth_1.requireAdmin, enumAdminController_1.reorderSupplierCategories);
router.put('/enums/supplier-categories/:value/toggle', adminAuth_1.requireAdmin, enumAdminController_1.toggleSupplierCategory);
router.put('/enums/supplier-categories/:value', adminAuth_1.requireAdmin, enumAdminController_1.updateSupplierCategory);
router.delete('/enums/supplier-categories/:value', adminAuth_1.requireAdmin, enumAdminController_1.deleteSupplierCategory);
// Supplier category groups
router.get('/enums/supplier-category-groups', enumAdminController_1.listSupplierCategoryGroups);
router.post('/enums/supplier-category-groups', adminAuth_1.requireAdmin, enumAdminController_1.createSupplierCategoryGroup);
router.put('/enums/supplier-category-groups/reorder', adminAuth_1.requireAdmin, enumAdminController_1.reorderSupplierCategoryGroups);
router.put('/enums/supplier-category-groups/:value/toggle', adminAuth_1.requireAdmin, enumAdminController_1.toggleSupplierCategoryGroup);
router.put('/enums/supplier-category-groups/:value', adminAuth_1.requireAdmin, enumAdminController_1.updateSupplierCategoryGroup);
router.delete('/enums/supplier-category-groups/:value', adminAuth_1.requireAdmin, enumAdminController_1.deleteSupplierCategoryGroup);
// Survey schema management
const DEFAULT_SURVEY_SCHEMA = JSON.stringify([{"title":"Section 1: Company Basic Information","key":"section_1","fields":[{"key":"company_type","label":"Company Type","type":"single","options":["Local","Joint Venture","Foreign"]},{"key":"year_established","label":"Year Established","type":"single","options":["Before 2000","2000-2010","2010-2015","2015-2020","2020+"]},{"key":"registration_location","label":"Registration Location","type":"single","options":["Dubai","Abu Dhabi","Sharjah","Other UAE","Outside UAE"]},{"key":"company_size","label":"Company Size","type":"single","options":["1-10","10-30","30-100","100+"]},{"key":"licenses","label":"Licenses / Certifications","type":"multi","options":["Dubai Municipality","DEWA Approved","ISO Certified","RERA","Other"]}]},{"title":"Section 2: Core Business","key":"section_2","fields":[{"key":"main_business_scope","label":"Main Business Scope","type":"multi","options":["Interior Design","Fit-out","FF&E","MEP","Joinery","Landscaping"]},{"key":"one_stop_service","label":"One-Stop Service (Design + Build + Materials + Furniture)?","type":"single","options":["Yes","No","Partial"]},{"key":"main_client_types","label":"Main Client Types","type":"multi","options":["Residential","Commercial","Hospitality","Retail","Government","F&B"]}]},{"title":"Section 3: Team Structure","key":"section_3","fields":[{"key":"total_employees","label":"Total Employees","type":"single","options":["1-10","11-30","31-100","100+"]},{"key":"design_team_size","label":"Design Team Size","type":"single","options":["0","1-3","4-10","10+"]},{"key":"pm_team_size","label":"Project Management Team Size","type":"single","options":["0","1-3","4-10","10+"]},{"key":"construction_team","label":"Construction Team","type":"single","options":["In-house","Outsourced","Hybrid"]},{"key":"management_background","label":"Management Background","type":"multi","options":["UAE Local","Arab","South Asian","Chinese","European","Mixed"]},{"key":"owner_nationality","label":"Owner / Shareholder Nationality","type":"multi","options":["Emirati","Arab","Indian","Pakistani","Chinese","European","Other"]}]},{"title":"Section 4: Projects & Performance","key":"section_4","fields":[{"key":"projects_last_year","label":"Projects Completed Last Year","type":"single","options":["1-5","6-20","21-50","50+"]},{"key":"annual_revenue_aed","label":"Annual Revenue (AED)","type":"single","options":["< 1M","1-5M","5-20M","20-50M","50M+"]},{"key":"typical_contract_value","label":"Typical Contract Value Range","type":"single","options":["< 100K","100K-500K","500K-2M","2M+"]},{"key":"main_project_types","label":"Main Project Types","type":"multi","options":["Villa","Apartment","Office","Retail","Hotel","Restaurant","Government"]}]},{"title":"Section 5: Supply Chain","key":"section_5","fields":[{"key":"main_material_sources","label":"Main Material Sources","type":"multi","options":["China","Italy","Germany","Local UAE","India","Turkey","Mixed"]},{"key":"stable_supply_chain","label":"Stable Supply Chain?","type":"single","options":["Yes","No","Partially"]},{"key":"open_to_chinese_supply","label":"Open to Chinese Material Supply?","type":"single","options":["Very Interested","Open","Neutral","Not Interested"]}]},{"title":"Section 6: Strengths & Challenges","key":"section_6","fields":[{"key":"key_strengths","label":"Key Strengths","type":"multi","options":["Design Capability","Speed","Price","Quality","Relationships","After-sales"]},{"key":"main_challenges","label":"Main Challenges","type":"multi","options":["Material Cost","Labour","Cash Flow","Competition","Finding Clients","Logistics"]}]},{"title":"Section 7: Cooperation Intent","key":"section_7","fields":[{"key":"interest_in_chinese_platform","label":"Interest in Cooperating with Chinese Supply Platform","type":"single","options":["Very Interested","Interested","Maybe","Not Interested"]},{"key":"support_needed","label":"Support Needed","type":"multi","options":["Sourcing","Logistics","Quality Control","Payment Terms","Showroom","Training"]},{"key":"preferred_cooperation_model","label":"Preferred Cooperation Model","type":"single","options":["Platform Membership","Per-project","Revenue Share","Exclusive Supply"]}]},{"title":"Section 8: Additional Information","key":"section_8","fields":[{"key":"stable_developer_clients","label":"Stable Developer / Client Resources?","type":"single","options":["Yes","No","Some"]},{"key":"avg_project_duration","label":"Average Project Duration","type":"single","options":["< 1 month","1-3 months","3-6 months","6+ months"]},{"key":"client_acquisition_channels","label":"Client Acquisition Channels","type":"multi","options":["Referral","Social Media","Tenders","Direct Sales","Repeat Clients","Platforms"]},{"key":"design_software","label":"Design Software Used","type":"multi","options":["AutoCAD","3ds Max","SketchUp","Revit","Lumion","Other"]},{"key":"standardized_quotation","label":"Standardized Quotation System?","type":"single","options":["Yes","No","In Progress"]}]},{"title":"Section 9: Strategic Questions","key":"section_9","fields":[{"key":"open_to_material_construction_split","label":"Open to Material + Construction Separation Model?","type":"single","options":["Yes","No","Need to Discuss"]},{"key":"willing_to_share_client_resources","label":"Willing to Share Client Resources for Joint Projects?","type":"single","options":["Yes","No","Case by Case"]},{"key":"concerns_about_chinese_supply","label":"Main Concerns About Chinese Supply Chain","type":"multi","options":["Quality","Delivery Time","Communication","MOQ","After-sales","None"]},{"key":"interested_in_showroom_collab","label":"Interested in Showroom / Sample Collaboration?","type":"single","options":["Very Interested","Interested","Maybe","Not Interested"]}]}]);
async function ensureSurveySchemaTable() {
    await database_1.default.execute(`CREATE TABLE IF NOT EXISTS survey_schema (id INT NOT NULL DEFAULT 1, schema_json MEDIUMTEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (id))`);
}
router.get('/survey-schema', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, async (req, res) => {
    try {
        await ensureSurveySchemaTable();
        const [rows] = await database_1.default.execute('SELECT schema_json FROM survey_schema WHERE id = 1');
        if (rows.length === 0) {
            await database_1.default.execute('INSERT INTO survey_schema (id, schema_json) VALUES (1, ?)', [DEFAULT_SURVEY_SCHEMA]);
            return res.json({ schema: JSON.parse(DEFAULT_SURVEY_SCHEMA) });
        }
        res.json({ schema: JSON.parse(rows[0].schema_json) });
    } catch (e) {
        console.error('getSurveySchema error:', e);
        res.status(500).json({ error: 'Failed to load schema' });
    }
});
router.put('/survey-schema', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, async (req, res) => {
    const { schema } = req.body;
    if (!Array.isArray(schema)) return res.status(400).json({ error: 'schema must be an array' });
    try {
        await ensureSurveySchemaTable();
        await database_1.default.execute('INSERT INTO survey_schema (id, schema_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE schema_json = VALUES(schema_json)', [JSON.stringify(schema)]);
        res.json({ ok: true });
    } catch (e) {
        console.error('putSurveySchema error:', e);
        res.status(500).json({ error: 'Failed to save schema' });
    }
});
// Survey Q&A questions management
const surveyQuestionsController_1 = require("../controllers/surveyQuestionsController");
router.get('/survey-questions', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, surveyQuestionsController_1.listQuestions);
router.post('/survey-questions', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, surveyQuestionsController_1.createQuestion);
router.patch('/survey-questions/:id', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, surveyQuestionsController_1.updateQuestion);
router.delete('/survey-questions/:id', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, surveyQuestionsController_1.deleteQuestion);
router.post('/survey-questions/reorder', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, surveyQuestionsController_1.reorderQuestions);
exports.default = router;
