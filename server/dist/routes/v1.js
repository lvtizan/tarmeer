"use strict";
// /api/v1 —— App-facing API 命名空间（与 Web 的 /api/* 并行，互不影响）。
// 目前承载 App 鉴权（refresh token）；后续 App 接口在此扩展。
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const appAuthController_1 = require("../controllers/appAuthController");
const authRateLimit_1 = require("../middleware/authRateLimit");
const router = express_1.default.Router();
// 健康 / 元信息
router.get('/health', (_req, res) => res.json({ ok: true, version: 1 }));
router.get('/meta', (req, res) => res.json({ version: 1, country: req.country }));
// App 鉴权（登录与 Web 同款防爆破：IP 限流 + 按邮箱锁号 5 次/15min）
router.post('/auth/login', authRateLimit_1.authRateLimit, authRateLimit_1.checkAccountLock, appAuthController_1.appLogin);
router.post('/auth/refresh', appAuthController_1.appRefresh);
router.post('/auth/logout', appAuthController_1.appLogout);
exports.default = router;
