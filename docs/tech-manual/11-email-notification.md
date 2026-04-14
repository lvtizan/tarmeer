# 11 — 邮件与通知系统

## 一、邮件服务

### 配置

| 项目 | 值 |
|------|-----|
| 提供商 | Aliyun DirectMail (SMTP) |
| 库 | Nodemailer 6.9 |
| 端口 | 465 (SSL) |
| 连接池 | 5 连接, 100 消息/池 |
| 连接超时 | 10 秒 |
| Socket 超时 | 30 秒 |

### 开发模式

```
DEV_SKIP_EMAIL=true
  → 跳过真实 SMTP
  → 控制台打印邮件内容
  → 自动提取验证链接/重置链接（方便测试）
```

### 邮件类型

| 邮件 | 触发 | 接收人 |
|------|------|--------|
| 邮箱验证 | 用户注册 | 注册用户 |
| 密码重置 | POST /forgot-password | 申请用户 |
| Admin 密码重置 | POST /admin/forgot-password | Admin |
| 设计师注册通知 | 新用户注册为 company | 通知邮箱组 |
| 项目提交通知 | 公司提交新项目 | 通知邮箱组 |
| 询盘通知 | 业主提交 inquiry | 通知邮箱组 |

### 通知邮箱组

**表**: `notification_emails`

```sql
id          INT AUTO_INCREMENT
email       VARCHAR(255) NOT NULL
is_active   TINYINT(1) DEFAULT 1
created_at  TIMESTAMP
```

Admin 后台 (`AdminNotificationEmailsPage`) 可动态增删邮箱。每次发送通知时查询 `is_active = 1` 的所有邮箱，批量发送。

---

## 二、应用内通知

**文件**: `server/src/services/notificationService.ts`

### 通知类型

| type | 触发 | 内容 |
|------|------|------|
| `inquiry` | 新 inquiry 提交 | "新询盘: {name} ({phone})" |
| `company_registration` | 新公司注册 | "新公司注册: {name}" |
| `system` | 系统事件 | 自定义消息 |

### 通知模式

| 模式 | userId | 说明 |
|------|--------|------|
| 用户级 | 具体 userId | 只发给指定用户 |
| 广播 | NULL | 所有用户可见 |

### 数据结构

**表**: `notifications`

```sql
id          INT AUTO_INCREMENT
user_id     INT NULL            -- NULL = 广播
type        VARCHAR(50)
title       VARCHAR(200)
message     TEXT
link        VARCHAR(500)        -- 点击跳转地址
is_read     TINYINT(1) DEFAULT 0
created_at  TIMESTAMP
```

### 前端展示

**组件**: `src/components/NotificationBell.tsx`

- Navbar 右上角铃铛图标
- 未读计数 badge
- 下拉列表显示最近通知
- 点击标记已读 + 跳转

### API

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/notifications` | 获取当前用户通知列表 |
| PUT | `/api/notifications/:id/read` | 标记已读 |
