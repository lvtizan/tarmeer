import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { submitComplaint } from '../controllers/complaintController';

const router = Router();

const complaintLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many complaint submissions. Please try again later.',
});

// Public: submit copyright complaint (rate limited)
router.post('/', complaintLimiter, submitComplaint);

export default router;
