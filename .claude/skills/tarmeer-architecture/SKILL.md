---
name: tarmeer-architecture
description: Tarmeer 系统架构契约——技术栈、目录职责、端口、生产服务器路径、nginx 映射、pm2 进程、环境变量。任何时候需要回答"这个东西在哪/归谁管/走哪条链路"时先读本文档。适用于：新会话首次接触本仓库、定位某功能的前后端代码、判断某个改动影响哪些部署单元。
---

# Tarmeer 架构契约

## 何时不用本技能

- 已经知道要改哪里、准备动手 → 先读 `tarmeer-change-control`
- 要部署 → `tarmeer-deploy-frontend` / `tarmeer-deploy-backend`
- 排查线上故障 → `tarmeer-debugging`

## 产品一句话

Tarmeer：阿联酋（AE）+ 越南（VN）双国装修/室内设计 B2B2C 平台。公司/供应商/设计师三类入驻方 + 业主端 + 管理后台 + 外勤调研端。**只服务 AE/VN 两国**（SA 沙特脚手架已于 2026-04 revert 移除，commit 96e17eea7，不要再引入）。

## 技术栈与目录职责

| 位置 | 是什么 | 关键事实 |
|------|--------|---------|
| `src/` | Next.js 16 App Router 前端（TS） | 路径别名 `@/*` → `src/*`；strict 模式 |
| `server/dist/` | Express 后端 **JS 编译产物 = 唯一源码** | **没有 server/src/**。改后端 = 直接改 dist 下的 JS，改完必须 rsync 上生产（见 tarmeer-deploy-backend） |
| `server/prerender/` | SSR 预渲染子项目 | 独立 node_modules |
| `scripts/harness/` | 自检用例脚本 | smoke-test / country-walkthrough / field-* 等，见 tarmeer-verification |
| `scripts/vietnam-scraper/` | VN 公司爬虫 + 图片下载 | 产出图片落 `public/images/vn-companies/`，须手动 rsync 上线 |
| `scripts/ops/` | 监控脚本 v3 | `health-check.mjs`（页面/API/pm2/告警） |
| `health-check-v2.mjs` + `site-checklist.json` | 监控 v2 + 40+ 检查项配置 | cron 定期跑，故障发邮件 |
| `docs/plans/` | 历史设计/实现计划 | 按日期命名 |
| `memory/` | 空目录（历史遗留） | 旧的 pitfalls 记录已整合进 `.claude/skills/`，不要再往 memory/ 写 |

## 端口与进程

- 本地：前端 dev server **5180**，后端 Express **3002**（`next.config.ts` 把 `/api/*`、`/uploads/*` 代理到 3002）
- 生产 pm2 进程：`tarmeer-next`（前端）、`tarmeer-api`（后端）

## 生产服务器

- 地址：`root@47.91.108.104`，SSH key `~/.ssh/tarmeer_ecs`
- `/tarmeer/tarmeer_web_portal/` — web 根 + **静态图片真实目录**
- `/tarmeer/tarmeer_api/` — 后端（含 `dist/`、`public/uploads/`、`.env`）

## nginx 路径映射（最常见的认知陷阱）

| URL | 实际磁盘位置 |
|-----|-------------|
| `/images/*` | `/tarmeer/tarmeer_web_portal/images/`（**不是** Next 的 public/，本地 `public/images/` 里的图 git push 后线上仍 404，必须 rsync） |
| `/uploads/*` | `/tarmeer/tarmeer_api/public/uploads/` |
| `/api/*` | proxy → `localhost:3002/api/` |

新建子域名的 server block 必须包含以上三块，缺一即 404（AGENTS.md 第四步有完整 nginx 片段）。

## 环境变量

- 前端 `.env`：`NEXT_PUBLIC_API_URL`、`NEXT_PUBLIC_GOOGLE_MAPS_KEY`
- 后端 `server/.env`：DB_*、JWT_SECRET、SMTP_*、GOOGLE_*（OAuth/Vision）、CRM_*、MALL_INTEGRATION_SECRET、OPENAI_*
- **`server/.env` 的 `DB_HOST` 决定连本地还是生产 RDS**——任何数据库操作前必查，见 `tarmeer-database-ops`

## 测试与 CI 现状

**没有 CI**（无 .github/workflows）。质量保障 = harness 脚本人肉跑 + health-check 监控。因此本仓库一切"验收"责任落在执行者身上，见 `tarmeer-verification`。

## 姊妹文档

- 动手改代码前 → `tarmeer-change-control`
- 国家相关的任何读写 → `tarmeer-country-isolation`
- 前端组件选型 → `tarmeer-ui-conventions`
- 枚举/分类/schema 类数据 → `tarmeer-dynamic-data`
