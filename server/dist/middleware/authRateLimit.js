"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimit = void 0;
exports.checkAccountLock = checkAccountLock;
exports.recordAuthFailure = recordAuthFailure;
exports.recordAuthSuccess = recordAuthSuccess;
exports.getAccountStatus = getAccountStatus;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
/**
 * 认证速率限制配置
 * 防止暴力破解攻击
 */
// 存储登录尝试次数的内存存储（生产环境建议使用Redis）
const loginAttempts = new Map();
const lockedAccounts = new Map();
// 配置参数
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15分钟
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15分钟
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15分钟
const MAX_REQUESTS_PER_WINDOW = 10;
/**
 * 检查账户是否被锁定
 */
function isAccountLocked(identifier) {
    const lockInfo = lockedAccounts.get(identifier);
    if (!lockInfo) {
        return { locked: false };
    }
    if (Date.now() >= lockInfo.lockUntil) {
        // 锁定已过期，清除记录
        lockedAccounts.delete(identifier);
        loginAttempts.delete(identifier);
        return { locked: false };
    }
    const remainingTime = Math.ceil((lockInfo.lockUntil - Date.now()) / 1000 / 60); // 分钟
    return {
        locked: true,
        reason: lockInfo.reason,
        remainingTime,
    };
}
/**
 * 记录失败的登录尝试
 */
function recordFailedAttempt(identifier) {
    const now = Date.now();
    const attempts = loginAttempts.get(identifier);
    if (!attempts || now > attempts.resetTime) {
        // 新的尝试窗口
        loginAttempts.set(identifier, {
            count: 1,
            resetTime: now + ATTEMPT_WINDOW,
        });
    }
    else {
        // 增加尝试次数
        attempts.count++;
        if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
            // 锁定账户
            lockedAccounts.set(identifier, {
                lockUntil: now + LOCKOUT_DURATION,
                reason: `Too many failed login attempts (${MAX_LOGIN_ATTEMPTS} attempts). Account locked for ${Math.ceil(LOCKOUT_DURATION / 60000)} minutes.`,
            });
            // 清除尝试计数
            loginAttempts.delete(identifier);
        }
    }
}
/**
 * 清除成功的登录尝试
 */
function clearFailedAttempts(identifier) {
    loginAttempts.delete(identifier);
}
/**
 * 认证速率限制中间件
 */
exports.authRateLimit = (0, express_rate_limit_1.default)({
    windowMs: RATE_LIMIT_WINDOW,
    max: MAX_REQUESTS_PER_WINDOW,
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // 跳过成功的请求
    skipSuccessfulRequests: true,
});
/**
 * 账户锁定检查中间件
 */
function checkAccountLock(req, res, next) {
    // 从请求中获取标识符（email或IP）
    const identifier = req.body?.email || req.ip;
    if (!identifier || typeof identifier !== 'string') {
        return next();
    }
    const lockStatus = isAccountLocked(identifier);
    if (lockStatus.locked) {
        res.status(423).json({
            error: 'Account temporarily locked',
            message: lockStatus.reason,
            locked: true,
            remainingMinutes: lockStatus.remainingTime,
        });
        return;
    }
    next();
}
/**
 * 记录认证失败的中间件
 */
function recordAuthFailure(req, res, next) {
    const identifier = req.body?.email || req.ip;
    if (identifier && typeof identifier === 'string') {
        recordFailedAttempt(identifier);
    }
    next();
}
/**
 * 记录认证成功的中间件
 */
function recordAuthSuccess(req, res, next) {
    const identifier = req.body?.email || req.ip;
    if (identifier && typeof identifier === 'string') {
        clearFailedAttempts(identifier);
    }
    next();
}
/**
 * 获取当前账户状态（用于前端显示）
 */
function getAccountStatus(identifier) {
    const attempts = loginAttempts.get(identifier);
    const lockStatus = isAccountLocked(identifier);
    return {
        attempts: attempts?.count || 0,
        maxAttempts: MAX_LOGIN_ATTEMPTS,
        locked: lockStatus.locked,
        remainingAttempts: attempts ? Math.max(0, MAX_LOGIN_ATTEMPTS - attempts.count) : MAX_LOGIN_ATTEMPTS,
    };
}
// 定期清理过期的锁定记录（每小时执行一次）
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        // 清理过期的锁定
        for (const [identifier, lockInfo] of lockedAccounts.entries()) {
            if (now >= lockInfo.lockUntil) {
                lockedAccounts.delete(identifier);
                loginAttempts.delete(identifier);
            }
        }
        // 清理过期的尝试记录
        for (const [identifier, attempts] of loginAttempts.entries()) {
            if (now >= attempts.resetTime) {
                loginAttempts.delete(identifier);
            }
        }
    }, 60 * 60 * 1000); // 1小时
}
