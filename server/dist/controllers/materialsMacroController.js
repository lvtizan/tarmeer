"use strict";
// 材料大类聚合（By Material 浏览）——把供应商自由标签归一到干净大类，聚合供应商数/产品数/代表图。
// 数据源：supplier_profiles.categories(逗号分隔标签) + supplier_products(有图)。国家隔离：只算 req.country。
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMacroCategories = getMacroCategories;
exports.getMacroProducts = getMacroProducts;
exports.getMaterialSearch = getMaterialSearch;
exports.getMegaMenu = getMegaMenu;
exports.getPopularProducts = getPopularProducts;
const database_1 = require("../config/database");

// 原始标签 → 英文子类名（mega 浮层 chips 用）
const SUBTAG_LABEL = {
  furniture: 'General', italian_minimal: 'Italian Minimalist', italian_luxury: 'Italian Luxury',
  modern_functional: 'Modern Functional', european_style: 'European', american_style: 'American',
  french_style: 'French', wabi_sabi: 'Wabi-sabi', childrens_furn: "Children's", outdoor_furn: 'Outdoor',
  office_furn: 'Office', hotel_furn: 'Hotel', beds: 'Beds', bedding: 'Bedding', wardrobe: 'Wardrobe',
  whole_house: 'Whole-house', smart_home: 'Smart Home', lighting: 'General', lighting_new: 'New Arrivals',
  stone: 'Marble & Stone', stone_materials: 'Stone Materials', flooring: 'Flooring', kitchen: 'Kitchen',
  sanitary_ware: 'Sanitary Ware', bath: 'Bath', system_windows: 'System Windows', entry_doors: 'Entry Doors',
  interior_doors: 'Interior Doors', stairs: 'Stairs', plants: 'Plants', curtains: 'Curtains',
  new_indoor_decorative: 'Indoor Decorative', outdoor_deco: 'Outdoor Decor',
};

// LIKE 转义(防 % _ 被当通配) + 包裹
const likeParam = (q) => '%' + String(q).replace(/[\\%_]/g, (c) => '\\' + c) + '%';

// 解析 supplier_profiles.categories —— 库里混合格式：JSON 数组 ["furniture","other"] 或逗号串 furniture,other
// 两种都要解析，否则 JSON 数组格式的供应商标签匹配不上 TAG_TO_MACRO → 大类漏计。
function parseTags(raw) {
  if (!raw) return [];
  const s = String(raw).trim();
  if (s.startsWith('[')) {
    try {
      const a = JSON.parse(s);
      if (Array.isArray(a)) return a.map((x) => String(x).trim()).filter(Boolean);
    } catch (e) { /* 落到逗号 split */ }
  }
  return s.split(',').map((t) => t.trim()).filter(Boolean);
}

// 供应商自由标签 → 干净大类（英文；未列出的标签(如 other)不计入大类浏览）
const TAG_TO_MACRO = {
  furniture: 'furniture', italian_minimal: 'furniture', italian_luxury: 'furniture', modern_functional: 'furniture',
  european_style: 'furniture', american_style: 'furniture', french_style: 'furniture', wabi_sabi: 'furniture',
  childrens_furn: 'furniture', outdoor_furn: 'furniture', office_furn: 'furniture', hotel_furn: 'furniture',
  beds: 'furniture', bedding: 'furniture', wardrobe: 'furniture', whole_house: 'furniture', smart_home: 'furniture',
  lighting: 'lighting', lighting_new: 'lighting',
  stone: 'stone', stone_materials: 'stone',
  flooring: 'flooring',
  kitchen: 'kitchen-bath', sanitary_ware: 'kitchen-bath', bath: 'kitchen-bath',
  system_windows: 'doors-windows', entry_doors: 'doors-windows', interior_doors: 'doors-windows',
  stairs: 'stairs', plants: 'plants', curtains: 'curtains',
  new_indoor_decorative: 'decorative', outdoor_deco: 'decorative',
};

