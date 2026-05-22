import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import sharp from 'sharp';
import pool from '../config/database';
import { enqueueVariants } from '../lib/variantWorker';
import { adminLoginRateLimit } from '../middleware/antiScraping';
import { analyticsEvents } from '../lib/analyticsEvents';
import {
  checkInstallation,
  install,
  login,
  forgotPassword,
  resetPassword,
  getProfile,
  createSubAdmin,
  listAdmins,
  updateAdmin,
  deleteAdmin,
  changePassword,
} from '../controllers/adminController';
import {
  listInterviews, getInterview, editInterview,
  listStaff, createStaff, toggleStaff,
} from '../controllers/fieldAdminController';
import {
  getDesignersForAdmin,
  getDesignerDetails,
  approveDesigner,
  rejectDesigner,
  deleteDesigner,
  restoreDesigner,
  bulkApproveDesigners,
  bulkDeleteDesigners,
  updateDesignerOrder,
  approveProject,
  rejectProject,
  getRejectionTemplates,
  getStatsOverview,
  getRegistrationStats,
  getRegistrationSources,
  getDailyStatsReport,
} from '../controllers/designerAdminController';
import { getActivityLogs, getActivityLogStats, exportActivityLogs, getTopActiveUsers, getUserTimeline } from '../controllers/activityLogController';
import { getVisitorOverview, listVisitors } from '../controllers/visitorAdminController';
import { listUsers, getUserDetail, updateUserStatus, updateUserRole, editUser, deleteUser, restoreUser, getUserPermissions, updateUserPermissions, forceVerifyUserEmail } from '../controllers/userAdminController';
import { getInquiries, updateInquiryStatus, exportInquiries, batchDeleteInquiries, batchRestoreInquiries, resendCrmSync } from '../controllers/inquiryController';
import { getComplaints, updateComplaintStatus, getNewCounts, markNotificationSeen } from '../controllers/complaintController';
import { listFeedback, getFeedback, markAllFeedbackRead } from '../controllers/feedbackController';
import {
  listCompanies,
  listCompanyApplications,
  reviewCompanyApplication,
  bindUserToCompany,
  unbindCompany,
  getScrapedCompany,
  editScrapedCompany,
  getCompanyProfile,
  editCompanyProfile,
  setCompanyCoverImage,
  setDirectoryCompanyCoverImage,
  getCompanyFullDetail,
  deleteDirectoryPortfolioImage,
  getCompanyProfileFullDetail,
  updateCompanyDisplayOrder,
  updateCompanyHomeDisplayOrder,
  updateCompanyListDisplayOrder,
  getHomeOrderCount,
  getAdminProject,
  updateAdminProject,
  createAdminProject,
  deleteAdminProject,
  restoreAdminProject,
  toggleCompanyProfileSigned,
  toggleDirectorySigned,
  toggleCompanyProfilePublished,
  toggleDirectoryPublished,
  toggleProjectPublished,
  listSignedCompanies,
  getWeightConfigList,
  updateWeightConfig,
  triggerWeightRecalculation,
  adminCrmProvisionCompany,
} from '../controllers/companyAdminController';
import { getAnalyticsOverview, getCompanyVisitors, listAnalyticsEvents, getDailyRegistrations, getDailyVisits, getTodayNew } from '../controllers/analyticsAdminController';
import { listSuppliers, getSupplierDetail, updateSupplierStatus, updateSupplier, deleteSupplier, adminAddProduct, adminDeleteProduct, adminReplaceCatalogFile, adminReplaceProductImage, adminUpdateProduct, adminUploadProjectImage, adminAddProject, adminUpdateProject, adminDeleteProject, setSupplierHomeOrder, setSupplierListOrder, toggleSupplierPublished, toggleSupplierProjectPublished } from '../controllers/supplierAdminController';
import { globalSearch } from '../controllers/globalSearchController';
import * as roleAdmin from '../controllers/roleAdminController';
import { mergeCompanyWithScraped, listMergeCandidates, unmergeCompany } from '../controllers/companyMergeController';
import {
  listCompanyTypes, createCompanyType, updateCompanyType, deleteCompanyType,
  listCompanyServices, createCompanyService, updateCompanyService, deleteCompanyService, reorderCompanyServices, renameServiceCategory,
  listServiceCategories, createServiceCategory, toggleServiceCategory, reorderServiceCategories, renameServiceCategory2, deleteServiceCategory,
  listSupplierCategories, createSupplierCategory, updateSupplierCategory, reorderSupplierCategories, toggleSupplierCategory, deleteSupplierCategory,
} from '../controllers/enumAdminController';
import { generateTemplate, parseTemplate, importCompany } from '../services/companyImportService';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadLargePdf = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
import {
  authenticateAdmin,
  requireAdmin,
  requireSuperAdmin,
  requirePermission
} from '../middleware/adminAuth';

