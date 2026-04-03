import { Router } from 'express';
import pool from '../config/database';
import { adminLoginRateLimit } from '../middleware/antiScraping';
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
import { getComplaints, updateComplaintStatus, getNewCounts } from '../controllers/complaintController';
import { listCompanies, listCompanyApplications, reviewCompanyApplication, bindUserToCompany, unbindCompany, getScrapedCompany, editScrapedCompany, getCompanyProfile, editCompanyProfile } from '../controllers/companyAdminController';
import { getAnalyticsOverview, listAnalyticsEvents } from '../controllers/analyticsAdminController';
import * as roleAdmin from '../controllers/roleAdminController';
import { mergeCompanyWithScraped, listMergeCandidates, unmergeCompany } from '../controllers/companyMergeController';
import { generateTemplate, parseTemplate, importCompany } from '../services/companyImportService';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
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

// Complaint management (admin)
router.get('/complaints', getComplaints);
router.put('/complaints/:id/status', updateComplaintStatus);

// Notification counts (admin)
router.get('/notifications/counts', getNewCounts);

// Company management
router.get('/companies', listCompanies);
router.get('/company-applications', listCompanyApplications);
router.put('/company-applications/:id/review', requirePermission('can_approve'), reviewCompanyApplication);
router.post('/companies/:companyId/bind', requireSuperAdmin, bindUserToCompany);
router.delete('/companies/:companyId/bind', requireSuperAdmin, unbindCompany);
router.get('/companies/:companyId/detail', getScrapedCompany);
router.put('/companies/:companyId/edit', editScrapedCompany);

// User management
router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.put('/users/:id/status', requireSuperAdmin, updateUserStatus);
router.put('/users/:id/role', requireSuperAdmin, updateUserRole);

// ====== Dual-Role Management (V3 User System) ======

// Homeowners (no approval needed)
router.get('/roles/homeowners', roleAdmin.listHomeowners);
router.post('/homeowners/:id/assign', requirePermission('can_approve'), roleAdmin.assignDesigner);

// Companies (with approval)
router.get('/roles/companies', roleAdmin.listCompanies);
router.post('/roles/companies/:id/approve', requirePermission('can_approve'), roleAdmin.approveCompany);
router.post('/roles/companies/:id/reject', requirePermission('can_approve'), roleAdmin.rejectCompany);
router.put('/roles/companies/:id/display-order', requirePermission('can_sort'), roleAdmin.updateCompanyDisplayOrder);
router.get('/roles/companies/:id/detail', getCompanyProfile);
router.put('/roles/companies/:id/edit', editCompanyProfile);

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

// Admin management (super admin only)
router.get('/admins', requireSuperAdmin, listAdmins);
router.post('/admins', requireSuperAdmin, createSubAdmin);
router.put('/admins/:id', requireSuperAdmin, updateAdmin);
router.delete('/admins/:id', requireSuperAdmin, deleteAdmin);

export default router;
