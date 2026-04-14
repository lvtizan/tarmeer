# 13 — 部署架构

## 服务器拓扑

```
┌─────────────────────────────────────────────────────────────────┐
│                    Aliyun ECS (Dubai Region)                     │
│                    IP: 47.91.108.104                              │
│                    SSH: ssh -i ~/.ssh/tarmeer_ecs root@47.91...   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  Nginx (Port 80/443, SSL 终止)                           │     │
│  │                                                           │     │
│  │  www.tarmeer.com                                          │     │
│  │    ├── /           → /tarmeer/tarmeer_web_portal/ (静态)  │     │
│  │    └── /api/*      → proxy_pass http://127.0.0.1:3002     │     │
│  │                                                           │     │
│  │  admin.tarmeer.com                                        │     │
│  │    ├── /           → /tarmeer/tarmeer_web_crm/ (静态)     │     │
│  │    └── /api/*      → proxy_pass http://127.0.0.1:3002     │     │
│  │                                                           │     │
│  │  tarmeer.com → 301 → www.tarmeer.com                      │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                   │
│  ┌───────────────────┐  ┌────────────────────────────────┐      │
│  │  Backend (PM2)     │  │  CRM (PM2 Cluster x2)          │      │
│  │  tarmeer-api       │  │  tarmeer-crm                    │      │
│  │  Port: 3002        │  │  Port: 3000                     │      │
│  │  app.js            │  │  index.js                       │      │
│  └───────────────────┘  └────────────────────────────────┘      │
│                                                                   │
│  SSL 证书: /cicd/tarmeer.com_nginx/tarmeer.com_bundle.pem        │
│  SSL 密钥: /cicd/tarmeer.com_nginx/tarmeer.com.key               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Aliyun RDS MySQL (Dubai Region)                                 │
│  Host: rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com      │
│  DB: tarmeer · 字符集: utf8mb4                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 部署命令

### 前端部署

```bash
# 1. 构建
node_modules/.bin/tsc && node_modules/.bin/vite build

# 2. 增量同步到服务器
DEPLOY_SSH_KEY=~/.ssh/tarmeer_ecs \
DEPLOY_RULES_ACK=YES \
DEPLOY_USER_APPROVED=YES \
SKIP_SCHEMA_CHECK=YES \
bash deploy-simple.sh
```

**内部流程**：
```
deploy-simple.sh
  ├── 步骤 1: npm run build (tsc + vite build)
  ├── 步骤 2: rsync -az --delete --checksum dist/ → 服务器
  ├── 步骤 3: 统一文件权限
  └── 步骤 4: 健康检查
      ├── 首页 HTTP 200
      ├── 头像文件可访问
      └── JS/CSS 资源可访问
```

**rsync 特性**：
- `-az`: 压缩传输 + 保持属性
- `--delete`: 删除服务器上多余的文件
- `--checksum`: 按内容校验而非时间戳
- 典型传输量: ~1MB, <10 秒

### 后端部署

```bash
bash deploy-backend-ecs.sh
```

**内部流程**：
```
deploy-backend-ecs.sh
  ├── 本地 tsc 编译 → dist/
  ├── tar 打包 dist/ + package.json + package-lock.json
  ├── scp 上传到服务器 /tarmeer/tarmeer_api/
  ├── 服务器端 npm install --production
  └── pm2 restart tarmeer-api
```

---

## 部署原则

### 顺序铁律

```
后端改了 → 先部署后端 → 再部署前端
只改前端 → 直接部署前端
只改后端 → 直接部署后端
```

**原因**：前端可能调用后端新 API，如果前端先部署，新 API 不存在，用户会看到 404 错误。

### 验证清单

每次部署后必须验证：

| 检查项 | 方法 |
|--------|------|
| 首页可访问 | curl https://www.tarmeer.com → 200 |
| API 健康 | curl https://www.tarmeer.com/api/health → 200 |
| 静态资源 | 随机一个 JS chunk URL → 200 |
| 图片可访问 | 随机一个头像 URL → 200 |
| 新功能可用 | 手动测试改动点 |

### Nginx 不变量

**绝对不要在部署脚本中修改 Nginx 配置。** Nginx 配置由人工管理，deploy 脚本只负责：构建 → 上传 → 验证。

---

## PM2 进程管理

```bash
# 查看进程
pm2 list

# 重启后端
pm2 restart tarmeer-api

# 查看日志
pm2 logs tarmeer-api --lines 50

# 监控
pm2 monit
```

### 进程列表

| 进程 | 模式 | 端口 | 说明 |
|------|------|------|------|
| tarmeer-api | fork | 3002 | Express 后端 |
| tarmeer-crm | cluster x2 | 3000 | CRM 系统 |

---

## 环境变量

后端关键环境变量（在服务器 `/tarmeer/tarmeer_api/.env` 中配置）：

| 变量 | 说明 |
|------|------|
| `PORT` | 后端端口（默认 3002） |
| `DB_HOST` | MySQL 主机 |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 凭证 |
| `JWT_SECRET` | JWT 签名密钥 |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | 邮件配置 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook OAuth |
| `CRM_INBOUND_URL` / `CRM_API_KEY` / `CRM_TENANT_ID` | CRM 集成 |
| `FRONTEND_URL` | 前端地址（用于 OAuth callback） |
| `NODE_ENV` | production / development |
