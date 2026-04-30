#!/usr/bin/env node
/**
 * Harness: Materials 页面 + Navbar 交互走查
 *
 * 用例:
 *   TC1:  /materials 页面返回 200
 *   TC2:  供应商公开列表 API 返回 approved 数据
 *   TC3:  每个 approved 供应商的封面图 HTTP 200（无 403/404）
 *   TC4:  每个 approved 供应商的 logo HTTP 200（有 logo 时）
 *   TC5:  /materials/suppliers/:slug 详情页返回 200
 *   TC6:  Navbar 源码不含 dropdown 间隙（mt-2）— 防复发
 *   TC7:  Navbar 源码使用 pt-2 桥接 — 修复验证
 *   TC8:  Navbar 关键链接目标页面返回 200
 *   TC9:  /portfolio 页面返回 200
 *   TC10: /companies 页面返回 200
 *
 * 用法:
 *   node scripts/harness/test-materials-nav.mjs
 *   node scripts/harness/test-materials-nav.mjs --url https://www.tarmeer.com
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const args = process.argv.slice(2);
const urlFlagIdx = args.indexOf('--url');
const BASE = (urlFlagIdx !== -1 && args[urlFlagIdx + 1]
  ? args[urlFlagIdx + 1]
  : 'https://www.tarmeer.com'
).replace(/\/+$/, '');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

let passed = 0;
let failed = 0;
const results = [];

function ok(tc, label) {
  passed++;
  results.push({ tc, label, ok: true });
  console.log(`  ✅ ${tc}: ${label}`);
}

function fail(tc, label, reason) {
  failed++;
  results.push({ tc, label, ok: false, reason });
  console.log(`  ❌ ${tc}: ${label}`);
  console.log(`      └─ ${reason}`);
}

async function test(tc, label, fn) {
  try {
    await fn();
    ok(tc, label);
  } catch (e) {
    fail(tc, label, e.message ?? String(e));
  }
}

async function fetchStatus(url) {
  const r = await fetch(url, {
    method: 'HEAD',
    headers: { 'User-Agent': 'TarmeerHarness/1.0' },
    redirect: 'follow',
  });
  return r.status;
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'TarmeerHarness/1.0' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ── SECTION 1: Materials 页面 ────────────────────────────────────────────────

console.log('\n── TC1-TC5: Materials 页面 & 封面图 ──');

await test('TC1', '/materials 页面返回 200', async () => {
  const s = await fetchStatus(`${BASE}/materials`);
  if (s !== 200) throw new Error(`Expected 200, got ${s}`);
});

let suppliers = [];

await test('TC2', '供应商公开列表 API 返回 approved 数据', async () => {
  const data = await fetchJson(`${BASE}/api/suppliers?limit=50`);
  if (!Array.isArray(data.suppliers)) throw new Error('缺少 suppliers 数组');
  if (data.suppliers.length === 0) throw new Error('无 approved 供应商');
  suppliers = data.suppliers;
  console.log(`      (${suppliers.length} 个供应商)`);
});

await test('TC3', '所有 approved 供应商封面图均可访问（HTTP 200）', async () => {
  const withCover = suppliers.filter(s => s.cover_image_url);
  if (withCover.length === 0) throw new Error('无封面图数据');

  const failures = [];
  await Promise.all(withCover.map(async (s) => {
    const url = s.cover_image_url.startsWith('http')
      ? s.cover_image_url
      : `${BASE}${s.cover_image_url}`;
    const status = await fetchStatus(url).catch(() => 0);
    if (status !== 200) {
      failures.push(`${s.company_name}: ${url} → ${status}`);
    }
  }));

  if (failures.length > 0) {
    throw new Error(`${failures.length} 张封面图无法访问:\n      ` + failures.join('\n      '));
  }
  console.log(`      (${withCover.length} 张封面图全部 200)`);
});

await test('TC4', '所有 approved 供应商 logo 可访问（HTTP 200）', async () => {
  const withLogo = suppliers.filter(s => s.logo_url);
  if (withLogo.length === 0) {
    console.log('      (无 logo 数据，跳过)');
    return;
  }

  const failures = [];
  await Promise.all(withLogo.map(async (s) => {
    const url = s.logo_url.startsWith('http') ? s.logo_url : `${BASE}${s.logo_url}`;
    const status = await fetchStatus(url).catch(() => 0);
    if (status !== 200) {
      failures.push(`${s.company_name}: ${url} → ${status}`);
    }
  }));

  if (failures.length > 0) {
    throw new Error(`${failures.length} 个 logo 无法访问:\n      ` + failures.join('\n      '));
  }
  console.log(`      (${withLogo.length} 个 logo 全部 200)`);
});

await test('TC5', '第一个供应商详情页返回 200', async () => {
  const first = suppliers.find(s => s.slug);
  if (!first) throw new Error('无有效 slug');
  const s = await fetchStatus(`${BASE}/materials/suppliers/${first.slug}`);
  if (s !== 200) throw new Error(`Expected 200, got ${s} (slug: ${first.slug})`);
});

// ── SECTION 2: Navbar 源码规范验证 ──────────────────────────────────────────

console.log('\n── TC6-TC8: Navbar 源码规范 ──');

const navbarSrc = (() => {
  try {
    return readFileSync(join(ROOT, 'src/components/Navbar.tsx'), 'utf-8');
  } catch {
    return null;
  }
})();

await test('TC6', 'Navbar dropdown 无 mt-2 间隙（防复发）', async () => {
  if (!navbarSrc) throw new Error('Navbar.tsx 无法读取');
  // 只检查 absolute top-full 后面跟 mt-2 的组合（这是危险的 gap 模式）
  const gapPattern = /absolute\s+top-full[^"]*mt-2/;
  if (gapPattern.test(navbarSrc)) {
    throw new Error('发现 absolute top-full + mt-2 组合 — dropdown 会有 hover 间隙，鼠标移动时菜单消失');
  }
});

await test('TC7', 'Navbar dropdown 使用 pt-2 桥接（修复验证）', async () => {
  if (!navbarSrc) throw new Error('Navbar.tsx 无法读取');
  const bridgePattern = /absolute\s+top-full[^"]*pt-2/;
  if (!bridgePattern.test(navbarSrc)) {
    throw new Error('未找到 absolute top-full + pt-2 组合 — dropdown hover 桥接可能缺失');
  }
});

// ── SECTION 3: 关键页面可访问性 ─────────────────────────────────────────────

console.log('\n── TC8-TC10: Navbar 链接目标页面 ──');

const navPages = [
  { tc: 'TC8',  path: '/portfolio',  label: '/portfolio 返回 200' },
  { tc: 'TC9',  path: '/companies',  label: '/companies 返回 200' },
  { tc: 'TC10', path: '/materials',  label: '/materials 返回 200（复查）' },
];

for (const { tc, path, label } of navPages) {
  await test(tc, label, async () => {
    const s = await fetchStatus(`${BASE}${path}`);
    if (s !== 200) throw new Error(`Expected 200, got ${s}`);
  });
}

// ── 汇总 ─────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅ 全部通过 ${passed}/${passed + failed} 用例`);
} else {
  console.log(`❌ ${failed} 失败 / ${passed} 通过（共 ${passed + failed} 用例）`);
  const failedList = results.filter(r => !r.ok);
  failedList.forEach(r => console.log(`   - ${r.tc}: ${r.label} — ${r.reason}`));
}
console.log(`${'─'.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
