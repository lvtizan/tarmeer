"use strict";
// supplier_products JSON 列（specs / certifications / application_scenes）读写工具。
// 所有写入口（supplier 门户 / admin / partner-sync）共用，单一可信来源（spec: docs/plans/china-materials-revamp-spec.md §2.1）。
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonArrayOrNull = jsonArrayOrNull;
exports.parseJsonArray = parseJsonArray;
// 数组 → JSON 字符串落库；非数组 → null（写 SQL 时配合 COALESCE 忽略，防止误清空既有值）
function jsonArrayOrNull(v) {
    return Array.isArray(v) ? JSON.stringify(v) : null;
}
// 读取：mysql2 的 JSON 列可能返回已解析数组或字符串，统一转数组；不合法一律 []
function parseJsonArray(v) {
    if (Array.isArray(v))
        return v;
    if (v == null)
        return [];
    if (typeof v === 'string') {
        try {
            const parsed = JSON.parse(v);
            return Array.isArray(parsed) ? parsed : [];
        }
        catch {
            return [];
        }
    }
    return [];
}
