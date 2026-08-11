"use strict";
// 材料大类聚合（By Material 浏览 / Mega 菜单 / 大类产品 / 搜索）。
// 分类口径的唯一真相源 = product_categories 表（运营在后台可编辑：value/label/parent_value/sort_order/is_enabled）。
// 不再硬编码 TAG_TO_MACRO / MACRO_LABEL / SUBTAG_LABEL —— 后台改分类即刻反映到材料页。
// 归属唯一判据：supplier_products.category = 子类 value（精确匹配）。计数与列表同一判据 → 二者恒等。
// 国家隔离（铁律）：所有查询都带 WHERE sp.country=?，绝不跨国聚合。
// 供应商去标识（P0，对齐 supplierRedact / FA-14）：公开输出一律用品类通用名（supplierPublicTitle），
// 产品标题里出现的真实厂名（含 name_zh）用 maskSupplierMentions 遮蔽，logo 不外发。
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMacroCategories = getMacroCategories;
exports.getMacroProducts = getMacroProducts;
exports.getMaterialSearch = getMaterialSearch;
exports.getMegaMenu = getMegaMenu;
exports.getPopularProducts = getPopularProducts;
const database_1 = require("../config/database");
const supplierRedact_1 = require("../lib/supplierRedact");

// LIKE 转义(防 % _ 被当通配) + 包裹
const likeParam = (q) => '%' + String(q).replace(/[\\%_]/g, (c) => '\\' + c) + '%';

// 公开产品标题遮蔽：英文厂名 + 中文厂名（name_zh）都要遮
function maskTitle(text, realName, realNameZh) {
    let out = supplierRedact_1.maskSupplierMentions(text, realName);
    if (realNameZh)
        out = supplierRedact_1.maskSupplierMentions(out, realNameZh);
    return out;
}

// product_categories.label_zh 列可能尚未上线（并行迁移在加）——探测一次并缓存，避免 SELECT 不存在列直接 500。
let _hasLabelZh = null;
async function hasLabelZh() {
    if (_hasLabelZh !== null) return _hasLabelZh;
    try {
        const [rows] = await database_1.default.query("SHOW COLUMNS FROM product_categories LIKE 'label_zh'");
        _hasLabelZh = Array.isArray(rows) && rows.length > 0;
    } catch (e) {
        _hasLabelZh = false;
    }
    return _hasLabelZh;
}

// 加载启用的「子类」（parent_value 非空 = 二级分类），按 sort_order 尊重后台排序。
async function loadChildren() {
    const withZh = await hasLabelZh();
    const cols = withZh
        ? 'value, label, label_zh, parent_value, sort_order'
        : 'value, label, parent_value, sort_order';
    const [rows] = await database_1.default.query(
        `SELECT ${cols} FROM product_categories
     WHERE parent_value IS NOT NULL AND is_enabled = 1
     ORDER BY sort_order, label`
    );
    return rows.map((r) => ({
        value: r.value,
        label: r.label,
        label_zh: withZh ? (r.label_zh ?? null) : null,
        parent_value: r.parent_value,
        sort_order: Number(r.sort_order) || 0,
    }));
}

