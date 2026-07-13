"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const https = require("https");
const http = require("http");
const { execFile } = require("child_process");
const dns = require("dns").promises;
const net = require("net");

// 用 process.cwd()（后端进程工作目录）作根：本地=仓库根、生产=/tarmeer/tarmeer_api，
// 两处都有 scripts/ 和 public/uploads/（与现网供应商上传代码一致）。
// 不能用 __dirname 相对推导——本地是 server/dist/lib、生产是 dist/lib，层级不同会算错。
const PROJECT_ROOT = process.cwd();

function isPrivateIp(ip) {
  if (net.isIP(ip) === 4) {
    const p = ip.split(".").map(Number);
    return p[0] === 10 || p[0] === 127 || p[0] === 0 || p[0] === 169 && p[1] === 254 || p[0] === 172 && p[1] >= 16 && p[1] <= 31 || p[0] === 192 && p[1] === 168;
  }
  const low = String(ip).toLowerCase();
  return low === "::1" || low === "::" || low.startsWith("fc") || low.startsWith("fd") || low.startsWith("fe80");
}
async function assertPublicHost(url) {
  let u; try { u = new URL(url); } catch { throw new Error("bad url"); }
  if (!/^https?:$/.test(u.protocol)) throw new Error("scheme not allowed");
  const { address } = await dns.lookup(u.hostname);
  if (isPrivateIp(address)) throw new Error("private host blocked");
}

// 跨区源站(阿里云北京 OSS ↔ 迪拜服务器)网络慢且不稳，实测 6~60s+ 波动。
// 超时放宽到 35s，配合 downloadWithRetry 3 次退避，覆盖慢下载与瞬时中断(SSL/空响应)。
const DOWNLOAD_TIMEOUT_MS = 35000;

async function download(url, dest) {
  await assertPublicHost(url);
  return await new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(dest);
    const req = lib.get(url, (res) => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(dest, () => {}); return reject(new Error(`HTTP ${res.statusCode}`)); }
      res.pipe(file);
      res.on("error", (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
      file.on("error", (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
      file.on("finish", () => file.close(() => resolve(dest)));
    });
    req.on("error", (e) => { file.close(); fs.unlink(dest, () => {}); reject(e); });
    req.setTimeout(DOWNLOAD_TIMEOUT_MS, () => req.destroy(new Error("timeout")));
  });
}

// 跨区网络会随机失败——重试 3 次(退避 2s/5s)，任一次成功即返回。
// downloader 可注入仅用于测试重试循环；生产默认走带 SSRF 防护的 download。
async function downloadWithRetry(url, dest, attempts = 3, downloader = download) {
  const backoff = [0, 2000, 5000];
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    if (backoff[i]) await new Promise((r) => setTimeout(r, backoff[i]));
    try { return await downloader(url, dest); }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("download failed");
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
  await downloadWithRetry(url, tmp);
  // 输出到 public/uploads/(nginx /uploads/ 已服务此目录,同现网供应商商品图),而非 /images/(portal 目录)
  const outRel = `public/uploads/partner/items/${safeExt}/cover`;
  fs.mkdirSync(path.join(PROJECT_ROOT, "public", "uploads", "partner", "items", safeExt), { recursive: true, mode: 0o755 });
  await genVariants(tmp, outRel);
  fs.unlink(tmp, () => {});
  return `/uploads/partner/items/${safeExt}/cover-medium.webp`;
}

module.exports = { download, downloadWithRetry, genVariants, resolveFirstImage };
