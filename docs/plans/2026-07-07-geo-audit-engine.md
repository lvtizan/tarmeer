# GEO Audit Engine 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 做一个站点无关、零依赖的 `geo-audit` 引擎,抓取网站服务端 HTML,按 GEO rubric 打量化分,输出 `report.md` + `report.json`;先对 tarmeer 跑出首轮报告,再按优先级修 top 快赢项并重跑验证。

**Architecture:** 纯函数(HTML 抽取 → 逐维度检查 → 打分 → 渲染报告)与 I/O(fetch + 落盘)分离,便于用 fixture 做 TDD。checker 按页型选用适用维度;"答案可摘取性"这类只能人判的维度,脚本给机械代理分 + 导出证据供 Claude 抽样复核(薄 C 层)。配置数据化(页型 + 样本 URL + 适用维度),换站只改 config。

**Tech Stack:** Node ≥ 20 原生 ESM(项目实测 v25)、原生 `fetch`、内置 `node:test`、正则解析 HTML。**零第三方依赖**(与 `health-check-v2.mjs` 一致,便于客户侧直接 `node` 运行)。

**参考设计:** `docs/plans/2026-07-07-geo-assistant-design.md`(rubric 权重、维度定义、页型清单以该文档为准)。

---

## 已知事实(勿重复踩坑)

- 公司详情对外 URL 是 `https://www.tarmeer.com/@{slug}`(next.config.ts rewrite 到 `companies/[slug]`),canonical 应为 `/@{slug}`。
- `public/llms.txt` **已存在**且内容合理 → 审计以**实测**为准,别照搬设计文档的"预判快赢"。
- JSON-LD 已铺开(guide/company/expert/supplier/service×city/list 均有)→ 打的是**完整度/正确性**分,不是有无。
- robots.txt / sitemap.xml 未见静态文件,应为 Next 动态生成 → 审计**抓生产线上**的 `/robots.txt`、`/sitemap.xml`,不读源码。
- 无 cheerio/jsdom,**不新增依赖**,用正则抽取。
- 每种页型样本包含 AE **英文** URL(本轮阿语维度不计分,见设计文档 §2)。

## 目录结构(全部新建于 `scripts/geo-audit/`)

```
scripts/geo-audit/
  geo-audit.mjs          # CLI 编排(I/O:fetch → 跑检查 → 写文件)
  config.tarmeer.json    # tarmeer 页型 + 样本 URL + 适用维度
  lib/
    rubric.mjs           # 维度定义、权重、成本常量、页型→适用维度
    extract.mjs          # 纯函数:HTML 字符串 → 结构化事实
    checks.mjs           # 纯函数:事实 + 页型 → 逐维度子分 + 证据
    score.mjs            # 纯函数:逐页结果 → 归一化分 + 优先级清单
    report.mjs           # 纯函数:结果 → markdown
  test/
    fixtures/            # 保存的 HTML 片段(好/坏样例)
    extract.test.mjs
    checks.test.mjs
    score.test.mjs
    report.test.mjs
```

输出落盘:仓库根 `geo-audit/report.md`、`geo-audit/report.json`(`.gitignore` 视需要加,report.json 提交以便 before/after 对比)。

---

## Task 1: 脚手架 + rubric 数据

**Files:**
- Create: `scripts/geo-audit/lib/rubric.mjs`
- Create: `scripts/geo-audit/test/rubric.test.mjs`

**Step 1: 写失败测试**

`scripts/geo-audit/test/rubric.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIMENSIONS, PAGE_TYPES, applicableDimensions } from '../lib/rubric.mjs';

test('本轮 7 个计分维度,权重和为 88(阿语维度不计分)', () => {
  const scored = Object.values(DIMENSIONS).filter(d => d.scored);
  const sum = scored.reduce((a, d) => a + d.weight, 0);
  assert.equal(sum, 88);
});

test('每个维度有正的成本常量(用于优先级)', () => {
  for (const d of Object.values(DIMENSIONS)) assert.ok(d.cost > 0, `${d.id} 缺 cost`);
});

test('guide 页适用维度含 structuredData 与 answerExtractability', () => {
  const dims = applicableDimensions('guide');
  assert.ok(dims.includes('structuredData'));
  assert.ok(dims.includes('answerExtractability'));
});

test('list 页不跑 answerExtractability', () => {
  assert.ok(!applicableDimensions('list').includes('answerExtractability'));
});
```

**Step 2: 跑测试确认失败**

Run: `node --test scripts/geo-audit/test/rubric.test.mjs`
Expected: FAIL(`Cannot find module '../lib/rubric.mjs'`)

**Step 3: 写实现**

