"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const express_validator_1 = require("express-validator");
const companyLeadController_1 = require("../controllers/companyLeadController");
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
const companyLeadLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many submissions. Please try again later.',
});
// Public: submit company lead (rate limited)
router.post('/', companyLeadLimiter, [
    (0, express_validator_1.body)('contactName').optional(),
    (0, express_validator_1.body)('phone').notEmpty().withMessage('Phone is required'),
    (0, express_validator_1.body)('companyName').notEmpty().withMessage('Company name is required'),
], handleValidation, companyLeadController_1.submitCompanyLead);
// Public: check if phone already exists (used by signup form for real-time feedback)
router.get('/check-phone', companyLeadController_1.checkCompanyPhone);
// Admin: list all company leads
router.get('/', adminAuth_1.authenticateAdmin, adminAuth_1.requireAdmin, companyLeadController_1.getCompanyLeads);
exports.default = router;
