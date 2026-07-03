# 整体优化方案（2026-07-03）

Status: In Progress（P0 代码已改，待验证部署；P1–P3 待排期）

依据：三路架构/性能审查（前端渲染、后端查询、工程卫生）+ 线上 HTML 实测。

---

## P0 — SEO 致命伤：SSR 空页（✅ 代码已改，待部署）

**问题**：生产公开页原始 HTML 无正文（实测 `/companies` 只有导航+页脚）。根因：生产不设 `NEXT_PUBLIC_API_URL`，SSR 用相对路径 `/api` 取数，Node fetch 直接抛错被静默吞掉。详见 `.claude/skills/tarmeer-failure-archaeology`（FA-12）。

**已改**（15 文件，tsc 全绿）：服务端取数兜底 `http://localhost:3002/api`，浏览器端维持 `/api`。涉及：`serverFetch.ts`、`publicApi.ts`、首页、companies/experts/materials/blog/services 全部公开页 + `sitemap.ts`。

**部署前验证**（本地）：
1. `node scripts/harness/smoke-test.mjs` 全绿
2. `node_modules/.bin/next build` exit 0（跑完重启 5180）
3. 本地验证 SSR：`curl -s localhost:5180/companies | grep -c '公司名关键词'` > 0

**部署后验证**（关键）：
```bash
curl -s https://www.tarmeer.com/companies | grep -o 'companies/[a-z0-9-]*' | head   # 应出现公司详情链接
curl -s https://vn.tarmeer.com/companies | grep -c 'vn-'                           # VN 站同理
```
可选加固：服务器 pm2 env 显式设 `API_INTERNAL_URL=http://localhost:3002/api`。

**预期收益**：Google 首次抓取即得完整正文 + 内链，收录/排名基础性修复。这是全部优化里 ROI 最高的一项。

---

## P1 — 快赢（各半天~1天，低风险）

1. **后端热接口加内存缓存**：服务分类、导航数据、首页数据等几乎不变的公开接口，加 60s TTL 内存缓存 + `Cache-Control` 头。后端目前零缓存，每请求都打 MySQL。
2. **连接池扩容**：`server/dist/config/database.js` `connectionLimit: 10` → 30（按生产内存核对）。
3. **SSR 失败不再静默**：全仓 `.catch(() => 空)` 的服务端取数补 `console.error`（FA-12 预防规则②）。

## P2 — 前端渲染与包体（1~2 周，中风险，需逐页回归）

1. **公开列表页 ISR 化**：`force-dynamic`（25 页）中不依赖请求头个性化的页面改 `revalidate: 300`。注意：多数页面用 `headers()` 取 `x-country`（按域名分国家），需先把 country 改为从 middleware/域名映射注入才能享受 ISR——分两步走，先做无 country 依赖的页面（blog、guide、营销页）。
2. **重库懒加载**：framer-motion / recharts / leaflet 改 `next/dynamic`（admin 图表、地图首当其冲）；目前全站仅 1 处动态 import。
3. **列表渲染优化**：公司/专家列表（一次 300 条）加 `React.memo`（当前全站 0 处）+ 分页或虚拟化。
4. **图片**：56 处 `<img>` 逐步迁 `ProgressiveImage`/`next/image`（先改首页与列表页 LCP 图）。
5. **i18n 拆包**：`site-translations.ts` 全量打进每页，按 namespace 拆分。

## P3 — 工程债（择机，需用户决策）

1. **构建下移**：生产机 `next build` 改为本地/CI 构建后 rsync `.next`（消除部署时生产机 CPU 尖峰 + build 失败静默跑旧版风险）。
2. **API 客户端合并**：api.ts / adminApi.ts / publicApi.ts 三套去重（~300 行重复）。
3. **weightCalculator N+1**：循环串行 UPDATE 改批量。
4. **清理**：`server/prerender/`（疑似已死，~200MB）、`dist 2`、`node_modules 3` 确认后删除；`docs/plans/` 各文档补 Status 标记。
5. **后端源码化**（最大的债，单独立项）：至少对新增模块要求 TS 源码 + 用例。

---

## 执行纪律

每批改动走 `.claude/skills/` 流程：change-control → verification（harness 全绿 + 报告附结果）→ 用户批准 → deploy。P2 每页改完在受影响页面逐一回归（防 FA-3 改坏功能）。
