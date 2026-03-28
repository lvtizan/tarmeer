import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { register, login, verifyEmail, resendVerification, forgotPassword, resetPassword, checkAvailability, oauthCallback } from '../controllers/authController';
import rateLimit from 'express-rate-limit';
import { authRateLimit, checkAccountLock } from '../middleware/authRateLimit';
import passport from '../middleware/passport';

const router = Router();

function handleValidation(req: any, res: any, next: any) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    const msg = (first as any).msg || 'Validation failed';
    return res.status(400).json({ error: msg });
  }
  next();
}

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts. Please try again later.'
});

const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many verification emails sent. Please try again later.'
});

router.post('/register',
  registerLimiter,
  [
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('full_name').notEmpty().withMessage('Please enter your name')
  ],
  handleValidation,
  register
);

router.post('/check-availability',
  [
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Please enter a valid email address'),
    body('phone').optional({ values: 'falsy' }).isString().withMessage('Please enter a valid phone number'),
  ],
  handleValidation,
  checkAvailability
);

router.post('/verify-email',
  [
    body('token').notEmpty().withMessage('Verification token is required')
  ],
  handleValidation,
  verifyEmail
);

router.post('/resend-verification',
  verificationLimiter,
  [
    body('email').isEmail().withMessage('Please enter a valid email address')
  ],
  handleValidation,
  resendVerification
);

router.post('/login',
  authRateLimit, // 应用认证速率限制
  checkAccountLock, // 检查账户锁定状态
  [
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password').notEmpty().withMessage('Please enter your password')
  ],
  handleValidation,
  login
);

router.post('/forgot-password',
  verificationLimiter,
  [
    body('email').isEmail().withMessage('Please enter a valid email address')
  ],
  handleValidation,
  forgotPassword
);

router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  handleValidation,
  resetPassword
);

// Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/callback/google',
  passport.authenticate('google', { failureRedirect: '/auth?error=google_failed' }),
  oauthCallback
);

// Facebook OAuth
router.get('/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/callback/facebook',
  passport.authenticate('facebook', { failureRedirect: '/auth?error=facebook_failed' }),
  oauthCallback
);

export default router;
