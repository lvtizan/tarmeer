# Insights 指南分板 + 专家引用 实现计划（首批）

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development。承接 [[2026-06-30-insights-guides-section-design]]。

**Goal:** DB 化 `/insights` 指南分板（AE 先行），公开页带结构化块/FAQ/**专家引用卡**/真实数据，全套 AI 友好 JSON-LD + llms.txt + sitemap 收录；首批我用平台真实数据写 2 篇 seed 入库。

**首批范围（本计划）**：DB 模型 + 后端公开读 + 公开页 + 页面级 Schema/llms.txt/sitemap + 2 篇真实内容 seed。
**第二批（不在本计划）**：admin 编辑器、全站 schema helper 收敛、榜单页、评分系统。

## 背景约束
- 后端无 TS 源，编辑 `server/dist/**/*.js`；改后 rsync + `pm2 restart tarmeer-api`。
- 前端 worktree 构建用 `next build --webpack`。
- 国家隔离铁律：guides 带 country；专家 JOIN 必带 `AND country 一致`；公开读接口必传 country；详情 fetch 失败/不存在/跨国 → `notFound()`。
- 真实数据：projects(292 published, 191 有 cost, 260 有 area, 46 styles)、expert_profiles(AE 认证专家 Ahmed Al Rashidi/Sara Mohammed 等)、supplier 品类(furniture/stone/lighting/flooring…)+32 approved 供应商。**priced 产品=0**→采购指南价格用市场参考并明确标注，不伪造平台价。
- 诚信：专家引用只放可核实事实（姓名/经验年限/城市/认证/代表作），不捏造引文。

## 文件
| 文件 | 动作 |
|------|------|
| `server/dist/lib/autoMigrate.js` | 建 3 表 |
| `server/dist/controllers/guideController.js` | 新建：公开列表/详情 |
| `server/dist/routes/public.js`（或现有公开路由文件） | 注册 `/guides/public*` |
| `server/dist/scripts/seed-guides.js` | 新建：2 篇真实内容入库 |
| `src/lib/schema/guide.ts` | 新建：guide 的 JSON-LD 生成（Article/FAQ/ItemList/BreadcrumbList/Person） |
| `src/app/insights/page.tsx` | 新建：分板落地 |
| `src/app/insights/[slug]/page.tsx` | 新建：详情（SSR + schema + notFound） |
| `src/components/insights/GuideDetailClient.tsx` | 新建：块渲染 + 专家引用卡 |
| `src/app/sitemap.ts` | 加 /insights + DB 驱动每篇 |
| `public/llms.txt` | 新建 |
| `src/lib/publicApi.ts` | 加 guides 取数 helper（复用国家化 fetch） |

---

## Task 1: DB 三表（autoMigrate 幂等建表）
**File:** `server/dist/lib/autoMigrate.js`

- [ ] **Step 1:** 在建表区（`TABLES` 数组/CREATE TABLE 段，参考现有 supplier_products 建表写法）加 3 张表：
```sql
CREATE TABLE IF NOT EXISTS guide_series (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(200) NOT NULL,
  country VARCHAR(5) NOT NULL DEFAULT 'ae',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_series_slug_country (slug, country)
)
CREATE TABLE IF NOT EXISTS guides (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(200) NOT NULL,
  country VARCHAR(5) NOT NULL DEFAULT 'ae',
  series_id INT NULL,
  category VARCHAR(100) NOT NULL DEFAULT 'guide',
  title VARCHAR(255) NOT NULL,
  summary TEXT,
  body_blocks JSON NOT NULL,
  cover_image VARCHAR(500),
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  author_name VARCHAR(120),
  seo_title VARCHAR(255),
  seo_description VARCHAR(500),
  view_count INT NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_guide_slug_country (slug, country),
  INDEX idx_guide_pub (country, status, published_at)
)
CREATE TABLE IF NOT EXISTS guide_expert_quotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guide_id INT NOT NULL,
  expert_ref_id INT NOT NULL,
  expert_ref_source VARCHAR(32) NOT NULL DEFAULT 'experts',
  quote TEXT NOT NULL,
  role_label VARCHAR(160),
  sort_order INT NOT NULL DEFAULT 0,
  INDEX idx_geq_guide (guide_id)
)
```
- [ ] **Step 2:** 重启本地后端验 3 表存在（`SHOW TABLES LIKE 'guide%'`）。
- [ ] **Step 3:** commit `feat(insights): guides/guide_series/guide_expert_quotes 三表`

