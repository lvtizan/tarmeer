# OAuth 登录功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 实现 Google 和 Facebook OAuth 2.0 登录，支持自动关联已有账号和头像下载存储

**架构:** 使用 Passport.js 作为 OAuth 中间件，后端处理 OAuth 回调后关联账号、下载头像、生成 JWT token

**技术栈:** Passport.js, passport-google-oauth20, passport-facebook, axios, MySQL, JWT

---

## 文件结构

```
server/
├── src/
│   ├── config/
│   │   └── oauth.ts              # OAuth 配置（环境变量读取）
│   ├── middleware/
│   │   └── passport.ts           # Passport 初始化和策略配置
│   ├── lib/
│   │   └── oauthHandler.ts       # OAuth 业务逻辑（账号关联、头像下载）
│   ├── controllers/
│   │   └── authController.ts     # 添加 OAuth 回调处理
│   ├── routes/
│   │   └── auth.ts               # 添加 OAuth 路由
│   └── config/index.ts           # 添加 OAuth 配置
├── migrations/
│   └── add_oauth_columns.sql     # 数据库迁移脚本
└── package.json                  # 添加依赖

docs/
└── superpowers/specs/
    └── 2025-03-28-oauth-design.md # 设计文档（已存在）
```

---

## Task 1: 数据库迁移 - 添加 OAuth 字段

**Files:**
- Create: `server/migrations/add_oauth_columns.sql`

- [ ] **Step 1: 创建数据库迁移文件**

```sql
-- OAuth 登录功能 - 添加字段
-- 执行日期: 2025-03-28

-- OAuth 提供商 ID
ALTER TABLE designers ADD COLUMN google_id VARCHAR(255) NULL UNIQUE;
ALTER TABLE designers ADD COLUMN facebook_id VARCHAR(255) NULL UNIQUE;

-- 头像 URL（本地存储路径）
ALTER TABLE designers ADD COLUMN avatar_url VARCHAR(500) NULL;

-- OAuth 提供商标识
ALTER TABLE designers ADD COLUMN oauth_provider ENUM('google', 'facebook', NULL) NULL;

-- 索引优化
CREATE INDEX idx_oauth_google ON designers(google_id);
CREATE INDEX idx_oauth_facebook ON designers(facebook_id);
```

- [ ] **Step 2: 执行迁移**

```bash
# 连接到数据库执行迁移
mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < server/migrations/add_oauth_columns.sql
```

Expected: "Query OK" for each ALTER TABLE statement

- [ ] **Step 3: 验证字段已添加**

```sql
DESCRIBE designers;
```

Expected: 看到 `google_id`, `facebook_id`, `avatar_url`, `oauth_provider` 字段

- [ ] **Step 4: 提交迁移文件**

```bash
git add server/migrations/add_oauth_columns.sql
git commit -m "feat(db): add OAuth fields to designers table

- Add google_id, facebook_id for OAuth provider IDs
- Add avatar_url for profile picture storage
- Add oauth_provider enum field
- Add indexes for OAuth lookups"
```

---

## Task 2: 添加 npm 依赖

**Files:**
- Modify: `server/package.json`

- [ ] **Step 1: 安装 Passport 和 OAuth 策略**

```bash
cd server
npm install passport passport-google-oauth20 passport-facebook axios
npm install --save-dev @types/passport @types/passport-google-oauth20 @types/passport-facebook
```

Expected: 安装成功，package.json 更新

- [ ] **Step 2: 验证 package.json 更新**

检查 `server/package.json` 包含以下依赖：
```json
{
  "dependencies": {
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "passport-facebook": "^3.0.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/passport": "^1.0.0",
    "@types/passport-google-oauth20": "^2.0.0",
    "@types/passport-facebook": "^3.0.0"
  }
}
```

- [ ] **Step 3: 提交依赖更新**

```bash
git add server/package.json server/package-lock.json
git commit -m "feat(oauth): add Passport.js and OAuth strategy dependencies

- Install passport core
- Install Google OAuth 2.0 strategy
- Install Facebook strategy
- Install axios for avatar downloads
- Add TypeScript type definitions"
```

