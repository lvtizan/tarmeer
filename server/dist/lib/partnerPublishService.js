"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool = require("../config/database").default;

const PLACEHOLDER = "/images/partner/placeholder.webp";
const LANG_BY_COUNTRY = { ae: "en", vn: "vi", sa: "ar" };

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
  const any = Object.values(map).find((v) => typeof v === "string" && v.trim());
  return any || null;
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

// 确保 (partner, country) 有一行 supplier_profiles；company 为可选的最新企业 payload
async function ensurePartnerSupplier(partner, country, company) {
  const lang = LANG_BY_COUNTRY[country] || partner.default_lang || "en";
  const defLang = partner.default_lang || "en";
  const name = (company && pickText(company.company_name, lang, defLang)) || `Partner ${partner.id}`;
  const desc = company ? pickText(company.description, lang, defLang) : null;
  const addr = company ? pickText(company.store_address, lang, defLang) : null;
  const phone = company?.contact_phone || null;
  const website = company?.website || null;
  const whatsapp = company?.whatsapp || null;
  const [existing] = await pool.execute(
    "SELECT id FROM supplier_profiles WHERE source='partner' AND partner_id=? AND country=? LIMIT 1",
    [partner.id, country]);
  if (existing[0]) {
    if (company) {
      // company payload provided: update all fields including company_name
      await pool.execute(
        "UPDATE supplier_profiles SET company_name=?, description=COALESCE(?,description), store_address=COALESCE(?,store_address), contact_phone=COALESCE(?,contact_phone), website=COALESCE(?,website), whatsapp=COALESCE(?,whatsapp), status='approved', is_published=1 WHERE id=?",
        [name, desc, addr, phone, website, whatsapp, existing[0].id]);
    } else {
      // no company payload: only ensure approved+published, don't overwrite company_name
      await pool.execute(
        "UPDATE supplier_profiles SET status='approved', is_published=1 WHERE id=?",
        [existing[0].id]);
    }
    return existing[0].id;
  }
  let slug = `${slugify(name) || "partner-" + partner.id}-${country}-p${partner.id}`;
  const [clash] = await pool.execute("SELECT id FROM supplier_profiles WHERE slug=? LIMIT 1", [slug]);
  if (clash[0]) slug = `${slug}-${Date.now() % 100000}`;
  const [r] = await pool.execute(
    "INSERT INTO supplier_profiles (supplier_user_id, company_name, slug, description, store_address, contact_phone, website, whatsapp, country, origin, source, partner_id, status, is_published) VALUES (NULL,?,?,?,?,?,?,?,?, 'china', 'partner', ?, 'approved', 1)",
    [name, slug, desc, addr, phone, website, whatsapp, country, partner.id]);
  return r.insertId;
}

// 发布一条商品暂存行到所有国家（扇出）。imageResolver(urls, externalId)→Promise<string|null> 可选，失败用占位图。
async function publishProduct(partner, stagingRow, imageResolver) {
  const item = typeof stagingRow.payload_json === "string" ? JSON.parse(stagingRow.payload_json) : stagingRow.payload_json;
  const defLang = partner.default_lang || "en";
  const removed = stagingRow.listing_status === "inactive" || stagingRow.is_deleted === 1 || stagingRow.is_deleted === true;
  let imageUrl = PLACEHOLDER;
  if (!removed && imageResolver && Array.isArray(item.images) && item.images.length) {
    try { const u = await imageResolver(item.images, stagingRow.external_id); if (u) imageUrl = u; }
    catch (e) { console.error("[partner-publish] image resolve failed", stagingRow.external_id, e.message); }
  }
  for (const country of countriesOf(partner)) {
    const lang = LANG_BY_COUNTRY[country] || defLang;
    const supplierId = await ensurePartnerSupplier(partner, country, null);
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

// 发布企业：更新该 partner 所有国家 supplier_profiles 的企业字段
async function publishCompany(partner, companyPayload) {
  for (const country of countriesOf(partner)) {
    await ensurePartnerSupplier(partner, country, companyPayload);
  }
}

module.exports = { slugify, pickText, pickArray, countriesOf, ensurePartnerSupplier, publishProduct, unpublishProduct, publishCompany, PLACEHOLDER };
