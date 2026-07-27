"use strict";
// 供应商 PDF 图册 → 逐页视网膜 WebP 预渲染（方案③）。
// 产物：public/uploads/suppliers/catalogs/pages/<catalogId>/{<n>.webp, <n>-thumb.webp, manifest.json}
// 阅读器有 manifest 就走图片模式（秒开、不下大 PDF）；没有则回退 pdf.js（平滑降级）。
// 依赖：poppler-utils(pdfinfo/pdftoppm) + sharp。
Object.defineProperty(exports, "__esModule", { value: true });
exports.rasterizeCatalog = rasterizeCatalog;
exports.pageCountOf = pageCountOf;
exports.pdfPathFromUrl = pdfPathFromUrl;
exports.detectFrontMatterPages = detectFrontMatterPages;
exports.buildCatalogPdf = buildCatalogPdf;

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
const PDF_WIDTH = 1600; // 下载 PDF 用的页宽（够清晰又不臃肿）

// 把已渲染的产品页 WebP 合成一份"去标识版"下载 PDF（catalog.pdf）。
// pdf-lib 只吃 JPEG/PNG，用 sharp 把 WebP 转 JPEG 再嵌入。pdf-lib 未装则抛错(调用方 try 掉)，不影响渲染主流程。
async function buildCatalogPdf(outDir, pages) {
  const { PDFDocument } = require("pdf-lib"); // 惰性 require：缺依赖只影响本功能
  const doc = await PDFDocument.create();
  let added = 0;
  for (let i = 1; i <= pages; i++) {
    let buf;
    try { buf = await fs.readFile(path.join(outDir, `${i}.webp`)); } catch (_) { continue; }
    const jpg = await sharp(buf).resize({ width: PDF_WIDTH, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const img = await doc.embedJpg(jpg);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    added++;
  }
  if (!added) throw new Error("no pages to compose");
  const outPath = path.join(outDir, "catalog.pdf");
  await fs.writeFile(outPath, await doc.save());
  await fs.chmod(outPath, 0o644);
  return outPath;
}

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

// ===== 去标识：自动识别应跳过的"企业信息"前置页（OCR + 关键词，已在 wanli/PARBRO 真实样本校验 6/1/1）=====
const OCR_CHECK_MAX = 15; // 只看前 15 页找边界，够覆盖封面/公司简介/工厂/联系页
// 企业信息信号词（英 + 中）：命中即认为该页是"关于公司"，不是产品
const COMPANY_KW = [
  "company", "technology", "factory", "investment", "industrial", "university", "collaboration",
  "research", "patent", "award", "established", "founded", "headquarters", "workshop", "enterprise",
  "manufacturer", "profile", "introduction", "aboutus", "contact", "email", "address", "website",
  "www", "certification", "partner",
  "公司", "简介", "关于", "联系", "电话", "地址", "邮箱", "工厂", "园区", "投资", "有限公司",
  "企业", "集团", "荣誉", "专利", "研发", "车间", "平方米", "大学", "科技", "认证", "合作",
];
function _companySignal(text, nameTokens) {
  const c = text.toLowerCase().replace(/\s+/g, "");
  for (const k of COMPANY_KW) if (c.includes(k)) return true;
  for (const k of nameTokens) if (k && c.includes(k)) return true; // 供应商自己的公司名/品牌
  return false;
}
// 产品页信号：一串 SERIES 列表(≥3) 或 型号网格(≥6 个 code)。用"phrase in prose"不行(公司简介也会写 product series)。
function _productSignal(text) {
  const c = text.toLowerCase();
  const series = (c.match(/series/g) || []).length + (c.match(/系列/g) || []).length;
  const codes = (text.match(/\b[A-Z]{1,5}\d{2,5}[A-Z0-9-]*\b/g) || []).length + (text.match(/\b\d{4}\b/g) || []).length;
  return series >= 3 || codes >= 6;
}
function _nameTokens(companyName) {
  if (!companyName) return [];
  const lower = String(companyName).toLowerCase();
  const stop = new Set(["co", "ltd", "inc", "the", "and", "company", "technology", "limited", "group"]);
  const words = lower.split(/[^a-z0-9一-龥]+/).filter((w) => w.length >= 3 && !stop.has(w));
  const cjk = lower.replace(/\s+/g, "").match(/[一-龥]{2,}/g) || [];
  return [...new Set([...words, ...cjk])];
}
async function _ocrPage(pdfPath, page) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "cat-ocr-"));
  try {
    await execFileP("pdftoppm", ["-png", "-r", "120", "-f", String(page), "-l", String(page), "-singlefile", pdfPath, path.join(tmp, "x")]);
    const { stdout } = await execFileP("tesseract", [path.join(tmp, "x.png"), "stdout", "-l", "eng+chi_sim"], { maxBuffer: 1 << 22 });
    return stdout || "";
  } catch (_) {
    return ""; // 无 tesseract / OCR 失败 → 该页无信号，交由整体逻辑兜底
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
/**
 * 自动判定应跳过的企业信息前置页数（去标识）。
 * 思路：找到第一张产品页(SERIES 列表/型号网格) → 向前回退越过"无企业信号的产品分隔页" → 停在第一张有企业信号的页。
 * 找不到产品页 / OCR 不可用 → 返回 0（不盲删，交人工兜底）。
 */
async function detectFrontMatterPages(pdfPath, companyName) {
  let total;
  try { total = await pageCountOf(pdfPath); } catch (_) { return 0; }
  if (!total || total < 2) return 0;
  const tokens = _nameTokens(companyName);
  const check = Math.min(total, OCR_CHECK_MAX);
  const cache = {};
  const get = async (p) => (cache[p] !== undefined ? cache[p] : (cache[p] = await _ocrPage(pdfPath, p)));
  let firstProduct = -1;
  for (let p = 1; p <= check; p++) {
    if (_productSignal(await get(p))) { firstProduct = p; break; }
  }
  if (firstProduct === -1) return 0; // 前 15 页找不到明确产品页 → 不盲删
  let boundary = firstProduct;
  for (let p = firstProduct - 1; p >= 1; p--) {
    if (_companySignal(await get(p), tokens)) break; // 碰到企业信息页就停
    boundary = p; // 无企业信号的产品分隔页并入"保留"区
  }
  return Math.max(0, Math.min(boundary - 1, total - 1));
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
    // 生成"去标识版"下载 PDF（只含已渲染的产品页）；失败不影响主流程
    try { await buildCatalogPdf(outDir, n); } catch (e) { console.error("[catalog-pdf] #" + catalogId + " failed:", e.message); }
    // nginx/express 读取需 644
    for (const f of await fs.readdir(outDir)) {
      await fs.chmod(path.join(outDir, f), 0o644);
    }
    return { pages: n };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