---

## Task 2: 后端公开读
**Files:** `server/dist/controllers/guideController.js`（新建）, 公开路由文件

先读现有 `articleController`/blog 公开读 + 路由注册写法对齐。

- [ ] **Step 1: guideController.js**
  - `listGuides(req,res)`: 取 `country`(query/header)、可选 `category`/`series`；`SELECT id,slug,title,summary,category,series_id,cover_image,published_at FROM guides WHERE country=? AND status='published' ORDER BY published_at DESC`。返回 `{ guides }`。
  - `getGuide(req,res)`: by slug+country，status published；不存在 → 404。JOIN 专家引用并**带国家一致条件**：
    ```sql
    SELECT geq.quote, geq.role_label, e.full_name, e.slug expert_slug, e.experience_years, e.city, e.is_certified
    FROM guide_expert_quotes geq
    JOIN expert_profiles e ON e.id = geq.expert_ref_id AND geq.expert_ref_source='experts' AND e.country = ?  -- 国家一致
    WHERE geq.guide_id = ? AND e.status='approved'
    ORDER BY geq.sort_order
    ```
    `body_blocks` JSON parse 后返回；返回 `{ guide: {..., experts:[...] } }`。
- [ ] **Step 2: 注册路由**（公开，无鉴权）：`GET /guides/public`、`GET /guides/public/:slug`。
- [ ] **Step 3: 验证** node --check + 重启后端 + curl `/api/guides/public?country=ae` 返回 200 `{guides:[]}`（暂空）。
- [ ] **Step 4:** commit `feat(insights): 指南公开读接口(列表/详情,专家JOIN国家一致)`

---

## Task 3: Schema helper + 公开页
**Files:** `src/lib/schema/guide.ts`, `src/app/insights/page.tsx`, `src/app/insights/[slug]/page.tsx`, `src/components/insights/GuideDetailClient.tsx`, `src/lib/publicApi.ts`

参考现有 `blog/[slug]/page.tsx`（SSR + generateMetadata + JSON-LD + notFound + 国家化 fetch）与 `guide/[slug]/page.tsx`（Article+FAQ+Breadcrumb schema）写法。

- [ ] **Step 1: publicApi.ts** 加 `fetchGuides(country)` / `fetchGuide(slug,country)`（复用现有国家化 fetch：query country + x-country header）。
- [ ] **Step 2: src/lib/schema/guide.ts** 导出 `buildGuideJsonLd({guide, experts, url, c})` 返回数组：Article、FAQPage（从 faq 块）、BreadcrumbList、ItemList（从 list 块，可选）、专家 Person（`@type:Person, name, jobTitle, sameAs: <baseUrl>/experts/<slug>`）。
- [ ] **Step 3: /insights/page.tsx**（SSR，force-dynamic，x-country；VN 可先同样渲染或预留）：generateMetadata（canonical 国家化）+ 列出系列/分类/最新指南卡 + ItemList JSON-LD。仅 AE 有内容时 VN 列表为空也不报错。
- [ ] **Step 4: /insights/[slug]/page.tsx**：SSR fetch guide；**不存在/跨国 → notFound()**（禁软 404）；generateMetadata 用 seo_title/seo_description + canonical；注入 `buildGuideJsonLd`；渲染 `<GuideDetailClient guide=.. experts=.. />`。
- [ ] **Step 5: GuideDetailClient.tsx**：按 `body_blocks` 类型渲染：heading/paragraph/**image(图+caption+alt，图文穿插)**/stat_table(数据表)/faq/list/source；**expert_quote 块 → 专家引用卡**（**专家真实头像 `avatar_url`**+`full_name`+`experience_years 年·city`+认证徽章+引文+「查看专家」链 `/experts/<expert_slug>`）。封面图 `cover_image` 置顶。答案前置摘要置顶。图片用 `SmartImage`/`<img srcSet>` + lazy + 显式宽高防 CLS。配色品牌金 `#b8864a`，规范见 AGENTS.md。
- [ ] **Step 6: 构建** `next build --webpack` Compiled successfully。
- [ ] **Step 7:** commit `feat(insights): /insights 分板落地+详情页(结构化块+专家引用卡+JSON-LD)`

