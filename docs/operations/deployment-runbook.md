# Tarmeer 生产部署运行手册

本手册是部署连接、路径与发布顺序的入口。每次发布先读本文件和对应 `.claude/skills/tarmeer-deploy-frontend/SKILL.md` / `tarmeer-deploy-backend/SKILL.md`，再执行连接预检。产品自测和三轮独立审查全绿后才发布；用户在当前任务明确授权上线即为发布授权，无须重复索取。

## 已验证的状态（2026-10-07）

- 生产 SSH 目标：`root@47.91.108.104`。
- 当前开发 Mac 的 `~/.ssh/tarmeer_ecs` 不存在；`~/.ssh/id_ed25519` 与 `~/.ssh/kst_deploy_ed25519` 均已被该目标拒绝。不要重复尝试这三个路径。
- 当前 `~/.ssh/config` 只有 `aiwiki-hk`，无需依赖尚未配置的 Tarmeer 主机别名。
- **生产密码认证已通过只读验证。** 从本机 Tarmeer 私有项目记忆恢复既有认证信息，保存在仓库外 `~/.config/tarmeer/deploy.env`（文件权限 `600`、目录 `700`）；认证通过 `sshpass -e` 进程环境提供，未输出或提交密码。
- 本地 `server/.env` 的 `DB_HOST=localhost`。本地脚本只用于本地库；生产数据修改必须 SSH 到服务器，使用 `/tarmeer/tarmeer_api/.env`。
- 后端路径为 `/tarmeer/tarmeer_api/dist/`，PM2 名为 `tarmeer-api`。已验证 Next 前端 cwd `/tarmeer/tarmeer_web_next`、PM2 名 `tarmeer-next`；两个服务均 online。每次仍以 `pm2 describe tarmeer-next` 验证 cwd，不能只凭旧记录。
- 发布前基线：前端 main 的 HEAD `f2988d0070f5826f3c9a79ca0a4593274cc56ca4`、BUILD_ID `kofLt9Ujt1Sg_Wa9uP-sb`；仅落后本地 origin/main 一条文档提交。四个受影响后端文件的生产哈希与该 Git HEAD 一致：`controllers/fieldAdminController.js`、`controllers/fieldInterviewController.js`、`routes/field.js`、`lib/autoMigrate.js`。这是发布前证据，不代表 V7 已上线。
- 生产前端有旧部署脚本、VN 项目图片和爬虫目录的未跟踪文件，必须保留，禁止 clean 或 rsync --delete。
- nginx 的 `/images/` 指向 `/tarmeer/tarmeer_web_portal/images/`；图片不因代码 push 自动上线。

更新认证或部署路径后，只记录验证时间、配置位置和成功命令形态，不记录私钥、密码、token 或 `.env` 全文。

## 连接配置与预检

1. 先查 `~/.config/tarmeer/deploy.env` 是否存在，以及 SSH 配置是否已有 `tarmeer-production` 别名；只读取目标主机、用户与私钥文件路径等非秘密配置。不要打印配置全文或环境变量全集。
2. 已配置私钥路径必须先验证文件存在、权限和目标是否对应 Tarmeer。若配置缺失或文件不存在，记录明确缺项，请用户提供正确私钥路径或恢复配置；不要不断猜测其它项目的密钥。
3. 推荐将长期连接信息保存在仓库外的 `~/.config/tarmeer/deploy.env`，权限 `600`，或 `~/.ssh/config` 的 `tarmeer-production` 别名中。仓库中只保存配置说明，不保存任何凭据。
4. 配置名为 `TARMEER_DEPLOY_HOST`、`TARMEER_DEPLOY_USER`、`TARMEER_DEPLOY_KEY`、`TARMEER_DEPLOY_SSH_ALIAS`；兼容 `DEPLOY_SSH_KEY`。本机已验证配置使用 host/user 和私有 `DEPLOY_SSH_PASSWORD`。自定义配置文件路径用 `TARMEER_DEPLOY_CONFIG`；不得在仓库创建真实凭据文件。
5. 先运行 `node scripts/ops/deploy-preflight.mjs --check-config` 验证配置，再运行 `node scripts/ops/deploy-preflight.mjs` 实际只读 SSH 预检。后者验证 PM2 cwd/status、Git HEAD 与 BUILD_ID；`--check-config` 成功只代表配置解析成功，不代表连接成功。2026-10-07 两条命令均 exit=0。
6. 对脚本修改运行 `node --test scripts/ops/deploy-preflight.test.mjs`。连接成功后才执行备份与部署。

SSH 别名配置示例（`IdentityFile` 必须换成已恢复且验证可用的实际路径）：

```sshconfig
Host tarmeer-production
  HostName 47.91.108.104
  User root
  IdentityFile /absolute/path/to/verified-tarmeer-private-key
  IdentitiesOnly yes
```

