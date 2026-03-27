# 设计师端注册与登录流程走查报告

**项目**: Tarmeer 4.0  
**范围**: 设计师端注册、邮箱验证、登录、忘记/重置密码  
**日期**: 2026-03-13  

---

## 1. 流程梳理

### 1.1 注册 → 验证邮箱 → 登录（主流程）

```
┌─────────────┐     POST /api/auth/register      ┌─────────────┐
│   AuthPage  │ ───────────────────────────────► │ authController│
│  (Register) │   email, password, full_name,     │   register   │
│             │   phone, city                     │              │
└─────────────┘                                   └──────┬──────┘
       ▲                                                  │
       │ 201 + 成功提示                                   │ INSERT designers
       │ 切到 Login Tab                                   │ 生成 verification_token (24h)
       │ 预填 email                                       │ 异步发验证邮件
       │                                                  ▼
       │                                         ┌─────────────────┐
       │                                         │ sendVerification │
       │                                         │ Email(link)     │
       │                                         └────────┬────────┘
       │                                                  │
       │  用户点邮件链接                                    │
       │  /verify-email?token=xxx                          │
       ▼                                                  │
┌─────────────────┐     POST /api/auth/verify-email      │
│ VerifyEmailPage  │ ───────────────────────────────────► │ verifyEmail
│                  │   { token }                          │ 校验 token 与过期时间
└────────┬─────────┘                                      │ 更新 email_verified=1
         │                                                │ 返回 token + designer
         │ 200 + token, designer                           │
         │ setToken + localStorage designer                │
         │ 2s 后 navigate('/designer/dashboard')           │
         ▼                                                │
┌─────────────────┐                                       │
│ DesignerDashboard│ ◄─────────────────────────────────────┘
│ /designer/dashboard
└─────────────────┘
```

### 1.2 登录流程

```
AuthPage (Login Tab)
    │
    │  POST /api/auth/login { email, password }
    ▼
authController.login
    │ 查 designers 表 → 校验 email_verified → bcrypt.compare
    │ 通过则 JWT sign → 返回 { token, designer }
    ▼
前端: api.setToken(response.token)
      localStorage.setItem('designer', JSON.stringify(response.designer))
      navigate('/designer/dashboard')
```

### 1.3 忘记密码 → 重置密码

```
ForgotPasswordPage                    authController.forgotPassword
    │  POST /api/auth/forgot-password       │ 按 email 查设计师
    │  { email }                            │ 生成 reset_token (1h)
    │ ───────────────────────────────────► │ 写 reset_token, reset_expires
    │                                       │ 异步发重置邮件
    │  200 统一文案（不泄露用户是否存在）     │ 返回统一成功文案
    ▼

用户点邮件链接 /reset-password?token=xxx

ResetPasswordPage                     authController.resetPassword
    │  从 URL 取 token                      │ 校验 reset_token 与 reset_expires
    │  POST /api/auth/reset-password         │ 更新 password，清空 reset_*
    │  { token, password }                   │ 签发 JWT，返回 token + designer
    │ ───────────────────────────────────►
    ▼
前端: setToken + localStorage designer → 2s 后跳转 /designer/dashboard
```

### 1.4 路由与入口汇总

| 路径 | 组件 | 说明 |
|------|------|------|
| `/auth` | AuthPage | 登录/注册 Tab，主入口 |
| `/login` | → Navigate to `/auth` | 重定向 |
| `/register` | → Navigate to `/auth` | 重定向 |
| `/verify-email` | VerifyEmailPage | 邮箱验证（需 `?token=xxx`） |
| `/forgot-password` | ForgotPasswordPage | 提交邮箱发重置链接 |
| `/reset-password` | ResetPasswordPage | 新密码表单（需 `?token=xxx`） |
| `/designer/dashboard` | DesignerDashboardPage | 登录后目标页（当前无鉴权守卫） |

---

## 2. 代码审查结论

### 2.1 前后端对接

| 环节 | 前端 | 后端 | 结论 |
|------|------|------|------|
| 注册 | `api.post('/auth/register', { email, password, full_name, phone, city })` | POST /api/auth/register，校验 email/password/full_name | ✅ 一致 |
| 登录 | `api.post('/auth/login', { email, password })`，成功后 setToken + localStorage designer，跳转 /designer/dashboard | 返回 { token, designer } | ✅ 一致 |
| 验证邮箱 | VerifyEmailPage 从 `?token=` 取 token，POST /auth/verify-email { token } | 校验 verification_token 与 verification_expires | ✅ 一致 |
| 重发验证 | AuthPage 未验证时展示「Resend verification email」，POST /auth/resend-verification { email } | 仅对未验证用户重发 | ✅ 一致 |
| 忘记密码 | POST /auth/forgot-password { email }，统一成功提示 | 统一 200 文案，不泄露是否存在 | ✅ 一致 |
| 重置密码 | 从 URL 取 token，POST /auth/reset-password { token, password }，成功后 setToken 并跳转 | 校验 reset_token/过期，更新密码并返回 token | ✅ 一致 |

