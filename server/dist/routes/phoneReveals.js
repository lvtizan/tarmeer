"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const phoneRevealController_1 = require("../controllers/phoneRevealController");
const router = (0, express_1.Router)();
// 公开接口：点击查看电话（限流防刷）
const revealLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many requests. Please try again later.',
});
router.post('/', revealLimiter, phoneRevealController_1.revealPhone);
exports.default = router;
