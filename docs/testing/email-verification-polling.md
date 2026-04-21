# Test Cases: Email Verification Polling (v5.0.60)

## Feature Summary

注册后显示"check your email"页面时，前端每 3 秒轮询 GET /auth/check-verified。
用户在手机/其他标签页点击验证链接后，原始注册页面自动登录并跳转到 dashboard。

## TC-1: check-verified API 基本功能

- [ ] 未验证的邮箱返回 { verified: false }
- [ ] 已验证的邮箱返回 { verified: true, token: "...", user: {...} }
- [ ] 不存在的邮箱返回 { verified: false }
- [ ] 缺少 email 参数返回 400

## TC-2: 注册 → 验证 → 自动登录（/auth 页面）

- [ ] 业主注册后页面显示 "check your email"
- [ ] 模拟验证（DB 设 email_verified=TRUE）
- [ ] 3 秒内页面自动跳转到 /dashboard
- [ ] localStorage 有 token 和 user 数据

## TC-3: 注册 → 验证 → 自动登录（/for-companies 页面）

- [ ] 装企注册后表单显示 "Account created! Please check..."
- [ ] 模拟验证后自动跳转到 /company

## TC-4: 注册 → 验证 → 自动登录（/join 页面）

- [ ] 装企在 /join 注册后显示 "Check your email"
- [ ] 模拟验证后自动跳转到 /company

## TC-5: 验证链接本身仍然正常工作

- [ ] 点击验证链接 → /verify-email?token=xxx → 验证成功 → 跳转 dashboard
- [ ] 手机端点击也能正常工作

## TC-6: 轮询不会无限运行

- [ ] 验证成功后轮询停止（不再发请求）
- [ ] 页面切走后轮询清理（useEffect cleanup）