### 2.2 Token 与状态

- **Token 存储**：`api.setToken(token)` 会写入 `localStorage.setItem('token', token)`，且后续请求通过 `Authorization: Bearer ${token}` 携带。✅
- **设计师信息**：登录/验证/重置成功后写入 `localStorage.setItem('designer', JSON.stringify(response.designer))`，DesignerContext 从 `localStorage.getItem('designer')` 初始化。✅
- **API 基址**：开发用 `VITE_API_URL` 或 `http://localhost:3002/api`，生产用 `window.location.origin + '/api'`。✅

### 2.3 错误处理

- 前端：`api.request` 在 `!response.ok` 时解析 `body.error` 并 `throw new Error(errorMessage)`；各页用 `err.message` 展示。✅
- 网络异常：api 层对 fetch/network 类错误统一为「Network error: registration service is unavailable...」。✅
- 登录未验证：后端返回 401 + `needVerification: true`，前端用 `err.message` 判断是否包含 "verify your email" 以展示「Resend verification email」。⚠️ 依赖字符串匹配，建议改为依赖 `body.needVerification`（若后端统一返回）。

---

## 3. 边界与异常问题

### 3.1 安全问题（建议修复）

| 问题 | 位置 | 说明 |
|------|------|------|
| **登录/验证邮箱响应中暴露 password 哈希** | authController：login 返回 `designer: user`，verifyEmail 返回 `designer: { ...user, ... }` | 整行 `user` 含 `password` 字段，虽为哈希仍不应下发给前端。应与 resetPassword 一致，返回前 `password: undefined` 或删除该字段。 |
| **设计师端登出未清空凭证** | DesignerLayout 登出按钮 | 仅 `navigate('/', { replace: true })`，未调用 `api.clearToken()` 也未 `localStorage.removeItem('designer')`。用户再次访问 /designer/dashboard 仍可能用旧 token 访问。 |

### 3.2 逻辑与体验

