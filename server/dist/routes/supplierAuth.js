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
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const passport_1 = __importDefault(require("passport"));
const supplierAuth = __importStar(require("../controllers/supplierAuthController"));
const router = (0, express_1.Router)();
function handleValidation(req, res, next) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const first = errors.array()[0];
        return res.status(400).json({ error: first.msg || 'Validation failed' });
    }
    next();
}
const registerLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Too many registration attempts. Please try again later.' },
});
router.post('/register', registerLimiter, [
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
], handleValidation, supplierAuth.register);
router.post('/login', [
    (0, express_validator_1.body)('email').isEmail().withMessage('Valid email is required'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password is required'),
], handleValidation, supplierAuth.login);
router.post('/check-availability', supplierAuth.checkAvailability);
router.post('/verify-email', supplierAuth.verifyEmail);
router.get('/check-verified', supplierAuth.checkVerified);
// Google OAuth — only if credentials are configured
if (process.env.GOOGLE_CLIENT_ID) {
    router.get('/google', (req, _res, next) => {
        // Store supplier flag in session so callback knows it's a supplier
        if (req.session)
            req.session.supplierOAuth = true;
        next();
    }, passport_1.default.authenticate('google', { scope: ['profile', 'email'] }));
    router.get('/google/callback', passport_1.default.authenticate('google', { failureRedirect: '/supplier/auth?error=google_failed', session: false }), supplierAuth.googleCallback);
}
exports.default = router;
