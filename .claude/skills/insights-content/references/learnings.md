# Insights 内容生产 — 累积学习记录（自学习）

> 每次生产/调试内容时新发现的技术、坑、有效做法，追加到这里（现象 → 根因 → 做法）。越积越多，下次先读避免重犯。

## 2026-06-30 SSR 取数：相对 /api 在服务端失败
- **现象**：`/insights/[slug]` 与 blog 详情本地 SSR 404/空，dev 日志无 API 命中。
- **根因**：`publicApi.request()` 用 `API_BASE='/api'`（相对），Next 服务端 fetch 相对路径无法解析（抛错被 catch → null → notFound）。
- **做法**：`API_BASE = NEXT_PUBLIC_API_URL || API_INTERNAL_URL || '/api'`；本地 dev 启动加 `API_INTERNAL_URL=http://localhost:3002/api`（客户端读不到该变量，仍走 /api，不影响浏览器）。prod 已设。

## 2026-06-30 生图：中转 gpt-image-2 + 60s 网关超时
- **现象**：`gpt-image-2`(via `api.mcvvo.com/v1`)生成人物/复杂图常 504。
- **根因**：中转 nginx 网关 60s 超时；复杂图生成 >60s 被掐。简单空场景图 <60s 能成。
- **做法**：env 存 `OPENAI_API_KEY`/`OPENAI_BASE_URL`/`OPENAI_IMAGE_MODEL=gpt-image-2`；调 `/images/generations` 返回 b64_json；带重试；复杂人物图需重试/off-peak 或换更快端点(官方直连)。size 用 1024x1024（1536x1024 更易超时）。

## 2026-06-30 配图风格 = 写实人物+场景+迪拜+暖色
- 用户要的不是空场景，是**生活化人物叙事图**（如：建材仓库提货本地人+物流员、设计团队看样板）。prompt 别写 "no people"。
- 诚信：生成人物=通用示意，**不冒充具体真实客户/专家**；真专家用真实 `avatar_url`。用户给的参考图**只是风格示例，不直接用**。

## 2026-06-30 图片流程
- `scripts/gen-image-variants.mjs '<src.png>::public/images/insights/<base>'` → 出 -blur/-thumb/-medium/full WebP + chmod 644。
- SmartImage 用全路径 src + `variant`，自动找 `-medium.webp`。
- prod：`/images/` 走 nginx portal 目录，git push 后还要 rsync `public/images/insights/` → portal，否则线上 404。

## 2026-06-30 专家引用诚信
- `guide_expert_quotes` 存 `(expert_ref_id, expert_ref_source)`（国家隔离）；JOIN 必带 `AND e.country=?`。
- quote 字段只放可核实事实（"12 年迪拜认证设计师"），不放捏造的个人观点；真实引文以后由平台收集填入。

## 2026-06-30 真实数据源（取数）
- projects(292 published)：cost/area/style → 191 个有造价，中位 ~1,800 AED/㎡，按风格区间。
- expert_profiles：13 位(AE 认证 Ahmed 12yr/Sara 7yr)；supplier 品类分布；company_profiles 公司名/服务。

## 2026-06-30 列表查空：country 参数重复
- **现象**：`/insights` 详情正常，列表却"No guides"。
- **根因**：`fetchGuides` 在 qs 里加了 country，`request()` 又追加一次 → `?country=ae&country=ae` → Express `req.query.country` 变数组 → `WHERE country=?` 绑定数组 → 查空（详情无 `?` 所以只加一次，正常）。
- **做法**：取数 helper 别重复加 country，统一交给 `request()` 加一次。凡"详情可、列表空"先查参数是否重复/类型。

## 2026-06-30 长文体验：折叠次要段(不丢AI收录)
- 深度长文"太长"的解法不是删，是**导航+折叠**：H2 heading 加 `collapsed:true` → 渲染成 `<details>`，**内容仍在 HTML/DOM，AI 与 Google 照抓**，仅视觉收起。配粘性/锚点目录 + 回顶浮钮。
- GuideDetailClient 按 H2 分段(lead + sections)，collapsed 段渲染 details/summary(id 在 summary 上, 锚点可跳)。次要段(时间线/含不含/能省不能省)默认折叠，核心数据/表/估算器/FAQ 保持展开。

## 2026-06-30 坑：加路由后未重启后端 → 通用404
- **现象**：guides 接口突然返回通用 `{"error":"Not found"}`(非 controller 的 'Guide not found.')，列表详情全 404。
- **根因**：3002 跑的是**加 guides 路由之前的旧实例**(seed/数据脚本不重启后端)。
- **做法**：凡改了 `server/dist/routes` 或 `app.js`，必须 kill+重启 3002；区分"通用404=路由没注册/旧实例" vs "controller 404=数据不存在"。
