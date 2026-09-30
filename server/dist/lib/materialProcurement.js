"use strict";
const { parseJsonArray } = require('./productJsonFields');
const CJK = /[\u3400-\u9fff]/;
const DEFAULT_NAME = /^(material|materials|product|new material|new product|untitled|产品|商品|新材料)$/i;
function validImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2000 || value.trim() !== value || /placeholder|no-image/i.test(value) || /[\\\x00-\x20]/.test(value)) return false;
  const local = value.startsWith('/uploads/') || value.startsWith('/images/');
  if (!local && !value.startsWith('https://')) return false;
  try {
    const url = new URL(value,'https://tarmeer.invalid');
    const pathname = decodeURIComponent(url.pathname);
    if (local && (!/^\/(?:uploads|images)\//.test(pathname) || decodeURIComponent(value.split('?')[0]).split('/').some(s=>s==='..' || s==='.'))) return false;
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || !url.hostname || pathname.split('/').some(s=>s==='..' || s==='.')) return false;
    return /[^/.][^/]*\.(?:png|jpe?g|webp|gif|avif)$/i.test(pathname);
  } catch { return false; }
}
function specsOf(row) { return parseJsonArray(row.specs); }
function metadata(row) {
  const specs = specsOf(row);
  const get = (...labels) => {
    const spec = specs.find(s => s && labels.includes(String(s.label || '').trim().toLowerCase()));
    return spec && typeof spec.value === 'string' ? spec.value.trim() || null : null;
  };
  const lead = get('lead time days', 'lead time (days)', 'lead time', '交期天数');
  const match = lead && lead.match(/^(\d{1,4})(?:\s*days?)?$/i);
  const availability = get('availability', '供货状态');
  return { model: get('model', 'model number', '型号'), material: get('material', '材质'),
    availability: ['uae_stock','china_order','made_to_order'].includes(availability) ? availability : null,
    lead_time_days: match ? Number(match[1]) : null, price_basis: get('price basis', '报价依据'),
    quality_flags: qualityFlags(row) };
}
function modelOnly(value) {
  const text = String(value || '').trim();
  if (!/\d/.test(text) || !/^[A-Za-z0-9._/# -]+$/.test(text)) return false;
  if (!/\s/.test(text)) return true;
  return text.split(/\s+/).every(token => /\d/.test(token) || /^(?:[A-Za-z]{1,3}|model|sku)$/i.test(token));
}
function qualityFlags(row) {
  const flags = [];
  const translated = typeof row.title_translated === 'string' ? row.title_translated.trim() : '';
  const title = translated || String(row.title || '').trim();
  if (!title || DEFAULT_NAME.test(title) || modelOnly(title)) flags.push('incomplete');
  if (CJK.test(title)) flags.push('translation');
  if (!row.category || !validImageUrl(row.image_url) || !(Number(row.price) > 1) || !row.price_unit || !row.price_currency) flags.push('incomplete');
  return [...new Set(flags)];
}
async function validateProduct(db, body, { partial = false, country = null, existing = {} } = {}) {
  const has = k => Object.prototype.hasOwnProperty.call(body, k);
  if (!partial || has('title')) {
    const originalOmitted = body.title == null || (typeof body.title === 'string' && !body.title.trim());
    if (!(country === 'ae' && originalOmitted) && (typeof body.title !== 'string' || !body.title.trim() || DEFAULT_NAME.test(body.title.trim()) || body.title.length > 255))
      return 'A descriptive product name is required; default names are not allowed.';
  }
  if (country === 'ae' && (!partial || has('title') || has('title_translated'))) {
    const effective = {...existing, ...body};
    const translated = typeof effective.title_translated === 'string' ? effective.title_translated.trim() : '';
    const original = typeof effective.title === 'string' ? effective.title.trim() : '';
    const display = translated || original;
    if (!display || CJK.test(display) || DEFAULT_NAME.test(display) || modelOnly(display) || !/[A-Za-z]{2}/.test(display))
      return 'An English product name describing the product type is required. Keep the model in specifications and the original name separately.';
  }
  if (!partial || has('category')) {
    if (typeof body.category !== 'string' || !body.category.trim()) return 'A valid product category is required.';
    const [cats] = await db.execute('SELECT value FROM product_categories WHERE value = ? AND is_enabled = 1 LIMIT 1', [body.category]);
    if (!cats.length) return 'Select an enabled product category.';
  }
  if (!partial || has('image_url') || has('image_urls')) {
    const images = Array.isArray(body.image_urls) ? body.image_urls : [body.image_url];
    if (!images.length || images.some(v => !validImageUrl(v))) return 'A valid product image is required.';
  }
  if (has('title_translated') && body.title_translated !== null && body.title_translated !== '' && (typeof body.title_translated !== 'string' || !body.title_translated.trim() || body.title_translated.length > 255 || DEFAULT_NAME.test(body.title_translated.trim()))) return 'Translated product name must be descriptive.';
  return null;
}
// JSON_TABLE only reads canonical specification labels; no availability is inferred from supplier origin.
function specSql(labels) {
  return `(SELECT jt.val FROM JSON_TABLE(COALESCE(p.specs, JSON_ARRAY()), '$[*]' COLUMNS (label VARCHAR(100) PATH '$.label', val VARCHAR(500) PATH '$.value')) jt WHERE LOWER(TRIM(jt.label)) IN (${labels.map(v => `'${v}'`).join(',')}) LIMIT 1)`;
}
const SQL = { material: specSql(['material','材质']), availability: specSql(['availability','供货状态']), lead: specSql(['lead time days','lead time (days)','lead time','交期天数']) };
function feedFilters(query) {
  const clauses = [], params = [];
  const add = (sql, value) => { clauses.push(sql); params.push(value); };
  const text = key => typeof query[key] === 'string' ? query[key].trim() : '';
  const currency = text('currency'), unit = text('unit'), sort = text('sort') || 'relevance';
  if (currency && !['AED','CNY','USD','VND'].includes(currency)) return {error:'Invalid currency.'};
  if (unit.length > 40) return {error:'Invalid unit.'};
  if (!['relevance','newest','price_asc','price_desc'].includes(sort)) return {error:'Invalid sort.'};
  if (sort.startsWith('price_') && (!currency || !unit)) return {error:'Price sorting requires currency and unit.'};
  const q = text('q').slice(0, 120);
  if (q) { const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%'; clauses.push('(p.title LIKE ? OR p.title_translated LIKE ? OR p.category LIKE ? OR CAST(p.specs AS CHAR) LIKE ?)'); params.push(like,like,like,like); }
  if (query.spec !== undefined && query.spec !== '') {
    if (typeof query.spec !== 'string' || !query.spec.trim() || query.spec.length > 120 || !text('category')) return {error:'Specification filtering requires a category and 1–120 characters.'};
    const like = '%' + query.spec.trim().replace(/[\\%_]/g, '\\$&') + '%';
    add(`EXISTS (SELECT 1 FROM JSON_TABLE(COALESCE(p.specs, JSON_ARRAY()), '$[*]' COLUMNS (val VARCHAR(2000) PATH '$.value')) specification WHERE specification.val LIKE ?)`,like);
  }
  if (currency) add('p.price_currency = ?', currency);
  if (unit === 'SQM') add("(p.price_unit = ? OR (p.price_unit = '元/㎡' AND p.price_currency = 'CNY'))", unit);
  else if (unit) add('p.price_unit = ?', unit);
  if (text('origin')) { if (!['china','dubai'].includes(text('origin'))) return {error:'Invalid origin.'}; add('sp.origin = ?',text('origin')); }
  if (text('material')) add(`LOWER(${SQL.material}) = LOWER(?)`,text('material').slice(0,100));
  if (text('availability')) { if (!['uae_stock','china_order','made_to_order'].includes(text('availability'))) return {error:'Invalid availability.'}; add(`${SQL.availability} = ?`,text('availability')); }
  for (const [key, op] of [['price_min','>='],['price_max','<=']]) {
    if (query[key] !== undefined && query[key] !== '') {
      const value = Number(query[key]); if (!Number.isFinite(value) || value < 0 || !currency || !unit) return {error:'Price filters require a valid amount, currency and unit.'};
      add(`p.price ${op} ?`,value); clauses.push('p.price > 1');
    }
  }
  if (query.lead_time_max !== undefined && query.lead_time_max !== '') {
    const value = Number(query.lead_time_max); if (!Number.isInteger(value) || value < 0 || value > 9999) return {error:'Invalid lead_time_max.'};
    clauses.push(`${SQL.lead} REGEXP '^[0-9]{1,4}( *days?)?$'`); add(`CAST(${SQL.lead} AS UNSIGNED) <= ?`,value);
  }
  if (sort.startsWith('price_')) clauses.push('p.price > 1');
  const quality = "(TRIM(COALESCE(NULLIF(p.title_translated,''),p.title,'')) <> '' AND LOWER(TRIM(COALESCE(NULLIF(p.title_translated,''),p.title,''))) NOT IN ('material','product','new material','new product') AND COALESCE(NULLIF(p.title_translated,''),p.title,'') NOT REGEXP '[一-鿿]' AND COALESCE(p.category,'') <> '' AND p.price > 1 AND p.price_currency IS NOT NULL AND p.price_unit IS NOT NULL)";
  return {clauses,params,order: sort === 'newest' ? 'p.id DESC' : sort.startsWith('price_') ? `p.price ${sort === 'price_asc' ? 'ASC' : 'DESC'}, p.id DESC` : `${quality} DESC, p.id DESC`, custom: Object.keys(query).some(k=>['q','spec','currency','unit','origin','material','availability','lead_time_max','price_min','price_max','sort'].includes(k))};
}
function validatePriceContext(body) {
  if (!(Number(body.price) > 0)) return null;
  if (!['AED','CNY','USD','VND'].includes(body.price_currency)) return 'Select an explicit supported price currency.';
  if (typeof body.price_unit !== 'string' || !body.price_unit.trim() || body.price_unit.trim().length > 32) return 'Select a valid price unit.';
  return null;
}
async function validateSupplierPublication(db, supplierId) {
  const [suppliers] = await db.execute('SELECT country FROM supplier_profiles WHERE id = ?', [supplierId]);
  if (!suppliers.length) return 'Supplier not found.';
  const [products] = await db.execute('SELECT id, title, title_translated, category, image_url FROM supplier_products WHERE supplier_profile_id = ?', [supplierId]);
  for (const product of products) {
    const error = await validateProduct(db, product, {country:suppliers[0].country});
    if (error) return `Product #${product.id}: ${error}`;
  }
  return null;
}
module.exports = {metadata,qualityFlags,validateProduct,feedFilters,validateSupplierPublication,validatePriceContext,validImageUrl};
