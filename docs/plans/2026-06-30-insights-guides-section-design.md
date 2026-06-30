# Insights / 指南分板 + 专家引用（AI 可收录内容飞轮）— 设计文档

> 日期：2026-06-30 ｜ 状态：待确认 ｜ 落地"打法二 内容飞轮"

## 需求
建立**自有域名下的指南/洞察分板**，写数据型系列文章（如《2026 迪拜别墅装修成本指南》《阿拉伯风格客厅设计趋势》），用**人的编辑手法 + AI 引擎友好格式**，每篇含**专家引用环节**（链真实专家、驱动飞轮）。

## 决策（用户确认）
| 决策点 | 结论 |
|--------|------|
| 内容作者 | **AI（我）撰写正文**，基于平台真实数据；后台可编辑维护 |
| 存储 | **DB 化**（新建 guides 系统，非硬编码、非混入公司博客）；AI 写好 seed 入库 |
| 首期范围 | 指南分板 + 专家引用 + AI 友好 Schema/llms.txt/schema helper。**榜单页、评分系统下期** |
| 国家 | **先 AE（英文）**，guides 表带 country、sitemap/canonical 国家隔离，VN 预留 |

## 诚信底线（铁律）
- AI 撰写：仅用**平台真实数据 + 可核实事实**（认证状态、经验年限、代表项目、所属公司）。
- **禁止捏造**安在真实专家名下的观点引文。专家引用块支持存"真实引文"字段，由平台/专家提供时填入；AI 默认只放可核实的事实性引用（"据平台认证专家 X（10 年别墅经验）的 N 个项目数据…"）。

## 架构

### 1. 分板与路由
- 新分板 `/insights`（落地页 + 分类/系列导航）。分类：成本指南 / 建材采购 / 风格趋势 / **案例故事(成交故事)** /（下期）榜单。
- **案例故事**：扎根平台真实项目（真实公司+真实造价/面积/风格），叙述客户在 Tarmeer 的成交旅程；禁造虚构客户/好评，真证言需平台/客户授权后填入。
- 每篇 = 独立可抓取网址 `/insights/<slug>`，自有域名下，AI 引用即指向 Tarmeer。
- 复用现有国家隔离：仅 AE 生成（VN 预留），`force-dynamic` + x-country。

### 2. 数据模型（DB，autoMigrate 建表）
- `guides`：id, slug(uniq), country, series_id NULL, category, title, summary(答案前置), body_blocks(JSON 结构化块), cover_image, status('draft'|'published'), author_name, seo_title, seo_description, published_at, created_at, updated_at, view_count
- `guide_series`：id, slug, country, title, description, sort_order
- `guide_expert_quotes`（**专家引用，国家隔离存 (ref_id, ref_source)**）：id, guide_id, expert_ref_id, expert_ref_source('experts'), quote TEXT, role_label, sort_order
- `body_blocks` 结构化块类型：`heading` / `paragraph` / `stat_table`(真实数据表) / `faq` / `list`(可做榜单 ItemList) / `expert_quote`(引 guide_expert_quotes) / `source`(来源标注)

### 3. 后端（server/dist，编 JS）
- 公开读：`GET /guides/public?country=&category=&series=`（列表）、`GET /guides/public/:slug?country=`（详情，JOIN 专家引用，带国家一致性条件 `AND e.country = :country`）。fetch 失败/不存在 → 前端 `notFound()`。
- Admin CRUD：`/admin/guides`（列表/建/改/删/发布），从 `useAdminCountry()` 传 country。
- 专家选择：复用现有 experts 查询，admin 编辑时按操作人国家过滤。

### 4. 前端公开页
- `/insights`：分板落地（系列卡 + 最新指南 + 分类筛选）。
- `/insights/[slug]`：渲染 body_blocks → 答案前置摘要、H2/H3、真实数据表、FAQ、**专家引用卡**（头像+姓名+职衔+引文+链 `/experts/<slug>`）、来源标注。
- 专家引用卡是飞轮关键：曝光专家 → 询盘 → 吸引更多专家。

### 5. AI 可收录优化（打法一在本分板落地 + 复用全站）
- Schema（统一到新 `src/lib/schema/` helper，逐步收敛散落的硬编码）：
  - `Article`（headline/author/publisher/datePublished/wordCount/mainEntityOfPage）
  - `FAQPage`（FAQ 块）
  - `BreadcrumbList`
  - `ItemList`（list/榜单块）
  - **专家**：`Person` + `sameAs` 指向专家主页；引文用 `citation`/`Quotation`
- `public/llms.txt`：声明 `/insights` 可引用内容 + sitemap 指针。
- `sitemap.ts`：`/insights` 列表 + DB 驱动收录每篇 `/insights/<slug>`（替代硬编码 guide 列表，旧 5 篇可迁移或并存）。

### 6. AI 撰写内容（首期 seed）
- 我用平台真实数据撰写首批指南（用户点名的 2 篇）：查 projects/prices/companies/experts 取真数字 → 写答案前置 + 数据表 + FAQ + 真实专家事实引用 → 入 `guides`（status published）。
- 提供 seed 脚本，内容可后台再编辑。

## 测试
- 端到端：公开列表/详情接口（含专家 JOIN 国家一致）、admin CRUD、notFound 分支；country-walkthrough 回归（新写入口）；schema 校验（JSON-LD 结构）；smoke + webpack build；部署后无头浏览器实测页面渲染 + console 无错 + 富媒体结构。

## 不做（本期）
- 榜单独立页（ItemList 列表页）—— 下期。
- 公司 AggregateRating/Review 评分系统 —— 下期。
- 旧 5 篇硬编码 guide 的强制迁移 —— 可并存，后续 CMS 化。
