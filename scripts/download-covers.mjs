/**
 * 下载设计师案例封面图片
 * 使用方法: cd 项目根目录 && node scripts/download-covers.mjs
 *
 * 每张图片按 cover-XXX.jpg 保存到 public/images/designers/projects/covers/
 * 覆盖旧图片。图片来自 Unsplash（免费商用）。
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVERS_DIR = path.join(__dirname, '..', 'public', 'images', 'designers', 'projects', 'covers');

// ── 75 张封面图 URL 映射 ──────────────────────────────────────
// 格式: [coverIndex, unsplashPhotoId, 标签说明]
// URL = https://images.unsplash.com/{photoId}?w=960&h=720&fit=crop&q=80

const COVER_MAP = [
  // ─── Designer 0: Salma Nasser (covers 1-5) ───
  [1,  'photo-1600573472591-ee6981cf81d6', 'Luxury Majlis/Reception'],
  [2,  'photo-1556911220-bff31c812dba',   'Kitchen'],
  [3,  'photo-1552321554-5fefe8c9ef14',   'Bathroom'],
  [4,  'photo-1600596542815-ffad4c1539a9', 'Outdoor Terrace'],
  [5,  'photo-1615529182904-14819c35db37', 'Majlis/Formal Seating'],

  // ─── Designer 1: Omar Farouk (covers 6-10) ───
  [6,  'photo-1618220179428-22790b461013', 'Apartment Living'],
  [7,  'photo-1600585154340-be6161a56a0c', 'Kitchen'],
  [8,  'photo-1586023492125-27b2c045efd7', 'Living Room'],
  [9,  'photo-1616594039964-ae9021a400a0', 'Bedroom'],
  [10, 'photo-1520250497591-112f2f40a3f4', 'Outdoor/Roof Garden'],

  // ─── Designer 2: Hana Idris (covers 11-15) ───
  [11, 'photo-1600585152915-d208bec867a1', 'Entrance/Foyer'],
  [12, 'photo-1617098900591-3f90928e8c54', 'Dining Room'],
  [13, 'photo-1600566753190-17f0baa2a6c3', 'Bathroom'],
  [14, 'photo-1558997519-83ea9252edf8', 'Wardrobe/Dressing'],
  [15, 'photo-1519710164239-da123dc03ef4', 'Reading Corner'],

  // ─── Designer 3: Daniel Rana (covers 16-20) ───
  [16, 'photo-1600210492486-724fe5c67fb3', 'Living Room Minimal'],
  [17, 'photo-1639405069836-f82aa6dcb900', 'Kitchen Luxury'],
  [18, 'photo-1504382103100-db7e92322d39', 'Staircase'],
  [19, 'photo-1536440136628-849c177e76a1', 'Home Cinema'],
  [20, 'photo-1522771739844-6a9f6d5f14af', 'Bedroom'],

  // ─── Designer 4: Mariam Kassem (covers 21-25) ───
  [21, 'photo-1600566753151-384129cf4e3e', 'Entrance/Villa'],
  [22, 'photo-1615066390971-03e4e1c36ddf', 'Dining Room'],
  [23, 'photo-1593642632559-0c6d3fc62b89', 'Home Office'],
  [24, 'photo-1584622650111-993a426fbf0a', 'Bathroom/Powder Room'],
  [25, 'photo-1558618666-fcd25c85cd64', 'Courtyard'],

  // ─── Designer 5: Layla Haddad (covers 26-30) ───
  [26, 'photo-1600585154526-990dced4db0d', 'Living Room'],
  [27, 'photo-1600210491741-0f2c48fcde1c', 'Dining Room Luxury'],
  [28, 'photo-1560185007-5f0bb1866cab', 'Bedroom'],
  [29, 'photo-1600566752227-26b30cda4e10', 'Entrance/Apartment'],
  [30, 'photo-1583847268964-b28dc8f51f92', 'Family Living'],

  // ─── Designer 6: Yousef Karim (covers 31-35) ───
  [31, 'photo-1613545564241-296299063513', 'Kitchen'],
  [32, 'photo-1616486029423-aaa4789e8c9a', 'Living Room'],
  [33, 'photo-1617325247661-675ab4b64ae2', 'Bedroom'],
  [34, 'photo-1600494603989-9650cf6ddd3d', 'Home Office'],
  [35, 'photo-1595428774223-ef52624120d2', 'Dining Room'],

  // ─── Designer 7: Noor Rahman (covers 36-40) ───
  [36, 'photo-1616137422495-1e9e46e2aa77', 'Wardrobe/Dressing'],
  [37, 'photo-1620626011761-996317b8d101', 'Bathroom'],
  [38, 'photo-1600585152220-90363fe7e115', 'Dining Room'],
  [39, 'photo-1540932239986-30128078f3c5', 'Reading Corner'],
  [40, 'photo-1618221195710-dd6b41faaea6', 'Bedroom'],

  // ─── Designer 8: Tariq Mansour (covers 41-45) ───
  [41, 'photo-1600607687920-4e4a92f082f4', 'Living Room Modern'],
  [42, 'photo-1613545564245-62b2c9ef8055', 'Kitchen Minimal'],
  [43, 'photo-1593784991095-a205069470b6', 'Home Cinema'],
  [44, 'photo-1518455027359-f3f8164ba6bd', 'Workspace/Study'],
  [45, 'photo-1540518614846-7eded433c457', 'Bedroom'],

  // ─── Designer 9: Amira Safwan (covers 46-50) ───
  [46, 'photo-1600566753086-00f18fb6b3ea', 'Living Room Family'],
  [47, 'photo-1560448204-603b3fc33ddc', 'Dining Room'],
  [48, 'photo-1564078516393-cf04bd966897', 'Outdoor Terrace'],
  [49, 'photo-1615874959474-d609969a20ed', 'Bedroom'],
  [50, 'photo-1600210492493-0946911123ea', 'Entrance'],

  // ─── Designer 10: Karim Dawoud (covers 51-55) ───
  [51, 'photo-1661964027195-4df42ba76842', 'Kitchen Renovation'],
  [52, 'photo-1507652313519-d4e9174996dd', 'Bathroom'],
  [53, 'photo-1585128792020-803d29415281', 'Dining Room'],
  [54, 'photo-1598300042247-d088f8ab3a91', 'Storage/Closet'],
  [55, 'photo-1600607687644-c7171b42498f', 'Bathroom'],

  // ─── Designer 11: Sara Elias (covers 56-60) ───
  [56, 'photo-1631679706909-1844bbd07221', 'Wardrobe/Vanity'],
  [57, 'photo-1631049307264-da0ec9d70304', 'Bedroom'],
  [58, 'photo-1481277542470-605612bd2d61', 'Reading Nook'],
  [59, 'photo-1617325710236-4a36d46b48c7', 'Dining Alcove'],
  [60, 'photo-1505693416388-ac5ce068fe85', 'Bedroom'],

  // ─── Designer 12: Adam Hakim (covers 61-65) ───
  [61, 'photo-1567016432779-094069958ea5', 'Apartment Living'],
  [62, 'photo-1704383014594-01bc24b6b840', 'Kitchen Compact'],
  [63, 'photo-1600607687939-ce8a6c25118c', 'Entrance/Storage'],
  [64, 'photo-1588046130717-0eb0c9a3ba15', 'Bedroom'],
  [65, 'photo-1533750349088-cd871a92f312', 'Home Office'],

  // ─── Designer 13: Leena Aziz (covers 66-70) ───
  [66, 'photo-1600210491369-e753d80a41f3', 'Coastal Living'],
  [67, 'photo-1600607688969-a5bfcd646154', 'Outdoor Dining'],
  [68, 'photo-1595526114035-0d45ed16cfbf', 'Bedroom Luxury'],
  [69, 'photo-1600607688960-e095ff83135b', 'Dining/Breakfast'],
  [70, 'photo-1600607687920-4e4a92f082f4', 'Guest Lounge'],

  // ─── Designer 14: Zayn Abbas (covers 71-75) ───
  [71, 'photo-1600210492486-724fe5c67fb3', 'Living Room Structured'],
  [72, 'photo-1616587894289-86480e533129', 'Study/Workspace'],
  [73, 'photo-1597673030062-0a0f1a801a31', 'Dining Room'],
  [74, 'photo-1600210491369-e753d80a41f3', 'Bedroom'],
  [75, 'photo-1593642634367-d91a135587b5', 'Workspace'],
];

// ── 下载函数 ────────────────────────────────────────────────

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const doRequest = (requestUrl, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      https.get(requestUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doRequest(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', (err) => {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        reject(err);
      });
    };
    doRequest(url);
  });
}

// ── 主流程 ──────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }

  console.log(`\n🖼️  开始下载 ${COVER_MAP.length} 张封面图...\n`);
  console.log(`目标目录: ${COVERS_DIR}\n`);

  const CONCURRENCY = 5;
  const failed = [];
  let done = 0;

  for (let i = 0; i < COVER_MAP.length; i += CONCURRENCY) {
    const batch = COVER_MAP.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async ([index, photoId, label]) => {
      const filename = `cover-${String(index).padStart(3, '0')}.jpg`;
      const dest = path.join(COVERS_DIR, filename);
      const url = `https://images.unsplash.com/${photoId}?w=960&h=720&fit=crop&q=80`;

      try {
        await download(url, dest);
        done++;
        console.log(`  ✅ [${done}/${COVER_MAP.length}] ${filename} — ${label}`);
      } catch (err) {
        failed.push({ index, filename, label, error: err.message });
        done++;
        console.log(`  ❌ [${done}/${COVER_MAP.length}] ${filename} — ${label} (${err.message})`);
      }
    }));
  }

  console.log(`\n✅ 完成! 成功: ${COVER_MAP.length - failed.length}, 失败: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\n❌ 下载失败的图片:');
    failed.forEach(({ filename, label, error }) => {
      console.log(`   ${filename} — ${label}: ${error}`);
    });
    console.log('\n提示: 可手动替换失败的图片，或修改 COVER_MAP 中的 photoId 后重新运行');
  }
}

main().catch(console.error);
