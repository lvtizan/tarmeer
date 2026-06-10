"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_validator_1 = require("express-validator");
const inquiryController_1 = require("../controllers/inquiryController");
const auth_1 = require("../middleware/auth");
const adminAuth_1 = require("../middleware/adminAuth");
const router = (0, express_1.Router)();
function handleValidation(req, res, next) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const first = errors.array()[0];
        return res.status(400).json({ error: first.msg || 'Validation failed' });
    }
    next();
}
const inquiryLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many inquiry submissions. Please try again later.',
});
// Public: submit inquiry (rate limited)
router.post('/', inquiryLimiter, [
    (0, express_validator_1.body)('phone').notEmpty().withMessage('Phone is required'),
    (0, express_validator_1.body)('area_range').notEmpty().withMessage('Area range is required'),
], handleValidation, inquiryController_1.submitInquiry);
// Authenticated: get my received inquiries
router.get('/mine', auth_1.authenticate, inquiryController_1.getMyInquiries);
// Authenticated: company updates status on their own inquiry
router.patch('/:id/my-status', auth_1.authenticate, inquiryController_1.updateMyInquiryStatus);
// Admin: list all inquiries
router.get('/', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, inquiryController_1.getInquiries);
// Admin: export Excel
router.get('/export', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, inquiryController_1.exportInquiries);
// Admin: update inquiry status
router.put('/:id/status', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, inquiryController_1.updateInquiryStatus);
exports.default = router;
