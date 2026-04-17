# Test Cases: Company Signup Flow (v5.0.43)

## Flow Summary
/for-companies 装企注册全流程，不跳转到 /auth，全程在深色 hero 背景内完成。

三条路径：
1. 新手机号 → 邮箱注册（两步：输邮箱 → 输密码）
2. 新手机号 → Google OAuth 注册
3. 已注册手机号 → inline 登录

## TC-1: 表单验证 (/for-companies)
- [ ] 不填 Contact Name → 提示 "Please fill in all required fields"
- [ ] 不填手机号 → 提示 "Please fill in all required fields"
- [ ] 填假手机号（如 +971500000000）→ phoneValidation 报错
- [ ] 不填 Company Name → 提示 "Please fill in all required fields"
- [ ] 不选 City → 提示 "Please fill in all required fields"
- [ ] 不选 Company Type → 红框 + 错误提示
- [ ] Year of Establishment 填 1899 → "Year must be between 1900 and 2026"
- [ ] Year of Establishment 留空 → OK（optional 字段）

## TC-2: AdminSelect 下拉（全局组件）
- [ ] City 下拉：fixed 定位，不被 overflow-hidden 裁切
- [ ] Company Type 下拉：8 个选项全部展示，无滚动条（≤10 项不限高）
- [ ] 打开下拉不产生页面滚动条抖动（desktop 不锁 body scroll）
- [ ] 选择后下拉关闭，值正确回填

## TC-3: 新手机号 → 邮箱注册（两步流程）
- [ ] 填完表单提交 → 表单卡片切换到 "Create your account" 界面
- [ ] 页面保持在 /for-companies，深色 hero 背景不变
- [ ] 显示 "Continue with Google" 按钮 + "OR CONTINUE WITH EMAIL" 分隔线
- [ ] 输入邮箱 → 点 "Continue with email"
- [ ] 后端检测邮箱（check-availability）
- [ ] 新邮箱 → 显示 "Create a password for xxx@xxx.com" + 密码框
- [ ] 已有邮箱 → 显示 "Enter password for xxx@xxx.com" + 密码框
- [ ] 新用户填密码 → 点 "Create Account" → 注册成功
- [ ] 注册后自动登录 → 自动创建 company_profiles → 跳转 /company
- [ ] 如需邮箱验证 → 显示绿色成功提示 "Account created! Please check xxx to verify..."
- [ ] 已有用户填密码 → 点 "Sign In" → 登录 → 创建/更新 profile → 跳转 /company
- [ ] Back 按钮（密码步骤）→ 回到邮箱输入步骤
- [ ] Back 按钮（邮箱步骤）→ 回到公司信息表单

## TC-4: 新手机号 → Google OAuth 注册
- [ ] 点 "Continue with Google" → sessionStorage 存储 pending_company_profile
- [ ] 跳转到 /api/auth/google?role=company
- [ ] OAuth 回调后自动创建 company_profiles（从 sessionStorage 读取）
- [ ] 跳转到 /company dashboard

## TC-5: 已注册手机号 → inline 登录
- [ ] 手机号已注册 → API 返回 409 → 卡片切换到 inline 登录界面
- [ ] 显示黄色警告 "This phone number is already registered"
- [ ] 有 profile → 提示 "Sign in to access your dashboard"
- [ ] 无 profile → 提示 "Sign in to complete your company profile"
- [ ] 输入邮箱 + 密码 → 登录成功 → 自动创建 profile（如无）→ 跳转 /company/dashboard
- [ ] Back 按钮 → 回到公司信息表单

## TC-6: CRM 推送
- [ ] 表单提交成功 → company_leads 表有记录
- [ ] design_inquiries 表有 mirror 记录
- [ ] CRM 推送包含 channelPlatform: "website"
- [ ] CRM 推送包含 channelAccountName: "Tarmeer Mall"
- [ ] CRM 推送包含 company 字段（公司名）

## TC-7: 邮件通知
- [ ] 注册后 onboarding_step < 2 → 不发邮件
- [ ] onboarding_step 升到 >= 2（上传项目后）→ 发邮件通知
- [ ] 邮件包含 Contact、Phone、Company Type、City、Services
- [ ] signup_source 正确显示（不是 "未知"）

## TC-8: 数据完整性
- [ ] users 表：role=company, signup_source=for-companies-landing
- [ ] company_profiles 表：company_name, contact_person, phone, city, company_type 都有值
- [ ] company_profiles.signup_source = for-companies-landing
