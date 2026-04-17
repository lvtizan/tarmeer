# For-Companies Registration Flow Test Cases

## Tables involved
- `company_leads` - form data + CRM push
- `users` - account creation
- `company_profiles` - company profile auto-creation
- `admin_users` - email conflict check

## TC-FC-01: Complete registration flow (happy path)

| Step | Action | Expected |
|------|--------|----------|
| 1 | POST /api/company-leads with phone, email, companyName, city | 201, lead created |
| 2 | Check company_leads table | Record exists with correct data |
| 3 | POST /api/auth/register with email, password, phone, city, role=company | 201, user created |
| 4 | Check users table | phone, city, role=company set |
| 5 | POST /api/auth/login with email, password | 200, token returned |
| 6 | POST /api/auth/company/profile with company_name, phone, city | Profile created |
| 7 | Check company_profiles table | company_name, phone, city match form data |

## TC-FC-02: Duplicate email registration

| Step | Action | Expected |
|------|--------|----------|
| 1 | POST /api/auth/register with already-registered email | Error: email already registered |
| 2 | Check users table | No duplicate row created |

## TC-FC-03: company_leads CRM push — 正确路由到装企租户

| Step | Action | Expected |
|------|--------|----------|
| 1 | POST /api/company-leads with valid data | 201 |
| 2 | Check company_leads table | Record exists |
| 3 | Check design_inquiries table (same phone) | Mirror row exists, message starts with `[Company Inquiry]` |
| 4 | Check design_inquiries.crm_sync_status | **Must be `synced`** (set at INSERT, not via pushLeadToCRM) |
| 5 | Check design_inquiries.crm_sync_attempts | **Must be `0`** — no actual homeowner CRM push occurred |
| 6 | Check design_inquiries.crm_lead_id | **Must be NULL** — homeowner CRM never called |
| 7 | Check server logs | "[CRM Push] Company lead created/linked" (装企租户) |
| 8 | Check server logs | No `pushLeadToCRM` call for this inquiry id |

> **Root cause of historical bug**: production code was calling `pushLeadToCRM` (homeowner CRM tenant)
> after the mirror INSERT, causing company users to appear as 业主 in CRM.
> Fixed 2026-04-18: mirror INSERT now sets `crm_sync_status='synced'` directly.

## TC-FC-03b: 装企注册后 CRM 身份验证（手动）

| Step | Action | Expected |
|------|--------|----------|
| 1 | 装企用户完成注册 | users.role = company, users.active_role = company |
| 2 | 登录 CRM 后台，搜索该用户手机号 | 仅在装企租户下出现，不在业主租户下 |
| 3 | CRM 中该 lead 身份标签 | 显示装企/公司，不显示业主 |

## TC-FC-03c: 管理后台 CRM 同步按钮已移除

| Step | Action | Expected |
|------|--------|----------|
| 1 | 登录管理后台 → Inquiries 页面 | 页面正常加载 |
| 2 | 找到 `[Company Inquiry]` 类型的行 | CRM 列显示"已同步"徽章，无"重新发送"按钮 |
| 3 | 找到 crm_sync_status=failed 的行 | 只显示"同步失败"标签，无按钮 |
| 4 | 找到 crm_sync_status=pending 的行 | 只显示"待同步"标签，无按钮 |

## TC-FC-04: Phone number sync

| Step | Action | Expected |
|------|--------|----------|
| 1 | Register with phone +971501234567 | users.phone = +971501234567 |
| 2 | Create company profile with same phone | company_profiles.phone = +971501234567 |
| 3 | Phones must match across tables | PASS if identical |

## TC-FC-05: Empty/invalid email

| Step | Action | Expected |
|------|--------|----------|
| 1 | POST /api/auth/register with empty email | 400 error |
| 2 | POST /api/auth/register with invalid format | 400 error |

## TC-FC-06: Password too short

| Step | Action | Expected |
|------|--------|----------|
| 1 | POST /api/auth/register with password < MIN_PASSWORD_LENGTH | 400 error |
