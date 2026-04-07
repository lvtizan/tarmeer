# OAuth 登录功能设计文档

**日期**: 2025-03-28
**作者**: Claude
**状态**: 待审核

## 概述

为 Tarmeer 平台添加完整的 Google 和 Facebook OAuth 登录功能。用户可以通过第三方账号快速注册/登录，系统自动关联已有账号并下载用户头像。

## 功能需求

### 核心功能
1. 支持 Google OAuth 2.0 登录
2. 支持 Facebook OAuth 2.0 登录
3. 自动关联已有账号（通过邮箱匹配）
4. 下载并存储 OAuth 提供的头像
5. 发送验证邮件（即使通过 OAuth 登录）
6. 完整的错误处理

### 用户流程
```
用户点击"Continue with Google/Facebook"
    ↓
重定向到 OAuth 提供商授权页面
    ↓
用户授权后，提供商回调到 /api/auth/callback/{provider}
    ↓
后端获取用户资料（邮箱、姓名、头像）
    ↓
检查邮箱是否已存在
    ├─ 存在 → 关联 OAuth ID，登录
    └─ 不存在 → 创建新账号，发送验证邮件
    ↓
下载头像到本地存储
    ↓
返回 JWT token，重定向到前端
```

## 技术方案

### 技术选型
使用 **Passport.js** 作为 OAuth 中间件：
- 行业标准，久经考验
- 丰富的策略库（500+）
- 完善的文档和社区支持
- 自动处理 CSRF、state token 等安全问题

### 依赖包
```json
{
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "passport-facebook": "^3.0.0",
  "axios": "^1.6.0"
}
```

## 数据库设计

### 新增字段
在 `designers` 表添加以下字段：

```sql
-- OAuth 提供商 ID
ALTER TABLE designers ADD COLUMN google_id VARCHAR(255) NULL UNIQUE;
ALTER TABLE designers ADD COLUMN facebook_id VARCHAR(255) NULL UNIQUE;

-- 头像 URL
ALTER TABLE designers ADD COLUMN avatar_url VARCHAR(500) NULL;

-- OAuth 提供商标识
ALTER TABLE designers ADD COLUMN oauth_provider ENUM('google', 'facebook', NULL) NULL;

-- 索引优化
CREATE INDEX idx_oauth_google ON designers(google_id);
CREATE INDEX idx_oauth_facebook ON designers(facebook_id);
```

## API 设计

### 路由

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/auth/google` | GET | 发起 Google OAuth 登录 |
| `/api/auth/facebook` | GET | 发起 Facebook OAuth 登录 |
| `/api/auth/callback/google` | GET | Google OAuth 回调 |
| `/api/auth/callback/facebook` | GET | Facebook OAuth 回调 |

### 环境变量

```bash
# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALLBACK_URL=https://tarmeer.com/api/auth/callback/google

# Facebook OAuth
FACEBOOK_APP_ID=xxx
FACEBOOK_APP_SECRET=xxx
FACEBOOK_CALLBACK_URL=https://tarmeer.com/api/auth/callback/facebook
```

## 文件结构

```
server/src/
├── config/
│   └── oauth.ts              # OAuth 配置
├── middleware/
│   └── passport.ts           # Passport 初始化和策略配置
├── controllers/
│   └── authController.ts     # 添加 OAuth 回调处理函数
├── lib/
│   └── oauthHandler.ts       # OAuth 业务逻辑（账号关联、头像下载）
├── routes/
│   └── auth.ts               # 添加 OAuth 路由
└── services/
    └── storageService.ts     # 文件存储服务（头像下载）

server/migrations/
└── add_oauth_columns.sql     # 数据库迁移脚本
```

## 实现细节

### Passport 配置 (middleware/passport.ts)

```typescript
// Google OAuth 2.0 策略
passport.use(new GoogleStrategy({
  clientID: config.oauth.google.clientId,
  clientSecret: config.oauth.google.clientSecret,
  callbackURL: config.oauth.google.callbackURL,
}, verifyOAuthCallback));

// Facebook OAuth 策略
passport.use(new FacebookStrategy({
  clientID: config.oauth.facebook.appId,
  clientSecret: config.oauth.facebook.appSecret,
  callbackURL: config.oauth.facebook.callbackURL,
  profileFields: ['id', 'displayName', 'email', 'photos'],
}, verifyOAuthCallback));
```

### OAuth 回调处理

1. **获取用户资料**：从 Passport 获取 profile
2. **检查邮箱**：查询数据库是否存在该邮箱
3. **关联/创建账号**：
   - 存在 → 更新 OAuth ID，登录
   - 不存在 → 创建新账号，发送验证邮件
4. **下载头像**：从 provider URL 下载到本地
5. **生成 JWT**：返回 token 给前端

### 头像存储

头像存储路径：`/uploads/avatars/{designer_id}.jpg`

```typescript
async function downloadAvatar(url: string, designerId: number): Promise<string | null> {
  // 1. 下载图片
  // 2. 调整大小（最大 300x300）
  // 3. 保存为 JPG
  // 4. 返回存储路径
}
```

### 错误处理

| 错误场景 | 处理方式 |
|----------|----------|
| 用户取消授权 | 重定向到登录页，显示提示信息 |
| 邮箱已被其他账号占用 | 提示用户使用邮箱登录或关联 |
| OAuth 令牌无效 | 重定向到登录页，显示错误信息 |
| 头像下载失败 | 继续登录流程，使用默认头像 |

## 前端集成

前端已有按钮，无需修改。回调后前端需要处理 URL 参数：

```typescript
// 从回调 URL 解析结果
const params = new URLSearchParams(window.location.search);
const token = params.get('token');
const error = params.get('error');

if (token) {
  api.setToken(token);
  navigate('/designer/dashboard');
} else if (error) {
  showError(decodeURIComponent(error));
}
```

## 部署清单

### 开发环境
1. 配置本地 OAuth 应用（localhost 回调）
2. 设置环境变量
3. 运行数据库迁移

### 生产环境
1. 在 Google Cloud Console 创建 OAuth 应用
2. 在 Facebook Developers 创建应用
3. 配置生产环境回调 URL
4. 更新服务器环境变量
5. 运行数据库迁移

## 测试计划

| 测试项 | 描述 |
|--------|------|
| Google 新用户注册 | 验证新用户创建、验证邮件发送 |
| Facebook 新用户注册 | 验证新用户创建、验证邮件发送 |
| 已有邮箱登录 | 验证账号自动关联 |
| 头像下载 | 验证头像正确下载和存储 |
| 取消授权 | 验证用户取消时的错误处理 |
| 无效令牌 | 验证令牌失效时的处理 |

## 安全考虑

1. **CSRF 保护**：Passport 自动处理 state 参数
2. **HTTPS 强制**：生产环境仅允许 HTTPS 回调
3. **令牌有效期**：JWT 7天有效期
4. **邮箱验证**：OAuth 用户仍需验证邮箱
5. **速率限制**：OAuth 发起受现有速率限制保护

## 后续扩展

可轻松添加更多 OAuth 提供商：
- LinkedIn
- Apple Sign In
- Twitter/X
- Microsoft
