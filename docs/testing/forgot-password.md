# Forgot Password Test Cases

## TC-FP-01: 普通用户忘记密码

**前置条件**: 未登录，使用已注册的普通用户邮箱

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 /forgot-password | 显示忘记密码页面 |
| 2 | 输入已注册的普通用户邮箱 | 输入框正常 |
| 3 | 点击发送 | 显示"If that email is registered, you will receive a password reset link." |
| 4 | 检查邮箱 | 收到重置密码邮件，链接指向 /reset-password?token=xxx |

**验证点**:
- [ ] 邮件能正常收到
- [ ] 重置链接可点击且有效
- [ ] 点击链接后能设置新密码

---

## TC-FP-02: Admin 用户从 admin 忘记密码页面

**前置条件**: 未登录，使用 admin_users 表中的邮箱

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 /admin/forgot-password | 显示"Forgot Password"页面（非"Admin Forgot Password"） |
| 2 | 输入 admin 邮箱 | 输入框正常 |
| 3 | 点击发送 | 显示成功提示 |
| 4 | 检查邮箱 | 收到 Admin 重置密码邮件，链接指向 /admin/reset-password?token=xxx |

**验证点**:
- [ ] 页面标题是"Forgot Password"不是"Admin Forgot Password"
- [ ] 调用的是统一接口 /api/auth/forgot-password
- [ ] 邮件链接指向 admin 重置页面

---

## TC-FP-03: 不存在的邮箱

**前置条件**: 使用未注册的邮箱

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 输入未注册邮箱 notexist@test.com | 输入框正常 |
| 2 | 点击发送 | 显示相同的通用消息（不暴露邮箱是否存在） |
| 3 | 检查邮箱 | 不会收到任何邮件 |

**验证点**:
- [ ] 返回消息与成功时一致（安全，不泄露用户信息）

---

## TC-FP-04: 同时存在于 users 和 admin_users 的邮箱

**前置条件**: 同一个邮箱既在 users 表又在 admin_users 表

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 输入该邮箱 | 输入框正常 |
| 2 | 点击发送 | 显示成功提示 |
| 3 | 检查邮箱 | 收到的是**普通用户**的重置邮件（users 表优先） |

**验证点**:
- [ ] users 表优先于 admin_users

---

## TC-FP-05: 被封禁的用户

**前置条件**: 用户 status='suspended'

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 输入被封禁用户的邮箱 | 显示通用消息 |
| 2 | 检查邮箱 | 不会收到邮件 |

**验证点**:
- [ ] suspended 用户不发重置邮件
- [ ] 返回消息不暴露用户状态
