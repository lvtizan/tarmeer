import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { checkAvailability } from '../controllers/authController';
import * as userAuth from '../controllers/userAuthController';
import * as onboarding from '../controllers/onboardingController';
import * as homeowner from '../controllers/homeownerController';
import * as companyProfile from '../controllers/companyProfileController';
import { issueCrmSso } from '../controllers/companyCrmController';
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

router.get('/check-verified', userAuth.checkVerified);

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

// 获取当前登录用户信息 (enhanced: returns all profiles)
router.get('/me', authenticate, onboarding.getMeEnhanced);

// Update profile
router.put('/me', authenticate, userAuth.updateProfile);

// Update name (requires current password)
router.put('/update-name',
  authenticate,
  [
    body('full_name').notEmpty().withMessage('Name is required'),
    body('current_password').notEmpty().withMessage('Current password is required')
  ],
  handleValidation,
  userAuth.updateName
);

// Change password (requires current password + new password)
router.put('/change-password',
  authenticate,
  [
    body('current_password').notEmpty().withMessage('Current password is required'),
    body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
  ],
  handleValidation,
  userAuth.changePassword
);

// ====== Role Selection & Switching ======
router.post('/select-role', authenticate, onboarding.selectRole);
router.post('/switch-role', authenticate, onboarding.switchRole);

// ====== Homeowner Routes ======
router.post('/homeowner/profile', authenticate, homeowner.upsertProfile);
router.get('/homeowner/profile', authenticate, homeowner.getProfile);
router.get('/homeowner/assigned-designer', authenticate, homeowner.getAssignedDesigner);

// ====== Company Profile Routes ======
router.post('/company/profile', authenticate, companyProfile.upsertProfile);
router.get('/company/profile', authenticate, companyProfile.getProfile);
router.get('/company/projects', authenticate, companyProfile.getCompanyProjects);
router.get('/company/services', companyProfile.getServiceOptions);
// CRM SSO — issue a consume URL for the logged-in company user
router.post('/company/crm-sso', authenticate, issueCrmSso);

// Portfolio scrape from URL
router.post('/company/scrape-portfolio', authenticate, async (req: any, res: any) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required.' });
    const { scrapePortfolio } = await import('../services/portfolioScraper');
    const result = await scrapePortfolio(url);
    res.json(result);
  } catch (error: any) {
    console.error('Scrape portfolio error:', error.message);
    res.status(400).json({ error: `Failed to scrape: ${error.message || 'Unknown error'}` });
  }
});

// Google One Tap 登录（ID Token 验证）
router.post('/google/one-tap',
  [
    body('credential').notEmpty().withMessage('Google credential is required')
  ],
  handleValidation,
  userAuth.googleOneTap
);

// Google OAuth — accepts ?role=company|homeowner and optional ?phone via state param
router.get('/google', (req: any, res: any, next: any) => {
  const role = req.query.role;
  const phone = req.query.phone;
  const validRole = role === 'company' || role === 'homeowner' ? role : undefined;
  // Encode role + phone into state as JSON when phone is present, otherwise plain role string for backwards compat
  const state = phone && validRole
    ? JSON.stringify({ role: validRole, phone })
    : validRole;
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
  })(req, res, next);
});

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
