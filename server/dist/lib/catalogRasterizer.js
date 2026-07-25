"use strict";
// 供应商 PDF 图册 → 逐页视网膜 WebP 预渲染（方案③）。
// 产物：public/uploads/suppliers/catalogs/pages/<catalogId>/{<n>.webp, <n>-thumb.webp, manifest.json}
// 阅读器有 manifest 就走图片模式（秒开、不下大 PDF）；没有则回退 pdf.js（平滑降级）。
// 依赖：poppler-utils(pdfinfo/pdftoppm) + sharp。
Object.defineProperty(exports, "__esModule", { value: true });
exports.rasterizeCatalog = rasterizeCatalog;
exports.pageCountOf = pageCountOf;
exports.pdfPathFromUrl = pdfPathFromUrl;

const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileP = promisify(execFile);
const sharp = require("sharp");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

const CATALOG_DIR = path.join(process.cwd(), "public", "uploads", "suppliers", "catalogs");
const PAGES_ROOT = path.join(CATALOG_DIR, "pages");

const RETINA_WIDTH = 2400; // 视网膜全幅
const THUMB_WIDTH = 200;
const RENDER_DPI = 150;

/** file_url(/uploads/...) → 服务器绝对路径 */
function pdfPathFromUrl(fileUrl) {
  if (!fileUrl || typeof fileUrl !== "string") return null;
  if (!fileUrl.startsWith("/uploads/")) return null; // 外链(如占位 URL)不处理
  return path.join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
}

async function pageCountOf(pdfPath) {
  const { stdout } = await execFileP("pdfinfo", [pdfPath]);
  const m = stdout.match(/Pages:\s+(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * 逐页栅格化。已存在 manifest 且 !force 则跳过（幂等，回填可重复跑）。
 * 返回 { pages } 或 { skipped:true }。
 */
async function rasterizeCatalog(catalogId, pdfPath, opts = {}) {
  const force = !!opts.force;
  // startPage: 从第几页起渲（跳过首页 logo/客户信息用）。输出仍从 1.webp 编号。
  const startPage = Math.max(1, parseInt(opts.startPage, 10) || 1);
  const outDir = path.join(PAGES_ROOT, String(catalogId));
  const manifestPath = path.join(outDir, "manifest.json");
  if (!force) {
    try { await fs.access(manifestPath); return { skipped: true }; } catch (_) { /* 未渲染，继续 */ }
  }
  const total = await pageCountOf(pdfPath);
  if (!total || total < startPage) throw new Error("catalog page range invalid: " + pdfPath);
  const n = total - startPage + 1; // 实际输出页数

  await fs.rm(outDir, { recursive: true, force: true }); // 清旧产物(重渲/改页码时避免残留)
  await fs.mkdir(outDir, { recursive: true, mode: 0o755 });
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cat-ras-"));
  let ar = 1.4; // 首页宽高比（前端按它设舞台比例，防布局抖动）
  try {
    for (let src = startPage; src <= total; src++) {
      const out = src - startPage + 1; // 源页 src → 输出页 out
      // -scale-to-x：直接出 2400px 宽的 PNG（与 DPI 无关，保证视网膜；-scale-to-y -1 保持比例）
      await execFileP("pdftoppm", [
        "-png", "-scale-to-x", String(RETINA_WIDTH), "-scale-to-y", "-1",
        "-f", String(src), "-l", String(src), "-singlefile",
        pdfPath, path.join(tmp, "pg"),
      ]);
      const pngPath = path.join(tmp, "pg.png");
      const buf = await fs.readFile(pngPath);
      if (out === 1) {
        const meta = await sharp(buf).metadata();
        if (meta.width && meta.height) ar = Number((meta.width / meta.height).toFixed(4));
      }
      await sharp(buf).webp({ quality: 85 }).toFile(path.join(outDir, `${out}.webp`));
      await sharp(buf).resize({ width: THUMB_WIDTH }).webp({ quality: 72 }).toFile(path.join(outDir, `${out}-thumb.webp`));
      await fs.rm(pngPath, { force: true });
    }
    // rev：每次(重)渲染换新值 → 前端 URL 加 ?r=rev 打破 nginx 30d immutable 缓存(同名 WebP 内容变了也能刷新)
    await fs.writeFile(manifestPath, JSON.stringify({ pages: n, v: 2, w: RETINA_WIDTH, ar, rev: Date.now() }));
    // nginx/express 读取需 644
    for (const f of await fs.readdir(outDir)) {
      await fs.chmod(path.join(outDir, f), 0o644);
    }
    return { pages: n };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
