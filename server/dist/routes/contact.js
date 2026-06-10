"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const contactController_1 = require("../controllers/contactController");
const auth_1 = require("../middleware/auth");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const router = (0, express_1.Router)();
const contactLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: 'Too many submissions. Please try again later.'
});
router.post('/', contactLimiter, [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Name is required'),
    (0, express_validator_1.body)('type').isIn(['inquiry', 'quote', 'partnership']).withMessage('Invalid type')
], contactController_1.createContact);
router.get('/', auth_1.authenticate, contactController_1.getContacts);
router.put('/:id/status', auth_1.authenticate, contactController_1.updateContactStatus);
exports.default = router;