const router = Router();

// ============ Public routes (no auth) ============

// Check if system needs installation
router.get('/check-installation', checkInstallation);

// Install: Create first super admin (only if no admins exist)
router.post('/install', install);

// Login (rate limited: 5 attempts per 15 min per IP)
router.post('/login', adminLoginRateLimit, login);
router.post('/forgot-password', adminLoginRateLimit, forgotPassword);
router.post('/reset-password', adminLoginRateLimit, resetPassword);

// ============ SSE: registration events (token via ?token= because EventSource can't set headers) ============
const sseAuthAdapter: import('express').RequestHandler = (req, _res, next) => {
  if (!req.headers.authorization && typeof req.query.token === 'string') {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  next();
};
router.get('/stats/registration-events',
  sseAuthAdapter, authenticateAdmin, requireAdmin, requirePermission('can_view_stats'),
  (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // disable nginx proxy buffering
    });
    res.flushHeaders?.();
    res.write(': hi\n\n');                   // initial flush
    const heartbeat = setInterval(() => { try { res.write(': hb\n\n'); } catch {} }, 25000);
    const onChange = (payload: any) => {
      try { res.write(`event: change\ndata: ${JSON.stringify(payload)}\n\n`); } catch {}
    };
    analyticsEvents.on('change', onChange);
    req.on('close', () => {
      clearInterval(heartbeat);
      analyticsEvents.off('change', onChange);
    });
  }
);


// ============ Protected routes (require admin auth) ============

// All routes below require authentication
router.use(authenticateAdmin);
router.use(requireAdmin);

// Profile
router.get('/profile', getProfile);
router.get('/search', globalSearch);
router.put('/password', changePassword);

// Stats (requires can_view_stats permission)
router.get('/stats/overview', requirePermission('can_view_stats'), getStatsOverview);
router.get('/stats/registrations', getRegistrationStats);
router.get('/stats/registration-sources', requirePermission('can_view_stats'), getRegistrationSources);
router.get('/stats/daily', requirePermission('can_view_stats'), getDailyStatsReport);
router.get('/stats/today-new', getTodayNew);
router.get('/activity-log/stats', getActivityLogStats);
router.get('/activity-log/export', exportActivityLogs);
router.get('/activity-log/top-users', getTopActiveUsers);
router.get('/activity-log/user/:userId', getUserTimeline);
router.get('/activity-log', getActivityLogs);
router.get('/visitors/overview', requirePermission('can_view_stats'), getVisitorOverview);
router.get('/visitors', requirePermission('can_view_stats'), listVisitors);
router.get('/analytics/overview', requirePermission('can_view_stats'), getAnalyticsOverview);
router.get('/analytics/company-visitors', requirePermission('can_view_stats'), getCompanyVisitors);
router.get('/analytics/events', requirePermission('can_view_stats'), listAnalyticsEvents);
router.get('/analytics/daily-registrations', requirePermission('can_view_stats'), getDailyRegistrations);
router.get('/analytics/daily-visits', requirePermission('can_view_stats'), getDailyVisits);

// Designer management
router.get('/designers', getDesignersForAdmin);
router.get('/designers/:id', getDesignerDetails);
router.put('/designers/:id/approve', requirePermission('can_approve'), approveDesigner);
router.put('/designers/:id/reject', requirePermission('can_approve'), rejectDesigner);
router.delete('/designers/:id', requirePermission('can_approve'), deleteDesigner);
router.post('/designers/:id/restore', requirePermission('can_approve'), restoreDesigner);
router.put('/designers/bulk-approve', requirePermission('can_approve'), bulkApproveDesigners);
router.put('/designers/bulk-delete', requirePermission('can_approve'), bulkDeleteDesigners);
router.put('/designers/order', requirePermission('can_sort'), updateDesignerOrder);
router.put('/projects/:projectId/approve', requirePermission('can_approve'), approveProject);
router.put('/projects/:projectId/reject', requirePermission('can_approve'), rejectProject);
router.get('/rejection-templates', getRejectionTemplates);

// Inquiry management (admin)
router.get('/inquiries', getInquiries);
router.get('/inquiries/export', exportInquiries);
router.put('/inquiries/:id/status', updateInquiryStatus);
router.put('/inquiries/batch-delete', batchDeleteInquiries);
router.put('/inquiries/batch-restore', batchRestoreInquiries);
router.post('/inquiries/:id/resend-crm', resendCrmSync);

