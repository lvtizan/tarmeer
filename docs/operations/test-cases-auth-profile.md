# Auth & Profile Test Cases

## TC-01: 邮箱注册新用户

**前置条件**: 未登录状态，使用全新邮箱

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 /auth | 显示登录页，左侧引导文案，右侧登录框 |
| 2 | 输入新邮箱（如 newuser@test.com） | 邮箱右侧显示 "New account" 标签 |
| 3 | 点击 "Continue with email" | 进入密码输入步骤 |
| 4 | 输入密码（≥6位） | 密码框正常显示 |
| 5 | 点击 "Continue" | 显示"注册成功，请查收验证邮件" |
| 6 | 验证邮件（点击链接） | 邮箱验证成功 |
| 7 | 重新登录 | 成功进入 /designer/dashboard |
| 8 | 进入 /designer/profile | **邮箱栏自动填入注册邮箱**，姓名显示邮箱前缀 |

**验证点**:
- [ ] 不要求填写姓名（注册时 full_name 可选）
- [ ] 邮箱自动带入个人中心
- [ ] 密码错误不会触发自动注册
- [ ] 已注册邮箱显示 "Existing" 标签

---

## TC-02: Google OAuth 注册新用户

**前置条件**: 未登录状态，Google 账号未在系统注册

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 /auth | 显示 "Continue with Google" 按钮 |
| 2 | 点击 "Continue with Google" | 跳转 Google 授权页面 |
| 3 | 选择 Google 账号授权 | 自动回调，创建账号，跳转 /designer/dashboard |
| 4 | 进入 /designer/profile | **邮箱栏自动填入 Google 邮箱** |
| 5 | 检查头像 | **Google 头像自动显示** |
| 6 | 检查姓名 | **Google 账号姓名自动填入** |

**验证点**:
- [ ] Google 邮箱带入个人中心
- [ ] Google 头像带入个人中心
- [ ] Google 姓名带入个人中心
- [ ] 不需要额外填写任何信息

---

## TC-03: 已有邮箱用户登录

**前置条件**: 邮箱已注册且已验证

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 打开 /auth | 显示登录页 |
| 2 | 输入已注册邮箱 | 邮箱右侧显示 "Existing" 标签 |
| 3 | 点击 "Continue with email" | 进入密码输入步骤 |
| 4 | 输入正确密码 | 登录成功，跳转 /designer/dashboard |
| 5 | 输入错误密码 | 显示"Invalid email or password"，**不触发注册流程** |
| 6 | 进入 /designer/profile | 邮箱、姓名、电话等信息完整显示 |

**验证点**:
- [ ] 密码错误只提示错误，不自动注册
- [ ] 已有用户信息完整带入个人中心

---

## TC-04: 上传/修改头像

**前置条件**: 已登录，进入 /designer/profile

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 点击头像区域 | 弹出文件选择框 |
| 2 | 选择一张图片（JPG/PNG，<10MB） | 头像区域显示新图片预览 |
| 3 | 点击 "Save Changes" | 保存成功，提示 "Profile saved." |
| 4 | 刷新页面 | 头像仍然显示（持久化成功） |
| 5 | 选择一张大图片（>2MB） | 自动压缩到 ≤500KB 后显示 |

**验证点**:
- [ ] 头像选择后立即预览
- [ ] 大图片自动压缩
- [ ] 保存不报 403（"You cannot edit another designer's profile"）
- [ ] 保存不报 "Data too long"（avatar_url 字段已改为 MEDIUMTEXT）
- [ ] 新用户（无 designer 记录）保存走 PUT /auth/me，不报 "Designer session not found"
- [ ] 刷新后头像仍在

---

## TC-05: 新用户升级为设计师

**前置条件**: 已注册为普通用户（role=user）

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入 /dashboard | 显示 "Become a Designer" 入口 |
| 2 | 点击 "Become a Designer" | 进入申请页面 |
| 3 | 填写设计师资料（bio, style, expertise） | 表单正常 |
| 4 | 提交申请 | 显示"申请已提交，等待审核" |
| 5 | 管理员后台审核通过 | 用户 role 变为 designer |
| 6 | 重新登录 | 进入设计师面板，可上传项目 |

---

## TC-06: 新用户升级为装修公司

**前置条件**: 已注册为普通用户（role=user）

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 进入 /dashboard | 显示 "Register Company" 入口 |
| 2 | 点击 "Register Company" | 进入公司申请页面 |
| 3 | 填写公司资料（名称、执照号、城市等） | 表单正常 |
| 4 | 提交申请 | 显示"申请已提交，等待审核" |
| 5 | 管理员后台审核 + 手动绑定到已有爬取公司 | 用户获得公司管理权 |
| 6 | 重新登录 | 可管理公司资料和作品 |

---

## TC-07: 邮箱可用性检查

**API 测试**: POST /api/auth/check-availability

| 场景 | 请求 | 预期响应 |
|------|------|----------|
| 新邮箱 | `{"email":"new@test.com"}` | `{"emailAvailable":true}` |
| designers 表已有 | `{"email":"existing@designer.com"}` | `{"emailAvailable":false}` |
| users 表已有 | `{"email":"existing@user.com"}` | `{"emailAvailable":false}` |
| 两表都有 | `{"email":"both@tables.com"}` | `{"emailAvailable":false}` |

**验证点**:
- [ ] 同时检查 users 和 designers 两张表
- [ ] 临时邮箱域名被拦截

---

## TC-08: Profile 编辑权限（403 修复验证）

**API 测试**: PUT /api/designers/:id

| 场景 | 预期 |
|------|------|
| 新 token（userId）编辑自己的 designer profile | 200 成功（auth middleware 解析 designer ID） |
| 旧 token（designer.id）编辑自己的 profile | 200 成功（兼容旧 token） |
| 编辑别人的 designer profile | 403 拒绝 |

---

## 运行 API 自动测试

```bash
# Health check
curl -s https://www.tarmeer.com/api/health

# Check availability
curl -s https://www.tarmeer.com/api/auth/check-availability \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}'

# Register (no name required)
curl -s https://www.tarmeer.com/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"newuser@test.com","password":"Test1234","full_name":""}'

# Login
curl -s https://www.tarmeer.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@test.com","password":"Test1234"}'
```

---

## 已知限制

- 头像存储为 base64 在数据库中（MEDIUMTEXT），未来应改为 OSS 存储
- Google OAuth 在 localhost 开发时需要注册对应 origin
- 新用户无 designer 记录时，部分设计师功能（上传项目）不可用，需先申请升级