---

## Task 3: 创建 OAuth 配置

**Files:**
- Create: `server/src/config/oauth.ts`
- Modify: `server/src/config/index.ts`
- Modify: `server/.env.example`

- [ ] **Step 1: 创建 OAuth 配置文件**

```typescript
// server/src/config/oauth.ts
import dotenv from 'dotenv';

dotenv.config();

export const oauthConfig = {
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: process.env.GOOGLE_CALLBACK_URL ||
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/auth/callback/google`,
  },
  facebook: {
    appId: process.env.FACEBOOK_APP_ID || '',
    appSecret: process.env.FACEBOOK_APP_SECRET || '',
    callbackURL: process.env.FACEBOOK_CALLBACK_URL ||
      `${process.env.FRONTEND_URL || 'http://localhost:5173'}/api/auth/callback/facebook`,
    profileFields: ['id', 'displayName', 'emails', 'photos'],
  },
};

export default oauthConfig;
```

- [ ] **Step 2: 更新主配置文件导出**

在 `server/src/config/index.ts` 末尾添加：

```typescript
// OAuth 配置
import { oauthConfig } from './oauth';

export const config = {
  // ... 现有配置 ...
  oauth: oauthConfig,
};

export default config;
```

- [ ] **Step 3: 更新 .env.example 添加 OAuth 环境变量**

在 `server/.env.example` 末尾添加：

```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5173/api/auth/callback/google

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=http://localhost:5173/api/auth/callback/facebook
```

- [ ] **Step 4: 提交配置**

```bash
git add server/src/config/oauth.ts server/src/config/index.ts server/.env.example
git commit -m "feat(oauth): add OAuth configuration

- Add OAuth config module for Google and Facebook
- Export oauth config from main config
- Add environment variables to .env.example"
```

---

## Task 4: 创建 OAuth 处理器（业务逻辑）

**Files:**
- Create: `server/src/lib/oauthHandler.ts`

- [ ] **Step 1: 创建 OAuth 处理器**

```typescript
// server/src/lib/oauthHandler.ts
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import pool from '../config/database';
import { generateVerificationToken } from '../services/emailService';

interface OAuthProfile {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string;
  provider: 'google' | 'facebook';
}

interface DesignerResult {
  id: number;
  email: string;
  email_verified: boolean;
  full_name: string;
  avatar_url?: string;
}

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars');

// 确保上传目录存在
async function ensureUploadDir() {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create upload directory:', error);
  }
}