`scripts/geo-audit/lib/rubric.mjs`:
```js
// GEO rubric v1 — 权重/成本/页型适用性。阿语维度(localization)本轮 scored:false。
// 成本 cost:1=极低,2=低,3=中,5=高(修复相对工作量,用于 优先级=影响/成本)。
export const DIMENSIONS = {
  structuredData:       { id: 'structuredData',       label: '结构化数据/JSON-LD', weight: 20, cost: 3, scored: true,  auto: true  },
  crawlerAccess:        { id: 'crawlerAccess',        label: 'AI 爬虫可达性',      weight: 15, cost: 1, scored: true,  auto: true  },
  answerExtractability: { id: 'answerExtractability', label: '答案可摘取性',        weight: 20, cost: 3, scored: true,  auto: false }, // 机械代理分 + 人判
  structuredContent:    { id: 'structuredContent',    label: '结构化内容块',        weight: 12, cost: 3, scored: true,  auto: false },
  entityAuthority:      { id: 'entityAuthority',      label: '实体与权威信号',      weight: 12, cost: 3, scored: true,  auto: true  },
  localization:         { id: 'localization',         label: '多语言/本地化',       weight: 12, cost: 5, scored: false, auto: true  }, // 本轮不计分
  freshness:            { id: 'freshness',            label: '新鲜度信号',          weight: 5,  cost: 2, scored: true,  auto: true  },
  renderability:        { id: 'renderability',        label: '可渲染性',            weight: 4,  cost: 2, scored: true,  auto: true  },
};

// 页型 → 适用维度(仅列 scored:true 的;跨页型公用的 crawlerAccess/renderability 都含)
export const PAGE_TYPES = {
  home:           ['structuredData', 'crawlerAccess', 'entityAuthority', 'freshness', 'renderability'],
  companyDetail:  ['structuredData', 'crawlerAccess', 'answerExtractability', 'structuredContent', 'entityAuthority', 'freshness', 'renderability'],
  supplierDetail: ['structuredData', 'crawlerAccess', 'answerExtractability', 'structuredContent', 'entityAuthority', 'freshness', 'renderability'],
  expertDetail:   ['structuredData', 'crawlerAccess', 'answerExtractability', 'structuredContent', 'entityAuthority', 'freshness', 'renderability'],
  serviceCity:    ['structuredData', 'crawlerAccess', 'answerExtractability', 'structuredContent', 'entityAuthority', 'freshness', 'renderability'],
  guide:          ['structuredData', 'crawlerAccess', 'answerExtractability', 'structuredContent', 'entityAuthority', 'freshness', 'renderability'],
  list:           ['structuredData', 'crawlerAccess', 'entityAuthority', 'renderability'],
};

export function applicableDimensions(pageType) {
  const dims = PAGE_TYPES[pageType];
  if (!dims) throw new Error(`未知页型: ${pageType}`);
  return dims.filter(id => DIMENSIONS[id].scored);
}
```

**Step 4: 跑测试确认通过**

Run: `node --test scripts/geo-audit/test/rubric.test.mjs`
Expected: PASS(4 tests)

**Step 5: Commit**

```bash
git add scripts/geo-audit/lib/rubric.mjs scripts/geo-audit/test/rubric.test.mjs
git commit -m "feat(geo-audit): rubric 维度/权重/页型适用性 + 测试"
```

---

## Task 2: HTML 抽取纯函数

从服务端 HTML 抽出所有 GEO 判定要用的事实。**只用正则,零依赖。**

**Files:**
- Create: `scripts/geo-audit/lib/extract.mjs`
- Create: `scripts/geo-audit/test/extract.test.mjs`
- Create: `scripts/geo-audit/test/fixtures/good-guide.html`、`bad-thin.html`

**Step 1: 写 fixtures**

`scripts/geo-audit/test/fixtures/good-guide.html`(自包含好样例):
```html
<!doctype html><html lang="en"><head>
<title>Renovation Cost in Dubai 2026: Complete Guide</title>
<meta name="description" content="How much does renovation cost in Dubai in 2026? Full breakdown by room and finish level.">
<link rel="canonical" href="https://www.tarmeer.com/guide/renovation-cost-dubai">
<link rel="alternate" hreflang="en" href="https://www.tarmeer.com/guide/renovation-cost-dubai">
<link rel="alternate" hreflang="ar" href="https://www.tarmeer.com/ar/guide/renovation-cost-dubai">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","@id":"https://www.tarmeer.com/guide/renovation-cost-dubai","headline":"Renovation Cost in Dubai 2026","datePublished":"2026-05-28","dateModified":"2026-07-01","author":{"@type":"Organization","name":"Tarmeer"},"publisher":{"@type":"Organization","name":"Tarmeer"}}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"How much does renovation cost in Dubai?","acceptedAnswer":{"@type":"Answer","text":"Between AED 500 and AED 1,500 per sqft depending on finish."}}]}</script>
</head><body>
<h1>Renovation Cost in Dubai 2026</h1>
<p>Renovating a home in Dubai in 2026 costs between AED 500 and AED 1,500 per square foot, depending on the finish level and scope of work involved.</p>
<h2>How much does a villa renovation cost?</h2>
<p>A full villa renovation ranges from AED 400,000 to AED 1.2M according to platform project data.</p>
<table><tr><th>Room</th><th>Cost (AED)</th></tr><tr><td>Kitchen</td><td>60,000</td></tr></table>
<h2>What affects the price?</h2>
<ul><li>Finish level</li><li>Structural changes</li></ul>
</body></html>
```

`scripts/geo-audit/test/fixtures/bad-thin.html`(缺项坏样例):
```html
<!doctype html><html><head><title>Company</title></head>
<body><div id="root"></div></body></html>
```

**Step 2: 写失败测试**