---

## Task 4: sitemap + llms.txt
**Files:** `src/app/sitemap.ts`, `public/llms.txt`

- [ ] **Step 1: sitemap.ts** 加 `/insights`（静态）+ DB 驱动每篇 `/insights/<slug>`（仿现有 `/articles/public` 取法，调 `/guides/public?country=`）。国家隔离同现有模式。
- [ ] **Step 2: public/llms.txt** 写 AI 引用导航（站点简介 + `/insights` 指南分板 + sitemap 指针 + 主要可引用栏目）。
- [ ] **Step 3:** commit `feat(insights): sitemap 收录指南 + llms.txt`

---

## Task 5: 真实内容 seed（我撰写）
**File:** `server/dist/scripts/seed-guides.js`

- [ ] **Step 1:** 写 seed 脚本，插入 2 篇 published 指南（country='ae'），body_blocks 用**平台真实数据**：
  - **指南A《Dubai Renovation Cost Guide 2026 — Real Project Data》**：取 projects(has cost+area, published) 聚合真实 AED/㎡ 区间、按 style 分；stat_table 块放真实数值；FAQ 块；source 块标注"基于 Tarmeer 平台 N 个真实项目"。
  - **指南B《Sourcing Building Materials in Dubai — Categories, Suppliers & Checklist》**：用真实 supplier 品类分布 + approved 供应商数；采购流程 list 块；价格标"询价/市场参考(注明非平台成交价)"；source 块。
  - **指南C（案例故事）《How a 156㎡ Dubai Apartment Renovation Came Together on Tarmeer》**：扎根**一个真实 published 项目**（真实公司 + 真实 area/cost/style，如 156㎡ Modern Luxury / AED 238,000），叙述匹配→报价→成交→交付旅程；category='story'。**禁造虚构客户名/好评**，只用真实项目事实 + 真实公司名；如无客户授权证言则不放证言。
  - 各挂 1-2 条 `guide_expert_quotes`：引真实 AE 认证专家（Ahmed Al Rashidi 12yr/Dubai、Sara Mohammed 7yr/Abu Dhabi），**引文为可核实事实表述**（"拥有 12 年迪拜高端住宅经验的认证设计师"），role_label 据实。
  - seed 幂等：按 slug+country 先删后插或 INSERT ... ON DUPLICATE。
  - category 取值约定：'cost' / 'sourcing' / 'trend' / 'story'。/insights 落地按 category 分区展示。
- [ ] **Step 2: 运行 seed**（连本地库），curl `/api/guides/public?country=ae` 应返回 2 篇；curl 详情含 experts。
- [ ] **Step 3: 浏览器实测** `/insights` 与 `/insights/<slug>` 渲染、专家卡链对、JSON-LD 存在、console 无错。
- [ ] **Step 4:** commit `content(insights): 首批2篇真实数据指南+专家事实引用 seed`

---

## 测试（部署前必过）
- 后端 node --check；公开读 curl 200；country-walkthrough 回归（新增 guides 读接口若涉及国家归属）；smoke-test；`next build --webpack`。
- 浏览器：/insights 列表 + 详情渲染、专家卡链 `/experts/<slug>` 正确、JSON-LD（Article/FAQ/Person）注入、console 无错、跨国/不存在 slug → 404。

## 部署（用户说"部署"后）
1. `git push`
2. 后端 rsync：`autoMigrate.js`+`guideController.js`+路由文件+`scripts/seed-guides.js` + `pm2 restart tarmeer-api`；服务器跑一次 seed（连生产库，country=ae）。
3. 前端 `git pull && next build && pm2 restart tarmeer-next` + `public/llms.txt` 随前端部署（注意 llms.txt 走 Next public 还是 nginx，需确认路径可达，类似 images 坑）。
4. 无头浏览器实测生产 /insights + 富媒体结构 + Google Rich Results 可后续验证。
