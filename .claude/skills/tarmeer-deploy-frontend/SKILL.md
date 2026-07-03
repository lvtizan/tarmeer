---
name: tarmeer-deploy-frontend
description: Tarmeer 前端（Next.js）部署流程——上线 src/ 下的代码改动。适用于：用户说"上线/部署/发布前端"、改了 src/ 需要生产生效。包含 BUILD_ID 验证防"静默跑旧版"。禁止使用 deploy-simple.sh。
---

# 前端部署

## 何时不用本技能

- 改的是 `server/dist/` → `tarmeer-deploy-backend`
- **前后端都改 → 先 `tarmeer-deploy-backend`，后本流程**
- 新增/改动了静态图片 → 先走 `tarmeer-image-pipeline`（代码和图片是两条独立上线通道，只 push 代码图片不会上线）
- 还没跑自检 → 先 `tarmeer-verification`，本地 `next build` exit 0 是部署前置条件

## 部署前置

1. 用户明确批准本次发布（无批准不部署）。
2. 本地 `node_modules/.bin/next build` 通过（exit 0）。**跑完 build 会覆盖 `.next`，本地 5180 dev server 必须重启**（否则 dev 缓存与新产物不同步，热更新异常）。
3. 工作区只含本次要上线的改动。
4. `package.json` 版本号 patch +1（如 4.0.1 → 4.0.2），与功能 commit 一起提交或单独 `chore: bump version`（沿用 deploy-safety-workflow 的版本规则）。

## 标准流程

```bash
git push
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104
# 服务器上（Next 应用目录，可用 pm2 describe tarmeer-next 查 cwd）：
git pull && next build && pm2 restart tarmeer-next
```

## 部署后必须验证（防最贵的坑）

**生产 build 失败时 pm2 会静默继续跑旧版本，站点看起来完全正常。** 所以：

1. 服务器上确认 build 真正成功（exit code / 输出无 error）。
2. **对比 `.next/BUILD_ID`**：build 前后值必须变化，且 pm2 restart 后线上行为对应新代码。
3. 首页 200、本次改动涉及的页面逐一 curl/浏览验证。
4. 可跑 `node health-check-v2.mjs` 或 `scripts/ops/health-check.mjs` 做全站体检。

## 禁止事项

- **禁止 `deploy-simple.sh` 部署前端代码**——它部署到旧 Vite 目录，已废弃。`docs/operations/deploy-safety-workflow.md` 中关于 deploy-simple.sh 的用法是旧架构遗留，**以本文档和 AGENTS.md 为准**。该文档中仍有效的部分：nginx 命令默认禁止、文件权限 644/755、回滚原则。
- **默认禁止任何 nginx 命令**（`nginx -t`、reload、restart）。仅当用户在当前对话明确批准、且执行时显式带 `ALLOW_NGINX_ACTIONS=YES` 时才可执行（与 deploy-safety-workflow 的闸门一致）。
- 禁止部署未过自检的代码。

## 文件权限

静态资源必须 644（目录 755），600 会导致 nginx 403：

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "find /tarmeer/tarmeer_web_portal -type d -exec chmod 755 {} +; \
   find /tarmeer/tarmeer_web_portal -type f -exec chmod 644 {} +"
```

## 回滚原则

部署后任何检查失败：停止继续改动 → 回退到上一个可用版本 → 重新验证 → 查明根因后才允许下一次发布。并把事故归档进 `tarmeer-failure-archaeology`。

## 姊妹文档

前后端都改了 → **先** `tarmeer-deploy-backend` **后**本流程。上线后异常 → `tarmeer-debugging`。
