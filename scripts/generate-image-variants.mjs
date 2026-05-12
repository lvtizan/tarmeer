/**
 * generate-image-variants.mjs
 *
 * 在服务器上跑，批量为历史图片生成 -blur / -thumb / -medium 变体。
 * 跳过已有变体的文件，幂等可重复执行。
 *
 * 用法:
 *   node scripts/generate-image-variants.mjs [--dir /path/to/images] [--dry-run]
 *
 * 默认扫描目录（相对于 server/public）:
 *   - images/uae-companies/portfolio
 *   - uploads/suppliers
 *   - uploads/avatars
 *   - uploads/projects
 *   - uploads/showcase
 */

import { createRequire } from 'module';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'server', 'public');

const VARIANTS = [
  { suffix: '-blur',   maxLongEdge: 40,   quality: 20 },
  { suffix: '-thumb',  maxLongEdge: 600,  quality: 78 },
  { suffix: '-medium', maxLongEdge: 1200, quality: 85 },
];

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)$/i;
const VARIANT_SUFFIX = /-(blur|thumb|medium)\.webp$/i;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const customDir = args.find((a, i) => args[i - 1] === '--dir');

const SCAN_DIRS = customDir
  ? [path.resolve(customDir)]
  : [
      path.join(ROOT, 'images', 'uae-companies', 'portfolio'),
      path.join(ROOT, 'uploads', 'suppliers'),
      path.join(ROOT, 'uploads', 'avatars'),
      path.join(ROOT, 'uploads', 'projects'),
      path.join(ROOT, 'uploads', 'showcase'),
    ];

let found = 0;
let generated = 0;
let skipped = 0;
let errors = 0;

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walk(full);
    } else if (e.isFile() && IMAGE_EXT.test(e.name) && !VARIANT_SUFFIX.test(e.name)) {
      yield full;
    }
  }
}

async function generateVariants(imagePath) {
  let metadata;
  try {
    metadata = await sharp(imagePath).metadata();
  } catch {
    return 0;
  }

  const { width = 0, height = 0 } = metadata;
  if (!width || !height) return 0;

  const ext = path.extname(imagePath);
  const base = imagePath.slice(0, -ext.length);
  let count = 0;

  for (const variant of VARIANTS) {
    const outPath = `${base}${variant.suffix}.webp`;
    try {
      await fs.access(outPath);
      continue; // already exists
    } catch { /* proceed */ }

    if (DRY_RUN) {
      console.log(`  [dry] would generate ${path.basename(outPath)}`);
      count++;
      continue;
    }

    const longEdge = Math.max(width, height);
    const scale = longEdge > variant.maxLongEdge ? variant.maxLongEdge / longEdge : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    try {
      await sharp(imagePath)
        .resize(targetW, targetH, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: variant.quality })
        .toFile(outPath);
      await fs.chmod(outPath, 0o644);
      count++;
    } catch (err) {
      console.error(`  [error] ${outPath}: ${err.message}`);
      errors++;
    }
  }
  return count;
}

async function main() {
  console.log(`Image variant generator${DRY_RUN ? ' (dry run)' : ''}`);
  console.log(`Scanning ${SCAN_DIRS.length} director${SCAN_DIRS.length === 1 ? 'y' : 'ies'}...\n`);

  for (const dir of SCAN_DIRS) {
    let dirExists = false;
    try { await fs.access(dir); dirExists = true; } catch {}
    if (!dirExists) {
      console.log(`[skip] ${dir} (not found)`);
      continue;
    }
    console.log(`[scan] ${dir}`);

    for await (const imgPath of walk(dir)) {
      found++;
      const rel = path.relative(ROOT, imgPath);
      const n = await generateVariants(imgPath);
      if (n > 0) {
        generated += n;
        console.log(`  [ok] ${rel} (+${n} variants)`);
      } else {
        skipped++;
      }
    }
  }

  console.log(`\nDone.`);
  console.log(`  Images scanned : ${found}`);
  console.log(`  Variants made  : ${generated}`);
  console.log(`  Already done   : ${skipped}`);
  console.log(`  Errors         : ${errors}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