// Complaint management (admin)
router.get('/complaints', getComplaints);
router.put('/complaints/:id/status', updateComplaintStatus);

// Feedback management (admin)
router.get('/feedback', listFeedback);
router.get('/feedback/:id', getFeedback);
router.put('/feedback/mark-all-read', markAllFeedbackRead);

// Notification counts (admin)
router.get('/notifications/counts', getNewCounts);
router.put('/notifications/mark-seen', markNotificationSeen);

// Company management
router.get('/home-order-count', getHomeOrderCount);
router.get('/companies', listCompanies);
router.put('/companies/:companyId/display-order', requirePermission('can_sort'), updateCompanyDisplayOrder);
router.put('/companies/:companyId/home-display-order', requirePermission('can_sort'), updateCompanyHomeDisplayOrder);
router.put('/companies/:companyId/list-display-order', requirePermission('can_sort'), updateCompanyListDisplayOrder);
router.get('/company-applications', listCompanyApplications);
router.put('/company-applications/:id/review', requirePermission('can_approve'), reviewCompanyApplication);
router.post('/companies/:companyId/bind', requireSuperAdmin, bindUserToCompany);
router.delete('/companies/:companyId/bind', requireSuperAdmin, unbindCompany);
router.get('/companies/:companyId/detail', getScrapedCompany);
router.get('/companies/:companyId/full-detail', getCompanyFullDetail);
router.delete('/companies/:companyId/portfolio-image', requireAdmin, deleteDirectoryPortfolioImage);
router.put('/companies/:companyId/edit', editScrapedCompany);

// User management
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id/status', requireSuperAdmin, updateUserStatus);
router.put('/users/:id/role', requireSuperAdmin, updateUserRole);
router.put('/users/:id/edit', requireSuperAdmin, editUser);
router.put('/users/:id/delete', requireSuperAdmin, deleteUser);
router.post('/users/:id/restore', requireSuperAdmin, restoreUser);
router.get('/users/:id/permissions', requireSuperAdmin, getUserPermissions);
router.put('/users/:id/permissions', requireSuperAdmin, updateUserPermissions);
router.post('/users/:id/force-verify-email', requireSuperAdmin, forceVerifyUserEmail);

// ====== Dual-Role Management (V3 User System) ======

// Homeowners (no approval needed)
router.get('/roles/homeowners', roleAdmin.listHomeowners);
router.post('/homeowners/:id/assign', requirePermission('can_approve'), roleAdmin.assignDesigner);

// Companies (with approval)
router.get('/roles/companies', roleAdmin.listCompanies);
router.post('/roles/companies/bulk-unapprove', requirePermission('can_approve'), roleAdmin.bulkUnapproveCompanies);
router.post('/roles/companies/:id/approve', requirePermission('can_approve'), roleAdmin.approveCompany);
router.post('/roles/companies/:id/reject', requirePermission('can_approve'), roleAdmin.rejectCompany);
router.put('/roles/companies/:id/display-order', requirePermission('can_sort'), roleAdmin.updateCompanyDisplayOrder);
router.put('/roles/companies/:id/home-display-order', requirePermission('can_sort'), roleAdmin.updateCompanyHomeDisplayOrder);
router.put('/roles/companies/:id/list-display-order', requirePermission('can_sort'), roleAdmin.updateCompanyListDisplayOrder);
router.put('/roles/companies/:id/delete', requirePermission('can_approve'), roleAdmin.deleteCompanyProfile);
router.post('/roles/companies/:id/restore', requirePermission('can_approve'), roleAdmin.restoreCompanyProfile);
router.get('/roles/companies/:id/detail', getCompanyProfile);
router.get('/roles/companies/:id/full-detail', getCompanyProfileFullDetail);
router.put('/roles/companies/:id/edit', editCompanyProfile);
router.put('/roles/companies/:id/cover-image', setCompanyCoverImage);
router.put('/companies/:companyId/cover-image', setDirectoryCompanyCoverImage);

// Company project CRUD (admin)
router.get('/roles/companies/:companyId/projects/:projectId', getAdminProject);
router.put('/roles/companies/:companyId/projects/:projectId', updateAdminProject);
router.post('/roles/companies/:companyId/projects', createAdminProject);
router.delete('/roles/companies/:companyId/projects/:projectId', deleteAdminProject);
router.put('/roles/companies/:companyId/projects/:projectId/restore', restoreAdminProject);

// Weight system: toggle signed status
router.put('/roles/companies/:id/toggle-signed', toggleCompanyProfileSigned);
router.put('/companies/:companyId/toggle-signed', toggleDirectorySigned);

