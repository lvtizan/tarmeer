# 09 — 安全防护体系

## 防御层级

```
请求进入
  │
  ▼
┌────────────┐   ┌────────────┐   ┌────────────┐   ┌────────────┐
│  Nginx     │ → │  Helmet    │ → │  反爬虫    │ → │  限流      │
│  SSL终止   │   │  HTTP安全头 │   │  UA检测    │   │  IP计数    │
│  HTTPS强制 │   │  XSS/MIME  │   │  Bot白名单 │   │  60/min    │
└────────────┘   └────────────┘   └────────────┘   └────────────┘
                                                         │
  ┌────────────┐   ┌────────────┐   ┌────────────┐      ▼
  │  CORS      │ → │  认证      │ → │  输入校验   │ → 业务逻辑
  │  白名单    │   │  JWT       │   │  express-   │
  │  6个源     │   │  Admin JWT │   │  validator  │
  └────────────┘   └────────────┘   └────────────┘
```

---

## 一、反爬虫中间件

**文件**: `server/src/middleware/antiScraping.ts`

### UA 黑名单（13 种）

```typescript
const BLOCKED_UA_PATTERNS = [
  /python-requests/i,  /scrapy/i,       /httpclient/i,
  /java\//i,           /wget/i,         /curl/i,
  /libwww/i,           /lwp-trivial/i,  /php\//i,
  /go-http-client/i,   /node-fetch/i,   /axios/i,
  /undici/i,
];
```

命中任一 → 返回 `403 Access denied`。

### SEO 白名单（13 种）

```typescript
const ALLOWED_BOTS = [
  'googlebot',   'bingbot',     'slurp',
  'duckduckbot', 'baiduspider', 'yandexbot',
  'facebot',     'twitterbot',  'linkedinbot',
  'whatsapp',    'telegrambot', 'applebot',
  'discordbot',
];
```

白名单 Bot 直接放行，不受限流影响。

### 无 UA 封杀

```typescript
if (!ua) {
  return res.status(403).json({ error: 'Access denied.' });
}
```

---

## 二、API 限流

### 公共 API 限流

```
规则: 60 请求/分钟/IP
超出: 封禁 5 分钟
实现: 内存 Map（无需 Redis）
清理: 每 10 分钟清理过期 IP 记录
```

```typescript
// antiScraping.ts
const WINDOW_MS = 60_000;                    // 1 分钟窗口
const MAX_API_REQUESTS_PER_MINUTE = 60;      // 上限
const BLOCK_DURATION_MS = 5 * 60_000;        // 超限后封 5 分钟
```

### 豁免路径

**文件**: `server/src/lib/rateLimitPolicy.ts`

以下路径不受全局限流影响：

| 类别 | 路径 |
|------|------|
| 健康检查 | `/health` |
| 认证 | `/auth/me`, `/auth/select-role`, `/auth/switch-role` |
| OAuth | `/auth/google`, `/auth/callback/google`, `/auth/google/one-tap`, `/auth/facebook`, `/auth/callback/facebook` |
| Admin | 所有 `/admin/*` 路径 |
| 公开只读 | `/companies/*`, `/public/companies/*`, `/designers/*`, `/stats/*`, `/uploads/*` |
| OPTIONS | 所有 CORS 预检请求 |
| 本地开发 | 非 production 环境的 localhost |

### Admin 登录限流

```
规则: 5 次/15 分钟/IP
场景: 仅 Admin 登录端点
```

---

## 三、CORS 策略

**文件**: `server/src/lib/corsOrigins.ts`

### 生产白名单

```
https://www.tarmeer.com
https://tarmeer.com
https://designer.tarmeer.com
https://admin.tarmeer.com
http://47.91.108.104
https://47.91.108.104
```

### 开发白名单

自动包含 localhost 端口：5173, 5174, 5179, 5180, 5181, 4175

### CORS 配置

```typescript
{
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,  // 预检缓存 24 小时
}
```

### CORS 违规日志

非白名单 origin 的请求会触发 `logCorsViolation(origin, path)`，记录到控制台。

---

## 四、HTTP 安全头

**技术**: `helmet` npm 包

自动设置：
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security` (HSTS)
- Content Security Policy 相关头

---

## 五、输入校验

### 手机号防垃圾（双重校验）

| 层 | 规则 | 位置 |
|----|------|------|
| 前端 | GCC 国家码下拉 + 纯数字 + maxDigits | InquiryForm / ServiceInquiryCard / Banner |
| 前端 | 5+ 连续相同数字 → 红色提示 + 禁用提交 | 同上 |
| 后端 | 纯数字 10-15 位 | inquiryController.ts |
| 后端 | 后 9 位含 5+ 连续相同数字 → 400 | inquiryController.ts |

### express-validator

路由级参数校验：

```typescript
router.post('/',
  [
    body('contactName').notEmpty().withMessage('Contact name is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
    body('companyName').notEmpty().withMessage('Company name is required'),
  ],
  handleValidation,
  submitCompanyLead
);
```

### 图片安全

| 措施 | 细节 |
|------|------|
| 请求体限制 | 20 MB (`requestLimits.ts`) |
| 文件上传限制 | 10 MB/文件 (multer) |
| Base64 禁入库 | `validateNoBase64Images()` 拦截 |

---

## 六、认证安全

| 措施 | 细节 |
|------|------|
| 密码哈希 | bcrypt 10 轮 salt |
| JWT Secret | 启动时校验最低复杂度 |
| Session | 仅 OAuth 流程，10 分钟 TTL |
| Admin 隔离 | 独立表 + 独立 JWT + 独立中间件 |
| 密码重置 | 一次性 token + 过期时间 |
| OAuth | 服务端验证，不信任客户端 token |

---

## 七、数据安全

| 措施 | 细节 |
|------|------|
| Soft Delete | users / company_profiles / design_inquiries / projects 支持软删除 |
| 审计日志 | 所有删除操作记录 admin_id + reason + 完整数据快照 |
| 数据恢复 | 软删除的记录可通过 Admin 后台恢复 |
| 敏感数据 | 密码 bcrypt 哈希，JWT secret 环境变量，不入代码 |
