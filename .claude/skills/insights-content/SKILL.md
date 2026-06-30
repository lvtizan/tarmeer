---
name: insights-content
description: 生产 Tarmeer /insights 数据型、AI 可引用(GEO/AEO)的指南/榜单/案例文章，并自动累积所学技术。当用户说"写一篇指南/榜单/成交故事""加一篇 insights""做数据型内容""GEO/AI 内容""写 AI 爱收录的文章"时使用。每次用完必须把新学到的技术/坑追加到 references/learnings.md（自学习）。
---

# Insights 数据型内容生产（自学习）

Tarmeer 把平台真实数据做成 AI 可引用的内容，沉在自有域名 `tarmeer.com/insights`，被 AI 引用 → 流量 → 询盘 → 吸引更多公司/项目（内容飞轮）。

## 开工前必读
1. `docs/insights-content-methodology.md` — 完整方法（三大引用要素、文章结构、六步法、Schema、配图、L1→L3 路线、数据源）。**先读它**。
2. `.claude/skills/insights-content/references/learnings.md` — 历次踩坑与技巧（避免重犯）。**先读它**。

## 三大引用要素（普林斯顿验证 · 每篇缺一不可）
1. 真实成本/统计数据（来自平台 projects/prices/suppliers，给具体数字，**禁编造**）。
2. 公司/专家引述（真实公司/认证专家；**只放可核实事实或真实引文，禁捏造**）。
3. 来源引用（末尾标注"基于 Tarmeer N 个真实项目"）。

## 生产步骤
1. **取数**：连本地库（`set -a; . server/.env; set +a`）聚合真实数字（造价/㎡、品类、专家）。
2. **撰写**：答案前置 + H2/H3(用户真问法) + 真实数据表 + 人物场景图 + 要点 + 公司/专家引用卡 + FAQ + 来源。结构=人类编辑手法，利于 AI 摘取。
3. **配图**：写实人物+场景+迪拜情境+暖色（`gpt-image-2` via `OPENAI_BASE_URL`）→ `scripts/gen-image-variants.mjs` 转 4 档 WebP。生成人物=通用示意，禁冒充真实客户/专家。
4. **入库**：扩 `scripts/seed-guides.mjs`，category ∈ cost/sourcing/trend/story，幂等 seed。
5. **Schema/收录**：`src/lib/schema/guide.ts`(Article/FAQ/ItemList/Person+sameAs)；`/insights/[slug]` SSR + notFound；sitemap + llms.txt 自动收录。
6. **验收**：`/api/guides/public` 返回；无头浏览器实测渲染+图+专家卡+JSON-LD+console 无错；webpack build。

## 自学习（铁律 · 每次用完必做）
完成后，把**本次新发现的技术/坑/有效做法**追加到 `.claude/skills/insights-content/references/learnings.md`（一条一段：现象→根因→做法）。同时按 AGENTS.md 第七步归档到对应 memory 文件。**不记录 = 没做完。**

## 现状指针
落地进度见 `docs/insights-content-methodology.md`「落地现状」与「L1→L3 路线图」。