// Admin unpublish: toggle visibility on public site
router.put('/roles/companies/:id/toggle-published', toggleCompanyProfilePublished);
router.put('/companies/:companyId/toggle-published', toggleDirectoryPublished);
router.put('/roles/companies/:companyId/projects/:projectId/toggle-published', toggleProjectPublished);
router.get('/signed-companies', listSignedCompanies);

// Weight config management
router.get('/weight-config', requireSuperAdmin, getWeightConfigList);
router.put('/weight-config/:key', requireSuperAdmin, updateWeightConfig);
router.post('/weight-config/recalculate', requireSuperAdmin, triggerWeightRecalculation);

// CRM provisioning (admin)
router.post('/profile-companies/:id/crm-provision', adminCrmProvisionCompany);

// Company merge/claim
router.get('/companies/merge-candidates', listMergeCandidates);
router.post('/companies/:companyProfileId/merge', requireSuperAdmin, mergeCompanyWithScraped);
router.post('/companies/:companyProfileId/unmerge', requireSuperAdmin, unmergeCompany);

// Company import (Word template)
router.get('/companies/import/template', async (_req: any, res: any) => {
  try {
    const buffer = await generateTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=Tarmeer-Company-Template.docx');
    res.send(buffer);
  } catch (error) {
    console.error('Generate template error:', error);
    res.status(500).json({ error: 'Failed to generate template.' });
  }
});

router.post('/companies/import/parse', upload.single('file'), async (req: any, res: any) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const parsed = await parseTemplate(req.file.buffer);
    res.json({ data: parsed });
  } catch (error) {
    console.error('Parse template error:', error);
    res.status(500).json({ error: 'Failed to parse document.' });
  }
});

router.post('/companies/import/confirm', async (req: any, res: any) => {
  try {
    const { data } = req.body;
    if (!data || !data.company_name) return res.status(400).json({ error: 'Company name is required.' });
    const result = await importCompany(data, req.admin?.id || 0);
    res.json({ message: `Company "${result.name}" imported successfully.`, id: result.id });
  } catch (error: any) {
    console.error('Import company error:', error);
    res.status(500).json({ error: error.message || 'Failed to import company.' });
  }
});

// Notification email config
router.get('/notification-emails', async (_req: any, res: any) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM notification_emails ORDER BY created_at DESC');
    res.json({ emails: rows });
  } catch (error) { res.status(500).json({ error: 'Failed to load emails.' }); }
});
router.post('/notification-emails', async (req: any, res: any) => {
  try {
    const { email, label } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    await pool.execute('INSERT INTO notification_emails (email, label) VALUES (?, ?) ON DUPLICATE KEY UPDATE label = VALUES(label), is_active = 1', [email, label || null]);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: 'Failed to add email.' }); }
});
router.put('/notification-emails/:id', async (req: any, res: any) => {
  try {
    await pool.execute('UPDATE notification_emails SET is_active = ? WHERE id = ?', [req.body.is_active ? 1 : 0, req.params.id]);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: 'Failed to update.' }); }
});
router.delete('/notification-emails/:id', async (req: any, res: any) => {
  try {
    await pool.execute('DELETE FROM notification_emails WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (error) { res.status(500).json({ error: 'Failed to delete.' }); }
});

// System config (super admin only)
router.get('/system-config', requireSuperAdmin, async (_req: any, res: any) => {
  try {
    const [rows] = await pool.execute('SELECT config_key, config_value FROM system_config');
    res.json({ config: rows });
  } catch (error) {
    console.error('Get system config error:', error);
    res.status(500).json({ error: 'Failed to load config.' });
  }
});

router.put('/system-config', requireSuperAdmin, async (req: any, res: any) => {
  try {
    const { configs } = req.body;
    if (!Array.isArray(configs)) return res.status(400).json({ error: 'configs array required.' });
    for (const { key, value } of configs) {
      await pool.execute(
        'INSERT INTO system_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?',
        [key, value, value]
      );
    }
    res.json({ message: 'Config updated.' });
  } catch (error) {
    console.error('Update system config error:', error);
    res.status(500).json({ error: 'Failed to update config.' });
  }
});


// Showcase image optimization — fetch external URL, resize to 800px, convert to WebP
router.post('/showcase-images/optimize', requireSuperAdmin, async (req: any, res: any) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url required' });
  // 相对路径（/uploads/...）直接返回原路径，无需压缩——文件在同一台服务器上
  if (url.startsWith('/')) return res.json({ optimizedUrl: url });
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return res.status(422).json({ error: 'Failed to fetch image' });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return res.status(422).json({ error: 'URL is not an image' });
    const buffer = Buffer.from(await response.arrayBuffer());
    const hash = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
    const filename = `showcase-${hash}.webp`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'showcase');
    const filePath = path.join(uploadDir, filename);
    await fs.mkdir(uploadDir, { recursive: true, mode: 0o755 });
    await sharp(buffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(filePath);
    await fs.chmod(filePath, 0o644);
    enqueueVariants(filePath);
    res.json({ optimizedUrl: `/uploads/showcase/${filename}` });
  } catch (err: any) {
    console.error('Showcase optimize error:', err);
    res.status(500).json({ error: 'Optimization failed' });
  }
});