只读验证示例：

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 tarmeer-production 'hostname; pm2 describe tarmeer-next; pm2 describe tarmeer-api'
```

只有认证成功且 PM2 应用/路径对应本项目，才能进入发布。若密码认证被明确配置，可按预检脚本支持的方式提供进程环境；不要将密码拼进命令参数、工具输出或 Git。2026-10-07 本机密码认证已验证，可直接使用预检脚本读取私有配置，无须重复考古找密码。

## 历史认证线索（旧脚本不可执行）

- 本机私有记忆 `~/.claude/projects/-Users-yiming-Code-tarmeer/memory/deploy_flow.md` 记录过本机密码部署方式及 `deploy.config.sh` 线索。已将实际可用凭据移到上面的私有配置入口；以后只需运行预检脚本，不打印该记忆或凭据全文。
- Git `7cc7bc8b` 的 `deploy-backend-ecs.sh` 曾使用 `SSH_KEY`，默认 `~/.ssh/tarmeer_ecs`；可选 `DEPLOY_SSH_PASSWORD` 环境变量经 `sshpass` 认证。这仅证明历史上有该分支，不能证明当前机器有密码或服务器仍接受它。
- Git `e7764319` 的 `deploy-simple.sh` 曾候选 `DEPLOY_SSH_KEY`、`~/.ssh/mastery_github`、`id_ed25519`、`id_rsa`；脚本的密码变量为空。这些是旧候选，不得自动逐个尝试或当作当前标准配置。
- **不得运行 `deploy-simple.sh`**：它部署到旧 Vite 目录。
- **不得运行 `deploy-backend-ecs.sh`**：旧流程依赖完整 `server/package.json`，并含删除/重建 `dist` 与 `node_modules` 的动作；当前统一用 rsync 增量同步。

## 发布前必须备份

认证成功后，在服务器为本次发布创建独立带时间戳的备份目录，记录前端 Git SHA、`.next/BUILD_ID`、两个 PM2 应用的 cwd 与当前状态。备份本次即将替换的后端文件，路径必须保持目录层级；如迁移数据库结构或数据，同时用服务器数据库配置备份受影响表的结构和数据。备份文件只留受控位置，不提交用户数据或秘密配置到 Git。

先验证备份命令 exit=0、文件存在且非空，并记录恢复命令。备份失败不得继续发布。后台旧版源码备份与数据库备份是不同项目，不能将“已备份源码”报告为“数据库已备份”。

## 前后端发布顺序

1. 本地测试、国家 walkthrough、前端 build 和三轮独立审查全部通过。
2. 获取最新 `origin/main`，解决分叉；先成功 `git push origin HEAD:main`。push 未成功不得 rsync。
3. **先后端**：每个改动文件分别 rsync 到完整目标文件名，再 `pm2 restart tarmeer-api`；不使用 `--delete`。新建的 lib/schema/迁移辅助文件必须与引用它们的 controller 一起同步。
4. **再前端**：SSH 中 `pm2 describe tarmeer-next` 确认 cwd；在该目录执行 `git pull --ff-only`，确认部署 SHA；运行项目已安装的 `node_modules/.bin/next build`，exit=0 后才 `pm2 restart tarmeer-next`。
5. 比较 build 前后的 `.next/BUILD_ID`，确认 PM2 正在正确 cwd 运行新产物。build 失败时旧站仍可能正常响应，不能以首页 200 代替版本验证。
6. 新增图片生成四档 WebP 后，另行 rsync `public/images/<dir>/` 到 portal 的对应图片目录，curl 验证图片 200。
7. 验证本次真实用户链路、角色权限、国家隔离、旧记录兼容、手机和 PC；记录发布 SHA、BUILD_ID 与测试结果。

后端少量文件示例，使用**已经验证的** SSH 别名：

```bash
rsync -avz server/dist/controllers/fieldAdminController.js -e ssh tarmeer-production:/tarmeer/tarmeer_api/dist/controllers/fieldAdminController.js
rsync -avz server/dist/routes/admin.js -e ssh tarmeer-production:/tarmeer/tarmeer_api/dist/routes/admin.js
ssh tarmeer-production 'pm2 restart tarmeer-api'
```

不要将多个文件一次传到同一个根目录，否则子目录会被展平。完整目录同步只能使用目录 trailing slash 的既有规范。

## 失败与恢复

连接未通：停止部署，报告具体缺失配置及已验证拒绝项，保留可审查产物和测试证据。不能声称上线或认证已恢复。

备份、构建、重启或发布验收失败：停止后续发布，按本次备份与记录的 SHA 恢复上一可用版本，再验证服务。不自动执行 nginx 命令；本任务无需改 nginx。

## 文档自检

核对 `AGENTS.md`、本手册和两个部署技能是否同时约束：连接预检 → 备份 → 最新 main push → 后端精确路径 rsync/重启 → 前端 `pull --ff-only` / build exit 0 / 重启 → BUILD_ID / 真实链路验证。检查均无旧脚本可执行建议、无凭据、认证状态有对应只读验证证据。纯文档改动至少经过一轮独立审查。
