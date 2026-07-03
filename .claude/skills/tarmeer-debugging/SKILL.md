---
name: tarmeer-debugging
description: Tarmeer 线上问题诊断手册——按症状分诊。适用于：线上 404/403/500、页面白屏或跑旧代码、图片不显示、数据为空、错国家内容漏出、SEO 收录异常。先分诊再动手，禁止盲改。
---

# 线上诊断手册

## 何时不用本技能

- 本地开发报错 → 通常是 `.next` 缓存（重启 5180 dev server）或后端没起（3002）；不属于线上诊断
- 要预防而非救火 → `tarmeer-change-control` / `tarmeer-verification`
- 修完了 → 归档进 `tarmeer-failure-archaeology`（不归档 = 没修完）

## 症状分诊表

| 症状 | 第一怀疑 | 验证方法 |
|------|---------|---------|
| 部署了但行为还是旧的 | **build 失败 pm2 静默跑旧版** | 服务器 `.next/BUILD_ID` 是否变化；pm2 logs 找 build 报错 |
| 静态图片 404 | 图片没 rsync（git push 不上线图片） | `curl -sI https://www.tarmeer.com/images/<path>`；对照 `tarmeer-image-pipeline` |
| 静态资源 403 | 文件权限 600 | `ls -la` 该文件，改 644/755 |
| 接口 500，本地却是绿的 | **跨表字符串比较 collation 不一致** | 生产库查 `INFORMATION_SCHEMA.COLUMNS` 比对两列 `COLLATION_NAME`；另一常见因：SELECT 了生产库没有的列（ER_BAD_FIELD_ERROR，历史 commit 549d85ab3） |
| 生产 build 失败但本地绿 | 类型文件没和引用方同 commit 提交 | 服务器上看 build 日志缺的类型/字段 |
| AE 视图冒出越南文（或反之） | 国家串桶 | 按 `tarmeer-country-isolation` 排查链：ref_source → JOIN 国家条件 → country 参数 |
| 新子域名下 /images/ /uploads/ /api/ 404 | nginx server block 缺三段 location | 对照 AGENTS.md 第四步的 nginx 模板 |
| 详情页数据拉不到但返回 200 页面 | fetch 失败分支渲染了 fallback UI | 必须改为 `notFound()`——HTTP 200 软 404 不被 Google 收录 |
| 导航栏/首页数据为空 | API 数据完整性问题 | `node health-check-v2.mjs` 的 spot-checks（供应商分类/服务分类/公司数据） |
| 问卷/访谈字段丢失但无报错 | 前端硬编码了 survey schema | 见 `tarmeer-dynamic-data`——schema 必须来自 `GET /api/field/survey-schema` |

## 通用诊断工具

```bash
# 全站体检（40+ 检查项，配置在 site-checklist.json）
node health-check-v2.mjs
# v3 版（含 pm2 监控自动重启、admin 登录态双国检查、邮件告警）
node scripts/ops/health-check.mjs

# 服务器侧
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104
pm2 list && pm2 logs tarmeer-api --lines 100
pm2 logs tarmeer-next --lines 100
cat <next应用目录>/.next/BUILD_ID   # 应用目录看 pm2 describe tarmeer-next 的 cwd
```

## 诊断纪律

1. 先复现、再定位、后修复；禁止"看起来像就先改了试试"（filter bar 一天 5 连修的根源就是无诊断盲改）。
2. 生产数据库只读排查可以，任何写操作走 `tarmeer-database-ops` 的规矩。
3. 修复动作本身也要过 `tarmeer-verification` 再上线。

## 姊妹文档

修复上线 → 对应 deploy 技能；根因沉淀 → `tarmeer-failure-archaeology`。
