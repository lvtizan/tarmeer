"use strict";
// 国家归属判定中心 —— 收敛此前散落在各 controller 的 phone 前缀判定与询盘国家过滤 SQL。
// 加新国家时只改本文件的 COUNTRY_PHONE_PREFIXES / POSITIVE_COUNTRIES，调用方零改动。
// 归属总表见 docs/testing/country-bucketing.md，隔离铁律见 AGENTS.md。
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCountry = detectCountry;
exports.inquiryCountryWhere = inquiryCountryWhere;
exports.phoneCountryWhere = phoneCountryWhere;
exports.COUNTRY_PHONE_PREFIXES = void 0;

// 各国手机号前缀（正向匹配国家）。ae 是残余/默认桶，无正向前缀。
const COUNTRY_PHONE_PREFIXES = {
    vn: ['+84%', '084%'],
    sa: ['+966%', '00966%'],
};
exports.COUNTRY_PHONE_PREFIXES = COUNTRY_PHONE_PREFIXES;
// 正向匹配的国家（有专属 phone 前缀 / company country）。ae = 不属于任何正向国家的残余桶。
const POSITIVE_COUNTRIES = ['vn', 'sa'];

// 写入口：按手机号前缀判定国家归属（+84/084=vn，+966/00966=sa，否则 ae）。
function detectCountry(rawPhone) {
    const p = String(rawPhone || '');
    if (p.startsWith('+84') || p.startsWith('084')) return 'vn';
    if (p.startsWith('+966') || p.startsWith('00966')) return 'sa';
    return 'ae';
}

// 读接口（仅 phone 维度，用于 users/homeowner 列表 —— 这些表/视图按 phone 前缀分国家）。
// 生成「phone 属于 country」WHERE 片段（前导 " AND ..."）。phoneCol 传列表达式（如 'u.phone' / 'hp.phone'）。
// 行为保证：无 sa 数据时 ae/vn 结果与旧两国逻辑逐字等价。
function phoneCountryWhere(country, phoneCol) {
    if (POSITIVE_COUNTRIES.includes(country)) {
        const pfx = COUNTRY_PHONE_PREFIXES[country];
        const ors = pfx.map(() => `${phoneCol} LIKE ?`).join(' OR ');
        return { sql: ` AND (${ors})`, params: [...pfx] };
    }
    // ae = 残余桶：phone 不匹配任何正向国家前缀
    const allPfx = POSITIVE_COUNTRIES.flatMap((c) => COUNTRY_PHONE_PREFIXES[c]);
    const nots = allPfx.map(() => `${phoneCol} NOT LIKE ?`).join(' AND ');
    return { sql: ` AND (${phoneCol} IS NULL OR (${nots}))`, params: [...allPfx] };
}

// 读接口：生成「属于 country 的询盘」WHERE 片段（前导 " AND ..."）。
// phoneCol/companyCol 传 SQL 列表达式（如 'di.phone' / 'di.company_id' 或 'phone' / 'company_id'）。
// 行为保证：当库中无 sa 数据（无 sa 公司、无 +966 电话）时，ae/vn 结果与旧两国逻辑逐字等价。
function inquiryCountryWhere(country, phoneCol, companyCol) {
    if (POSITIVE_COUNTRIES.includes(country)) {
        const pfx = COUNTRY_PHONE_PREFIXES[country];
        const phoneOr = pfx.map(() => `${phoneCol} LIKE ?`).join(' OR ');
        return {
            sql: ` AND (${companyCol} IN (SELECT id FROM company_profiles WHERE country = ?) OR ${phoneOr})`,
            params: [country, ...pfx],
        };
    }
    // ae = 残余桶：不属于任何正向国家（既不在 vn/sa 公司名下，phone 也不匹配任何正向前缀）。
    const allPfx = POSITIVE_COUNTRIES.flatMap((c) => COUNTRY_PHONE_PREFIXES[c]);
    const phoneNot = allPfx.map(() => `${phoneCol} NOT LIKE ?`).join(' AND ');
    const inPlaceholders = POSITIVE_COUNTRIES.map(() => '?').join(',');
    return {
        sql: ` AND (${companyCol} IS NULL OR ${companyCol} NOT IN (SELECT id FROM company_profiles WHERE country IN (${inPlaceholders}))) AND (${phoneCol} IS NULL OR (${phoneNot}))`,
        params: [...POSITIVE_COUNTRIES, ...allPfx],
    };
}
