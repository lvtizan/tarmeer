import { Router } from 'express';
import pool from '../config/database';
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
  listStaff,
  createStaff,
  toggleStaff,
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
  getActivityLogs,
  getRegistrationStats,
  getRegistrationSources,
  getDailyStatsReport,
} from '../controllers/designerAdminController';
import { getActivityLogStats, exportActivityLogs } from '../controllers/activityLogController';
import { getVisitorOverview, listVisitors } from '../controllers/visitorAdminController';
import { listUsers, getUserDetail, updateUserStatus, updateUserRole, editUser, deleteUser, restoreUser, getUserPermissions, updateUserPermissions } from '../controllers/userAdminController';
import { getInquiries, updateInquiryStatus, exportInquiries, batchDeleteInquiries, batchRestoreInquiries, resendCrmSync } from '../controllers/inquiryController';
import { getComplaints, updateComplaintStatus, getNewCounts, markNotificationSeen } from '../controllers/complaintController';
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
  getCompanyFullDetail,
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
  listSignedCompanies,
  getWeightConfigList,
  updateWeightConfig,
  triggerWeightRecalculation,
} from '../controllers/companyAdminController';
import { getAnalyticsOverview, getCompanyVisitors, listAnalyticsEvents, getDailyRegistrations, getDailyVisits, getTodayNew } from '../controllers/analyticsAdminController';
import { listSuppliers, getSupplierDetail, updateSupplierStatus, updateSupplier, deleteSupplier, adminAddProduct, adminDeleteProduct, adminReplaceCatalogFile, adminReplaceProductImage } from '../controllers/supplierAdminController';
import { globalSearch } from '../controllers/globalSearchController';
import * as roleAdmin from '../controllers/roleAdminController';
import { mergeCompanyWithScraped, listMergeCandidates, unmergeCompany } from '../controllers/companyMergeController';
import {
  listCompanyTypes, createCompanyType, updateCompanyType, deleteCompanyType,
  listCompanyServices, createCompanyService, updateCompanyService, deleteCompanyService,
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

// Company project CRUD (admin)
router.get('/roles/companies/:companyId/projects/:projectId', getAdminProject);
router.put('/roles/companies/:companyId/projects/:projectId', updateAdminProject);
router.post('/roles/companies/:companyId/projects', createAdminProject);
router.delete('/roles/companies/:companyId/projects/:projectId', deleteAdminProject);
router.put('/roles/companies/:companyId/projects/:projectId/restore', restoreAdminProject);

// Weight system: toggle signed status
router.put('/roles/companies/:id/toggle-signed', toggleCompanyProfileSigned);
router.put('/companies/:companyId/toggle-signed', toggleDirectorySigned);
router.get('/signed-companies', listSignedCompanies);

// Weight config management
router.get('/weight-config', requireSuperAdmin, getWeightConfigList);
router.put('/weight-config/:key', requireSuperAdmin, updateWeightConfig);
router.post('/weight-config/recalculate', requireSuperAdmin, triggerWeightRecalculation);

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

// Supplier management
router.get('/suppliers', listSuppliers);
router.get('/suppliers/:id', getSupplierDetail);
router.put('/suppliers/:id/status', requirePermission('can_approve'), updateSupplierStatus);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', requirePermission('can_approve'), deleteSupplier);
router.post('/suppliers/:id/products', adminAddProduct);
router.delete('/suppliers/:id/products/:productId', adminDeleteProduct);
router.put('/suppliers/catalogs/:id/file', requirePermission('can_approve'), uploadLargePdf.single('file'), adminReplaceCatalogFile);
router.put('/suppliers/:id/products/:productId/image', upload.single('file'), adminReplaceProductImage);

// Field staff management (super admin only)
router.get('/staff', requireSuperAdmin, listStaff);
router.post('/staff', requireSuperAdmin, createStaff);
router.patch('/staff/:id', requireSuperAdmin, toggleStaff);

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
router.post('/enums/company-types', requireSuperAdmin, createCompanyType);
router.put('/enums/company-types/:slug', requireSuperAdmin, updateCompanyType);
router.delete('/enums/company-types/:slug', requireSuperAdmin, deleteCompanyType);
router.get('/enums/company-services', listCompanyServices);
router.post('/enums/company-services', requireSuperAdmin, createCompanyService);
router.put('/enums/company-services/:name', requireSuperAdmin, updateCompanyService);
router.delete('/enums/company-services/:name', requireSuperAdmin, deleteCompanyService);

export default router;
