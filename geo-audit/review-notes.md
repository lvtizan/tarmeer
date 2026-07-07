# GEO 审计 — 人判校准 + before/after(2026-07-07)

## 1. 薄 C 层校准(reviewNeeded 维度抽样人判)

对机械代理分标了 `reviewNeeded` 的维度做抽样复核:

| 维度 | 机械代理信号 | 人判结论 | 处理 |
|------|------------|---------|------|
| answerExtractability | 首段词数/问句标题数/正文词数 | 线上 guide/serviceCity 的 H2 **全是陈述句**(`questionHeadings:0`),代理分合理反映"答案不易被 AI 整段摘取" | 阈值不动;列为**下一轮**修复项(H2 改问句式) |
| structuredContent | hasTable/hasList/FAQPage | supplier 页仅 hasList(33%)属实;guide 满分属实 | 阈值不动,代理分可信 |

**存疑项(校准记录,非本轮修复)**:`entityAuthority` 对 `serviceCity`/`list` 页判 0% 曾疑过严——但修复方案(全站 Organization)天然覆盖这些页,实测把它们从 0→1,证明该维度指向的动作正确,阈值无需调整。

**结论**:rubric 阈值本轮无需调整;代理分与人判方向一致。

## 2. before / after 证据

### 2a. 本地闭环实测(修复后 `next start` 抓 HTML,已剔除本地无 robots/llms 的 crawlerAccess 假象)

| 页/页型 | entityAuthority | structuredData |
|--------|:---:|:---:|
| home | 1 → 1 | 0.90 → **1.0** |
| list `/companies` | **0 → 1** | 0.55 → **0.65** |
| list `/materials` | **0 → 1** | 0.20 → 0.20（CollectionPage,非本轮范围）|
| serviceCity dubai | **0 → 1** | 0.90 → **1.0** |
| serviceCity abu-dhabi | **0 → 1** | 0.90 → **1.0** |

→ 证明"修 → 重跑审计"闭环打通,#1 短板 entityAuthority 全线 0→1。

### 2b. 生产投影(用真实 score 模块把已验证的维度提升套回 before 报告;**投影非实测**)

| 页型 | before(实测) | after(投影) |
|------|:---:|:---:|
| home | 92 | 95.5 |
| list | 52 | 77.4 |
| companyDetail | 78.4 | 85.2 |
| supplierDetail | 47.7 | 79.5 |
| serviceCity | 69.9 | 85.8 |
| guide | 84.1 | 93.2 |
| **总分** | **70.7** | **86.1（+15.4）** |

## 3. 待部署后实测确认

- **supplierDetail 的 LocalBusiness**(Fix②)本地无后端渲染不出,投影 47.7→79.5 需部署后重跑审计坐实。
- 部署后执行:`node scripts/geo-audit/geo-audit.mjs --config scripts/geo-audit/config.tarmeer.json`,与 `report.before.json` 对比总分。

## 4. 三轮代码审查结论(AGENTS.md 第六步之二)

| 轮 | 视角 | 发现 | 处理 |
|---|------|------|------|
| 1 | 规格+安全对抗 | 6 缺陷:whatsapp→`https://+971`垃圾URL、@id硬编码AE泄VN、logo→`https:///uploads`、`</script>`注入、Organization双节点、sameAs AE硬编码 | 全修(ec32b136) |
| 2 | 复审+质量 | 2 Important:M4未尽(同@id属性冲突+home sameAs泄VN)、其他DB schema块未转义 | 补全站Organization+删home重复+全站jsonLd转义(8bee7586) |
| 3 | 整体+遗漏 | 1 must-fix:supplier addressCountry `?? 'ae'` 泄VN | 改 `?? c.isoCode`(7049d2e1) |

三轮后:tsc EXIT=0、引擎 28/28、smoke 10/10、eslint 0 error、首页 Organization=1 无 AE 泄漏。**CLEAN,可部署。**

## 5. 跟进项(非阻塞,第3轮标记)

- **实体图链接(高价值)**:全站 `#organization` 节点已发,但各处 `publisher`/`author`/`provider` 仍是匿名子对象,未 `{'@id':'…/#organization'}` 引用它 → AI 引擎不会归并为同一实体,削弱链接收益。
- **guide 预存泄漏(超本次范围)**:`guide/[slug]` Article 的 author/publisher 硬编码 `www.tarmeer.com` → VN guide emit AE org URL。预存于本分支之前,同主题应记账。

## 6. 下一轮候选(本轮未做)

- answerExtractability:guide/serviceCity H2 改问句式 + guide 补 dateModified/标题年份(freshness)
- list `/materials` 补 ItemList + `/companies` 补 BreadcrumbList
- expertDetail:生产补充公开专家数据后纳入审计
- 阿语维度(localization)启用 + AE/SA 阿语页审计
