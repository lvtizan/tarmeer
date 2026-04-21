import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import { submitCompanyLead, getCompanyLeads, checkPhoneExists } from '../controllers/companyLeadController';
import { authenticateAdmin, requireAdmin } from '../middleware/adminAuth';

const router = Router();

function handleValidation(req: any, res: any, next: any) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ error: (first as any).msg || 'Validation failed' });
  }
  next();
}

const companyLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many submissions. Please try again later.',
});

// Public: submit company lead (rate limited)
router.post('/',
  companyLeadLimiter,
  [
    body('contactName').notEmpty().withMessage('Contact name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('companyName').notEmpty().withMessage('Company name is required'),
  ],
  handleValidation,
  submitCompanyLead
);

// Public: check if phone already submitted
router.get('/check-phone', checkPhoneExists);

// Admin: list all company leads
router.get('/', authenticateAdmin, requireAdmin, getCompanyLeads);

export default router;