`scripts/geo-audit/test/extract.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractFacts } from '../lib/extract.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const good = readFileSync(path.join(dir, 'fixtures/good-guide.html'), 'utf8');
const bad = readFileSync(path.join(dir, 'fixtures/bad-thin.html'), 'utf8');

test('抽出所有 JSON-LD 块并解析类型', () => {
  const f = extractFacts(good);
  const types = f.jsonLd.flatMap(b => [].concat(b['@type'] || []));
  assert.ok(types.includes('Article'));
  assert.ok(types.includes('FAQPage'));
});

test('抽 title/description/canonical/h1', () => {
  const f = extractFacts(good);
  assert.match(f.title, /Renovation Cost in Dubai 2026/);
  assert.ok(f.metaDescription.length > 0);
  assert.equal(f.canonical, 'https://www.tarmeer.com/guide/renovation-cost-dubai');
  assert.equal(f.h1Count, 1);
});

test('抽 hreflang 对', () => {
  const f = extractFacts(good);
  assert.deepEqual(f.hreflang.sort(), ['ar', 'en']);
});

test('检测问句型小标题与表格/清单', () => {
  const f = extractFacts(good);
  assert.ok(f.questionHeadings >= 2);
  assert.ok(f.hasTable);
  assert.ok(f.hasList);
});

test('抽首段(用于答案可摘取性代理)', () => {
  const f = extractFacts(good);
  assert.ok(f.firstParagraphWords >= 20);
});

test('坏样例:无 JSON-LD、body 文本极少', () => {
  const f = extractFacts(bad);
  assert.equal(f.jsonLd.length, 0);
  assert.ok(f.visibleTextWords < 10);
  assert.equal(f.canonical, null);
});
```

**Step 3: 写实现**

`scripts/geo-audit/lib/extract.mjs`:
```js
// 纯函数:服务端 HTML 字符串 → 结构化事实。零依赖,正则解析。
// 目标是"AI 爬虫看到什么",故只看 HTML 里已有的文本,不执行 JS。

const stripTags = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ').trim();

const wordCount = (s) => (s.match(/\S+/g) || []).length;

function parseJsonLd(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      // @graph 展开
      if (parsed['@graph']) out.push(...parsed['@graph']);
      else out.push(parsed);
    } catch { out.push({ __parseError: true }); }
  }
  return out;
}

function attr(html, tagRe) { const m = html.match(tagRe); return m ? m[1].trim() : null; }

export function extractFacts(html) {
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  const head = headMatch ? headMatch[0] : html;
  const bodyMatch = html.match(/<body[\s\S]*?<\/body>/i);
  const body = bodyMatch ? bodyMatch[0] : html;

  const title = attr(head, /<title[^>]*>([\s\S]*?)<\/title>/i) || '';
  const metaDescription = attr(head, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || '';
  const canonical = attr(head, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  const htmlLang = attr(html, /<html[^>]*\blang=["']([^"']*)["']/i);
  const htmlDir = attr(html, /<html[^>]*\bdir=["']([^"']*)["']/i);

  const hreflang = [];
  const hlRe = /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']*)["']/gi;
  let hm; while ((hm = hlRe.exec(head))) hreflang.push(hm[1]);

  const h1s = body.match(/<h1[^>]*>[\s\S]*?<\/h1>/gi) || [];
  const headings = body.match(/<h[23][^>]*>[\s\S]*?<\/h[23]>/gi) || [];
  const questionHeadings = headings.filter(h => stripTags(h).includes('?')).length;

  const firstP = (body.match(/<p[^>]*>([\s\S]*?)<\/p>/i) || [])[1] || '';

  return {
    jsonLd: parseJsonLd(html),
    title, metaDescription, canonical, htmlLang, htmlDir,
    hreflang,
    h1Count: h1s.length,
    h1Text: h1s.map(stripTags),
    headingCount: headings.length,
    questionHeadings,
    firstParagraphWords: wordCount(stripTags(firstP)),
    hasTable: /<table[\s>]/i.test(body),
    hasList: /<(ul|ol)[\s>]/i.test(body),
    visibleTextWords: wordCount(stripTags(body)),
  };
}
```

**Step 4: 跑测试确认通过**

Run: `node --test scripts/geo-audit/test/extract.test.mjs`
Expected: PASS(6 tests)

**Step 5: Commit**

```bash
git add scripts/geo-audit/lib/extract.mjs scripts/geo-audit/test/extract.test.mjs scripts/geo-audit/test/fixtures/
git commit -m "feat(geo-audit): HTML 事实抽取纯函数 + fixtures"
```

---

## Task 3: 逐维度 checker

输入 = `extractFacts` 的结果 + 页型 + 站点级事实(robots/sitemap,见 Task 4 注入);输出 = `{ [dimId]: { score: 0..1, evidence, reviewNeeded } }`。

**Files:**
- Create: `scripts/geo-audit/lib/checks.mjs`
- Create: `scripts/geo-audit/test/checks.test.mjs`

**Step 1: 写失败测试**

`scripts/geo-audit/test/checks.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractFacts } from '../lib/extract.mjs';
import { runChecks } from '../lib/checks.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const good = extractFacts(readFileSync(path.join(dir, 'fixtures/good-guide.html'), 'utf8'));
const bad = extractFacts(readFileSync(path.join(dir, 'fixtures/bad-thin.html'), 'utf8'));

const siteOk = { robotsAllows: { GPTBot: true, PerplexityBot: true, ClaudeBot: true, 'Google-Extended': true }, hasLlmsTxt: true, inSitemap: true };
const siteBad = { robotsAllows: { GPTBot: false, PerplexityBot: false, ClaudeBot: false, 'Google-Extended': false }, hasLlmsTxt: false, inSitemap: false };

test('好 guide:structuredData 满分(Article+FAQPage+dateModified)', () => {
  const r = runChecks(good, 'guide', siteOk);
  assert.equal(r.structuredData.score, 1);
});

test('好 guide:crawlerAccess 满分', () => {
  const r = runChecks(good, 'guide', siteOk);
  assert.equal(r.crawlerAccess.score, 1);
});

test('坏页:crawlerAccess 低分且证据列出被封爬虫', () => {
  const r = runChecks(bad, 'guide', siteBad);
  assert.ok(r.crawlerAccess.score < 0.5);
  assert.ok(r.crawlerAccess.evidence.blocked.length >= 4);
});

test('answerExtractability 标记 reviewNeeded=true(薄 C 层)', () => {
  const r = runChecks(good, 'guide', siteOk);
  assert.equal(r.answerExtractability.reviewNeeded, true);
  assert.ok(r.answerExtractability.score > 0.5); // 有首段+问句标题的代理分
});

test('坏页:renderability 低(无 h1/描述,正文空)', () => {
  const r = runChecks(bad, 'guide', siteBad);
  assert.ok(r.renderability.score < 0.5);
});

test('只返回该页型适用维度', () => {
  const r = runChecks(good, 'list', siteOk);
  assert.ok(!('answerExtractability' in r));
  assert.ok('structuredData' in r);
});
```

