import { Router } from 'express';
import { body } from 'express-validator';
import { createContact, getContacts, updateContactStatus } from '../controllers/contactController';
import { authenticate } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const router = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many submissions. Please try again later.'
});

router.post('/',
  contactLimiter,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('type').isIn(['inquiry', 'quote', 'partnership']).withMessage('Invalid type')
  ],
  createContact
);

router.get('/', authenticate, getContacts);
router.put('/:id/status', authenticate, updateContactStatus);

export default router;
