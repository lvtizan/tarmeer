# 后端 API 部署说明（不改 Nginx）

本仓库**不会**自动修改服务器上的 Nginx 配置。部署脚本只负责把后端代码上传到 ECS 并启动进程。  
**Nginx 配置由 AI 输出、供运维同事复制使用**，需运维同事人工合并到现有配置并重载 Nginx。

## 前置条件

- 服务器已安装 **Node.js**（建议 18+）  
- 可选：安装 **pm2**（`npm i -g pm2`）便于进程守护；未安装时脚本会用 nohup 启动

## 服务器信息

- **IP**: 47.91.108.104  
- **账号**: root  
- **部署目录**: /tarmeer/tarmeer_api  
- **API 监听端口**: 3002（默认）

## 一键部署后端

在项目根目录执行：

```bash
./deploy-backend-ecs.sh
```

脚本会：

1. 在本地构建 `server/`（npm ci + tsc）
2. 将构建产物和依赖清单上传到 ECS 的 `/tarmeer/tarmeer_api`
3. 在服务器上执行 `npm ci --omit=dev` 并启动进程（优先用 pm2，否则 nohup node）

**不会**修改 Nginx 或任何其他系统配置。

## 首次部署后必做

1. **SSH 登录服务器**，编辑 `/tarmeer/tarmeer_api/.env`：
   - `JWT_SECRET`：生产环境必填（建议 32 位以上随机字符串）
   - `DB_HOST`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`：若使用 MySQL，按实际填写
   - `FRONTEND_URL`：可选，例如 `http://47.91.108.104`（用于 CORS）
   - `NODE_ENV=production`
   - `PORT=3002`（与下面 Nginx 代理端口一致即可）

2. 编辑完成后重启后端：
   - 若用 pm2：`pm2 restart tarmeer-api`
   - 若用 nohup：先 `pkill -f 'node dist/app.js'`，再在 `/tarmeer/tarmeer_api` 下执行 `nohup node dist/app.js > backend.log 2>&1 &`

## 给运维同事：Nginx 配置（AI 输出，人工合并）

前端请求会发到 **同一域名 + `/api`**，例如：  
`http://47.91.108.104/api/auth/register`。  
需要把 `/api` 反向代理到本机后端 `http://127.0.0.1:3002`。

**完整配置已输出到仓库内，供运维同事复制使用，AI 与部署脚本不会修改 Nginx：**

- **文件位置**：`docs/nginx-api-for-ops.conf`
- 内含：`location /api { ... }` 片段（可合并进现有 server 块）及可选独立 server 示例说明。
- 请运维同事将上述配置**人工合并**到现有 Nginx 配置后，执行 `nginx -t` 检查，再 `systemctl reload nginx`（或你们实际使用的重载方式）。

## 验证

- 未配置 Nginx 前，可在服务器上测：`curl http://127.0.0.1:3002/api/health`
- 配置 Nginx 后，可在浏览器或本机测：`curl http://47.91.108.104/api/health`

返回 JSON 即表示后端和（若已配置）Nginx 均正常。

## 数据库（MySQL）

- **数据库名**：`tarmeer`
- **表**：`designers`、`projects`、`contacts`
- **完整建库与建表**：见 `server/schema/init.sql`。  
  详细步骤（安装 MySQL、建库、.env、SMTP 等）见 **`docs/阿里云数据库与环境配置.md`**。

若线上尚未建库，在服务器执行：  
`mysql -u root -p < server/schema/init.sql`（需先把 `server/schema/init.sql` 拷到服务器，或在项目目录下执行）。

## 注册失败排查（Registration fails）

若注册一直报错，可依次检查：

1. **数据库与表是否存在**  
   使用 **MySQL**，数据库名为 **`tarmeer`**。若未建库/表，按上面「数据库」执行 `server/schema/init.sql`。

2. **.env 配置**  
   确认 `DB_HOST`、`DB_USER`、`DB_PASSWORD`、**`DB_NAME=tarmeer`**、`JWT_SECRET` 正确。

3. **后端日志**  
   `pm2 logs tarmeer-api` 查看报错（如 DB 连接失败、表不存在等）。