**Step 2: 跑测试确认失败**

Run: `node --test scripts/geo-audit/test/checks.test.mjs`
Expected: FAIL(`Cannot find module '../lib/checks.mjs'`)

**Step 3: 写实现**

`scripts/geo-audit/lib/checks.mjs`:
```js
import { applicableDimensions } from './rubric.mjs';

const typesOf = (jsonLd) => jsonLd.flatMap(b => [].concat(b['@type'] || []));
const hasType = (jsonLd, t) => typesOf(jsonLd).includes(t);
const findType = (jsonLd, t) => jsonLd.find(b => [].concat(b['@type'] || []).includes(t));

// 每页型期望的核心 schema 类型
const EXPECTED_SCHEMA = {
  home:           ['Organization'],
  companyDetail:  ['LocalBusiness'],   // 或 Organization,择一即可
  supplierDetail: ['LocalBusiness'],
  expertDetail:   ['Person'],
  serviceCity:    ['ItemList'],
  guide:          ['Article', 'FAQPage'],
  list:           ['ItemList', 'BreadcrumbList'],
};
const SCHEMA_ALIASES = { LocalBusiness: ['LocalBusiness', 'Organization'] };

function checkStructuredData(f, pageType) {
  const want = EXPECTED_SCHEMA[pageType] || [];
  if (!want.length) return { score: 1, evidence: { note: '该页型无 schema 要求' } };
  const missing = [];
  for (const t of want) {
    const accept = SCHEMA_ALIASES[t] || [t];
    if (!accept.some(a => hasType(f.jsonLd, a))) missing.push(t);
  }
  const parseErrors = f.jsonLd.filter(b => b.__parseError).length;
  // 质量项:canonical/@id/dateModified
  const primary = findType(f.jsonLd, want[0]) || {};
  const qualityChecks = [
    !!f.canonical,
    !!(primary['@id']),
    // Article/详情页应有 dateModified
    (pageType === 'guide') ? !!primary.dateModified : true,
  ];
  const presenceScore = want.length ? (want.length - missing.length) / want.length : 1;
  const qualityScore = qualityChecks.filter(Boolean).length / qualityChecks.length;
  let score = presenceScore * 0.7 + qualityScore * 0.3;
  if (parseErrors) score = Math.min(score, 0.5);
  return { score: Math.max(0, Math.min(1, score)),
    evidence: { want, missing, parseErrors, canonical: !!f.canonical, hasId: !!primary['@id'] } };
}

const AI_BOTS = ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended'];
function checkCrawlerAccess(f, pageType, site) {
  const blocked = AI_BOTS.filter(b => site.robotsAllows?.[b] === false);
  const botScore = (AI_BOTS.length - blocked.length) / AI_BOTS.length; // 0..1
  const parts = [botScore, site.hasLlmsTxt ? 1 : 0, site.inSitemap ? 1 : 0];
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { score, evidence: { blocked, hasLlmsTxt: !!site.hasLlmsTxt, inSitemap: !!site.inSitemap } };
}

// 机械代理 + 人判标记(薄 C 层)。代理信号:首段词数、问句标题数、正文非空。
function checkAnswerExtractability(f) {
  const leadOk = f.firstParagraphWords >= 40 ? 1 : f.firstParagraphWords >= 20 ? 0.5 : 0;
  const qOk = f.questionHeadings >= 2 ? 1 : f.questionHeadings === 1 ? 0.5 : 0;
  const bodyOk = f.visibleTextWords >= 300 ? 1 : f.visibleTextWords >= 100 ? 0.5 : 0;
  const score = leadOk * 0.4 + qOk * 0.3 + bodyOk * 0.3;
  return { score, reviewNeeded: true,
    evidence: { firstParagraphWords: f.firstParagraphWords, questionHeadings: f.questionHeadings, visibleTextWords: f.visibleTextWords } };
}

function checkStructuredContent(f) {
  const hasFaq = hasType(f.jsonLd, 'FAQPage');
  const parts = [f.hasTable ? 1 : 0, f.hasList ? 1 : 0, hasFaq ? 1 : 0];
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { score, reviewNeeded: true, evidence: { hasTable: f.hasTable, hasList: f.hasList, hasFaqSchema: hasFaq } };
}

function checkEntityAuthority(f, pageType) {
  const org = findType(f.jsonLd, 'Organization') || findType(f.jsonLd, 'LocalBusiness') || {};
  const parts = [
    !!(org.name),
    !!(org.address || org.telephone) || pageType === 'guide',   // guide 不强求 NAP
    Array.isArray(org.sameAs) && org.sameAs.length > 0,
  ];
  const score = parts.filter(Boolean).length / parts.length;
  return { score, evidence: { hasName: !!org.name, hasNAP: !!(org.address || org.telephone), hasSameAs: Array.isArray(org.sameAs) && org.sameAs.length > 0 } };
}

function checkFreshness(f, pageType) {
  const primary = f.jsonLd.find(b => b.dateModified) || {};
  const hasYear = /20(2[6-9]|3\d)/.test(f.title + ' ' + f.metaDescription);
  const hasDateMod = !!primary.dateModified;
  const parts = pageType === 'guide' ? [hasYear ? 1 : 0, hasDateMod ? 1 : 0] : [hasDateMod ? 1 : 0.5];
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { score, evidence: { hasYearInTitle: hasYear, hasDateModified: hasDateMod } };
}

function checkRenderability(f) {
  const parts = [
    f.title && f.title.length > 5 ? 1 : 0,
    f.metaDescription && f.metaDescription.length > 20 ? 1 : 0,
    f.h1Count === 1 ? 1 : f.h1Count > 1 ? 0.5 : 0,
    f.visibleTextWords >= 100 ? 1 : 0,
  ];
  const score = parts.reduce((a, b) => a + b, 0) / parts.length;
  return { score, evidence: { title: f.title, h1Count: f.h1Count, visibleTextWords: f.visibleTextWords } };
}

const CHECKERS = {
  structuredData:       (f, pt) => checkStructuredData(f, pt),
  crawlerAccess:        (f, pt, site) => checkCrawlerAccess(f, pt, site),
  answerExtractability: (f) => checkAnswerExtractability(f),
  structuredContent:    (f) => checkStructuredContent(f),
  entityAuthority:      (f, pt) => checkEntityAuthority(f, pt),
  freshness:            (f, pt) => checkFreshness(f, pt),
  renderability:        (f) => checkRenderability(f),
};

export function runChecks(facts, pageType, site = {}) {
  const out = {};
  for (const dim of applicableDimensions(pageType)) {
    out[dim] = CHECKERS[dim](facts, pageType, site);
  }
  return out;
}
```