// Supplier management
router.get('/suppliers', listSuppliers);
router.get('/suppliers/:id', getSupplierDetail);
router.put('/suppliers/:id/status', requirePermission('can_approve'), updateSupplierStatus);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', requirePermission('can_approve'), deleteSupplier);
router.post('/suppliers/:id/products', adminAddProduct);
router.put('/suppliers/:id/products/:productId', adminUpdateProduct);
router.delete('/suppliers/:id/products/:productId', adminDeleteProduct);
router.put('/suppliers/catalogs/:id/file', requirePermission('can_approve'), uploadLargePdf.single('file'), adminReplaceCatalogFile);
router.put('/suppliers/:id/products/:productId/image', upload.single('file'), adminReplaceProductImage);
router.post('/suppliers/:id/project-image', upload.single('file'), adminUploadProjectImage);
router.post('/suppliers/:id/projects', adminAddProject);
router.put('/suppliers/:id/projects/:projectId', adminUpdateProject);
router.delete('/suppliers/:id/projects/:projectId', adminDeleteProject);
router.put('/suppliers/:id/home-order', setSupplierHomeOrder);
router.put('/suppliers/:id/list-order', setSupplierListOrder);
router.put('/suppliers/:id/toggle-published', toggleSupplierPublished);
router.put('/suppliers/:id/projects/:projectId/toggle-published', toggleSupplierProjectPublished);

// Admin management (super admin only)
router.get('/admins', requireSuperAdmin, listAdmins);
router.post('/admins', requireSuperAdmin, createSubAdmin);
router.put('/admins/:id', requireSuperAdmin, updateAdmin);
router.delete('/admins/:id', requireSuperAdmin, deleteAdmin);

// Field interviews (super_admin only)
router.get('/interviews', requireSuperAdmin, listInterviews);
router.get('/interviews/:id', requireSuperAdmin, getInterview);
router.patch('/interviews/:id', requireSuperAdmin, editInterview);

// Field staff management (super_admin only)
router.get('/staff', requireSuperAdmin, listStaff);
router.post('/staff', requireSuperAdmin, createStaff);
router.patch('/staff/:id', requireSuperAdmin, toggleStaff);

// Enum management — company types & services
router.get('/enums/company-types', listCompanyTypes);
router.post('/enums/company-types', requireAdmin, createCompanyType);
router.put('/enums/company-types/:slug', requireAdmin, updateCompanyType);
router.delete('/enums/company-types/:slug', requireAdmin, deleteCompanyType);
router.get('/enums/company-services', listCompanyServices);
router.post('/enums/company-services', requireAdmin, createCompanyService);
router.put('/enums/company-services/reorder', requireAdmin, reorderCompanyServices);
router.put('/enums/company-services/rename-category', requireAdmin, renameServiceCategory);
router.put('/enums/company-services/:name', requireAdmin, updateCompanyService);
router.delete('/enums/company-services/:name', requireAdmin, deleteCompanyService);
// Enum management — service categories (parent level)
router.get('/enums/service-categories', listServiceCategories);
router.post('/enums/service-categories', requireAdmin, createServiceCategory);
router.put('/enums/service-categories/reorder', requireAdmin, reorderServiceCategories);
router.put('/enums/service-categories/:name/toggle', requireAdmin, toggleServiceCategory);
router.put('/enums/service-categories/:name/rename', requireAdmin, renameServiceCategory2);
router.delete('/enums/service-categories/:name', requireAdmin, deleteServiceCategory);
// Enum management — supplier categories
router.get('/enums/supplier-categories', listSupplierCategories);
router.post('/enums/supplier-categories', requireAdmin, createSupplierCategory);
router.put('/enums/supplier-categories/reorder', requireAdmin, reorderSupplierCategories);
router.put('/enums/supplier-categories/:value/toggle', requireAdmin, toggleSupplierCategory);
router.put('/enums/supplier-categories/:value', requireAdmin, updateSupplierCategory);
router.delete('/enums/supplier-categories/:value', requireAdmin, deleteSupplierCategory);

export default router;
