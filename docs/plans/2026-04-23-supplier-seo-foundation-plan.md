# Supplier SEO Foundation Plan (Site-Wide)

**Date:** 2026-04-23  
**Scope:** `/materials` 与供应商垂类，但以全站自然流量底层能力为目标（非线索转化）。

---

## 1) 现状判断（基于代码现状）

已具备：
- 页面级基础 meta（`<title>`, description, canonical, og）在多数页面存在。
- 动态 sitemap 已上线（`/api/sitemap.xml`），覆盖首页、公司、文章、项目等。
- 供应商列表与详情页已完成 UI/数据重构，路径稳定在 `/materials` 与 `/materials/suppliers/:slug`。

主要短板：
- **供应商详情未进入 sitemap**：当前 sitemap 未输出 `/materials/suppliers/:slug`。
- **服务端 SEO 注入未覆盖供应商路径**：`seoMetaInjector` 仅覆盖首页、公司、项目等，不含 `/materials` 与供应商详情。
- **结构化数据薄弱**：供应商列表/详情缺 `ItemList`、`Organization/LocalBusiness`、`BreadcrumbList`、`Product`（可选）等。
- **索引层级不足**：目前只有一个 `/materials` 聚合页，缺少稳定可索引的“类目页/地域页”。
- **内链网络不够强**：供应商垂类缺高权重入口和上下文链接（home/blog/company/portfolio互链）。
- **查询参数策略未体系化**：筛选多依赖前端状态，尚未形成 SEO 友好的静态可抓取 URL。

---

## 2) 目标定义

### North Star
12 周内把供应商垂类从“单列表页”升级为“可规模化索引的内容网络”，让 Google/Bing 能持续发现、理解、排序。

### 关键结果（KR）
- KR1: 供应商详情收录率 >= 85%。
- KR2: `/materials*` 目录自然点击提升 >= 200%。
- KR3: 非品牌词点击占比提升 >= 50%。
- KR4: Supplier 详情页平均排名提升（top 20 关键词进入前 20）。

---

## 3) 三种路线与取舍

### 路线 A：技术 SEO 修复优先（2-3 周见效）
内容：sitemap + canonical + robots + SSR-meta 注入 + JSON-LD。
- 优点：见效快、风险低、工程成本低。
- 缺点：流量上限有限，缺规模化新入口。

### 路线 B：程序化索引页优先（4-8 周拉升）
内容：构建 `/materials/category/:category`、`/materials/origin/:origin`、后续 `city` 组合页。
- 优点：新增大量可排名页面，覆盖长尾。
- 缺点：若内容薄会被判定低质量，需要质量阈值与模板控制。

### 路线 C：内容网络优先（8-12 周放大）
内容：围绕材料主题建立 guides/FAQ/case hub，与供应商详情强内链。
- 优点：权重沉淀与 topical authority 最强。
- 缺点：编辑与运营成本高，见效较慢。

### 推荐
采用 **A -> B -> C** 的分层推进：
- 先保证 crawl/index 基础正确（A），
- 再用程序化页面扩入口（B），
- 最后用内容网络抬权重与稳定性（C）。

---

## 4) 分阶段执行计划

## Phase P0（第 1-2 周）索引与抓取基础

1. Sitemap 完整化
- 在 `server/src/app.ts` 的 `/api/sitemap.xml` 中新增：
  - `/materials/suppliers/:slug`（approved supplier）
  - 预留 `/materials/category/:category-slug`（若上线）
- 对大规模 URL 做分片：`sitemap-suppliers.xml` + index（可选但建议）。

2. 服务端 SEO 注入覆盖供应商路由
- 在 `server/src/lib/seoMetaInjector.ts` 增加：
  - `/materials` 静态 meta
  - `/materials/suppliers/:slug` 动态 meta（从 `supplier_profiles` 读数据）
- 目标：即便 bot 不执行 JS，也能拿到唯一 head 信号。

3. 结构化数据补齐
- `src/pages/ShowroomsPage.tsx`
  - 增加 `ItemList`（首屏 suppliers）+ `CollectionPage`。
- `src/pages/SupplierDetailPage.tsx`
  - 增加 `Organization/LocalBusiness`、`BreadcrumbList`。
  - 若产品字段完整，再补 `Product` 列表（可延后 P1）。

4. Canonical/Noindex 策略
- 列表筛选 query 参数页统一 canonical 到主规范 URL。
- 仅对“明确价值的索引页”给自 canonical，不让任意 query 组合进索引。