**Step 4: 跑测试确认通过**

Run: `node --test scripts/geo-audit/test/checks.test.mjs`
Expected: PASS(6 tests)。若个别代理阈值致某断言差一点,**只调 fixture 或阈值常量,不得删断言**。

**Step 5: Commit**

```bash
git add scripts/geo-audit/lib/checks.mjs scripts/geo-audit/test/checks.test.mjs
git commit -m "feat(geo-audit): 逐维度 checker(含薄 C 层 reviewNeeded 标记)"
```

---

## Task 4: 打分 + 优先级

**Files:**
- Create: `scripts/geo-audit/lib/score.mjs`
- Create: `scripts/geo-audit/test/score.test.mjs`

**Step 1: 写失败测试**

`scripts/geo-audit/test/score.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePage, aggregate } from '../lib/score.mjs';

// 构造两页结果(dimId → {score})
const pageA = { pageType: 'guide', url: 'u1', checks: {
  structuredData: { score: 1 }, crawlerAccess: { score: 1 }, answerExtractability: { score: 1 },
  structuredContent: { score: 1 }, entityAuthority: { score: 1 }, freshness: { score: 1 }, renderability: { score: 1 } } };
const pageB = { pageType: 'guide', url: 'u2', checks: {
  structuredData: { score: 0 }, crawlerAccess: { score: 1 }, answerExtractability: { score: 0.5 },
  structuredContent: { score: 1 }, entityAuthority: { score: 1 }, freshness: { score: 1 }, renderability: { score: 1 } } };

test('单页分归一化到 0..100', () => {
  const s = scorePage(pageA);
  assert.ok(s > 90 && s <= 100);
});

test('缺 structuredData(权重20)明显拉低单页分', () => {
  assert.ok(scorePage(pageB) < scorePage(pageA) - 15);
});

test('aggregate 给出总分、页型均分、优先级清单', () => {
  const agg = aggregate([pageA, pageB]);
  assert.ok(agg.overall > 0 && agg.overall <= 100);
  assert.ok(agg.byPageType.guide >= 0);
  assert.ok(Array.isArray(agg.priorities));
  // structuredData 因 pageB 缺失,应排在优先级前列
  assert.equal(agg.priorities[0].dimension, 'structuredData');
});

test('优先级项含 impact/cost/affectedUrls', () => {
  const p = aggregate([pageA, pageB]).priorities[0];
  assert.ok(p.impact > 0 && p.cost > 0);
  assert.ok(p.affectedUrls.includes('u2'));
});
```

**Step 2: 跑测试确认失败**

Run: `node --test scripts/geo-audit/test/score.test.mjs`
Expected: FAIL

**Step 3: 写实现**

