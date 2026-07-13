#!/usr/bin/env node
// 补图脚本：扫描所有回退到占位图的合作方产品，从暂存 payload 重取原图 URL，
// 经加固后的图片管线(35s 超时 + 3 次重试)重新下载入库，更新 supplier_products。
// 跨区网络仍抖时可重复运行——只处理仍为占位图的行，已成功的不再动。
//
// 用法(必须在后端根目录跑，让 process.cwd() = /tarmeer/tarmeer_api，
//      变体图才会写到 nginx 服务的 public/uploads/ 下)：
//   cd /tarmeer/tarmeer_api && node /tmp/reheal-partner-images.cjs
const path = require("path");
const ROOT = process.cwd();
require("dotenv").config({ path: path.join(ROOT, ".env") });
const pool = require(path.join(ROOT, "dist/config/database")).default;
const { resolveFirstImage } = require(path.join(ROOT, "dist/lib/partnerImageService"));

const PLACEHOLDER = "/images/partner/placeholder.webp";

(async () => {
  const [rows] = await pool.execute(
    "SELECT DISTINCT partner_external_id FROM supplier_products WHERE source='partner' AND image_url=? AND partner_external_id IS NOT NULL",
    [PLACEHOLDER]);
  console.log(`占位图合作方产品(去重 external_id)：${rows.length}`);
  let fixed = 0, failed = 0;
  for (const { partner_external_id: ext } of rows) {
    const [st] = await pool.execute(
      "SELECT payload_json FROM partner_sync_products WHERE external_id=? LIMIT 1", [ext]);
    if (!st.length) { console.log(`  跳过 ${ext}：暂存无此行`); failed++; continue; }
    let p;
    try { p = typeof st[0].payload_json === "string" ? JSON.parse(st[0].payload_json) : st[0].payload_json; }
    catch { p = {}; }
    const images = Array.isArray(p.images) ? p.images : [];
    if (!images.length) { console.log(`  跳过 ${ext}：payload 无 images(源头本就没图)`); failed++; continue; }
    try {
      const url = await resolveFirstImage(images, ext);
      const [r] = await pool.execute(
        "UPDATE supplier_products SET image_url=?, image_urls=? WHERE source='partner' AND partner_external_id=? AND image_url=?",
        [url, JSON.stringify([url]), ext, PLACEHOLDER]);
      console.log(`  ✅ ${ext} -> ${url}  (更新 ${r.affectedRows} 行)`);
      fixed++;
    } catch (e) {
      console.log(`  ❌ ${ext} 下载失败：${e.message}(网络抖，可稍后重跑)`);
      failed++;
    }
  }
  console.log(`\n完成：修复 ${fixed}，失败 ${failed}`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
