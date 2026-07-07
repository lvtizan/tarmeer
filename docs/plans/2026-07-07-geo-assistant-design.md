# GEO 助手 — 设计文档

**日期**: 2026-07-07
**分支**: lvtizan/GEO
**一句话**: 做一套「诊断 → 按优先级修复 → 重跑验证」的 GEO 流水线,先在 tarmeer 上跑通把自家站 GEO 做好,同时把流程固化成内部 skill,支撑将来对外提供 GEO 服务。

---

## 目标(三层)

1. **现在**:把 tarmeer 的 GEO 真正做好(练手 + 真实收益)。
2. **固化**:把审计+修复流程沉淀成可重复的内部 skill `geo-optimizer`。
3. **产品化**:将来对客户**卖 GEO 服务**(交付=体检报告+修复实施+before/after)。skill/脚本是**内部产能引擎**,不是拿去卖的商品。

## 目标引擎 / 市场

- ChatGPT / Perplexity(英文 query)
- Google AI Overviews
- 阿拉伯语(AE/SA 市场)——**引擎能力保留,tarmeer 首轮不计分**(只审英文)
- 越南语——本轮不做

## 关键洞察

AI 爬虫(GPTBot / PerplexityBot / ClaudeBot / Google-Extended)读的是**服务端渲染的原始 HTML,不跑 JS**。因此"抓服务端 HTML 判断"是最贴合 GEO 的视角,不是妥协。

---

## 1. 架构

**A 脚本为主 + 薄薄一层 C 抽样判读。**

| 层 | 做什么 | 判定 |
|---|---|---|
| A. 确定性脚本(沿用 health-check 套路,Node + cheerio 抓服务端 HTML) | 机械可判定项:schema 有无/合法、robots 放行、hreflang、dateModified、软 404、canonical | 🤖 自动打分 |
| C. 抽样 agentic 判读 | 只有人能判的项:答案是否可被 AI 直接摘取、内容是否可引用。每种页型抽 1-2 个样本 | 🧑 人工/Claude 复核 |

被否方案:B 无头浏览器(重、慢、AI 爬虫本就看不到 JS,过度);纯 C 逐页判读(不可重复/不可量化,做不成工具)。

**站点无关**:脚本设计成传入 `--base-url` + 各页型样本 URL,不硬编码 tarmeer,换任意客户站即可复用。

---

## 2. GEO 评分 Rubric(v1,满分 100)

每页按页型只跑适用维度 → 归一化 → 全站按页型加权汇总。

| # | 维度 | 权重 | 判定 | 检查项 |
|---|------|:---:|:---:|------|
| 1 | 结构化数据 / JSON-LD | 20 | 🤖 | 页型对应 schema 存在且合法:Organization/LocalBusiness(公司/供应商)、FAQPage(guide)、Article(guide)、ItemList+Breadcrumb(列表);`@id`/canonical 用 slug 非 id;`sameAs`;`areaServed` 准确;`dateModified` 存在 |
| 2 | AI 爬虫可达性 | 15 | 🤖 | robots.txt 放行 GPTBot/PerplexityBot/ClaudeBot/Google-Extended;存在 llms.txt;sitemap 含该页;**无软 404**(缺数据必 notFound()) |
| 3 | 答案可摘取性 | 20 | 🧑 | 开头 40-60 字直接回答/TL;DR;H2/H3 写成问句;关键事实成句(不靠图片/JS);段落自包含 |
| 4 | 结构化内容块 | 12 | 🤖+🧑 | 表格/有序清单/对比块;FAQ 块与 FAQPage schema 对应;数据点带来源 |
| 5 | 实体与权威信号 | 12 | 🤖 | NAP(名/址/电)一致成文;author/publisher 标注;统计带出处;权威外链;内链主题簇 |
| 6 | 多语言 / 本地化 | 12 | 🤖 | 阿语页独立 `<html lang="ar" dir="rtl">`;hreflang 成对(en↔ar)自指;阿语 schema/FAQ 本地化;canonical 指本语言版本 —— **tarmeer 首轮不计分** |
| 7 | 新鲜度信号 | 5 | 🤖 | 标题/正文含年份(2026);dateModified 近期;guide 有可见"更新于"日期 |
| 8 | 可渲染性 | 4 | 🤖 | 关键内容在服务端 HTML 里;`<title>`/`<meta description>`/H1 唯一非空 |

**tarmeer 首轮**:排除维度6,其余 7 项共 88 分归一化到 100。

**页型清单**:首页、公司详情(`/@slug`)、供应商详情、专家详情、service×city 落地页、guide 文章、列表页。每种页型抽真实 URL 样本。

---

## 3. 产出与开修流程

**产出物**
- `scripts/geo-audit.mjs` — 审计引擎(站点无关,传 base-url + 样本 URL)
- `geo-audit/report.md` — 人看:总分 → 各页型得分 → 最痛 5 短板 → 优先级修复清单(标 影响/成本/涉及文件)
- `geo-audit/report.json` — 机器可读:趋势对比 + 产品数据底座

**优先级排序**:`影响分(维度权重 × 命中页面数) ÷ 修复成本`,高影响低成本排最前。

**开修落地**:审计跑完 → 报告吐清单 → 按排序修 top 快赢项 → tsc + smoke-test 全绿 → 提交 →(用户说部署才部署)→ 修完**重跑审计用分数证明效果**(before/after)。

**预判首轮快赢项**(实际以审计结果为准):

| 快赢项 | 影响 | 成本 |
|---|:---:|:---:|
| llms.txt(大概率缺失) | 高 | 极低 |
| robots.txt 放行 AI 爬虫 + Google-Extended | 高 | 极低 |
| guide 页补 FAQPage + Article schema | 高 | 中 |
| 公司/供应商/专家详情页 JSON-LD 补全 | 高 | 中 |
| 详情页软 404 排查(缺数据必 notFound()) | 高 | 低 |

---

## 4. 流程化 / skill 沉淀

首轮跑通后,把三件套沉淀成内部 skill `geo-optimizer`:
- **rubric**(评分标准)
- **审计脚本**(站点无关引擎)
- **修复 playbook**(每种短板的标准修法)

skill 内写清"对任意站:跑审计 → 读报告 → 按 playbook 修 → 重跑验证"。这是**内部产能**,支撑对外卖 GEO 服务。tarmeer 是第一个样板案例。

---

## 成功标准

- `geo-audit.mjs` 能对 tarmeer 跑出量化 GEO 分数与优先级清单
- 首轮 top 快赢项修复并(经用户批准)部署,tsc + smoke-test 全绿
- 重跑审计,总分较 before 有可证明的提升(report.json before/after)
- 流程可换站复用(站点无关已验证)

## 非目标(本轮)

- 越南语 GEO
- 阿语内容本地化实施(引擎保留维度,首轮不计分不实施)
- 无头浏览器/视觉审计
- 线上 AI 引用监测面板(后续里程碑)