// 核心聚合：按 product_categories 子类归桶（供应商数 / 产品数 / 代表图 / 供应商列表）。
// By-Material 网格与 Mega 菜单共用此函数（单一真相源，口径一致）。
// 归属唯一判据（canonical predicate）：supplier_products.category = 子类 value（精确匹配）。
// —— 与 getMacroProducts 的列表判据完全一致 → 侧栏计数 == 分类页产品数，且不跨类重复。
//    category 为 NULL/'' 的产品不进任何分类浏览（在供应商自己页面展示），可接受。
async function aggregateByChild(country) {
    const children = await loadChildren();
    const childMap = new Map(children.map((c) => [c.value, c]));

    // 供应商元信息（国家隔离 + 已批准发布）+ 代表图 + 权重（供 featured 排序）。
    // 去标识：name 用品类通用名；logo 不进公开输出（对齐 redactPublicSupplier 隐藏 logo_url）。
    const [sup] = await database_1.default.query(
        `SELECT sp.id, sp.slug, sp.categories, sp.cover_image_url,
       COALESCE(sp.weight_score, 0) AS weight,
       (SELECT image_url FROM supplier_products p
          WHERE p.supplier_profile_id = sp.id AND p.image_url IS NOT NULL AND p.image_url <> ''
          ORDER BY p.sort_order, p.id LIMIT 1) img
     FROM supplier_profiles sp
     WHERE sp.country = ? AND sp.status = 'approved' AND sp.is_published = 1`,
        [country]
    );
    const supMeta = new Map();
    for (const s of sup) {
        supMeta.set(s.id, {
            slug: s.slug,
            name: supplierRedact_1.supplierPublicTitle(s.categories),
            image: s.img || s.cover_image_url || null,
            weight: Number(s.weight) || 0,
        });
    }

    // 每供应商每分类的有图产品数（精确通道，只取已归类到 product_categories 子类的产品）。
    const [prod] = await database_1.default.query(
        `SELECT p.supplier_profile_id AS sid, p.category AS cat, COUNT(*) AS cnt
     FROM supplier_products p
     JOIN supplier_profiles sp ON sp.id = p.supplier_profile_id
     WHERE sp.country = ? AND sp.status = 'approved' AND sp.is_published = 1
       AND p.image_url IS NOT NULL AND p.image_url <> ''
       AND p.category IS NOT NULL AND p.category <> ''
     GROUP BY p.supplier_profile_id, p.category`,
        [country]
    );

    const bucket = new Map(); // value -> aggregate
    for (const r of prod) {
        const cat = String(r.cat).trim();
        if (!childMap.has(cat)) continue; // 未知/未启用子类值 → 不归桶（不 crash）
        const meta = supMeta.get(r.sid);
        if (!meta) continue; // 供应商不在 approved/published/本国 集合内（JOIN 已保证，防御）
        let b = bucket.get(cat);
        if (!b) {
            const c = childMap.get(cat);
            b = { key: cat, label: c.label, label_zh: c.label_zh, productCount: 0, supplierCount: 0, image: null, sort_order: c.sort_order, suppliers: [] };
            bucket.set(cat, b);
        }
        b.productCount += Number(r.cnt) || 0;
        // GROUP BY (sid,cat) 保证同一供应商在同一分类只出现一次 → suppliers 天然去重
        b.suppliers.push({ slug: meta.slug, name: meta.name, image: meta.image, weight: meta.weight, pcnt: Number(r.cnt) || 0 });
    }

    const list = [];
    for (const b of bucket.values()) {
        if (b.productCount <= 0) continue;
        b.supplierCount = b.suppliers.length; // 有该类产品的不同供应商数（与列表口径一致）
        b.suppliers.sort((a, z) => (z.weight - a.weight) || (z.pcnt - a.pcnt));
        const withImg = b.suppliers.find((s) => s.image);
        b.image = withImg ? withImg.image : null;
        list.push(b);
    }
    // 按后台 sort_order 排序（尊重运营顺序）
    return list.sort((a, b) => (a.sort_order - b.sort_order) || a.label.localeCompare(b.label));
}

// GET /api/suppliers/macro-categories?country= — By Material 浏览网格（分类来自 product_categories）
async function getMacroCategories(req, res) {
    try {
        const country = (typeof req.query.country === 'string' && req.query.country) || req.country || 'ae';
        const list = await aggregateByChild(country);
        const macros = list.map((b) => ({
            key: b.key,
            label: b.label,
            label_zh: b.label_zh,
            supplierCount: b.supplierCount,
            productCount: b.productCount,
            image: b.image,
        }));
        res.json({ macros, country });
    } catch (error) {
        console.error('getMacroCategories error:', error);
        res.status(500).json({ error: 'Failed to load material categories.' });
    }
}

