"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool = require("../config/database").default;

const PLACEHOLDER = "/images/partner/placeholder.webp";
const LANG_BY_COUNTRY = { ae: "en", vn: "vi", sa: "ar" };

// 从 payload 或其 attributes 对象提取 supplier_id，标准化为字符串；缺失→空串
function supplierRefOf(obj) {
  const a = obj && obj.attributes;
  const v = (a && a.supplier_id) != null ? a.supplier_id : (obj && obj.supplier_id);
  return v != null ? String(v) : "";
}

function slugify(name) {
  return String(name || "").toLowerCase().trim()
    .replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
// 从「语言→值」对象取该国文案，缺则回退 default_lang，再回退任意非空
function pickText(map, lang, defLang) {
  if (map == null) return null;
  if (typeof map === "string") return map;
  if (typeof map !== "object") return null;
  if (map[lang]) return map[lang];
  if (map[defLang]) return map[defLang];
  return null; // 隔离铁律：缺目标语言/默认语言时留空，绝不回退到其它国家的语言
}
function pickArray(map, lang, defLang) {
  if (!map) return [];
  if (Array.isArray(map)) return map;
  return map[lang] || map[defLang] || [];
}
function countriesOf(partner) {
  const raw = partner.countries_json;
  // mysql2 may return JSON columns already parsed as native arrays
  if (Array.isArray(raw)) return raw;
  try { const c = JSON.parse(raw || "[]"); return Array.isArray(c) ? c : []; }
  catch { return []; }
}

// 确保 (partner, supplierRef, country) 有一行 supplier_profiles；company 为可选的最新企业 payload
// supplierRef = '' 时走单企业兼容路径（旧行为保持不变）
async function ensurePartnerSupplier(partner, country, company, supplierRef) {
  if (supplierRef == null) supplierRef = "";
  const lang = LANG_BY_COUNTRY[country] || partner.default_lang || "en";
  const defLang = partner.default_lang || "en";
  const name = (company && pickText(company.company_name, lang, defLang)) || `Partner ${partner.id}`;
  const desc = company ? pickText(company.description, lang, defLang) : null;
  const addr = company ? pickText(company.store_address, lang, defLang) : null;
  const phone = company?.contact_phone || null;
  const website = company?.website || null;
  const whatsapp = company?.whatsapp || null;
  // 按 (partner_id, partner_supplier_ref, country) 定位唯一 supplier_profiles 行
  const [existing] = await pool.execute(
    "SELECT id FROM supplier_profiles WHERE source='partner' AND partner_id=? AND COALESCE(partner_supplier_ref,'')=? AND country=? LIMIT 1",
    [partner.id, supplierRef, country]);
  if (existing[0]) {
    if (company) {
      // company payload provided: 更新资料字段，但不改 status/is_published——审核状态由后台管理员掌控
      // （防止 partner 更新把待审/已下架的供应商自动改回 approved，绕过人工审核）
      await pool.execute(
        "UPDATE supplier_profiles SET company_name=?, description=COALESCE(?,description), store_address=COALESCE(?,store_address), contact_phone=COALESCE(?,contact_phone), website=COALESCE(?,website), whatsapp=COALESCE(?,whatsapp), partner_supplier_ref=? WHERE id=?",
        [name, desc, addr, phone, website, whatsapp, supplierRef || null, existing[0].id]);
    }
    // no payload 分支：不再自动 approved+published，保留现有审核状态（无操作）
    return existing[0].id;
  }
  // slug 包含 supplierRef 保证多供应商间不碰撞
  const slugSuffix = supplierRef ? `-s${slugify(supplierRef).slice(0, 8)}` : "";
  let slug = `${slugify(name) || "partner-" + partner.id}-${country}-p${partner.id}${slugSuffix}`;
  const [clash] = await pool.execute("SELECT id FROM supplier_profiles WHERE slug=? LIMIT 1", [slug]);
  if (clash[0]) slug = `${slug}-${Date.now() % 100000}`;
  // 新上传的 partner 供应商建为 'pending'——需后台审核通过(status→approved)才在前端展示
  const [r] = await pool.execute(
    "INSERT INTO supplier_profiles (supplier_user_id, company_name, slug, description, store_address, contact_phone, website, whatsapp, country, origin, source, partner_id, partner_supplier_ref, status, is_published, published_at) VALUES (NULL,?,?,?,?,?,?,?,?, 'china', 'partner', ?, ?, 'pending', 1, NOW())",
    [name, slug, desc, addr, phone, website, whatsapp, country, partner.id, supplierRef || null]);
  return r.insertId;
}

// 发布一条商品暂存行到所有国家（扇出）。imageResolver(urls, externalId)→Promise<string|null> 可选，失败用占位图。
// 商品的 supplier_ref 决定它归属哪家供应商（每个国家各一行）。
async function publishProduct(partner, stagingRow, imageResolver) {
  const item = typeof stagingRow.payload_json === "string" ? JSON.parse(stagingRow.payload_json) : stagingRow.payload_json;
  const defLang = partner.default_lang || "en";
  const removed = stagingRow.listing_status === "inactive" || stagingRow.is_deleted === 1 || stagingRow.is_deleted === true;
  // 优先从暂存行的 supplier_ref 列读；fallback 从 payload attributes
  const supplierRef = stagingRow.supplier_ref != null ? stagingRow.supplier_ref : supplierRefOf(item);
  let imageUrl = PLACEHOLDER;
  if (!removed && imageResolver && Array.isArray(item.images) && item.images.length) {
    try { const u = await imageResolver(item.images, stagingRow.external_id); if (u) imageUrl = u; }
    catch (e) { console.error("[partner-publish] image resolve failed", stagingRow.external_id, e.message); }
  }
  for (const country of countriesOf(partner)) {
    const lang = LANG_BY_COUNTRY[country] || defLang;
    // 用商品自身的 supplierRef 找到对应供应商（而非全局的单一供应商）
    const supplierId = await ensurePartnerSupplier(partner, country, null, supplierRef);
    const [exist] = await pool.execute(
      "SELECT id FROM supplier_products WHERE supplier_profile_id=? AND source='partner' AND partner_external_id=? LIMIT 1",
      [supplierId, stagingRow.external_id]);
    if (removed) {
      if (exist[0]) await pool.execute("DELETE FROM supplier_products WHERE id=?", [exist[0].id]);
      continue;
    }
    const title = pickText(item.title, lang, defLang);
    const desc = pickText(item.description, lang, defLang);
    const catPath = pickArray(item.category_path, lang, defLang);
    const category = catPath.length ? catPath[catPath.length - 1] : (item.category || null);
    const imageUrls = JSON.stringify([imageUrl]);
    if (exist[0]) {
      await pool.execute(
        "UPDATE supplier_products SET title=?, description=?, category=?, image_url=?, image_urls=?, sort_order=? WHERE id=?",
        [title, desc, category, imageUrl, imageUrls, item.sort_order || 0, exist[0].id]);
    } else {
      await pool.execute(
        "INSERT INTO supplier_products (supplier_profile_id, title, description, category, image_url, image_urls, sort_order, source, partner_external_id) VALUES (?,?,?,?,?,?,?, 'partner', ?)",
        [supplierId, title, desc, category, imageUrl, imageUrls, item.sort_order || 0, stagingRow.external_id]);
    }
  }
}

// 撤下（reject）：删该商品所有国家 live 行
async function unpublishProduct(partner, externalId) {
  const [rows] = await pool.execute(
    "SELECT id FROM supplier_profiles WHERE source='partner' AND partner_id=?", [partner.id]);
  for (const sp of rows) {
    await pool.execute(
      "DELETE FROM supplier_products WHERE supplier_profile_id=? AND source='partner' AND partner_external_id=?",
      [sp.id, externalId]);
  }
}

// 发布企业：更新该 partner + supplierRef 在所有国家的 supplier_profiles 企业字段
async function publishCompany(partner, companyPayload, supplierRef) {
  if (supplierRef == null) supplierRef = supplierRefOf(companyPayload);
  for (const country of countriesOf(partner)) {
    await ensurePartnerSupplier(partner, country, companyPayload, supplierRef);
  }
}

module.exports = { slugify, pickText, pickArray, countriesOf, ensurePartnerSupplier, publishProduct, unpublishProduct, publishCompany, PLACEHOLDER };
