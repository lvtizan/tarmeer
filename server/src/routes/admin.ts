import { Router } from 'express';
import {
  checkInstallation,
  install,
  login,
  getProfile,
  createSubAdmin,
  listAdmins,
  updateAdmin,
  deleteAdmin,
  changePassword
} from '../controllers/adminController';
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
  getStatsOverview,
  getActivityLogs
} from '../controllers/designerAdminController';
import { getVisitorOverview, listVisitors } from '../controllers/visitorAdminController';
import { listUsers, getUserDetail, updateUserStatus, updateUserRole } from '../controllers/userAdminController';
import { getInquiries, updateInquiryStatus, exportInquiries } from '../controllers/inquiryController';
import { listCompanies, listCompanyApplications, reviewCompanyApplication, bindUserToCompany, unbindCompany } from '../controllers/companyAdminController';
import { getAnalyticsOverview, listAnalyticsEvents } from '../controllers/analyticsAdminController';
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

// Login
router.post('/login', login);


// ============ Protected routes (require admin auth) ============

// All routes below require authentication
router.use(authenticateAdmin);
router.use(requireAdmin);

// Profile
router.get('/profile', getProfile);
router.put('/password', changePassword);

// Stats (requires can_view_stats permission)
router.get('/stats/overview', requirePermission('can_view_stats'), getStatsOverview);
router.get('/activity-logs', getActivityLogs);
router.get('/visitors/overview', requirePermission('can_view_stats'), getVisitorOverview);
router.get('/visitors', requirePermission('can_view_stats'), listVisitors);
router.get('/analytics/overview', requirePermission('can_view_stats'), getAnalyticsOverview);
router.get('/analytics/events', requirePermission('can_view_stats'), listAnalyticsEvents);

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

// Inquiry management (admin)
router.get('/inquiries', getInquiries);
router.get('/inquiries/export', exportInquiries);
router.put('/inquiries/:id/status', updateInquiryStatus);

// Company management
router.get('/companies', listCompanies);
router.get('/company-applications', listCompanyApplications);
router.put('/company-applications/:id/review', requirePermission('can_approve'), reviewCompanyApplication);
router.post('/companies/:companyId/bind', requireSuperAdmin, bindUserToCompany);
router.delete('/companies/:companyId/bind', requireSuperAdmin, unbindCompany);

// User management
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id/status', requireSuperAdmin, updateUserStatus);
router.put('/users/:id/role', requireSuperAdmin, updateUserRole);

// Admin management (super admin only)
router.get('/admins', requireSuperAdmin, listAdmins);
router.post('/admins', requireSuperAdmin, createSubAdmin);
router.put('/admins/:id', requireSuperAdmin, updateAdmin);
router.delete('/admins/:id', requireSuperAdmin, deleteAdmin);

export default router;