// GET /api/suppliers/macro-categories/:key/products — 某子类的产品瀑布流
async function getMacroProducts(req, res) {
    try {
        const country = (typeof req.query.country === 'string' && req.query.country) || req.country || 'ae';
        const key = String(req.params.key || '').trim();
        const children = await loadChildren();
        const child = children.find((c) => c.value === key);
        if (!child) return res.status(404).json({ error: 'Unknown category.' });
        const label = child.label;

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(48, Math.max(1, parseInt(req.query.limit) || 24));
        const offset = (page - 1) * limit;

        // 唯一判据：精确归类 p.category = key（与 aggregateByChild 完全一致 → 计数 == 列表）。
        const where = `sp.country = ? AND sp.status = 'approved' AND sp.is_published = 1
      AND p.image_url IS NOT NULL AND p.image_url <> '' AND p.category = ?`;
        const params = [country, key];

        const [cntRows] = await database_1.default.query(
            `SELECT COUNT(*) total FROM supplier_products p
       JOIN supplier_profiles sp ON sp.id = p.supplier_profile_id
       WHERE ${where}`,
            params
        );
        const total = cntRows[0].total;
        if (total === 0) return res.json({ label, key, products: [], pagination: { page, limit, total: 0, totalPages: 0 } });

        const [rows] = await database_1.default.query(
            `SELECT p.id, p.title, p.title_translated, p.image_url, p.category,
         p.price, p.price_max, p.price_unit, p.price_currency, p.price_from,
         sp.slug AS supplier_slug, sp.company_name AS supplier_real_name,
         sp.name_zh AS supplier_real_name_zh, sp.categories AS supplier_categories
       FROM supplier_products p
       JOIN supplier_profiles sp ON sp.id = p.supplier_profile_id
       WHERE ${where}
       ORDER BY p.sort_order, p.id
       LIMIT ${limit} OFFSET ${offset}`,
            params
        );
        const products = rows.map((r) => ({
            id: r.id,
            title: maskTitle(r.title_translated || r.title || 'Product', r.supplier_real_name, r.supplier_real_name_zh),
            image_url: r.image_url,
            price: r.price,
            price_max: r.price_max,
            price_unit: r.price_unit,
            price_currency: r.price_currency,
            price_from: r.price_from,
            supplier_slug: r.supplier_slug || null,
            supplier_name: supplierRedact_1.supplierPublicTitle(r.supplier_categories),
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
         p.price, p.price_max, p.price_unit, p.price_currency, p.price_from,
         sp.slug AS supplier_slug, sp.company_name AS supplier_real_name,
         sp.name_zh AS supplier_real_name_zh, sp.categories AS supplier_categories
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
            out.push({
                id: r.id,
                title: maskTitle(r.title, r.supplier_real_name, r.supplier_real_name_zh),
                image_url: r.image_url,
                price: r.price,
                price_max: r.price_max,
                price_unit: r.price_unit,
                price_currency: r.price_currency,
                price_from: r.price_from,
                supplier_slug: r.supplier_slug,
                supplier_name: supplierRedact_1.supplierPublicTitle(r.supplier_categories),
            });
            if (out.length >= limit) break;
        }
        res.json({ products: out });
    } catch (error) {
        console.error('getPopularProducts error:', error);
        res.status(500).json({ error: 'Failed to load popular products.' });
    }
}

// GET /api/suppliers/search — 材料/供应商搜索（不依赖分类硬编码；按名称/标题/分类值 LIKE）
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
            const [cntRows] = await database_1.default.query(
                `SELECT COUNT(*) total FROM supplier_profiles sp
         WHERE sp.country=? AND sp.status='approved' AND sp.is_published=1
           AND (sp.company_name LIKE ? OR sp.categories LIKE ?)`,
                [country, like, like]
            );
            const total = cntRows[0].total;
            const [rows] = await database_1.default.query(
                `SELECT sp.id, sp.slug, sp.categories, sp.origin, sp.cover_image_url,
           (SELECT image_url FROM supplier_products p WHERE p.supplier_profile_id=sp.id AND p.image_url IS NOT NULL AND p.image_url<>'' ORDER BY p.sort_order,p.id LIMIT 1) first_product_image
         FROM supplier_profiles sp
         WHERE sp.country=? AND sp.status='approved' AND sp.is_published=1
           AND (sp.company_name LIKE ? OR sp.categories LIKE ?)
         ORDER BY (sp.company_name LIKE ?) DESC, sp.id DESC
         LIMIT ${limit} OFFSET ${offset}`,
                [country, like, like, like]
            );
            // 去标识：公开搜索结果用品类通用名，不回传真实厂名/logo
            const results = rows.map((r) => ({
                id: r.id,
                slug: r.slug,
                company_name: supplierRedact_1.supplierPublicTitle(r.categories),
                origin: r.origin,
                cover_image_url: r.cover_image_url,
                logo_url: null,
                first_product_image: r.first_product_image,
            }));
            return res.json({ type, q, results, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
        }

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
         p.price, p.price_max, p.price_unit, p.price_currency, p.price_from,
         sp.slug AS supplier_slug, sp.company_name AS supplier_real_name,
         sp.name_zh AS supplier_real_name_zh, sp.categories AS supplier_categories
       FROM supplier_products p
       JOIN supplier_profiles sp ON sp.id=p.supplier_profile_id
       WHERE sp.country=? AND sp.status='approved' AND sp.is_published=1 AND p.image_url IS NOT NULL AND p.image_url<>''
         AND (p.title LIKE ? OR p.title_translated LIKE ? OR p.category LIKE ?)
       ORDER BY (p.title LIKE ? OR p.title_translated LIKE ?) DESC, p.sort_order, p.id
       LIMIT ${limit} OFFSET ${offset}`,
            [country, like, like, like, like, like]
        );
        const results = rows.map((r) => ({
            id: r.id,
            title: maskTitle(r.title, r.supplier_real_name, r.supplier_real_name_zh),
            image_url: r.image_url,
            category: r.category,
            price: r.price,
            price_max: r.price_max,
            price_unit: r.price_unit,
            price_currency: r.price_currency,
            price_from: r.price_from,
            supplier_slug: r.supplier_slug,
            supplier_name: supplierRedact_1.supplierPublicTitle(r.supplier_categories),
        }));
        return res.json({ type, q, results, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
        console.error('getMaterialSearch error:', error);
        res.status(500).json({ error: 'Search failed.' });
    }
}

// GET /api/suppliers/mega-menu?country= — 目录浮层（分类=product_categories 子类；含代表图 + 精选供应商）
async function getMegaMenu(req, res) {
    try {
        const country = (typeof req.query.country === 'string' && req.query.country) || req.country || 'ae';
        const list = await aggregateByChild(country);
        const macros = list.map((b) => ({
            key: b.key,
            label: b.label,
            productCount: b.productCount,
            supplierCount: b.supplierCount,
            image: b.image,
            subcategories: [], // product_categories 只有两级（大类/子类），子类下无三级 → 无 chips
            // 已按 weight_score 排序（供应商查询 ORDER BY），取前 3；name 已是品类通用名（去标识）
            featuredSuppliers: b.suppliers.slice(0, 3).map((s) => ({ slug: s.slug, name: s.name, image: s.image })),
        }));
        res.json({ macros, country });
    } catch (error) {
        console.error('getMegaMenu error:', error);
        res.status(500).json({ error: 'Failed to load menu.' });
    }
}
