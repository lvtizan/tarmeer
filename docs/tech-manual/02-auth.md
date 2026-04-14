# 02 — 认证与权限系统

## 技术栈

| 技术 | 用途 |
|------|------|
| Passport.js 0.7 | OAuth 策略框架 |
| passport-google-oauth20 | Google 登录 |
| passport-facebook | Facebook 登录 |
| jsonwebtoken | JWT 签发/验证 |
| bcryptjs | 密码哈希 |
| express-session | OAuth 流程中的临时 session |

---

## 架构总览

```
┌─────────────────────────────────────────────────────┐
│                     认证流程                          │
├──────────────────┬──────────────────────────────────┤
│  邮箱注册/登录    │  OAuth 登录                       │
│  POST /register  │  GET /google → callback → JWT     │
│  POST /login     │  GET /facebook → callback → JWT   │
│  → bcrypt 校验   │  POST /google/one-tap → JWT       │
│  → JWT 签发      │                                   │
├──────────────────┴──────────────────────────────────┤
│                    JWT Token                          │
│  payload: { userId, email, role, active_role }       │
│  前端存 localStorage → 每次请求 Authorization header  │
├─────────────────────────────────────────────────────┤
│                   中间件链                            │
│  authenticate (user) → req.user                      │
│  authenticateAdmin → req.adminId + req.permissions    │
│  ProtectedRoute (frontend) → redirect /auth           │
└─────────────────────────────────────────────────────┘
```

---

## 用户认证（User Auth）

### 注册流程

```
用户填写表单 → POST /api/auth/register
  ├── 邮箱查重
  ├── bcrypt 哈希密码（10 轮 salt）
  ├── INSERT INTO users
  ├── 发送验证邮件（含 token 链接）
  └── 返回 JWT + user profile
```

### 登录流程

```
POST /api/auth/login
  ├── 查询 users 表（email）
  ├── bcrypt.compare 校验密码
  ├── 检查账号是否被软删除
  └── 返回 JWT + user profile
```

### JWT 管理

**文件**: `server/src/lib/jwtManager.ts`

```typescript
// 签发
sign(payload: { userId, email, role, active_role })
// → expiresIn 由环境变量配置

// 验证
verify(token) → decoded payload

// 启动校验
validateJWTConfig() // 检查 JWT_SECRET 长度/复杂度
```

**Rotation 支持**：通过 `JWT_ROTATION_ENABLED` + `JWT_ROTATION_INTERVAL` 环境变量控制，签发用新 secret，验证同时接受新旧两个 secret。

### 前端 Token 管理

**文件**: `src/lib/api.ts`

```typescript
class ApiClient {
  setToken(token)      // → localStorage.setItem('token', token)
  getToken()           // → localStorage.getItem('token')
  clearToken()         // → localStorage.removeItem('token')

  // 每次请求自动附加
  headers: { Authorization: `Bearer ${token}` }
}
```

---

## OAuth 登录

### Google OAuth

**文件**: `server/src/middleware/passport.ts`

```
GET /api/auth/google
  → Google 授权页面
  → 用户同意
  → GET /api/auth/callback/google
    ├── Passport 验证 code → 获取 profile
    ├── 查找 users 表 (google_id)
    ├── 存在 → 登录
    ├── 不存在 → 创建新用户（google_id, email, name, avatar）
    └── 签发 JWT → redirect 到前端 /auth/callback?token=xxx
```

### Google One Tap（零点击登录）

**前端**: `src/components/GoogleOneTap.tsx`
**后端**: `POST /api/auth/google/one-tap`

```
页面加载 → Google SDK 弹出 One Tap 窗口
  → 用户点击确认
  → 返回 credential (JWT)
  → POST /api/auth/google/one-tap { credential }
    ├── 后端 google-auth-library 验证 credential
    ├── 提取 email, name, picture, sub(google_id)
    ├── 查找/创建用户
    └── 返回 JWT
```