// 下载并保存头像
export async function downloadAvatar(
  url: string,
  designerId: number
): Promise<string | null> {
  try {
    await ensureUploadDir();

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });

    const ext = url.includes('.png') ? '.png' : '.jpg';
    const filename = `${designerId}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    await fs.writeFile(filepath, response.data);

    return `/uploads/avatars/${filename}`;
  } catch (error) {
    console.error('Failed to download avatar:', error);
    return null;
  }
}

// 通过 OAuth ID 查找用户
export async function findDesignerByOAuthId(
  provider: 'google' | 'facebook',
  oauthId: string
): Promise<DesignerResult | null> {
  const field = provider === 'google' ? 'google_id' : 'facebook_id';

  const [rows] = await pool.execute(
    `SELECT id, email, email_verified, full_name, avatar_url
     FROM designers WHERE ${field} = ? AND deleted_at IS NULL`,
    [oauthId]
  );

  const designers = rows as DesignerResult[];
  return designers.length > 0 ? designers[0] : null;
}

// 通过邮箱查找用户
export async function findDesignerByEmail(
  email: string
): Promise<DesignerResult | null> {
  const [rows] = await pool.execute(
    `SELECT id, email, email_verified, full_name, avatar_url
     FROM designers WHERE email = ? AND deleted_at IS NULL`,
    [email]
  );

  const designers = rows as DesignerResult[];
  return designers.length > 0 ? designers[0] : null;
}

// 关联 OAuth ID 到已有账号
export async function linkOAuthToDesigner(
  designerId: number,
  provider: 'google' | 'facebook',
  oauthId: string
): Promise<void> {
  const field = provider === 'google' ? 'google_id' : 'facebook_id';

  await pool.execute(
    `UPDATE designers SET ${field} = ?, oauth_provider = ? WHERE id = ?`,
    [oauthId, provider, designerId]
  );
}

// 创建新的 OAuth 用户
export async function createOAuthDesigner(
  profile: OAuthProfile
): Promise<{ designer: DesignerResult; isNew: boolean; needsVerification: boolean }> {
  const { email, displayName, photoUrl, provider, id: oauthId } = profile;

  // 检查邮箱是否已存在
  const existing = await findDesignerByEmail(email);

  if (existing) {
    // 关联 OAuth ID
    await linkOAuthToDesigner(existing.id, provider, oauthId);

    // 下载头像
    if (photoUrl) {
      const avatarUrl = await downloadAvatar(photoUrl, existing.id);
      if (avatarUrl) {
        await pool.execute(
          'UPDATE designers SET avatar_url = ? WHERE id = ?',
          [avatarUrl, existing.id]
        );
        existing.avatar_url = avatarUrl;
      }
    }

    return {
      designer: existing,
      isNew: false,
      needsVerification: !existing.email_verified,
    };
  }

  // 创建新用户
  const field = provider === 'google' ? 'google_id' : 'facebook_id';
  const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();

  // 下载头像
  let avatarUrl: string | null = null;
  if (photoUrl) {
    avatarUrl = await downloadAvatar(photoUrl, 0); // 临时用 0，后面会替换
  }

  const [result] = await pool.execute(
    `INSERT INTO designers
     (email, full_name, ${field}, oauth_provider, avatar_url, verification_token, verification_expires, status, is_approved, city)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      email,
      displayName,
      oauthId,
      provider,
      avatarUrl,
      verificationToken,
      verificationExpires,
      'pending',
      0,
      'Dubai',
    ]
  );

  const designerId = (result as any).insertId;

  // 如果下载了头像，更新文件名
  if (avatarUrl) {
    const oldPath = path.join(UPLOAD_DIR, `0${photoUrl?.includes('.png') ? '.png' : '.jpg'}`);
    const newPath = path.join(UPLOAD_DIR, `${designerId}${photoUrl?.includes('.png') ? '.png' : '.jpg'}`);
    try {
      await fs.rename(oldPath, newPath);
      const finalAvatarUrl = `/uploads/avatars/${designerId}${photoUrl?.includes('.png') ? '.png' : '.jpg'}`;
      await pool.execute(
        'UPDATE designers SET avatar_url = ? WHERE id = ?',
        [finalAvatarUrl, designerId]
      );
      avatarUrl = finalAvatarUrl;
    } catch (error) {
      console.error('Failed to rename avatar file:', error);
    }
  }

  const [designer] = await pool.execute(
    'SELECT id, email, email_verified, full_name, avatar_url FROM designers WHERE id = ?',
    [designerId]
  );

  return {
    designer: (designer as DesignerResult[])[0],
    isNew: true,
    needsVerification: true,
  };
}
```

- [ ] **Step 2: 提交处理器**

```bash
git add server/src/lib/oauthHandler.ts
git commit -m "feat(oauth): add OAuth handler module

- Add downloadAvatar for profile picture storage
- Add findDesignerByOAuthId for OAuth user lookup
- Add findDesignerByEmail for email-based account linking
- Add linkOAuthToDesigner for connecting OAuth to existing accounts
- Add createOAuthDesigner for new OAuth user creation
- Auto-link accounts by email
- Download and store profile pictures locally"
```

---

## Task 5: 创建 Passport 中间件

**Files:**
- Create: `server/src/middleware/passport.ts`

- [ ] **Step 1: 创建 Passport 配置**

```typescript
// server/src/middleware/passport.ts
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import jwt from 'jsonwebtoken';
import config from '../config';
import {
  createOAuthDesigner,
  findDesignerByOAuthId,
} from '../lib/oauthHandler';

// 扩展 Passport 类型
declare global {
  namespace Express {
    interface User {
      id: number;
      email: string;
    }
  }
}

