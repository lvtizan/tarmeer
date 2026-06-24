"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const http = require("http");
const { execFile } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", ".."); // server/dist/lib → 项目根
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    const req = lib.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(dest, () => {}); return reject(new Error(`HTTP ${res.statusCode}`)); }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
    });
    req.on("error", (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
  });
}

function genVariants(srcAbs, outRel) {
  return new Promise((resolve, reject) => {
    execFile("node", [path.join(PROJECT_ROOT, "scripts", "gen-image-variants.mjs"), `${srcAbs}::${outRel}`],
      { cwd: PROJECT_ROOT }, (err, stdout, stderr) => err ? reject(new Error(stderr || err.message)) : resolve(stdout));
  });
}

// 处理一组图片 URL：下载第一张 → 多档缓存 → 返回 -medium webp 的站点路径（失败抛错，调用方兜底占位图）
async function resolveFirstImage(urls, externalId) {
  const url = urls.find((u) => typeof u === "string" && /^https?:\/\//.test(u));
  if (!url) throw new Error("no http(s) image url");
  const safeExt = String(externalId).replace(/[^\w-]/g, "_");
  const tmp = path.join(os.tmpdir(), `partner-${safeExt}-${Date.now()}.img`);
  await download(url, tmp);
  const outRel = `public/images/partner/items/${safeExt}/cover`;
  fs.mkdirSync(path.join(PROJECT_ROOT, "public", "images", "partner", "items", safeExt), { recursive: true });
  await genVariants(tmp, outRel);
  fs.unlink(tmp, () => {});
  return `/images/partner/items/${safeExt}/cover-medium.webp`;
}

module.exports = { download, genVariants, resolveFirstImage };