const MACRO_LABEL = {
  furniture: 'Furniture', lighting: 'Lighting', stone: 'Stone & Surfaces', flooring: 'Flooring',
  'kitchen-bath': 'Kitchen & Bath', 'doors-windows': 'Doors & Windows', stairs: 'Stairs',
  plants: 'Plants & Landscaping', curtains: 'Curtains', decorative: 'Decorative Surfaces',
};

// GET /api/suppliers/macro-categories — By Material 大类列表
async function getMacroCategories(req, res) {
  try {
    const country = (typeof req.query.country === 'string' && req.query.country) || req.country || 'ae';
    const [sup] = await database_1.default.query(
      `SELECT sp.id, sp.categories,
         (SELECT image_url FROM supplier_products p WHERE p.supplier_profile_id=sp.id AND p.image_url IS NOT NULL AND p.image_url<>'' ORDER BY p.sort_order,p.id LIMIT 1) img,
         (SELECT COUNT(*) FROM supplier_products p WHERE p.supplier_profile_id=sp.id AND p.image_url IS NOT NULL AND p.image_url<>'') pcnt
       FROM supplier_profiles sp
       WHERE sp.country = ? AND sp.status='approved' AND sp.is_published=1`,
      [country]
    );
    const bucket = {};
    for (const s of sup) {
      const tags = parseTags(s.categories);
      const macros = [...new Set(tags.map(t => TAG_TO_MACRO[t]).filter(Boolean))];
      // 只有画册、没有产品的供应商不计入 By-Material：该页只展示产品，若计数会导致"数字≠展示内容"
      if ((Number(s.pcnt) || 0) === 0) continue;
      for (const m of macros) {
        if (!bucket[m]) bucket[m] = { key: m, label: MACRO_LABEL[m], supplierCount: 0, productCount: 0, image: null };
        bucket[m].supplierCount += 1;
        bucket[m].productCount += Number(s.pcnt) || 0;
        if (!bucket[m].image && s.img) bucket[m].image = s.img;
      }
    }
    const macros = Object.values(bucket).sort((a, b) => b.productCount - a.productCount);
    res.json({ macros, country });
  } catch (error) {
    console.error('getMacroCategories error:', error);
    res.status(500).json({ error: 'Failed to load material categories.' });
  }
}

