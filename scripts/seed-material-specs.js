#!/usr/bin/env node
"use strict";
/**
 * 本地 demo 种子：给 AE 供应商产品填充 specs / certifications / application_scenes
 * （spec: docs/plans/china-materials-revamp-spec.md §2.1 / §2.3）
 *
 * 规则：
 *   - 只连本地库：读 server/.env，DB_HOST 不是 localhost 直接退出报错
 *   - 幂等：specs 已有值的产品跳过
 *   - application_scenes 的 slug 必须来自 spec §2.3 字典
 *
 * 用法：node scripts/seed-material-specs.js
 */
const path = require('path');
const serverDir = path.join(__dirname, '..', 'server');
require(path.join(serverDir, 'node_modules', 'dotenv')).config({ path: path.join(serverDir, '.env') });

if (process.env.DB_HOST !== 'localhost') {
  console.error(`[seed-material-specs] 拒绝执行：DB_HOST=${process.env.DB_HOST}（不是 localhost）。本脚本只做本地 demo，禁止连生产库。`);
  process.exit(1);
}

const mysql = require(path.join(serverDir, 'node_modules', 'mysql2', 'promise'));

// 按产品 title 匹配（本地 demo 数据），场景 slug 全部来自 spec §2.3 字典
const SEED = [
  { title: 'Calacatta Gold Marble Slab',        specs: [{ label: 'Material', value: 'Natural Calacatta marble' }, { label: 'Thickness', value: '18mm / 20mm' }, { label: 'Slab Size', value: '2800 x 1600mm' }, { label: 'Finish', value: 'Polished' }], certifications: ['CE', 'SGS'],           scenes: ['feature-wall', 'countertop'] },
  { title: 'Italian Travertine Tile',           specs: [{ label: 'Material', value: 'Natural travertine' }, { label: 'Size', value: '600 x 1200mm' }, { label: 'Thickness', value: '15mm' }, { label: 'Finish', value: 'Honed & filled' }], certifications: ['CE'],                          scenes: ['feature-wall', 'flooring'] },
  { title: 'Natural Stone Wall Cladding',       specs: [{ label: 'Material', value: 'Split-face natural stone' }, { label: 'Panel Size', value: '150 x 600mm' }, { label: 'Thickness', value: '10-25mm' }, { label: 'Installation', value: 'Adhesive or mechanical fix' }], certifications: ['ISO 9001'],  scenes: ['feature-wall'] },
  { title: 'Calacatta Marble Flooring Tile',    specs: [{ label: 'Material', value: 'Calacatta marble' }, { label: 'Size', value: '800 x 800mm' }, { label: 'Thickness', value: '15mm' }, { label: 'Finish', value: 'Polished' }, { label: 'Slip Rating', value: 'R9' }], certifications: ['CE', 'ISO 9001'], scenes: ['flooring'] },
  { title: 'Engineered Oak Parquet Flooring',   specs: [{ label: 'Material', value: 'European oak top layer' }, { label: 'Plank Size', value: '190 x 1900mm' }, { label: 'Thickness', value: '14mm (3mm wear layer)' }, { label: 'Finish', value: 'UV lacquered' }], certifications: ['CE', 'FSC'],   scenes: ['flooring'] },
  { title: 'SPC Rigid Core Flooring',           specs: [{ label: 'Material', value: 'Stone plastic composite' }, { label: 'Plank Size', value: '180 x 1220mm' }, { label: 'Thickness', value: '5.5mm + 1mm IXPE pad' }, { label: 'Wear Layer', value: '0.5mm' }, { label: 'Waterproof', value: '100%' }], certifications: ['CE', 'SGS'], scenes: ['flooring'] },
  { title: 'Linear Suspension Pendant',         specs: [{ label: 'Material', value: 'Aluminium body, acrylic diffuser' }, { label: 'Length', value: '1200mm' }, { label: 'Power', value: '36W LED' }, { label: 'Color Temperature', value: '3000K / 4000K' }], certifications: ['CE', 'RoHS'],  scenes: ['lighting'] },
  { title: 'Magnetic Track Lighting System',    specs: [{ label: 'Material', value: 'Aluminium track' }, { label: 'Voltage', value: '48V DC low voltage' }, { label: 'Modules', value: 'Spot / linear / pendant heads' }, { label: 'Color Temperature', value: '2700K-4000K' }], certifications: ['CE', 'SGS'], scenes: ['lighting'] },
  { title: 'Villa Dining & Living Set',         specs: [{ label: 'Material', value: 'Solid ash frame, Italian leather' }, { label: 'Set Includes', value: 'Dining table + 6 chairs + sofa' }, { label: 'Table Size', value: '2200 x 1000mm' }, { label: 'Customization', value: 'Fabric & finish options' }], certifications: ['ISO 9001'], scenes: ['furniture'] },
  { title: 'Custom Wardrobe System',            specs: [{ label: 'Material', value: 'E1-grade MDF, matte lacquer' }, { label: 'Depth', value: '600mm' }, { label: 'Height', value: 'Up to 2800mm floor-to-ceiling' }, { label: 'Hardware', value: 'Blum soft-close' }], certifications: ['ISO 9001', 'SGS'], scenes: ['furniture'] },
  { title: 'Italian Minimalist Kitchen Cabinet', specs: [{ label: 'Material', value: 'E1-grade plywood carcass' }, { label: 'Door Finish', value: 'Matte lacquer / wood veneer' }, { label: 'Countertop', value: 'Sintered stone 12mm' }, { label: 'Hardware', value: 'Blum / Hettich' }], certifications: ['CE', 'ISO 9001'], scenes: ['kitchen-bath', 'countertop'] },
  { title: 'Low-VOC Luxury Emulsion Paint',     specs: [{ label: 'Type', value: 'Water-based interior emulsion' }, { label: 'Coverage', value: '12-14 m²/L per coat' }, { label: 'VOC', value: '< 30 g/L' }, { label: 'Finish', value: 'Matte / eggshell' }], certifications: ['CE', 'SGS'],   scenes: ['feature-wall'] },
  { title: 'Vertical Green Wall System',        specs: [{ label: 'Material', value: 'UV-resistant artificial foliage' }, { label: 'Panel Size', value: '500 x 500mm modular' }, { label: 'Fire Rating', value: 'B1 flame retardant' }, { label: 'Usage', value: 'Indoor & outdoor' }], certifications: ['SGS'],       scenes: ['feature-wall', 'outdoor-garden'] },
  { title: 'Artificial King Coconut Palm',      specs: [{ label: 'Material', value: 'Fiberglass trunk, PE leaves' }, { label: 'Height', value: '3-8m customizable' }, { label: 'Base', value: 'Steel plate anchor' }, { label: 'Usage', value: 'Lobby / outdoor landscape' }], certifications: ['SGS'],       scenes: ['outdoor-garden', 'decor'] },
];

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  let updated = 0;
  let skipped = 0;
  let missing = 0;
  try {
    for (const item of SEED) {
      // 只匹配 AE 已审核已发布供应商的产品（与公开 feed 口径一致）
      const [rows] = await pool.execute(
        `SELECT p.id, p.specs FROM supplier_products p
         JOIN supplier_profiles sp ON sp.id = p.supplier_profile_id
         WHERE p.title = ? AND sp.country = 'ae' AND sp.status = 'approved' AND sp.is_published = 1
         ORDER BY p.id LIMIT 1`,
        [item.title]
      );
      if (rows.length === 0) {
        console.log(`  [missing] ${item.title}（本地库无此产品，跳过）`);
        missing++;
        continue;
      }
      const row = rows[0];
      if (row.specs !== null && row.specs !== undefined && String(row.specs) !== '' && String(row.specs) !== 'null') {
        console.log(`  [skip]    #${row.id} ${item.title}（specs 已有值，幂等跳过）`);
        skipped++;
        continue;
      }
      await pool.execute(
        'UPDATE supplier_products SET specs = ?, certifications = ?, application_scenes = ? WHERE id = ?',
        [JSON.stringify(item.specs), JSON.stringify(item.certifications), JSON.stringify(item.scenes), row.id]
      );
      console.log(`  [updated] #${row.id} ${item.title}`);
      updated++;
    }
    console.log(`[seed-material-specs] 完成：updated=${updated} skipped=${skipped} missing=${missing} / 共 ${SEED.length} 条种子`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('[seed-material-specs] 失败:', err);
  process.exit(1);
});
