"use strict";
// 后端国家统一解析 —— 单一来源。
// 新增国家只需在 VALID_COUNTRIES 加一项（如 'sa'）。
//
// 解析优先级（App-ready）：
//   1) X-Country header（App 无子域名 / Web SSR 都走这个）
//   2) ?country= query（admin 显式切国家 / 旧调用兼容）
//   3) 默认 'ae'
//
// 约定：所有 controller 一律读 req.country（由中央中间件设置），
// 禁止各自再读 req.query.country 兜底，避免国家串桶（P0）。
Object.defineProperty(exports, "__esModule", { value: true });
exports.VALID_COUNTRIES = void 0;
exports.isValidCountry = isValidCountry;
exports.resolveCountry = resolveCountry;
const VALID_COUNTRIES = ['ae', 'vn'];
exports.VALID_COUNTRIES = VALID_COUNTRIES;
const DEFAULT_COUNTRY = 'ae';
function isValidCountry(c) {
    return typeof c === 'string' && VALID_COUNTRIES.includes(c);
}
function resolveCountry(req) {
    const header = req && req.headers ? req.headers['x-country'] : undefined;
    if (isValidCountry(header))
        return header;
    const q = req && req.query ? req.query.country : undefined;
    if (isValidCountry(q))
        return q;
    return DEFAULT_COUNTRY;
}
