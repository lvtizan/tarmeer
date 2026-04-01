import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { checkAvailability } from '../controllers/authController';
import * as userAuth from '../controllers/userAuthController';
import rateLimit from 'express-rate-limit';
import { authRateLimit, checkAccountLock } from '../middleware/authRateLimit';
import { authenticate } from '../middleware/auth';
import passport from '../middleware/passport';
import config from '../config';

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
    body('full_name').optional()
  ],
  handleValidation,
  userAuth.register
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
  userAuth.verifyEmail
);

router.post('/resend-verification',
  verificationLimiter,
  [
    body('email').isEmail().withMessage('Please enter a valid email address')
  ],
  handleValidation,
  userAuth.resendVerification
);

router.post('/login',
  authRateLimit, // 应用认证速率限制
  checkAccountLock, // 检查账户锁定状态
  [
    body('email').isEmail().withMessage('Please enter a valid email address'),
    body('password').notEmpty().withMessage('Please enter your password')
  ],
  handleValidation,
  userAuth.login
);

router.post('/forgot-password',
  verificationLimiter,
  [
    body('email').isEmail().withMessage('Please enter a valid email address')
  ],
  handleValidation,
  userAuth.forgotPassword
);

router.post('/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  handleValidation,
  userAuth.resetPassword
);

// 获取当前登录用户信息
router.get('/me', authenticate, userAuth.getMe);

// Update profile
router.put('/me', authenticate, userAuth.updateProfile);

// Google One Tap 登录（ID Token 验证）
router.post('/google/one-tap',
  [
    body('credential').notEmpty().withMessage('Google credential is required')
  ],
  handleValidation,
  userAuth.googleOneTap
);

// Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/callback/google',
  passport.authenticate('google', { failureRedirect: `${config.frontendUrl}/auth?error=google_failed` }),
  userAuth.oauthCallback
);

// Facebook OAuth
router.get('/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/callback/facebook',
  passport.authenticate('facebook', { failureRedirect: `${config.frontendUrl}/auth?error=facebook_failed` }),
  userAuth.oauthCallback
);

export default router;
