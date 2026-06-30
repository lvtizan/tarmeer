# Tarmeer 内容方法论 — 数据型内容 · AI 可引用（GEO/AEO）

> 来源：用户 2026-06 战略（打法一/二/三）。**每写一篇 `/insights` 指南都按此执行。** 这是可复用方法，新文章照抄结构。

## 北极星
让 Tarmeer 成为「AI 需要某类答案时，结构最清晰、最易引用的来源」。内容沉在**自有域名 `tarmeer.com/insights`**，AI 引用时才指向 Tarmeer，带来流量与询盘。

## 每篇文章的三大引用要素（普林斯顿验证 · 缺一不可）
1. **真实成本/统计数据** — 来自平台真实项目/报价/供应商数据，给具体数字（如「191 个真实项目，中位 1,800 AED/㎡」）。禁止编造数字。
2. **公司/专家引述** — 引平台真实公司或认证专家。**诚信底线**：只放可核实事实（认证、经验年限、城市、代表项目、所属公司）或**真实收集到的引文**；**绝不捏造**安在真实公司/人名下的话。
3. **来源引用** — 末尾标注数据来源（"基于 Tarmeer 平台 N 个真实项目聚合"），可核查。

## 文章结构（模仿人类编辑手法 + AI 爱抓取）
1. **答案前置**：开头一段直接给结论/关键数字（AI 摘录的就是这段）。
2. **清晰小标题**：H2/H3 用用户真会问 AI 的问法（"How much does X cost in Dubai?"）。
3. **真实数据表**（stat_table）：可摘取的结构化数字。
4. **场景图文**：人物+场景的写实配图（生活化、迪拜情境、暖色），增强故事性（非空场景）。
5. **要点列表**（list / 可做榜单 ItemList）。
6. **公司/专家引用卡**（expert_quote / 公司引述块）。
7. **FAQ 段**（FAQPage schema）。
8. **来源标注**（source 块）。

## AI 可收录技术要素（打法一）
- **JSON-LD**：Article + FAQPage + BreadcrumbList +（榜单）ItemList + 专家 `Person`+`sameAs`(链专家主页)。helper：`src/lib/schema/guide.ts`。
- **独立可抓取网址**：每篇 = `tarmeer.com/insights/<slug>`，SSR、`notFound()` 防软404。
- **sitemap 收录** + **`public/llms.txt`** 声明可引用栏目。
- 公司主页字段化（服务/城市/项目数/评分/代表作）+ LocalBusiness/AggregateRating（评分系统下期）。

## 六步生产流程（打法二实操）
1. **选题**：从用户真会问 AI 的问题出发（成本 / 找谁 / 风格趋势 / 建材采购 / 成交故事）。
2. **取数**：从平台 projects/prices/suppliers/experts 提真实数字（见下"数据源"）。
3. **撰写**：答案前置 + 嵌统计数据 + 公司引述 + 标注来源。
4. **结构化**：FAQ + 清晰小标题 + Schema(Article/ItemList)。
5. **发布**：自有 `/insights` 栏目，独立网址，提交 sitemap。
6. **分发**：社媒 / 邮件 / 入驻公司转发，加速被 AI 发现。

## 平台真实数据源（取数用）
- `projects`(292 published)：`cost`(AED)/`area`(sqm)/`style`/`space_type` → 造价、每㎡价、按风格区间。
- `supplier_products` / `supplier_profiles`：品类分布、审核供应商数、（价格待供应商填）。
- `expert_profiles`：认证专家 full_name/slug/experience_years/city/is_certified/avatar_url → 真实事实引用。
- `company_profiles`/`uae_companies`：公司名/服务/城市/项目数 → 公司引述与榜单。

## 内容栏目分类（category）
`cost`(成本) / `sourcing`(建材采购) / `trend`(风格趋势) / `story`(成交故事) /（下期 `ranking` 榜单）。

## 配图规范
- **写实人物 + 场景 + 迪拜情境 + 暖色电影感**（参考用户给的风格示例：建材仓库提货、设计团队看样板）。
- 生成图=通用示意人物，**不冒充具体真实客户/专家**；真专家用真实头像。
- 走 4 档 WebP（`scripts/gen-image-variants.mjs`）；prod 需 rsync 到 portal 目录。
- 生图：`gpt-image-2` via `OPENAI_BASE_URL`(中转)。**已知坑**：中转 nginx 60s 网关超时，复杂人物图常 504 → 需重试/换更快端点。

## 站外权威矩阵（打法三 · 后续，非本仓库代码）
让 AI 跨多源「被看见且一致」：① Wikidata 品牌实体 ② Google 商家资料 ③ 第三方目录/榜单 ④ Google/Trustpilot 评价 ⑤ 行业媒体/PR ⑥ **全网 NAP 一致**(名称/地址/电话/定位统一)。

## 成熟度路线图（L1→L2→L3 · 循序渐进不能跳级）
- **L1 入门「能被读懂」**：验证 GSC + 提交 sitemap；首页/公司页基础 LocalBusiness schema；移动端 + 加载速度达标；robots.txt + llms.txt。**毕业**：核心页被 AI 抓取且收录。
- **L2 进阶「值得被引用」**：上线「指南/Insights」栏目；公司页字段化 + Review schema；写前 10 篇数据型指南/榜单；认领 Google 商家 + 铺 FAQ。**毕业**：核心 prompt 下开始零星被提及。
- **L3 精通「成为默认答案」**：建 Wikidata 实体；系统化收评价 + 进第三方榜单；阿语内容 + 每周引用监测；跑通询盘闭环 + SOP 产品化。**毕业**：核心 prompt 稳定进第一梯队。

> 当前位置：L1 大部分已具备（sitemap/robots/llms.txt/多页 schema）；L2 进行中（Insights 栏目✓、数据型指南起步✓、还差写满 10 篇 + 公司页 Review schema + Google 商家 FAQ）。L3 待启。

## 落地现状（2026-06-30）
- `/insights` 分板 + 详情页 + 专家引用卡 + 5 段 JSON-LD + sitemap + llms.txt：已建（见 docs/plans/2026-06-30-insights-guides-*）。
- 首篇《Dubai Renovation Cost Guide 2026》已 seed（191 真实项目 + 专家 Ahmed）。
- 待办：footer 入口、公司引述块、人物场景图（中转生图修复后补）、建材采购篇 + 成交故事篇、榜单页、评分系统。

## 深度标准（铁律 · 每篇必达，避免"速读卡片")
一篇合格指南 = 读 5–8 分钟的权威长文，不是一张表+几条要点。每篇至少包含：
1. 顶部「关键结论」callout + 3 个大数字 stat_highlight + 目录锚点 + 阅读时长/更新日期。
2. **多维真数据切片**（同一主题至少 3 张表/角度）：如成本=按风格 + 按面积档(经济规模) + 按年份趋势 + 真实案例表(带真实公司名)。
3. **交互件**（如造价估算器 estimator，用真实中位数算）。
4. **成本/数据构成拆解**（市场参考须标 source）。
5. **3 位真实专家**分主题出现（不是 1 位）。
6. 时间线 + 含/不含清单 + 能省/不能省 + 如何挑选(内链) + CTA。
7. 方法论 callout（数据来源/口径/样本量/时间范围）+ 8–10 条 FAQ + source。
> 块类型已支持：heading/paragraph/image/stat_table/list/faq/expert_quote/source/**callout/stat_highlight/estimator/timeline/cta**（渲染器 GuideDetailClient + 类型 BodyBlock）。
