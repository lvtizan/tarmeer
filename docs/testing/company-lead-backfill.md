# Test Cases: Company Lead Backfill (v5.0.59)

## Feature Summary

用户在 /for-companies 填写的公司信息存入 company_leads 表，注册后首次进入公司后台时，
GET /api/company/profile 自动按 phone 或 email 匹配 company_leads，命中则自动创建 company_profiles。

不依赖 sessionStorage，全走 DB 匹配。

## TC-1: Phone 匹配 (邮箱注册 + 验证后登录)

模拟最常见场景：用户填表 → 注册 → 邮箱验证(新标签页) → 登录 → 进公司后台

- [ ] POST /api/company-leads 返回 201
- [ ] POST /api/auth/register 返回 201
- [ ] 邮箱验证后登录返回 200 + token
- [ ] GET /api/auth/company/profile 返回 200
- [ ] profile 自动创建 (profile != null)
- [ ] company_name 带入
- [ ] contact_person 带入
- [ ] phone 带入
- [ ] city 带入
- [ ] company_type 带入
- [ ] establishment_year 带入
- [ ] signup_source = 'company-lead-backfill'
- [ ] company_leads.email 已回填为注册邮箱

## TC-2: Email Fallback (Google OAuth 场景 - 用户无 phone)

模拟 Google OAuth 用户 phone 丢失，通过 email 兜底匹配

- [ ] company_leads 有 phone + email(已回填)
- [ ] users 无 phone (模拟 Google OAuth 未传 phone)
- [ ] GET /api/auth/company/profile 返回 200
- [ ] profile 自动创建
- [ ] company_name 带入
- [ ] contact_person 带入
- [ ] city 带入
- [ ] company_type 带入 (包括非 design_studio/renovation_company 的类型)

## TC-3: 幂等性 (重复请求不创建多个 profile)

- [ ] 第二次 GET /api/auth/company/profile 返回同一个 profile.id

## TC-4: 已有 profile 不被覆盖

- [ ] 已有 company_profiles 记录的用户不触发回填逻辑
- [ ] 返回原有 profile 数据不变

## TC-5: 无匹配 leads 时正常返回 null

- [ ] 用户没有对应 company_leads 记录
- [ ] GET /api/auth/company/profile 返回 { profile: null, projectCount: 0 }

## TC-6: OAuth state 带 phone (前端)

- [ ] CompanySignupForm Google 按钮 URL 包含 &phone= 参数
- [ ] CompanyAuthPage Google 按钮 URL 包含 &phone= 参数
- [ ] 后端解析 JSON state { role, phone }
- [ ] 后端兼容旧版纯字符串 state "company"

## TC-7: OAuth 回调补写 users.phone

- [ ] 已有用户无 phone + oauthPhone 有值 → users.phone 被补写
- [ ] 新用户创建时 phone 从 state 带入

## TC-8: company_type VARCHAR 兼容

- [ ] company_leads.company_type = 'general_contractor' → 写入 company_profiles 成功
- [ ] company_leads.company_type = 'mep_contractor' → 写入成功
- [ ] company_leads.company_type = 'specialty_trade' → 写入成功
