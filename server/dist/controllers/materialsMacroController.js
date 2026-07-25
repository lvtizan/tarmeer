"use strict";
// 材料大类聚合（By Material 浏览）——把供应商自由标签归一到干净大类，聚合供应商数/产品数/代表图。
// 数据源：supplier_profiles.categories(逗号分隔标签) + supplier_products(有图)。国家隔离：只算 req.country。
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMacroCategories = getMacroCategories;
const database_1 = require("../config/database");

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
      const tags = String(s.categories || '').split(',').map(t => t.trim()).filter(Boolean);
      const macros = [...new Set(tags.map(t => TAG_TO_MACRO[t]).filter(Boolean))];
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
