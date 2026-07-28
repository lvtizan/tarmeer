"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const authController_1 = require("../controllers/authController");
const userAuth = __importStar(require("../controllers/userAuthController"));
const onboarding = __importStar(require("../controllers/onboardingController"));
const homeowner = __importStar(require("../controllers/homeownerController"));
const companyProfile = __importStar(require("../controllers/companyProfileController"));
const companyCrmController_1 = require("../controllers/companyCrmController");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authRateLimit_1 = require("../middleware/authRateLimit");
const auth_1 = require("../middleware/auth");
const passport_1 = __importDefault(require("../middleware/passport"));
const config_1 = __importDefault(require("../config"));
const router = (0, express_1.Router)();
function handleValidation(req, res, next) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const first = errors.array()[0];
        const msg = first.msg || 'Validation failed';
        return res.status(400).json({ error: msg });
    }
    next();
}
const registerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many registration attempts. Please try again later.'
});
const verificationLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: 'Too many verification emails sent. Please try again later.'
});
router.post('/register', registerLimiter, [
    (0, express_validator_1.body)('email').isEmail().withMessage('Please enter a valid email address'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    (0, express_validator_1.body)('full_name').optional()
], handleValidation, userAuth.register);
router.post('/check-availability', [
    (0, express_validator_1.body)('email').optional({ values: 'falsy' }).isEmail().withMessage('Please enter a valid email address'),
    (0, express_validator_1.body)('phone').optional({ values: 'falsy' }).isString().withMessage('Please enter a valid phone number'),
], handleValidation, authController_1.checkAvailability);
router.post('/verify-email', [
    (0, express_validator_1.body)('token').notEmpty().withMessage('Verification token is required')
], handleValidation, userAuth.verifyEmail);
router.get('/check-verified', userAuth.checkVerified);
router.post('/resend-verification', verificationLimiter, [
    (0, express_validator_1.body)('email').isEmail().withMessage('Please enter a valid email address')
], handleValidation, userAuth.resendVerification);
router.post('/login', authRateLimit_1.authRateLimit, // 应用认证速率限制
authRateLimit_1.checkAccountLock, // 检查账户锁定状态
[
    (0, express_validator_1.body)('email').isEmail().withMessage('Please enter a valid email address'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Please enter your password')
], handleValidation, userAuth.login);
router.post('/forgot-password', verificationLimiter, [
    (0, express_validator_1.body)('email').isEmail().withMessage('Please enter a valid email address')
], handleValidation, userAuth.forgotPassword);
router.post('/reset-password', [
    (0, express_validator_1.body)('token').notEmpty().withMessage('Reset token is required'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], handleValidation, userAuth.resetPassword);
// 获取当前登录用户信息 (enhanced: returns all profiles)
router.get('/me', auth_1.authenticate, onboarding.getMeEnhanced);
// Update profile
router.put('/me', auth_1.authenticate, userAuth.updateProfile);
// Update name (requires current password)
router.put('/update-name', auth_1.authenticate, [
    (0, express_validator_1.body)('full_name').notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('current_password').notEmpty().withMessage('Current password is required')
], handleValidation, userAuth.updateName);
// Change password (requires current password + new password)
router.put('/change-password', auth_1.authenticate, [
    (0, express_validator_1.body)('current_password').notEmpty().withMessage('Current password is required'),
    (0, express_validator_1.body)('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], handleValidation, userAuth.changePassword);
// ====== Role Selection & Switching ======
router.post('/select-role', auth_1.authenticate, onboarding.selectRole);
router.post('/switch-role', auth_1.authenticate, onboarding.switchRole);
// Returns other portals this user can access (same email in admin_users/supplier_users/users)
router.get('/linked-portals', auth_1.authenticate, userAuth.getLinkedPortals);
// Exchange current token for another portal's token (no re-login)
router.post('/cross-portal-token', auth_1.authenticate, userAuth.crossPortalToken);
// ====== Homeowner Routes ======
router.post('/homeowner/profile', auth_1.authenticate, homeowner.upsertProfile);
router.get('/homeowner/profile', auth_1.authenticate, homeowner.getProfile);
router.get('/homeowner/assigned-designer', auth_1.authenticate, homeowner.getAssignedDesigner);
// ====== Company Profile Routes ======
router.post('/company/profile', auth_1.authenticate, companyProfile.upsertProfile);
router.get('/company/profile', auth_1.authenticate, companyProfile.getProfile);
router.get('/company/projects', auth_1.authenticate, companyProfile.getCompanyProjects);
router.get('/company/services', companyProfile.getServiceOptions);
// CRM SSO — issue a consume URL for the logged-in company user
router.post('/company/crm-sso', auth_1.authenticate, companyCrmController_1.issueCrmSso);
// Portfolio scrape from URL
router.post('/company/scrape-portfolio', auth_1.authenticate, async (req, res) => {
    try {
        const { url } = req.body;
        if (!url)
            return res.status(400).json({ error: 'URL is required.' });
        const { scrapePortfolio } = await Promise.resolve().then(() => __importStar(require('../services/portfolioScraper')));
        const result = await scrapePortfolio(url);
        res.json(result);
    }
    catch (error) {
        console.error('Scrape portfolio error:', error.message);
        res.status(400).json({ error: `Failed to scrape: ${error.message || 'Unknown error'}` });
    }
});
// Google One Tap 登录（ID Token 验证）
router.post('/google/one-tap', [
    (0, express_validator_1.body)('credential').notEmpty().withMessage('Google credential is required')
], handleValidation, userAuth.googleOneTap);
// Google OAuth — accepts ?role=company|homeowner, optional ?phone, optional ?source via state param
router.get('/google', (req, res, next) => {
    const role = req.query.role;
    const phone = req.query.phone;
    const source = req.query.source;
    const validRole = role === 'company' || role === 'homeowner' ? role : undefined;
    // Encode role + phone + source into state JSON; fallback to plain role string for backwards compat
    let state;
    if (phone || source) {
        const s = {};
        if (validRole)
            s.role = validRole;
        if (phone)
            s.phone = String(phone);
        if (source)
            s.source = String(source);
        state = JSON.stringify(s);
    }
    else {
        state = validRole;
    }
    passport_1.default.authenticate('google', {
        scope: ['profile', 'email'],
        state,
    })(req, res, next);
});
router.get('/callback/google', passport_1.default.authenticate('google', { failureRedirect: `${config_1.default.frontendUrl}/auth?error=google_failed` }), userAuth.oauthCallback);
// Facebook OAuth
router.get('/facebook', passport_1.default.authenticate('facebook', { scope: ['email'] }));
router.get('/callback/facebook', passport_1.default.authenticate('facebook', { failureRedirect: `${config_1.default.frontendUrl}/auth?error=facebook_failed` }), userAuth.oauthCallback);
exports.default = router;