5. 内链最低保障
- 从首页/页脚/FAQ 至少提供 1 条稳定 dofollow 入口到 `/materials`。
- 在供应商详情增加“相关供应商/相关分类”链接。

**P0 验收标准**
- Search Console URL Inspection 抽样 30 页：全部可抓取、可索引、canonical 正确。
- 新 supplier URL 在 3-7 天内进入已发现/已抓取集合。

---

## Phase P1（第 3-6 周）程序化 SEO 页面（高质量约束）

1. 新建稳定索引页
- `/materials/category/:categorySlug`
- `/materials/origin/:origin`（china/dubai）
- 可选：`/materials/category/:categorySlug/:origin`

2. 页面质量阈值（必须）
- 页面至少满足：
  - >= 8 家供应商，且
  - 每页有唯一 intro（>=120 词）、FAQ（2-3条）、精选卡片差异化文案。
- 不满足阈值：返回 404 或 noindex，避免薄页。

3. 模板与内容差异化
- 文案模板必须包含类目特有段落，不允许纯变量替换。
- 使用 “category guide + supplier cards + buyer checklist + FAQs” 结构。

4. Sitemap 与内链同步
- 所有满足阈值的程序化页面进入 sitemap。
- `/materials` 作为 hub，输出到类目页的文本链接网格。

**P1 验收标准**
- 程序化索引页收录率 >= 60%（4 周内）。
- Long-tail query 覆盖数显著增长（GSC queries + landing pages）。

---

## Phase P2（第 7-12 周）内容网络与主题权威

1. 建立材料主题集群（Topic Clusters）
- 例如：
  - Marble in UAE
  - Lighting for villas
  - Kitchen cabinet materials
- 每个 cluster 链接到对应 category 页与 suppliers。

2. 供应商详情增强可排名字段
- 增加可公开字段：service areas、minimum order、delivery lead time、brands carried、project galleries。
- 用结构化字段渲染“可抓取文本”，降低纯图片依赖。

3. 统一内容更新机制
- 供应商有更新（产品/图册）时触发：
  - `lastmod` 更新
  - 相关类目页重新生成摘要段

**P2 验收标准**
- `/materials*` 在 non-brand query 的 impressions 与 clicks 稳定上升。
- 头部类目页出现可持续前 10 关键词。

---

## 5) 工程落地清单（按仓库文件）

后端：
- `server/src/app.ts`
  - 扩展 `/api/sitemap.xml` 生成逻辑，加入 supplier detail 与后续索引页。
- `server/src/lib/seoMetaInjector.ts`
  - 新增 `/materials` 与 `/materials/suppliers/:slug` meta 解析逻辑。

前端：
- `src/pages/ShowroomsPage.tsx`
  - 增加 `CollectionPage` + `ItemList` JSON-LD。
  - 补强可抓取文本内容（类目导览段落）。
- `src/pages/SupplierDetailPage.tsx`
  - 增加 `Organization/LocalBusiness` + `BreadcrumbList` JSON-LD。
  - 规范化 canonical/og/twitter 输出。
- `src/App.tsx`
  - 新增程序化索引页路由（P1 阶段）。

数据/规则：
- `supplier_profiles` 增补用于 SEO 的可公开字段（P2，可选迁移）。

---

## 6) 监控与告警（必须）

1. GSC 看板
- 目录维度：`/materials`, `/materials/suppliers/`, `/materials/category/`
- 指标：impressions, clicks, avg position, indexed pages。

2. 技术健康巡检（每周）
- 抓取错误（5xx/404）
- canonical 冲突
- noindex 误伤
- sitemap discovered vs indexed 差值

3. 发布闸门
- 每次发布自动跑：
  - 随机抽样 URL head 校验（title/canonical/robots/json-ld）
  - sitemap URL 可访问性校验

---

## 7) 反模式（明确禁止）

- 仅靠前端筛选 query 生成“无限组合 URL”并开放索引。
- 批量生成低质量类目页（无差异文案、无实体内容）。
- 供应商详情只放图片不放文本化实体信息。
- 在 robots 中误封 `/materials` 或其子路径。

---

## 8) 建议的本周执行顺序

1. P0-1: sitemap 加 supplier detail URL。  
2. P0-2: `seoMetaInjector` 覆盖 `/materials` + supplier detail。  
3. P0-3: 两个页面补 JSON-LD。  
4. P0-4: 内链补强（home/footer/materials hub）。  
5. 上线后 72 小时检查抓取与索引状态，再进入 P1。