// OAuth 验证回调
async function verifyOAuthCallback(
  accessToken: string,
  refreshToken: string,
  profile: any,
  done: any
) {
  try {
    const provider = profile.provider as 'google' | 'facebook';
    const oauthId = profile.id;

    // 查找是否已有此 OAuth 账号
    const existingDesigner = await findDesignerByOAuthId(provider, oauthId);

    if (existingDesigner) {
      return done(null, existingDesigner);
    }

    // 提取用户信息
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error('No email provided by OAuth provider'), null);
    }

    const photoUrl = profile.photos?.[0]?.value;
    const displayName = profile.displayName || email.split('@')[0];

    // 创建或关联账号
    const result = await createOAuthDesigner({
      id: oauthId,
      email,
      displayName,
      photoUrl,
      provider,
    });

    return done(null, result.designer);
  } catch (error) {
    console.error('OAuth verification error:', error);
    return done(error, null);
  }
}

// 配置 Google 策略
passport.use(
  new GoogleStrategy(
    {
      clientID: config.oauth.google.clientId,
      clientSecret: config.oauth.google.clientSecret,
      callbackURL: config.oauth.google.callbackURL,
    },
    verifyOAuthCallback
  )
);

// 配置 Facebook 策略
passport.use(
  new FacebookStrategy(
    {
      clientID: config.oauth.facebook.appId,
      clientSecret: config.oauth.facebook.appSecret,
      callbackURL: config.oauth.facebook.callbackURL,
      profileFields: ['id', 'displayName', 'emails', 'photos'],
    },
    verifyOAuthCallback
  )
);

// 序列化用户（存储到 session）
passport.serializeUser((user: any, done) => {
  done(null, { id: user.id, email: user.email });
});

// 反序列化用户（从 session 读取）
passport.deserializeUser((user: any, done) => {
  done(null, user);
});

export default passport;
```

- [ ] **Step 2: 提交 Passport 配置**

```bash
git add server/src/middleware/passport.ts
git add server/src/middleware/passport.ts
git commit -m "feat(oauth): add Passport.js middleware

- Configure Google OAuth 2.0 strategy
- Configure Facebook OAuth strategy
- Implement verifyOAuthCallback with account linking
- Add serialize/deserialize user functions"
```

---

## Task 6: 更新认证控制器 - 添加 OAuth 回调处理

**Files:**
- Modify: `server/src/controllers/authController.ts`

- [ ] **Step 1: 在 authController.ts 末尾添加 OAuth 回调函数**

在 `server/src/controllers/authController.ts` 文件末尾（`resetPassword` 函数之后）添加：

```typescript
// OAuth 回调处理
export async function oauthCallback(req: any, res: any) {
  try {
    const user = req.user as any;

    if (!user) {
      return res.redirect('/auth?error=oauth_failed');
    }

    // 检查邮箱是否已验证
    if (!user.email_verified) {
      return res.redirect('/auth?error=verify_email');
    }

    // 生成 JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    // 重定向到前端，携带 token
    const frontendUrl = config.frontendUrl || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&provider=oauth`);
  } catch (error) {
    console.error('OAuth callback error:', error);
    const frontendUrl = config.frontendUrl || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth?error=oauth_error`);
  }
}

// OAuth 发起（辅助函数，实际由 Passport 中间件处理）
export async function initiateOAuth(req: any, res: any, next: any) {
  passport.authenticate(req.params.provider)(req, res, next);
}
```

- [ ] **Step 2: 提交控制器更新**

```bash
git add server/src/controllers/authController.ts
git commit -m "feat(oauth): add OAuth callback handler

- Add oauthCallback for processing OAuth provider responses
- Generate JWT token after successful OAuth
- Redirect to frontend with token
- Handle email verification requirement"
```

---

## Task 7: 更新认证路由 - 添加 OAuth 端点

**Files:**
- Modify: `server/src/routes/auth.ts`

- [ ] **Step 1: 在 auth.ts 中添加 OAuth 路由**

在 `server/src/routes/auth.ts` 中：

1. 添加导入：
```typescript
import passport from '../middleware/passport';
import { oauthCallback } from '../controllers/authController';
```

2. 在 `export default router;` 之前添加路由：

```typescript
// Google OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/callback/google',
  passport.authenticate('google', { failureRedirect: '/auth?error=google_failed' }),
  oauthCallback
);

