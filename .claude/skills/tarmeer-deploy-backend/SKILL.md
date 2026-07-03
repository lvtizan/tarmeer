---
name: tarmeer-deploy-backend
description: Tarmeer 后端（Express，server/dist/）部署流程——rsync 增量同步 + pm2 重启。适用于：改了 server/dist/ 下任何文件之后。判断标准：改了 server/dist/ = 必须走本流程，本地改动不会自动生效。
---

# 后端部署

## 何时不用本技能

- 只改了 `src/`（前端）→ `tarmeer-deploy-frontend`
- 要改生产数据库数据（跑 SQL/脚本）→ `tarmeer-database-ops`，那不叫部署
- 前后端都改 → **先本流程，后前端部署**

## 背景事实

- `server/dist/` 的 JS 就是后端唯一源码（无 TS 源码），生产在 `/tarmeer/tarmeer_api/dist/`。
- `deploy-backend-ecs.sh` 需要完整 `server/package.json`，本地不满足条件，**不要用**；用 rsync 增量同步。

## 单文件/少量文件同步（⚠️ 最容易踩的坑）

**多文件 rsync 必须分开写，目标路径必须指定到文件名。** rsync 一次传多个文件会把它们展平到目标目录根部，路径全错：

```bash
rsync -avz server/dist/controllers/fieldAdminController.js \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/controllers/fieldAdminController.js

rsync -avz server/dist/routes/admin.js \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/routes/admin.js
```

## 全量同步

```bash
rsync -avz server/dist/ \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/
```

**禁止加 `--delete`**：生产 `dist/` 或其邻近目录可能有服务器侧文件；历史上有过"全站图片被删、被迫全部重传"的事故（见 `tarmeer-failure-archaeology`），任何 rsync 删除行为都必须先向用户确认。

## 同步完必须重启

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "pm2 restart tarmeer-api"
```

不重启 = 改动不生效。重启后验证：

```bash
curl -s https://www.tarmeer.com/api/health
# 再用本次改动涉及的接口实测一次（带真实参数）
```

## 部署前置

- 本地已跑 `node scripts/harness/smoke-test.mjs`（后端路由存在性检查）全绿 → 见 `tarmeer-verification`
- 涉及国家/写入口 → country-walkthrough 全绿
- 用户明确批准发布

## 姊妹文档

上线后 500/接口异常 → `tarmeer-debugging`（先查 pm2 logs 和 collation）。
