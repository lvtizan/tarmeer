"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const complaintController_1 = require("../controllers/complaintController");
const router = (0, express_1.Router)();
const complaintLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Too many complaint submissions. Please try again later.',
});
// Public: submit copyright complaint (rate limited)
router.post('/', complaintLimiter, complaintController_1.submitComplaint);
exports.default = router;
