import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import rateLimit from 'express-rate-limit';
import passport from 'passport';
import * as supplierAuth from '../controllers/supplierAuthController';

const router = Router();

function handleValidation(req: any, res: any, next: any) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const first = errors.array()[0];
    return res.status(400).json({ error: (first as any).msg || 'Validation failed' });
  }
  next();
}

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

router.post('/register',
  registerLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  handleValidation,
  supplierAuth.register
);

router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  handleValidation,
  supplierAuth.login
);

router.post('/check-availability', supplierAuth.checkAvailability);
router.post('/verify-email', supplierAuth.verifyEmail);
router.get('/check-verified', supplierAuth.checkVerified);

// Google OAuth — only if credentials are configured
if (process.env.GOOGLE_CLIENT_ID) {
  router.get('/google',
    (req: any, _res: any, next: any) => {
      // Store supplier flag in session so callback knows it's a supplier
      if (req.session) req.session.supplierOAuth = true;
      next();
    },
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/supplier/auth?error=google_failed', session: false }),
    supplierAuth.googleCallback
  );
}

export default router;