// Facebook OAuth
router.get('/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get('/callback/facebook',
  passport.authenticate('facebook', { failureRedirect: '/auth?error=facebook_failed' }),
  oauthCallback
);
```

- [ ] **Step 2: 提交路由更新**

```bash
git add server/src/routes/auth.ts
git commit -m "feat(oauth): add OAuth routes

- Add GET /api/auth/google for Google OAuth initiation
- Add GET /api/auth/callback/google for Google OAuth callback
- Add GET /api/auth/facebook for Facebook OAuth initiation
- Add GET /api/auth/callback/facebook for Facebook OAuth callback
- Integrate Passport authentication middleware"
```

---

## Task 8: 更新主应用 - 初始化 Passport

**Files:**
- Modify: `server/src/app.ts`

- [ ] **Step 1: 在 app.ts 中添加 Passport 初始化**

在 `server/src/app.ts` 中：

1. 在顶部导入后添加：
```typescript
import passport from './middleware/passport';
```

2. 在 `app.use(cors(corsConfig));` 之后添加：
```typescript
// Passport 初始化
app.use(passport.initialize());
app.use(passport.session());
```

- [ ] **Step 2: 提交应用更新**

```bash
git add server/src/app.ts
git commit -m "feat(oauth): initialize Passport in Express app

- Add passport.initialize() middleware
- Add passport.session() middleware for session support"
```

---

## Task 9: 前端回调处理

**Files:**
- Create: `src/pages/AuthCallbackPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: 创建 OAuth 回调页面**

```typescript
// src/pages/AuthCallbackPage.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      // 存储 token
      api.setToken(token);

      // 获取用户信息
      fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          if (data.designer) {
            localStorage.setItem('designer', JSON.stringify(data.designer));
          }
          navigate('/designer/dashboard');
        })
        .catch(() => {
          navigate('/designer/dashboard');
        });
    } else if (error) {
      // 错误处理
      navigate(`/auth?error=${encodeURIComponent(error)}`);
    } else {
      navigate('/auth');
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#FAFAF9] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#B8864A] border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-stone-600">Completing sign in...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 在 App.tsx 中添加回调路由**

在 `src/App.tsx` 的路由配置中添加：

```typescript
import AuthCallbackPage from './pages/AuthCallbackPage';

// 在路由中添加
<Route path="/auth/callback" element={<AuthCallbackPage />} />
```

- [ ] **Step 3: 提交前端回调处理**

```bash
git add src/pages/AuthCallbackPage.tsx src/App.tsx
git commit -m "feat(oauth): add OAuth callback page

- Add AuthCallbackPage for handling OAuth redirects
- Extract token from URL params
- Store token and fetch user data
- Redirect to dashboard or show error"
```

---

## Task 10: 更新 AuthPage 错误处理

**Files:**
- Modify: `src/pages/AuthPage.tsx`

- [ ] **Step 1: 添加 OAuth 错误处理**

在 `src/pages/AuthPage.tsx` 的 `AuthPage` 组件中，找到 `useState` 部分，添加：

```typescript
const [searchParams] = useSearchParams();

useEffect(() => {
  const error = searchParams.get('error');
  if (error) {
    setError(decodeURIComponent(error));
  }
}, [searchParams]);
```

同时确保导入了 `useSearchParams`：
```typescript
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
```

- [ ] **Step 2: 提交错误处理更新**

```bash
git add src/pages/AuthPage.tsx
git commit -m "feat(oauth): add OAuth error handling to AuthPage

- Display OAuth errors from URL params
- Decode error messages for display"
```

---

## Task 11: 创建测试脚本

**Files:**
- Create: `server/migrations/test-oauth.sql`

- [ ] **Step 1: 创建 OAuth 测试 SQL**

```sql
-- OAuth 功能测试
-- 验证字段是否正确添加

