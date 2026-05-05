#!/usr/bin/env node
/**
 * 拉取「中国供应商」全部产品目录 PDF 到本地，便于跑 redact-pdf-contacts.py。
 *
 * 用法：
 *   ADMIN_TOKEN=<your_token> node scripts/fetch-cn-supplier-catalogs.mjs
 *   ADMIN_TOKEN=<token> API_BASE=https://www.tarmeer.com/api node scripts/fetch-cn-supplier-catalogs.mjs
 *
 * 输出：
 *   ./tmp/cn-catalogs/<supplier_slug>/<catalog_id>__<title>.pdf
 *   ./tmp/cn-catalogs/manifest.json   { items: [{supplierId, catalogId, slug, title, originalUrl, localPath}] }
 *
 * 拿到 ADMIN_TOKEN 的方法：浏览器登录 admin 后，打开 DevTools → Application → localStorage →
 *   admin_token 字段，复制 value。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

const API_BASE = (process.env.API_BASE || 'https://www.tarmeer.com/api').replace(/\/$/, '');
const TOKEN = process.env.ADMIN_TOKEN;
if (!TOKEN) {
  console.error('ERROR: 必须设置 ADMIN_TOKEN 环境变量');
  console.error('  浏览器登录 /admin/login 后，DevTools → Application → localStorage → admin_token');
  process.exit(2);
}

const OUT_DIR = './tmp/cn-catalogs';
const PAGE_SIZE = 100;

const headers = { Authorization: `Bearer ${TOKEN}` };

async function fetchJson(path) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${url}`);
  return res.json();
}

async function downloadFile(url, outPath) {
  await mkdir(dirname(outPath), { recursive: true });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(outPath));
}

function safeName(s) {
  return String(s || '').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 100);
}

(async () => {
  console.log(`API: ${API_BASE}`);
  console.log(`Listing 中国供应商 (origin=china)…`);

  // 1. 列出全部 origin=china 的供应商（分页拉完）
  const suppliers = [];
  let page = 1;
  while (true) {
    const data = await fetchJson(`/admin/suppliers?origin=china&page=${page}&limit=${PAGE_SIZE}`);
    suppliers.push(...(data.suppliers || []));
    const total = data.pagination?.total ?? suppliers.length;
    process.stdout.write(`  page ${page}: ${data.suppliers?.length || 0} suppliers (total so far ${suppliers.length}/${total})\n`);
    if (suppliers.length >= total || !data.suppliers?.length) break;
    page++;
  }
  console.log(`  → 共 ${suppliers.length} 家中国供应商`);

  // 2. 对有 catalog_count > 0 的供应商，取详情拿 catalogs
  const withCatalogs = suppliers.filter(s => Number(s.catalog_count) > 0);
  console.log(`  → ${withCatalogs.length} 家有 catalog；逐个取详情…`);

  const manifest = { generatedAt: new Date().toISOString(), apiBase: API_BASE, items: [] };

  for (let i = 0; i < withCatalogs.length; i++) {
    const sup = withCatalogs[i];
    let detail;
    try {
      detail = await fetchJson(`/admin/suppliers/${sup.id}`);
    } catch (e) {
      console.warn(`  WARN: 拉 supplier ${sup.id} (${sup.company_name}) 失败: ${e.message}`);
      continue;
    }
    const catalogs = detail.catalogs || [];
    if (!catalogs.length) continue;

    for (const cat of catalogs) {
      const localPath = join(OUT_DIR, safeName(sup.slug || `id${sup.id}`), `${cat.id}__${safeName(cat.title)}.pdf`);
      const item = {
        supplierId: sup.id,
        slug: sup.slug,
        companyName: sup.company_name,
        catalogId: cat.id,
        title: cat.title,
        originalUrl: cat.file_url,
        localPath,
      };

      if (existsSync(localPath)) {
        process.stdout.write(`  [${i+1}/${withCatalogs.length}] ${sup.company_name} · ${cat.title} → 已存在，跳过\n`);
      } else {
        try {
          await downloadFile(cat.file_url, localPath);
          process.stdout.write(`  [${i+1}/${withCatalogs.length}] ${sup.company_name} · ${cat.title} → ${localPath}\n`);
        } catch (e) {
          process.stdout.write(`  [${i+1}/${withCatalogs.length}] ${sup.company_name} · ${cat.title} ✗ ${e.message}\n`);
          item.error = e.message;
        }
      }

      manifest.items.push(item);
    }
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n✅ 完成。${manifest.items.filter(i => !i.error).length} 个 catalog 下载，${manifest.items.filter(i => i.error).length} 个失败`);
  console.log(`   manifest: ${join(OUT_DIR, 'manifest.json')}`);
  console.log(`\n下一步：运行 redact 脚本：`);
  console.log(`   python3 scripts/redact-pdf-contacts.py ${OUT_DIR} --batch`);
  console.log(`   或干跑预览命中：`);
  console.log(`   python3 scripts/redact-pdf-contacts.py ${OUT_DIR} --dry-run`);
})();
