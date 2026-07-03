"use strict";
/**
 * 轻量内存 TTL 缓存中间件 —— 仅用于公开只读 GET 接口（2026-07-03 P1 性能优化）。
 * key = x-country 头 + originalUrl（country 也可能在 query 里，originalUrl 已含）。
 * 仅缓存 2xx 的 res.json 输出；上限 500 条防内存膨胀（FIFO 淘汰）。
 * 管理后台改动最多延迟 ttlSeconds 秒可见，属可接受代价。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheMiddleware = cacheMiddleware;
const store = new Map();
const MAX_ENTRIES = 500;
function cacheMiddleware(ttlSeconds = 60) {
    const ttlMs = ttlSeconds * 1000;
    return (req, res, next) => {
        if (req.method !== 'GET')
            return next();
        const key = (req.headers['x-country'] || '') + '|' + req.originalUrl;
        const hit = store.get(key);
        if (hit && Date.now() - hit.time < ttlMs) {
            res.set('X-Cache', 'HIT');
            res.set('Vary', 'x-country');
            res.set('Cache-Control', 'public, max-age=' + ttlSeconds);
            return res.status(hit.status).type('application/json').send(hit.body);
        }
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                if (store.size >= MAX_ENTRIES) {
                    store.delete(store.keys().next().value);
                }
                store.set(key, { time: Date.now(), status: res.statusCode, body: JSON.stringify(body) });
                res.set('Vary', 'x-country');
                res.set('Cache-Control', 'public, max-age=' + ttlSeconds);
            }
            return originalJson(body);
        };
        next();
    };
}