SELECT
  COLUMN_NAME,
  DATA_TYPE,
  IS_NULLABLE,
  COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'designers'
  AND COLUMN_NAME IN ('google_id', 'facebook_id', 'avatar_url', 'oauth_provider')
ORDER BY COLUMN_NAME;
```

- [ ] **Step 2: 运行测试验证**

```bash
mysql -h $DB_HOST -u $DB_USER -p $DB_NAME < server/migrations/test-oauth.sql
```

Expected: 显示 4 行字段信息

- [ ] **Step 3: 提交测试脚本**

```bash
git add server/migrations/test-oauth.sql
git commit -m "test(oauth): add OAuth field verification script

- Add SQL test to verify OAuth columns are created
- Check column types and constraints"
```

---

## Task 12: 文档更新

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `memory/docs/REQUIREMENTS.md`

- [ ] **Step 1: 更新 CHANGELOG.md**

将 CHANGELOG.md 中的 OAuth 条目状态从"设计完成，实现中"改为"已完成"：

```markdown
## [已发布] - 2025-03-28

### 新增功能
- **OAuth 登录** - Google 和 Facebook 第三方登录
  - Passport.js 集成
  - 自动关联已有账号
  - 头像下载存储
  - 完整的回调处理和错误处理
```

- [ ] **Step 2: 提交文档更新**

```bash
git add CHANGELOG.md memory/docs/REQUIREMENTS.md
git commit -m "docs(oauth): update documentation for OAuth release

- Mark OAuth feature as complete in CHANGELOG
- Update requirements with OAuth login details"
```

---

## Task 13: 配置环境变量（生产环境）

**Files:**
- Modify: `server/.env`

- [ ] **Step 1: 配置 Google OAuth**

1. 访问 [Google Cloud Console](https://console.cloud.google.com)
2. 创建 OAuth 2.0 凭证
3. 添加授权重定向 URI：`https://yourdomain.com/api/auth/callback/google`
4. 复制 Client ID 和 Client Secret 到 `.env`：

```bash
GOOGLE_CLIENT_ID=your-actual-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-google-client-secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/callback/google
```

- [ ] **Step 2: 配置 Facebook OAuth**

1. 访问 [Facebook Developers](https://developers.facebook.com)
2. 创建应用并添加 Facebook 登录产品
3. 添加重定向 URL：`https://yourdomain.com/api/auth/callback/facebook`
4. 复制 App ID 和 App Secret 到 `.env`：

```bash
FACEBOOK_APP_ID=your-actual-facebook-app-id
FACEBOOK_APP_SECRET=your-actual-facebook-app-secret
FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/auth/callback/facebook
```

**注意**: `.env` 文件包含敏感信息，不要提交到 git

- [ ] **Step 3: 重启服务**

```bash
cd server
pm2 restart tarmeer-api
# 或
npm run build && npm start
```

---

## 验证清单

完成所有任务后，验证以下功能：

- [ ] 点击 "Continue with Google" 按钮跳转到 Google 授权页面
- [ ] Google 授权后正确回调并登录
- [ ] 点击 "Continue with Facebook" 按钮跳转到 Facebook 授权页面
- [ ] Facebook 授权后正确回调并登录
- [ ] OAuth 登录的用户头像已下载到 `public/uploads/avatars/`
- [ ] 数据库 `designers` 表中 `google_id` 或 `facebook_id` 字段已填充
- [ ] 已有邮箱用户通过 OAuth 登录会自动关联账号
- [ ] 错误处理正确显示（用户取消授权、无效令牌等）
- [ ] JWT token 正确生成并存储
- [ ] 登录后正确跳转到 Designer Dashboard

---

## 故障排查

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| 回调 URL 不匹配 | 环境变量配置错误 | 检查 `.env` 中的 `CALLBACK_URL` 与 OAuth 提供商配置一致 |
| 头像下载失败 | 网络问题或 URL 无效 | 检查日志，头像失败不影响登录流程 |
| 账号未关联 | 邮箱不匹配 | 确保用户在 OAuth 提供商使用的邮箱与注册邮箱一致 |
| Passport 未初始化 | 中间件未加载 | 检查 `app.ts` 中 `passport.initialize()` 是否正确添加 |
