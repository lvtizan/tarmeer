---
name: tarmeer-deploy-backend
description: Tarmeer 后端（Express，server/dist/）部署流程——rsync 增量同步 + pm2 重启。适用于：改了 server/dist/ 下任何文件之后。判断标准：改了 server/dist/ = 必须走本流程，本地改动不会自动生效。
---

# 后端部署

## 何时不用本技能

- 只改了 `src/`（前端）→ `tarmeer-deploy-frontend`
- 要改生产数据库数据（跑 SQL/脚本）→ `tarmeer-database-ops`，那不叫部署
- 前后端都改 → **先本流程，后前端部署**

## 连接预检与备份（发布入口）

先读 [`docs/operations/deployment-runbook.md`](../../../docs/operations/deployment-runbook.md)，执行 `node scripts/ops/deploy-preflight.mjs --check-config` 后再执行 `node scripts/ops/deploy-preflight.mjs` 实际只读预检，成功后先备份生产当前版本与受影响数据库表。连接配置优先仓库外 `~/.config/tarmeer/deploy.env` 或已验证 SSH 别名；禁止打印/提交密码与私钥。

2026-10-07 当前开发 Mac 的 `~/.ssh/tarmeer_ecs` 不存在，`id_ed25519` 与 `kst_deploy_ed25519` 已被生产拒绝，已从本机私有 Tarmeer 项目记忆恢复既有密码认证，`~/.config/tarmeer/deploy.env`（600）现为已验证入口，实际只读预检 exit=0。本文该私钥命令是历史示例，仅在恢复并验证后可用。缺配置时明确报告，不反复猜测密钥；历史密码 fallback 只作考古，见运行手册。

用户在当前任务已明确授权上线即满足发布授权，无须重复索取。预检/备份失败不得发布，也不得声称认证恢复或已上线。

## 背景事实

- `server/dist/` 的 JS 就是后端唯一源码（无 TS 源码），生产在 `/tarmeer/tarmeer_api/dist/`。
- `deploy-backend-ecs.sh` 需要完整 `server/package.json`，本地不满足条件，**不要用**；用 rsync 增量同步。

## ⚠️ 第 0 步：rsync 前必先同步远端（多人协作防覆盖，FA-13）

**在 rsync 任何后端文件到生产之前，必须先确认本地已含 origin/main 最新提交。** 否则会用落后的 dist 覆盖队友已部署的后端（多人同仓库时血的教训）：

```bash
git fetch origin main
git log --oneline HEAD..origin/main   # 有输出 = 远端领先,先 rebase 再说
git rebase origin/main                # 落后就先 rebase(通常零冲突,增量在不同区域自动合并)
git merge-base --is-ancestor origin/main HEAD && echo OK  # 确认本地已含远端最新
```

**安全门：先 `git push origin HEAD:main`。** push 被 non-fast-forward 拒绝 = 远端领先，立刻停手 rebase；**push 成功才允许 rsync 后端 + pm2 restart**。绝不在 push 之前 rsync。
（若已误覆盖：`git show origin/main:server/dist/<file>` 提取队友版本 rsync 回生产恢复，再 rebase 重来。）

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

- **先同步远端**（第 0 步）：`git fetch` + `git push` 成功（分叉已解决）才允许 rsync 后端 — FA-13
- 本地已跑 `node scripts/harness/smoke-test.mjs`（后端路由存在性检查）全绿 → 见 `tarmeer-verification`
- 涉及国家/写入口 → country-walkthrough 全绿
- 用户明确批准发布

## 姊妹文档

上线后 500/接口异常 → `tarmeer-debugging`（先查 pm2 logs 和 collation）。
