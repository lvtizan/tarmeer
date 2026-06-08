<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 开发工作流 — 每次动手前必查

### 第一步：确认数据库环境

运行任何操作数据库的脚本前，先看 `server/.env` 的 `DB_HOST`：

- `DB_HOST=localhost` → 连本地 MySQL，**生产库不受影响**
- `DB_HOST=rm-eb3t6y5093m91i2wzqo...` → 连生产 RDS

**规则：凡是要改生产数据，必须 SSH 到服务器，用服务器上的 `/tarmeer/tarmeer_api/.env` 执行。本地脚本只做本地开发。**

### 第二步：确认部署路径

| 操作 | 正确命令 |
|------|---------|
| 前端代码上线 | `git push` → SSH: `git pull && next build && pm2 restart tarmeer-next` |
| 静态图片上线 | `rsync -avz public/images/vn-companies/ root@47.91.108.104:/tarmeer/tarmeer_web_portal/images/vn-companies/` |
| 后端代码上线 | 见下方后端部署规则 |

`deploy-simple.sh` 已废弃（部署到旧 Vite 目录），**不要用它部署前端代码**。

**后端部署规则（凡改 `server/dist/` 下任何文件，必须同步到生产）：**

`deploy-backend-ecs.sh` 需要完整 `server/package.json`，本地不满足条件，**改用 rsync 增量同步**：

```bash
# 只同步改动的文件（例如改了 controller 和 routes）
rsync -avz server/dist/controllers/fieldAdminController.js \
           server/dist/routes/admin.js \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/

# 同步完必须重启后端
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "pm2 restart tarmeer-api"
```

批量同步所有 dist 文件：
```bash
rsync -avz server/dist/ \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_api/dist/
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "pm2 restart tarmeer-api"
```

**判断标准：改了 `server/dist/` = 必须 rsync 后端 + pm2 restart tarmeer-api。改了 `src/` = 只需前端部署。两者都改 = 先后端后前端。**

### 第三步：新增 VN 公司图片后必须 rsync

爬虫入库结束后，图片在本地 `public/images/vn-companies/`，**必须手动 rsync 到服务器才能在线上显示**：

```bash
rsync -avz public/images/vn-companies/ \
  -e "ssh -i ~/.ssh/tarmeer_ecs" \
  root@47.91.108.104:/tarmeer/tarmeer_web_portal/images/vn-companies/
```

### 第四步：新建子域名必须检查 nginx 配置

新建任何子域名的 nginx server block，必须包含以下三块，缺一会导致已知 404：

```nginx
# 静态图片（与 www.tarmeer.com 共用）
location ^~ /images/ {
    alias /tarmeer/tarmeer_web_portal/images/;
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
}

# API 上传文件
location ^~ /uploads/ {
    alias /tarmeer/tarmeer_api/public/uploads/;
    expires 30d;
}

# 后端 API
location ^~ /api/ {
    proxy_pass http://localhost:3002/api/;
    ...
}
```

### 第五步：图片过滤脚本使用规范

`scripts/filter-portfolio-images.js` 需要本地图片文件 + `sharp`，只能在本地运行。但改的是本地 DB（`DB_HOST=localhost`），生产库不变。

如需清理生产库中失效的图片引用，在服务器上运行专用脚本：

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104
node /tmp/purge-vn-missing.js   # 删除文件不存在的图片引用
```

---

## Field Survey Rules

**NEVER hardcode the survey schema (section titles, field keys, field labels, or options)** in any frontend file — not in the survey page, not in the admin visit-records detail view, nowhere.

The canonical schema lives in the `survey_schema` DB table and is served by `GET /api/field/survey-schema`. All components that render survey data MUST fetch from this endpoint and fall back to a minimal default only when the API returns null.

Rationale: hardcoded schemas cause silent data loss — fields added to the DB schema are never shown in the admin view, and filled answers go invisible without any error.
