"use strict";
const db = require('../config/database').default;
const {qualityFlags} = require('../lib/materialProcurement');
exports.listProductReview = async (req,res) => {
  try {
    const requested = req.admin?.role === 'super_admin' ? (req.query.country || req.admin.country) : req.admin?.country;
    if (!['ae','vn','sa'].includes(requested)) return res.status(403).json({error:'Supplier country access denied.'});
    const country = requested;
    const page = Math.max(1,parseInt(req.query.page)||1), limit = Math.min(100,Math.max(1,parseInt(req.query.limit)||30));
    const issue = req.query.issue;
    if (issue && !['translation','incomplete','duplicate'].includes(issue)) return res.status(400).json({error:'Invalid issue.'});
    const [rows] = await db.execute(`SELECT p.id, p.supplier_profile_id AS supplier_id, sp.slug, p.title, p.title_translated, p.category, p.image_url, p.price, p.price_currency, p.price_unit, p.specs,
      EXISTS(SELECT 1 FROM supplier_products duplicate WHERE duplicate.supplier_profile_id=p.supplier_profile_id AND duplicate.id<>p.id AND LOWER(TRIM(COALESCE(duplicate.title_translated,duplicate.title)))=LOWER(TRIM(COALESCE(p.title_translated,p.title)))) AS duplicate_name,
      EXISTS(SELECT 1 FROM product_categories c WHERE c.value COLLATE utf8mb4_unicode_ci=p.category COLLATE utf8mb4_unicode_ci AND c.is_enabled=1) AS valid_category
      FROM supplier_products p JOIN supplier_profiles sp ON sp.id=p.supplier_profile_id WHERE sp.country=? ORDER BY p.id DESC`,[country]);
    const products = rows.map(row=>{ const {duplicate_name,valid_category,...product}=row; const flags=qualityFlags(row); if(!valid_category&&!flags.includes('incomplete'))flags.push('incomplete'); if(duplicate_name)flags.push('duplicate'); return {...product,flags}; }).filter(p=>issue?p.flags.includes(issue):p.flags.length);
    res.json({products:products.slice((page-1)*limit,page*limit),total:products.length,page,limit});
  } catch(error) { console.error('Product review queue:',error);res.status(500).json({error:'Failed to load product review queue.'}); }
};