`scripts/geo-audit/lib/score.mjs`:
```js
import { DIMENSIONS } from './rubric.mjs';

// 单页:Σ(weight×subscore)/Σweight ×100(只算该页出现的维度)
export function scorePage(page) {
  let wsum = 0, acc = 0;
  for (const [dim, res] of Object.entries(page.checks)) {
    const w = DIMENSIONS[dim].weight;
    wsum += w; acc += w * res.score;
  }
  return wsum ? +(acc / wsum * 100).toFixed(1) : 0;
}

export function aggregate(pages) {
  // 页型均分
  const byType = {};
  for (const p of pages) {
    (byType[p.pageType] ||= []).push(scorePage(p));
  }
  const byPageType = {};
  for (const [t, arr] of Object.entries(byType)) {
    byPageType[t] = +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1);
  }
  // 总分 = 各页型均分的均值(避免某页型样本多而带偏)
  const typeMeans = Object.values(byPageType);
  const overall = typeMeans.length ? +(typeMeans.reduce((a, b) => a + b, 0) / typeMeans.length).toFixed(1) : 0;

  // 优先级:按维度聚合缺口。impact = weight × Σ(1-score);cost = 维度常量;priority = impact/cost
  const gaps = {};
  for (const p of pages) {
    for (const [dim, res] of Object.entries(p.checks)) {
      const gap = 1 - res.score;
      if (gap <= 0.001) continue;
      const g = (gaps[dim] ||= { dimension: dim, label: DIMENSIONS[dim].label, impactRaw: 0, cost: DIMENSIONS[dim].cost, affectedUrls: [] });
      g.impactRaw += DIMENSIONS[dim].weight * gap;
      g.affectedUrls.push(p.url);
    }
  }
  const priorities = Object.values(gaps).map(g => ({
    dimension: g.dimension, label: g.label,
    impact: +g.impactRaw.toFixed(1), cost: g.cost,
    priority: +(g.impactRaw / g.cost).toFixed(1),
    affectedUrls: g.affectedUrls,
  })).sort((a, b) => b.priority - a.priority);

  return { overall, byPageType, priorities };
}
```

**Step 4: 跑测试确认通过**

Run: `node --test scripts/geo-audit/test/score.test.mjs`
Expected: PASS(4 tests)

**Step 5: Commit**

```bash
git add scripts/geo-audit/lib/score.mjs scripts/geo-audit/test/score.test.mjs
git commit -m "feat(geo-audit): 单页/全站打分 + 优先级排序"
```

---

## Task 5: Markdown 报告渲染

**Files:**
- Create: `scripts/geo-audit/lib/report.mjs`
- Create: `scripts/geo-audit/test/report.test.mjs`

**Step 1: 写失败测试**

`scripts/geo-audit/test/report.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReport } from '../lib/report.mjs';

const data = {
  baseUrl: 'https://www.tarmeer.com', generatedAt: '2026-07-07',
  overall: 72.3, byPageType: { guide: 80, companyDetail: 65 },
  priorities: [
    { dimension: 'structuredData', label: '结构化数据/JSON-LD', impact: 20, cost: 3, priority: 6.7, affectedUrls: ['https://www.tarmeer.com/@acme'] },
  ],
  pages: [{ url: 'https://www.tarmeer.com/@acme', pageType: 'companyDetail', score: 65,
    checks: { structuredData: { score: 0.5, evidence: { missing: [] } } } }],
};

test('报告含总分、页型分、最痛短板表', () => {
  const md = renderReport(data);
  assert.match(md, /72\.3/);
  assert.match(md, /结构化数据/);
  assert.match(md, /最痛|优先级/);
  assert.match(md, /www\.tarmeer\.com/);
});

test('report 是字符串且非空', () => {
  assert.ok(typeof renderReport(data) === 'string' && renderReport(data).length > 100);
});
```

**Step 2: 跑测试确认失败**

Run: `node --test scripts/geo-audit/test/report.test.mjs`
Expected: FAIL

**Step 3: 写实现**

`scripts/geo-audit/lib/report.mjs`:
```js
export function renderReport(d) {
  const lines = [];
  lines.push(`# GEO 审计报告 — ${d.baseUrl}`);
  lines.push('');
  lines.push(`**生成时间**: ${d.generatedAt}`);
  lines.push(`**总分**: **${d.overall} / 100**`);
  lines.push('');
  lines.push('## 各页型得分');
  lines.push('| 页型 | 分数 |');
  lines.push('|------|-----:|');
  for (const [t, s] of Object.entries(d.byPageType)) lines.push(`| ${t} | ${s} |`);
  lines.push('');
  lines.push('## 最痛短板(按 优先级=影响/成本 降序)');
  lines.push('| # | 维度 | 影响 | 成本 | 优先级 | 命中页数 |');
  lines.push('|---|------|-----:|-----:|-------:|--------:|');
  d.priorities.forEach((p, i) => {
    lines.push(`| ${i + 1} | ${p.label} | ${p.impact} | ${p.cost} | ${p.priority} | ${p.affectedUrls.length} |`);
  });
  lines.push('');
  lines.push('## 逐页明细');
  for (const p of d.pages) {
    lines.push(`### ${p.pageType} — ${p.url} · ${p.score}/100`);
    for (const [dim, res] of Object.entries(p.checks)) {
      const flag = res.reviewNeeded ? ' 🧑需人判' : '';
      lines.push(`- **${dim}**: ${(res.score * 100).toFixed(0)}%${flag} — \`${JSON.stringify(res.evidence || {})}\``);
    }
    lines.push('');
  }
  return lines.join('\n');
}
```

**Step 4: 跑测试确认通过**

Run: `node --test scripts/geo-audit/test/report.test.mjs`
Expected: PASS(2 tests)

**Step 5: Commit**

```bash
git add scripts/geo-audit/lib/report.mjs scripts/geo-audit/test/report.test.mjs
git commit -m "feat(geo-audit): markdown 报告渲染"
```

---

## Task 6: tarmeer 配置 + CLI 编排

**Files:**
- Create: `scripts/geo-audit/config.tarmeer.json`
- Create: `scripts/geo-audit/geo-audit.mjs`

**Step 1: 先用生产 sitemap 挑真实样本 URL**

Run(取真实详情页 slug,每型选 2 个英文页):
```bash
curl -s --noproxy '*' https://www.tarmeer.com/sitemap.xml | grep -oE '<loc>[^<]+</loc>' | sed 's/<[^>]*>//g' | head -100
```
从输出里各页型选 2 个真实 URL 填入 config(公司详情用 `/@{slug}` 形式;若 sitemap 给的是 `/companies/{slug}` 也可,审计跟随即可)。

**Step 2: 写 config**

`scripts/geo-audit/config.tarmeer.json`(URL 用 Step 1 的真实值替换占位):
```json
{
  "baseUrl": "https://www.tarmeer.com",
  "robotsBots": ["GPTBot", "PerplexityBot", "ClaudeBot", "Google-Extended"],
  "pages": [
    { "pageType": "home",           "urls": ["https://www.tarmeer.com/"] },
    { "pageType": "list",           "urls": ["https://www.tarmeer.com/companies", "https://www.tarmeer.com/experts"] },
    { "pageType": "companyDetail",  "urls": ["<REAL_/@slug_1>", "<REAL_/@slug_2>"] },
    { "pageType": "supplierDetail", "urls": ["<REAL_supplier_1>", "<REAL_supplier_2>"] },
    { "pageType": "expertDetail",   "urls": ["<REAL_expert_1>", "<REAL_expert_2>"] },
    { "pageType": "serviceCity",    "urls": ["<REAL_service_city_1>", "<REAL_service_city_2>"] },
    { "pageType": "guide",          "urls": ["<REAL_guide_1>", "<REAL_guide_2>"] }
  ]
}
```

**Step 3: 写 CLI**

`scripts/geo-audit/geo-audit.mjs`:
```js
#!/usr/bin/env node
// GEO 审计 CLI。用法:
//   node scripts/geo-audit/geo-audit.mjs --config scripts/geo-audit/config.tarmeer.json
//   node scripts/geo-audit/geo-audit.mjs --base-url https://example.com --config <path>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { extractFacts } from './lib/extract.mjs';
import { runChecks } from './lib/checks.mjs';
import { scorePage, aggregate } from './lib/score.mjs';
import { renderReport } from './lib/report.mjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '../../..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) =>
  v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a, []));
