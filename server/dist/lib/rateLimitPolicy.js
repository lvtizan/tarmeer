"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldSkipApiRateLimit = shouldSkipApiRateLimit;
function isLocalIp(ip) {
    if (!ip)
        return false;
    return ip === '127.0.0.1'
        || ip === '::1'
        || ip === '::ffff:127.0.0.1';
}
function normalizePath(path) {
    if (!path)
        return '';
    if (path === '/')
        return '/';
    return path.endsWith('/') ? path.slice(0, -1) : path;
}
function isExemptPath(path) {
    const normalized = normalizePath(path);
    const withoutApiPrefix = normalized.startsWith('/api/')
        ? normalizePath(normalized.slice(4))
        : normalized;
    const candidates = new Set([normalized, withoutApiPrefix]);
    const exactExemptPaths = new Set([
        '/health',
        '/auth/me',
        '/auth/select-role',
        '/auth/switch-role',
        '/auth/google',
        '/auth/callback/google',
        '/auth/google/one-tap',
        '/auth/facebook',
        '/auth/callback/facebook',
        '/admin/check-installation',
        '/admin/install',
        '/admin/forgot-password',
        '/admin/reset-password',
    ]);
    // Public read-only API paths — exempt from strict global rate limit
    // These are called on every page load by all visitors
    const publicReadPrefixes = [
        '/companies',
        '/public/companies',
        '/designers',
        '/stats',
        '/uploads',
    ];
    for (const candidate of candidates) {
        if (candidate.startsWith('/admin/')) {
            return true;
        }
        if (exactExemptPaths.has(candidate)) {
            return true;
        }
        for (const prefix of publicReadPrefixes) {
            if (candidate.startsWith(prefix)) {
                return true;
            }
        }
    }
    return false;
}
function shouldSkipApiRateLimit(input) {
    if (input.method === 'OPTIONS') {
        return true;
    }
    if (isExemptPath(input.path)) {
        return true;
    }
    if (input.nodeEnv !== 'production' && isLocalIp(input.ip)) {
        return true;
    }
    return false;
}
