# 阿里云 RDS（Dubai）建库与网站对接

## RDS 实例信息

- **连接串示例**：`mysql://tarmeerCRM:Tarmeer2026@@rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com:3306`
- **主机**：`rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com`
- **端口**：`3306`
- **用户**：`tarmeerCRM`
- **密码**：连接串中的密码（若含 `@`，密码为 `Tarmeer2026@`）
- **数据库名**：`tarmeer`（需在 RDS 控制台先建好并授权给 tarmeerCRM）

---

## 一、在 RDS 控制台完成（必做）

1. 登录 **阿里云 RDS 控制台**，选择 Dubai 实例 `rm-eb3t6y5093m91i2wzqo`。
2. **创建数据库**：  
   - 数据库名：**`tarmeer`**  
   - 字符集：**utf8mb4**  
   - 排序规则：utf8mb4_unicode_ci（或默认）
3. **授权账号**：  
   - 将账号 **tarmeerCRM** 授权访问数据库 **tarmeer**（勾选读写或“所有权限”），保存。

---

## 二、在 RDS 上建表（与网站字段一致）

控制台建库并授权后，在**项目目录**下用 Node 执行（与后端同驱动，避免本机 mysql 客户端兼容问题）：

```bash
cd "/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0/server"

DB_TABLES_ONLY=1 \
DB_HOST=rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com \
DB_PORT=3306 \
DB_USER=tarmeerCRM \
DB_PASSWORD='Tarmeer2026@' \
DB_NAME=tarmeer \
node schema/run-init-with-node.js
```

会执行 `schema/init-tables-only.sql`，在库 **tarmeer** 下创建表：**designers**、**projects**、**contacts**，字段与网站后端一致。

若你的用户有 CREATE DATABASE 权限，也可先试完整初始化（建库+建表，不设 `DB_TABLES_ONLY`）：

```bash
DB_HOST=rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com DB_USER=tarmeerCRM DB_PASSWORD='Tarmeer2026@' DB_NAME=tarmeer node schema/run-init-with-node.js
```

---

## 二、网站后端对接 RDS（ECS 上 .env）

在 ECS 服务器上编辑 **`/tarmeer/tarmeer_api/.env`**，与 RDS 保持一致：

```env
# RDS Dubai
DB_HOST=rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com
DB_PORT=3306
DB_USER=tarmeerCRM
DB_PASSWORD=Tarmeer2026@
DB_NAME=tarmeer

# 必填
JWT_SECRET=你的JWT密钥至少32位

PORT=3002
NODE_ENV=production
FRONTEND_URL=http://designer.tarmeer.com

# SMTP（可选，用于验证邮件）
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=...
# SMTP_PASS=...
# SMTP_FROM=noreply@tarmeer.com
```

保存后重启后端：

```bash
pm2 restart tarmeer-api
pm2 logs tarmeer-api
```

---

## 三、表与网站功能对应关系

| 表名 | 说明 | 网站用途 |
|------|------|----------|
| **designers** | 设计师账号与资料 | 注册、登录、邮箱验证、个人资料 |
| **projects** | 设计师项目案例 | 项目列表、详情、上传/编辑/删除 |
| **contacts** | 客户留言/询盘 | 联系表单提交、后台列表与状态 |

字段与现有后端代码已对齐，无需再改表结构即可正常使用网站。

---

## 四、自检

- **表是否建好**：在 RDS 控制台用 DMS 连接该实例，选中库 `tarmeer`，应看到表 `designers`、`projects`、`contacts`。
- **网站**：访问注册页提交注册；访问 `/api/health` 应返回 JSON。  
  若注册或接口报错，在 ECS 上执行 `pm2 logs tarmeer-api` 查看报错（如 DB 连接失败、表不存在等）。

---

## 五、流程小结

1. RDS 控制台：创建数据库 **tarmeer**（utf8mb4），并授权 **tarmeerCRM** 访问该库。  
2. 本机执行：`DB_TABLES_ONLY=1 DB_HOST=... DB_USER=tarmeerCRM DB_PASSWORD='...' DB_NAME=tarmeer node server/schema/run-init-with-node.js`，完成建表。  
3. ECS 上配置 `/tarmeer/tarmeer_api/.env`（同上 RDS 与 JWT），执行 `pm2 restart tarmeer-api`。  
完成以上步骤后，网站即使用该 RDS 数据库，可正常注册、登录与使用各功能。
