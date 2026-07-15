"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const sourcingRequestController_1 = require("../controllers/sourcingRequestController");
const router = (0, express_1.Router)();
// 采购线索提交限流：20/h/IP（spec §3.2，对齐 suppliers.js 的 leadLimiter 模式）
const sourcingLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Too many submissions. Please try again later.',
});
router.post('/', sourcingLimiter, sourcingRequestController_1.submitSourcingRequest);
exports.default = router;