// GET /api/suppliers/macro-categories/:key/products — 某大类下聚合的供应商产品(穿透到公司)
async function getMacroProducts(req, res) {
  try {
    const country = (typeof req.query.country === 'string' && req.query.country) || req.country || 'ae';
    const key = String(req.params.key || '');
    const label = MACRO_LABEL[key];
    if (!label) return res.status(404).json({ error: 'Unknown category.' });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(48, Math.max(1, parseInt(req.query.limit) || 24));
    const offset = (page - 1) * limit;
    // 1) 找属于该大类的 AE 供应商
    const [sup] = await database_1.default.query(
      `SELECT id, slug, company_name, categories FROM supplier_profiles
       WHERE country = ? AND status='approved' AND is_published=1`,
      [country]
    );
    const ids = [];
    const supMeta = {};
    for (const s of sup) {
      const tags = parseTags(s.categories);
      if (tags.some(t => TAG_TO_MACRO[t] === key)) {
        ids.push(s.id);
        supMeta[s.id] = { slug: s.slug, name: s.company_name };
      }
    }
    if (ids.length === 0) return res.json({ label, key, products: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    // 2) 这些供应商的有图产品
    const placeholders = ids.map(() => '?').join(',');
    const [cntRows] = await database_1.default.query(
      `SELECT COUNT(*) total FROM supplier_products WHERE supplier_profile_id IN (${placeholders}) AND image_url IS NOT NULL AND image_url<>''`,
      ids
    );
    const total = cntRows[0].total;
    const [rows] = await database_1.default.query(
      `SELECT id, supplier_profile_id, title, title_translated, image_url, category
       FROM supplier_products
       WHERE supplier_profile_id IN (${placeholders}) AND image_url IS NOT NULL AND image_url<>''
       ORDER BY sort_order, id
       LIMIT ${limit} OFFSET ${offset}`,
      ids
    );
    const products = rows.map(r => ({
      id: r.id,
      title: r.title_translated || r.title || 'Product',
      image_url: r.image_url,
      supplier_slug: supMeta[r.supplier_profile_id] ? supMeta[r.supplier_profile_id].slug : null,
      supplier_name: supMeta[r.supplier_profile_id] ? supMeta[r.supplier_profile_id].name : null,
    }));
    res.json({ label, key, products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('getMacroProducts error:', error);
    res.status(500).json({ error: 'Failed to load category products.' });
  }
}

// GET /api/suppliers/popular-products?country=&limit= — 按热度(供应商 weight_score 代理)展示单品，每供应商≤2 保多样
async function getPopularProducts(req, res) {
  try {
    const country = (typeof req.query.country === 'string' && req.query.country) || req.country || 'ae';
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit) || 16));
    const [rows] = await database_1.default.query(
      `SELECT p.id, COALESCE(p.title_translated, p.title, 'Product') AS title, p.image_url,
         sp.slug AS supplier_slug, sp.company_name AS supplier_name
       FROM supplier_products p
       JOIN supplier_profiles sp ON sp.id = p.supplier_profile_id
       WHERE sp.country=? AND sp.status='approved' AND sp.is_published=1 AND p.image_url IS NOT NULL AND p.image_url<>''
       ORDER BY COALESCE(sp.weight_score,0) DESC, p.sort_order, p.id`,
      [country]
    );
    const perSup = {};
    const out = [];
    for (const r of rows) {
      const c = perSup[r.supplier_slug] || 0;
      if (c >= 2) continue; // 每供应商最多 2 个，避免一家刷屏
      perSup[r.supplier_slug] = c + 1;
      out.push(r);
      if (out.length >= limit) break;
    }
    res.json({ products: out });
  } catch (error) {
    console.error('getPopularProducts error:', error);
    res.status(500).json({ error: 'Failed to load popular products.' });
  }
}

// GET /api/materials/search?q=&type=products|suppliers&country=&page= — 全文搜索(hub 大搜索)
async function getMaterialSearch(req, res) {
  try {
    const country = (typeof req.query.country === 'string' && req.query.country) || req.country || 'ae';
    const type = req.query.type === 'suppliers' ? 'suppliers' : 'products';
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(48, Math.max(1, parseInt(req.query.limit) || 24));
    const offset = (page - 1) * limit;
    if (!q) return res.json({ type, q, results: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    const like = likeParam(q);

    if (type === 'suppliers') {
      // 供应商：按公司名 / 品类标签模糊搜（country 参数比较，无 collation 问题）
      const [cntRows] = await database_1.default.query(
        `SELECT COUNT(*) total FROM supplier_profiles sp
         WHERE sp.country=? AND sp.status='approved' AND sp.is_published=1
           AND (sp.company_name LIKE ? OR sp.categories LIKE ?)`,
        [country, like, like]
      );
      const total = cntRows[0].total;
      const [rows] = await database_1.default.query(
        `SELECT sp.id, sp.slug, sp.company_name, sp.origin, sp.cover_image_url, sp.logo_url,
           (SELECT image_url FROM supplier_products p WHERE p.supplier_profile_id=sp.id AND p.image_url IS NOT NULL AND p.image_url<>'' ORDER BY p.sort_order,p.id LIMIT 1) first_product_image
         FROM supplier_profiles sp
         WHERE sp.country=? AND sp.status='approved' AND sp.is_published=1
           AND (sp.company_name LIKE ? OR sp.categories LIKE ?)
         ORDER BY (sp.company_name LIKE ?) DESC, sp.id DESC
         LIMIT ${limit} OFFSET ${offset}`,
        [country, like, like, like]
      );
      return res.json({ type, q, results: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    }

    // products：按产品标题(原/译) / 品类模糊搜，join 供应商取国家 + 公司
    const [cntRows] = await database_1.default.query(
      `SELECT COUNT(*) total FROM supplier_products p
       JOIN supplier_profiles sp ON sp.id=p.supplier_profile_id
       WHERE sp.country=? AND sp.status='approved' AND sp.is_published=1 AND p.image_url IS NOT NULL AND p.image_url<>''
         AND (p.title LIKE ? OR p.title_translated LIKE ? OR p.category LIKE ?)`,
      [country, like, like, like]
    );
    const total = cntRows[0].total;
    const [rows] = await database_1.default.query(
      `SELECT p.id, COALESCE(p.title_translated, p.title, 'Product') AS title, p.image_url, p.category,
         sp.slug AS supplier_slug, sp.company_name AS supplier_name
       FROM supplier_products p
       JOIN supplier_profiles sp ON sp.id=p.supplier_profile_id
       WHERE sp.country=? AND sp.status='approved' AND sp.is_published=1 AND p.image_url IS NOT NULL AND p.image_url<>''
         AND (p.title LIKE ? OR p.title_translated LIKE ? OR p.category LIKE ?)
       ORDER BY (p.title LIKE ? OR p.title_translated LIKE ?) DESC, p.sort_order, p.id
       LIMIT ${limit} OFFSET ${offset}`,
      [country, like, like, like, like, like]
    );
    return res.json({ type, q, results: rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error('getMaterialSearch error:', error);
    res.status(500).json({ error: 'Search failed.' });
  }
}

// GET /api/materials/mega-menu?country= — hub 左目录 + 每类子类 + 精选供应商（一次返回）
async function getMegaMenu(req, res) {
  try {
    const country = (typeof req.query.country === 'string' && req.query.country) || req.country || 'ae';
    const [sup] = await database_1.default.query(
      `SELECT sp.id, sp.slug, sp.company_name, sp.categories, sp.cover_image_url, sp.logo_url,
         (SELECT image_url FROM supplier_products p WHERE p.supplier_profile_id=sp.id AND p.image_url IS NOT NULL AND p.image_url<>'' ORDER BY p.sort_order,p.id LIMIT 1) img,
         (SELECT COUNT(*) FROM supplier_products p WHERE p.supplier_profile_id=sp.id AND p.image_url IS NOT NULL AND p.image_url<>'') pcnt
       FROM supplier_profiles sp
       WHERE sp.country=? AND sp.status='approved' AND sp.is_published=1`,
      [country]
    );
    const macros = {};
    for (const s of sup) {
      const pcnt = Number(s.pcnt) || 0;
      if (pcnt === 0) continue; // 只算有产品的供应商（与 By-Material 口径一致）
      const tags = parseTags(s.categories);
      const macroSet = new Set();
      for (const t of tags) {
        const m = TAG_TO_MACRO[t];
        if (!m) continue;
        macroSet.add(m);
        if (!macros[m]) macros[m] = { key: m, label: MACRO_LABEL[m], productCount: 0, supplierCount: 0, subs: {}, suppliers: [] };
        // 子类计数
        if (!macros[m].subs[t]) macros[m].subs[t] = { tag: t, label: SUBTAG_LABEL[t] || t, count: 0 };
        macros[m].subs[t].count += 1;
      }
      // 该供应商计入其所属每个大类的精选池(带图) + 计数
      const supImg = s.cover_image_url || s.img || s.logo_url || null;
      for (const m of macroSet) {
        macros[m].productCount += pcnt;
        macros[m].supplierCount += 1;
        if (supImg) macros[m].suppliers.push({ slug: s.slug, name: s.company_name, image: supImg, pcnt });
      }
    }
    const out = Object.values(macros).map((m) => ({
      key: m.key,
      label: m.label,
      productCount: m.productCount,
      supplierCount: m.supplierCount,
      subcategories: Object.values(m.subs).sort((a, b) => b.count - a.count).slice(0, 8),
      featuredSuppliers: m.suppliers.sort((a, b) => b.pcnt - a.pcnt).slice(0, 3),
    })).sort((a, b) => b.productCount - a.productCount);
    res.json({ macros: out, country });
  } catch (error) {
    console.error('getMegaMenu error:', error);
    res.status(500).json({ error: 'Failed to load menu.' });
  }
}
