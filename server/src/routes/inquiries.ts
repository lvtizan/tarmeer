import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { submitInquiry, getInquiries, updateInquiryStatus, exportInquiries, getMyInquiries } from '../controllers/inquiryController';
import { authenticate } from '../middleware/auth';
import { authenticateAdmin, requireAdmin, requirePermission } from '../middleware/adminAuth';

const router = Router();

function handleValidation(req: any, res: any, next: any) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ error: (first as any).msg || 'Validation failed' });
  }
  next();
}

const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many inquiry submissions. Please try again later.',
});

// Public: submit inquiry (rate limited)
router.post('/',
  inquiryLimiter,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('city').notEmpty().withMessage('City is required'),
    body('area_range').notEmpty().withMessage('Area range is required'),
  ],
  handleValidation,
  submitInquiry
);

// Authenticated: get my received inquiries
router.get('/mine', authenticate, getMyInquiries);

// Admin: list all inquiries
router.get('/', authenticateAdmin, requireAdmin, getInquiries);

// Admin: export Excel
router.get('/export', authenticateAdmin, requireAdmin, exportInquiries);

// Admin: update inquiry status
router.put('/:id/status', authenticateAdmin, requireAdmin, updateInquiryStatus);

export default router;
