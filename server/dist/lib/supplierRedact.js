"use strict";
// 公开供应商去标识（仅公开接口用；后台 supplierAdminController 不得引用，管理员看真实数据）。
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskSupplierName = maskSupplierName;
exports.maskPhraseInText = maskPhraseInText;
exports.maskSupplierMentions = maskSupplierMentions;
exports.redactPublicSupplier = redactPublicSupplier;
exports.supplierPublicTitle = supplierPublicTitle;
/** 遮蔽自填文本(商品/项目/目录标题·简介)里出现的完整厂家名 + 品牌首词(≥4)，大小写不敏感。 */
function maskSupplierMentions(text, companyName) {
    if (typeof text !== 'string' || !companyName)
        return text;
    let out = maskPhraseInText(text, companyName);
    const brand = String(companyName).split(/\s+/)[0];
    if (brand && brand.length >= 4)
        out = maskPhraseInText(out, brand);
    return out;
}
/**
 * 公开供应商的“通用标题”：用品类而非真实厂家名，既藏身份又保 SEO 关键词。
 * categories 为 JSON 数组或字符串；取首个品类 → Title Case + " Supplier"。空则回退 "Building Materials Supplier"。
 * 例：["system_windows"] → "System Windows Supplier"。
 */
function supplierPublicTitle(categories) {
    let arr = categories;
    if (typeof arr === 'string') {
        try {
            arr = JSON.parse(arr);
        }
        catch {
            arr = [];
        }
    }
    const first = Array.isArray(arr) && arr[0] ? String(arr[0]) : '';
    const label = first
        ? first.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Building Materials';
    return `${label} Supplier`;
}
/** 厂家名整体遮蔽：字母/数字/CJK 字符 → *，保留空格与符号(& - 等)。 */
function maskSupplierName(name) {
    if (!name)
        return name;
    return String(name).replace(/[\p{L}\p{N}]/gu, '*');
}
/** 把 text 中出现的 phrase（大小写不敏感、整词短语）替换成等长的星号遮蔽。 */
function maskPhraseInText(text, phrase) {
    if (!text || !phrase)
        return text;
    const esc = String(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
        return String(text).replace(new RegExp(esc, 'gi'), (m) => maskSupplierName(m));
    }
    catch {
        return text;
    }
}
/**
 * 公开供应商去标识：厂家名遮蔽 + 简介里出现的完整厂家名/品牌首词(≥4)一并遮蔽（大小写不敏感）；
 * 地址/地图/坐标/联系方式/logo/账号信息一律隐藏。只保留产品相关信息（产品、项目、目录、品类、产地）。
 */
function redactPublicSupplier(row) {
    if (!row)
        return row;
    const name = row.company_name || '';
    // 简介里可能同时出现英文名与中文名(name_zh)，两者都要遮蔽；name_zh 本身直接隐藏。
    let desc = maskSupplierMentions(row.description, name);
    if (row.name_zh)
        desc = maskSupplierMentions(desc, row.name_zh);
    return {
        ...row,
        company_name: maskSupplierName(name),
        name_zh: null,
        description: desc,
        store_address: null,
        google_maps_url: null,
        store_lat: null,
        store_lng: null,
        has_physical_store: 0,
        contact_phone: null,
        whatsapp: null,
        website: null,
        logo_url: null,
        user_email: null,
        user_name: null,
    };
}