const cfg = JSON.parse(readFileSync(args.config, 'utf8'));
const baseUrl = (args['base-url'] || cfg.baseUrl).replace(/\/$/, '');

async function fetchText(url, opts = {}) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'GEO-Audit/1.0' }, ...opts });
    return { status: res.status, body: await res.text() };
  } catch (e) { return { status: 0, body: '', error: String(e) }; }
}

// 站点级事实:robots(逐 bot 判 Allow/Disallow)、llms.txt、sitemap 集合
function robotsAllows(robotsTxt, bot) {
  // 简化:找该 UA 段或 * 段的 Disallow: /。命中则 false。
  const blocks = robotsTxt.split(/(?=User-agent:)/i);
  const forBot = blocks.find(b => new RegExp(`User-agent:\\s*${bot}`, 'i').test(b));
  const star = blocks.find(b => /User-agent:\s*\*/i.test(b));
  const block = forBot || star || '';
  return !/Disallow:\s*\/\s*$/im.test(block);
}

async function main() {
  const [robots, llms, sitemap] = await Promise.all([
    fetchText(`${baseUrl}/robots.txt`),
    fetchText(`${baseUrl}/llms.txt`),
    fetchText(`${baseUrl}/sitemap.xml`),
  ]);
  const robotsAllowsMap = Object.fromEntries((cfg.robotsBots || []).map(b => [b, robotsAllows(robots.body, b)]));
  const hasLlmsTxt = llms.status === 200 && llms.body.length > 20;
  const sitemapUrls = new Set((sitemap.body.match(/<loc>([^<]+)<\/loc>/gi) || []).map(m => m.replace(/<\/?loc>/gi, '')));

  const pages = [];
  for (const group of cfg.pages) {
    for (const url of group.urls) {
      const { status, body } = await fetchText(url);
      const facts = extractFacts(body);
      const site = { robotsAllows: robotsAllowsMap, hasLlmsTxt, inSitemap: sitemapUrls.has(url) };
      const checks = status === 200 ? runChecks(facts, group.pageType, site) : {};
      const page = { url, pageType: group.pageType, httpStatus: status, checks };
      page.score = status === 200 ? scorePage(page) : 0;
      pages.push(page);
    }
  }

  const agg = aggregate(pages.filter(p => p.httpStatus === 200));
  const now = new Date().toISOString().slice(0, 10);
  const data = { baseUrl, generatedAt: now, ...agg, pages, siteFacts: { robotsAllowsMap, hasLlmsTxt } };

  const outDir = path.join(ROOT, 'geo-audit');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(data, null, 2));
  writeFileSync(path.join(outDir, 'report.md'), renderReport(data));
  console.log(`GEO 总分 ${agg.overall}/100 → geo-audit/report.md`);
  console.log('Top 短板:', agg.priorities.slice(0, 5).map(p => `${p.label}(${p.priority})`).join('、'));
}
main();
```

> 注:`new Date()` 在本仓库脚本正常可用(此约束仅限 Workflow 脚本环境)。

**Step 4: 跑真实审计**

Run: `node scripts/geo-audit/geo-audit.mjs --config scripts/geo-audit/config.tarmeer.json`
Expected: 打印总分 + Top 短板;生成 `geo-audit/report.md` 与 `report.json`。
若某页 404/软404 → `httpStatus` 非 200 或分数异常,**记录为发现项**(软 404 是已知坑)。

**Step 5: Commit**

```bash
git add scripts/geo-audit/config.tarmeer.json scripts/geo-audit/geo-audit.mjs geo-audit/report.json geo-audit/report.md
git commit -m "feat(geo-audit): tarmeer 配置 + CLI 编排 + 首轮报告"
```

---

## Task 7: 薄 C 层——抽样人判 + 校准

对标了 `reviewNeeded: true` 的维度(answerExtractability、structuredContent),Claude 逐个页型抽 1 个样本,**读 report.json 里导出的证据 + 必要时重新 fetch 该 URL 的 HTML**,人工判定真实子分,写入 `geo-audit/review-notes.md`;若机械代理分与人判系统性偏差,回填校准 checks.mjs 的阈值常量(仅调常量,不动断言)。

**Files:**
- Create: `geo-audit/review-notes.md`
- Modify(按需): `scripts/geo-audit/lib/checks.mjs`(阈值常量)

**Step 1:** 每个含 reviewNeeded 的页型抽 1 URL,记录:首段是否真的一句话直答?小标题是否问句化?有无可被 AI 整段摘录的自包含答案?表格/清单是否真结构化(非装饰)?

**Step 2:** 写 `review-notes.md`,每条含 URL、维度、代理分、人判分、差异原因、改进建议。

**Step 3:** 若偏差系统性(例如首段阈值 40 词过严),调 checks.mjs 常量并重跑 `node --test scripts/geo-audit/test/`(全绿)。

**Step 4: Commit**

```bash
git add geo-audit/review-notes.md scripts/geo-audit/lib/checks.mjs
git commit -m "docs(geo-audit): 抽样人判校准 + 阈值微调"
```

---

## Task 8: 按优先级修 top 快赢项(逐项一 commit)

以 `geo-audit/report.md` 的优先级清单为准(**不照搬设计文档预判**)。对 Top N(建议先做 priority 最高且 cost≤2 的 3-5 项),逐项:

**通用循环(每项)**
1. 读该维度命中的 `affectedUrls` 与证据,定位真实源码文件(`src/app/**` 对应页型;robots/sitemap 若为动态生成找 `src/app/robots.ts|sitemap.ts`,没有则新建)。
2. **改前全量搜索**(AGENTS.md 铁律):`grep -rn` 该逻辑在 `src/` 全部出现处,统一修,不只改一处。
3. 改。若涉及详情页缺数据分支 → 必须 `notFound()`(禁软 404,tarmeer 老坑)。
4. 跑 `node scripts/geo-audit/geo-audit.mjs --config ...` 确认该维度分上升。
5. `node scripts/harness/smoke-test.mjs`(tsc + 路由)全绿。
6. 若改了用户侧写入口/国家相关 → 另跑 `node scripts/harness/country-walkthrough.mjs`(先重启本地后端防限流)。
7. 逐项 commit:`git commit -m "fix(geo): <维度> — <具体页型>"`。

**要部署的前端改动**:本地 `node_modules/.bin/next build` 须 exit=0(防线上 build 失败);跑完 build 记得重启 5180 dev server。

**典型快赢修法(命中才做)**
- crawlerAccess 缺:`src/app/robots.ts` 显式 `allow` 四个 AI bot(GPTBot/PerplexityBot/ClaudeBot/Google-Extended);llms.txt 已存在则确认被 fetch 到即可。
- structuredData 详情页缺 `@id`/`dateModified`/`sameAs`:在对应 `page.tsx` 的 JSON-LD 补全,canonical/og:url 用 `/@{slug}`。
- guide 缺 FAQPage:在 guide 模板注入 FAQPage schema(与页面 FAQ 块内容一致,禁硬编码 schema——若 tarmeer 有 survey-schema 式 DB 源则读源)。
- freshness:guide 标题/正文含年份,补 `dateModified`。

---

## Task 9: 修完重跑 + before/after + 收尾

**Step 1:** 重跑审计,对比 `report.json` 的 before/after `overall` 与各维度分。
```bash
cp geo-audit/report.json geo-audit/report.before.json   # 在 Task 8 开始前做!
# ...修复...
node scripts/geo-audit/geo-audit.mjs --config scripts/geo-audit/config.tarmeer.json
```
**Step 2:** 在 `geo-audit/report.md` 顶部或 `review-notes.md` 记 before/after 提升(卖服务的样板证据)。

**Step 3: feature-done 自检**(AGENTS.md 第六步铁律):smoke-test 全绿、新行为有用例(本引擎的 node:test 即用例)、报告附测试结果。

**Step 4:** 问题复盘归档(AGENTS.md 第七步):把审计中发现的真实坑(如软 404、schema 缺失根因)按模板追加到 `.claude/skills/tarmeer-failure-archaeology/SKILL.md`。

**Step 5:** 沉淀 skill(设计文档 §4):首轮跑通后,把 rubric + 脚本 + 修复 playbook 整理为内部 skill `geo-optimizer`(**单独一轮工作,不在本计划内**,此处仅标记为后续里程碑)。

**Step 6: Commit + 通知用户**(等用户说"部署"才部署;附 before/after 分数与测试结果)。

---

## 验收标准(整份计划)

- `node --test scripts/geo-audit/test/` 全绿(rubric/extract/checks/score/report)。
- `geo-audit.mjs` 对 tarmeer 跑出量化总分 + 优先级清单 + 逐页明细。
- 至少完成 Top 3 快赢项修复,每项让对应维度分可见上升,smoke-test 全绿。
- `report.json` 保留 before/after,总分有可证明提升。
- 脚本站点无关(config 驱动),换 `--base-url` 可跑别站——支撑将来卖 GEO 服务。
```