**牛B之处**：Google One Tap 是在页面加载时自动弹出的，用户只需要点一下确认就完成注册+登录。相比传统 "点击 Google 登录按钮 → 跳转授权页 → 同意 → 回调" 的四步流程，One Tap 只需要一步。

### Facebook OAuth

与 Google OAuth 流程相同，使用 `passport-facebook` 策略。

---

## 角色系统

### 三种角色

| 角色 | 说明 | 认证方式 |
|------|------|----------|
| `homeowner` | 业主，浏览+提交 inquiry | users 表 JWT |
| `company` | 公司，管理 profile + 项目 | users 表 JWT |
| `admin` | 管理员 | admin_users 表独立 JWT |

### 双角色字段

```sql
-- users 表
role          VARCHAR(20)  -- 能力（permanent）：homeowner / company
active_role   VARCHAR(20)  -- 视图模式（switchable）：homeowner / company
```

- `role` = 用户**有资格**扮演的角色
- `active_role` = 用户**当前正在使用**的角色
- 切换角色只改 `active_role`，不改 `role`

### 角色切换

```
POST /api/auth/switch-role { role: 'company' }
  ├── 校验用户确实拥有该 role
  ├── UPDATE active_role
  └── 返回更新后的 user profile
```

前端 Navbar 根据 `active_role` 决定导航到 `/company` 还是 `/dashboard`。

---

## Admin 认证

### 完全隔离

Admin 使用独立的认证体系：

| 项目 | User Auth | Admin Auth |
|------|-----------|------------|
| 表 | `users` | `admin_users` |
| Token 键 | `token` | `admin_token` |
| 中间件 | `authenticate` | `authenticateAdmin` |
| Context | (无) | `AdminContext` |
| 密码哈希 | bcrypt | bcrypt |

### Admin 权限

```sql
-- admin_users 表
permissions  JSON  -- 例: ["can_approve","can_delete","can_manage_roles"]
```

```typescript
// AdminContext 提供
const { admin, hasPermission, isSuperAdmin } = useAdmin();

// 路由级权限检查
router.put('/projects/:id/approve', requirePermission('can_approve'), handler);
```

### 首次安装

```
GET /api/admin/check-installation → 检查是否有 admin 账号
POST /api/admin/install → 创建首个超级管理员（仅当无 admin 时）
```

---

## Session 管理

Session 仅用于 OAuth redirect 往返，不用于 API 认证：

```typescript
app.use(session({
  secret: jwtSecret,     // 复用 JWT secret
  maxAge: 10 * 60_000,   // 10 分钟过期
  resave: false,
  saveUninitialized: false,
}));
```

---

## 账号锁定机制

**文件**: `server/src/middleware/authRateLimit.ts`

```
登录失败跟踪:
  ├── Map<email, { count, resetTime }> 记录失败次数
  ├── 5 次失败 / 15 分钟 → 账号锁定
  ├── 锁定期: 15 分钟
  ├── 锁定期间返回 423 (Locked)
  ├── 成功登录 → 清除失败计数
  └── 每小时清理过期锁定记录
```

| 中间件 | 功能 |
|--------|------|
| `authRateLimit` | express-rate-limit: 10 req/15min |
| `checkAccountLock` | 检查账号是否被锁定 → 423 |
| `recordAuthFailure` | 失败 → 计数+1 |
| `recordAuthSuccess` | 成功 → 清零 |

---

## 安全要点

| 措施 | 细节 |
|------|------|
| 密码哈希 | bcrypt 10 轮 salt |
| JWT Secret 校验 | 启动时 `validateJWTConfig()` 检查最低复杂度 |
| OAuth Callback | 服务端验证，不信任客户端 token |
| Session 极短 | 10 分钟 TTL，仅撑过 OAuth redirect |
| 密码重置 | 一次性 token，有过期时间 |
| Admin 登录限流 | 5 次/15 分钟/IP |