| 问题 | 位置 | 说明 |
|------|------|------|
| **/designer/* 无鉴权守卫** | DesignerLayout / App 路由 | 未校验 token 或 designer 是否存在。未登录用户可直接进入 /designer/dashboard，看到空 profile，后续调用受保护 API 才 401。建议在 DesignerLayout 或路由层判断 token，无则重定向到 /auth。 |
| **验证链接过期** | 后端 verifyEmail | 过期返回 400「Verification link is invalid or has expired.」；前端 VerifyEmailPage 展示该文案并有「Back to Login」。✅ 已处理。 |
| **重置链接过期** | 后端 resetPassword | 同上，返回「Reset link is invalid or has expired.」；ResetPasswordPage 展示并在错误时提供「Request a new reset link」跳转 /forgot-password。✅ 已处理。 |
| **重复注册** | 后端 register | 已存在 email 返回 400「Email already registered」，前端展示 err.message。✅ 已处理。 |
| **临时邮箱** | 后端 register | 拒绝部分临时邮箱域名（tempmail.com 等），返回 400。✅ 已处理。 |

### 3.3 配置与数据

| 问题 | 位置 | 说明 |
|------|------|------|
| **designers 表缺少重置字段** | server/schema/designers.sql | 仅 init.sql 含 `reset_token`、`reset_expires`；若只执行 designers.sql，忘记/重置密码会报错。建议在 designers.sql 中补全两字段及 idx_reset。 |
| **邮件未配置时注册仍成功** | authController.register | SMTP 未配置时仅打 log，仍 201。前端提示「请查收邮件」，用户可能收不到。可考虑在响应中区分 emailSent，前端提示「若未收到邮件请检查垃圾箱或联系支持」。 |

### 3.4 其他

- **密码强度**：注册要求至少 6 位且含字母和特殊字符（前端）；后端仅 `isLength({ min: 6 })`，未强制字母/特殊字符。
- **Remember me**：AuthPage 有「Remember me」勾选，但未使用（未延长 token 或写 cookie），可视为占位或后续实现。

---

## 4. 测试建议（可执行用例）

以下用例适合人工或自动化（如 Playwright）执行。

### 4.1 正常流程

1. **注册成功**  
   - 用新邮箱、符合规则的密码、必填项完成注册。  
   - 预期：201，提示查收邮件，切到登录 Tab 且 email 已预填；若 SMTP 开启，收到验证邮件。

2. **验证邮箱后自动登录**  
   - 点击验证邮件中的链接（或开发环境下控制台打印的链接）打开 /verify-email?token=xxx。  
   - 预期：先「Verifying...」，再「Email verified successfully!」，约 2s 后跳转 /designer/dashboard，localStorage 有 token 和 designer。

3. **登录成功**  
   - 已验证邮箱的设计师在 /auth 登录 Tab 输入正确邮箱密码提交。  
   - 预期：跳转 /designer/dashboard，token 与 designer 已写入，仪表盘显示当前设计师信息。

4. **忘记密码 → 重置 → 自动登录**  
   - 在 /forgot-password 输入已注册邮箱，提交；从邮件打开 /reset-password?token=xxx，输入新密码并确认，提交。  
   - 预期：忘记密码页显示统一成功提示；重置成功后提示成功并约 2s 后跳转 /designer/dashboard，且用新密码可登录。

5. **重发验证邮件**  
   - 未验证账号尝试登录，在错误提示下点击「Resend verification email」。  
   - 预期：后端 200，前端成功提示；邮箱收到新验证邮件（若 SMTP 开启）。

### 4.2 异常与边界

6. **未验证邮箱登录**  
   - 用已注册但未验证的邮箱登录。  
   - 预期：401，提示需先验证邮箱，并出现「Resend verification email」。

7. **验证链接过期**  
   - 使用已过期的验证链接（或修改 DB 中 verification_expires 为过去时间后请求 verify-email）。  
   - 预期：400，页面显示「Verification link is invalid or has expired.»，可点「Back to Login」。

8. **重置链接无效/过期**  
   - 访问 /reset-password（无 token 或 token 错误/过期）。  
   - 预期：无 token 时前端提示无效并可选「Request a new reset link」；错误 token 时后端 400，前端展示错误信息。

9. **重复注册**  
   - 用已存在且已验证的邮箱再次注册。  
   - 预期：400「Email already registered」，前端展示该文案。

10. **网络/服务不可用**  
    - 断网或关闭后端后在前端进行登录/注册。  
    - 预期：前端显示「Network error: registration service is unavailable...」类提示，不崩溃。

### 4.3 安全与状态（建议在修复后回归）

11. **登出后访问设计师端**  
    - 登录后点击设计师端「Log out」，再直接访问 /designer/dashboard。  
    - 预期（修复后）：应重定向到 /auth 或要求重新登录；当前实现下可能仍能进入页面但后续 API 401。

12. **登录响应不包含密码**  
    - 登录成功后检查响应体或 localStorage 中 designer 对象。  
    - 预期（修复后）：无 `password` 字段。

---

## 5. 结论与建议

### 5.1 是否可视为「已跑通、可上线」

- **主流程**：注册 → 发验证邮件 → 点链接验证 → 登录 → 进入 /designer/dashboard，以及忘记密码 → 收邮件 → 重置 → 自动登录，在前后端对接上是**完整且可跑通**的。  
- **但**存在以下问题，建议在上线前处理或明确接受风险：
  - 登录/验证邮箱接口返回的 designer 中包含 **password 哈希**（敏感信息泄露）。
  - **登出不清 token/designer**，导致「登出」后仍可被当作已登录使用。
  - **/designer/* 无鉴权守卫**，未登录用户可进入设计师台，依赖后续 API 401 才失败，体验与安全均不佳。

因此：**功能上可视为「主流程已跑通」；从安全与体验角度，建议完成下列修复后再视为「可上线」。**

### 5.2 建议修复项（按优先级）

1. **高**  
   - 登录与验证邮箱接口返回 designer 前**删除或置空 password 字段**（与 resetPassword 一致）。  
   - 设计师端**登出时**调用 `api.clearToken()` 并 `localStorage.removeItem('designer')`。  
   - 为 **/designer/* 增加鉴权守卫**：无有效 token 时重定向到 /auth（或登录页）。

2. **中**  
   - 在 **designers.sql** 中增加 `reset_token`、`reset_expires` 及索引，与 init.sql 一致，避免仅执行该文件时重置密码报错。  
   - （可选）登录/验证失败时后端统一返回 `needVerification: true`，前端据此展示重发验证，而不是依赖 `err.message` 字符串匹配。

3. **低**  
   - 注册时若 SMTP 未配置或发送失败，在响应或前端提示中区分「邮件可能未发送」，引导用户检查垃圾箱或联系支持。  
   - 后端注册密码策略与前端一致（至少含字母与特殊字符），或在前端说明「以当前前端校验为准」。

完成高优先级三项后，设计师端注册与登录流程可视为**可上线**；中低优先级可在后续迭代中处理。
