#!/usr/bin/env node
/**
 * 中国供应商 catalog PDF 联系方式打白 —— 全流程驱动脚本（前端无需介入）。
 *
 * 流程：
 *   1. 拉所有 origin=china 的 supplier 列表（admin API 分页）
 *   2. 对每个 supplier 取详情拿 catalogs
 *   3. 写 tasks.json (每条 {id, file_url})
 *   4. 调 redact-pdfs-pipeline.py 批量处理（下载 + 白块覆盖）
 *   5. 把结果 PDF 经 PUT /api/admin/suppliers/catalogs/:id/file 上传，DB file_url 自动更新
 *
 * 用法：
 *   ADMIN_TOKEN=<token> node scripts/redact-cn-catalogs.mjs --dry-run    # 只列要处理的 + 命中数
 *   ADMIN_TOKEN=<token> node scripts/redact-cn-catalogs.mjs --apply      # 处理 + 上传
 *   ADMIN_TOKEN=<token> node scripts/redact-cn-catalogs.mjs --apply --supplier 123    # 限定单个
 *
 * 环境：
 *   ADMIN_TOKEN  必填。浏览器登录 /admin 后 DevTools → localStorage → admin_token 复制
 *   API_BASE     默认 https://www.tarmeer.com/api
 */
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';

const API_BASE = (process.env.API_BASE || 'https://www.tarmeer.com/api').replace(/\/$/, '');
const TOKEN = process.env.ADMIN_TOKEN;
if (!TOKEN) {
  console.error('ERROR: 必须设 ADMIN_TOKEN（浏览器登录 /admin 后 localStorage.admin_token）');
  process.exit(2);
}

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const arg  = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const DRY_RUN = flag('--dry-run');
const APPLY   = flag('--apply');
const SUPPLIER_FILTER = arg('--supplier');
if (!DRY_RUN && !APPLY) { console.error('需 --dry-run 或 --apply'); process.exit(2); }
if (DRY_RUN && APPLY)   { console.error('--dry-run 与 --apply 互斥'); process.exit(2); }

const OUT_DIR = './tmp/cn-catalogs';
const DL_DIR  = `${OUT_DIR}/_dl`;
const RED_DIR = `${OUT_DIR}/redacted`;

const headers = { Authorization: `Bearer ${TOKEN}` };

async function fj(p) {
  const r = await fetch(p.startsWith('http') ? p : `${API_BASE}${p}`, { headers });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} on ${p}`);
  return r.json();
}

async function fetchAllCatalogs(supplierFilter) {
  const out = [];
  if (supplierFilter) {
    const d = await fj(`/admin/suppliers/${supplierFilter}`);
    for (const c of (d.catalogs || [])) {
      out.push({ supplier_id: d.supplier.id, slug: d.supplier.slug, company: d.supplier.company_name,
                 catalog_id: c.id, title: c.title, file_url: c.file_url });
    }
    return out;
  }
  let page = 1;
  while (true) {
    const data = await fj(`/admin/suppliers?origin=china&page=${page}&limit=100`);
    const list = data.suppliers || [];
    if (!list.length) break;
    for (const s of list) {
      if (Number(s.catalog_count) <= 0) continue;
      const d = await fj(`/admin/suppliers/${s.id}`);
      for (const c of (d.catalogs || [])) {
        out.push({ supplier_id: s.id, slug: s.slug, company: s.company_name,
                   catalog_id: c.id, title: c.title, file_url: c.file_url });
      }
    }
    if (list.length < 100) break;
    page++;
  }
  return out;
}

function runRedactPipeline(tasks, dryRun) {
  return new Promise((resolve, reject) => {
    const py = spawn('python3', [
      'scripts/redact-pdfs-pipeline.py',
      '--out-dir', RED_DIR,
      '--tmp-dir', DL_DIR,
      ...(dryRun ? ['--dry-run'] : []),
    ], { stdio: ['pipe', 'pipe', 'inherit'] });
    let buf = '';
    py.stdout.on('data', (d) => { buf += d.toString(); });
    py.on('close', (code) => {
      if (code !== 0) return reject(new Error(`pipeline exit ${code}`));
      const lines = buf.trim().split('\n').filter(Boolean);
      resolve(lines.map((l) => JSON.parse(l)));
    });
    py.stdin.write(JSON.stringify(tasks.map((t) => ({ id: t.catalog_id, file_url: t.file_url }))));
    py.stdin.end();
  });
}

async function uploadRedacted(catalogId, pdfPath) {
  const buf = await readFile(pdfPath);
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'application/pdf' }), `${catalogId}.pdf`);
  const r = await fetch(`${API_BASE}/admin/suppliers/catalogs/${catalogId}/file`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: fd,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`upload ${catalogId} failed: ${r.status} ${t}`);
  }
  return r.json();
}

(async () => {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(DL_DIR, { recursive: true });
  await mkdir(RED_DIR, { recursive: true });

  console.log(`API:   ${API_BASE}`);
  console.log(`Mode:  ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
  if (SUPPLIER_FILTER) console.log(`Filter: supplier_id=${SUPPLIER_FILTER}`);

  console.log('\n== 1. 列出 catalog ==');
  const catalogs = await fetchAllCatalogs(SUPPLIER_FILTER);
  console.log(`  → ${catalogs.length} 条 catalog`);
  await writeFile(`${OUT_DIR}/manifest.json`, JSON.stringify(catalogs, null, 2));
  if (!catalogs.length) { console.log('无可处理项'); return; }

  console.log('\n== 2. 跑 redact pipeline ==');
  const results = await runRedactPipeline(catalogs, DRY_RUN);
  await writeFile(`${OUT_DIR}/redact.log.jsonl`,
    results.map((r) => JSON.stringify(r)).join('\n'));

  const idToOk = new Map(results.filter((r) => r.status === 'ok').map((r) => [r.id, r]));
  console.log(`  → ok=${idToOk.size}  failed=${results.filter((r) => r.status !== 'ok').length}`);

  let totalHits = 0;
  for (const r of results) {
    const c = catalogs.find((c) => c.catalog_id === r.id);
    const hits = r.hits ? Object.entries(r.hits).map(([k, v]) => `${k}=${v}`).join(',') : '';
    const totalHit = r.hits ? Object.values(r.hits).reduce((a, b) => a + b, 0) : 0;
    totalHits += totalHit;
    console.log(`  [${c?.supplier_id}] ${c?.company} · ${c?.title}: ${r.status} ${hits || '(no hits)'}`);
  }
  console.log(`  → 总命中 ${totalHits} 处`);

  if (DRY_RUN) {
    console.log('\n=== 干跑结束。没有上传任何东西。'
      + '\n=== 检查 ./tmp/cn-catalogs/redact.log.jsonl 后用 --apply 跑实际处理。');
    return;
  }

  console.log('\n== 3. 上传打白后的 PDF ==');
  let uploaded = 0, upFailed = 0;
  for (const r of results) {
    if (r.status !== 'ok') continue;
    try {
      const result = await uploadRedacted(r.id, r.dst);
      uploaded++;
      const c = catalogs.find((c) => c.catalog_id === r.id);
      console.log(`  ✓ cat#${r.id} ${c?.company} · ${c?.title} → ${result.file_url}`);
    } catch (e) {
      upFailed++;
      console.log(`  ✗ cat#${r.id} ${e.message}`);
    }
  }
  console.log(`\n=== 完成 === uploaded=${uploaded}  upload_failed=${upFailed}`);
})();
