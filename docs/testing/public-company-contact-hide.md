# Test Cases: 自主注册装企联系方式对外隐藏

## Flow Summary
自主注册装企（`company_profiles` 表）的联系方式对外全部隐藏，只有后台可见。

**对外隐藏字段**：`contact_person`, `phone`, `website`, `email`, `address`
**保留字段**：`company_name`, `city`, `services`, `logo_url`, `description`, `is_signed`, `projects`

**不受影响**：
- 目录公司（`uae_companies`）：走不同接口，联系方式照常显示
- 后台接口（`/api/admin/roles/companies/*`）：admin 可见全部联系方式
- 后台全局搜索（`/admin/search`）：admin 可按 phone/email 搜索

## 改动位置
- 后端：`server/src/controllers/publicCompanyController.ts`
  - `listApprovedCompanies()`：SELECT 不取 `contact_person`, `phone`, `website`, `u.email`，去掉 `users` JOIN
  - `getCompanyDetail()`：响应不返回 `contact_person`, `phone`, `website`, `address`
- 前端：`src/pages/CompanyDetailPage.tsx`
  - 移动端 `Contact` section 和桌面端 `Contact Info` 侧边卡，用 `(phone || email || website || instagram || address)` 包裹，无联系字段时整块不渲染

## TC-1: 公共列表接口（/api/public/companies）
- [ ] GET `/api/public/companies` 返回 200
- [ ] 响应 `companies[]` 每一项 **不含** `contact_person` 字段
- [ ] 响应 `companies[]` 每一项 **不含** `phone` 字段
- [ ] 响应 `companies[]` 每一项 **不含** `website` 字段
- [ ] 响应 `companies[]` 每一项 **不含** `email` 字段
- [ ] 响应仍包含 `company_name`, `city`, `services`, `logo_url`, `description`, `is_signed`, `project_count`, `portfolio_images`

## TC-2: 公共详情接口（/api/public/companies/:id）
- [ ] GET `/api/public/companies/:id` 返回 200
- [ ] 响应 `company` **不含** `contact_person`
- [ ] 响应 `company` **不含** `phone`
- [ ] 响应 `company` **不含** `website`
- [ ] 响应 `company` **不含** `address`
- [ ] 响应 `company` **不含** `email`
- [ ] 响应仍包含 `projects`, `company_name`, `city`, `services`, `logo_url`, `description`

## TC-3: 前端页面（CompanyDetailPage）
- [ ] 自主注册公司详情页（`company_profiles.id`）：**不显示** "Contact" 标题和任何联系方式
- [ ] 自主注册公司详情页：移动端 Contact section 整块不渲染（无空标题）
- [ ] 自主注册公司详情页：桌面端 Contact Info 侧边卡整块不渲染
- [ ] 目录公司详情页（`uae_companies.id`）：Contact 区块照常显示 phone/email/website/instagram/address
- [ ] 自主注册公司的 "Get in touch with {name}" 询价卡仍然可用（不受影响）

## TC-4: 后台管理接口（admin-only）
- [ ] GET `/api/admin/roles/companies` with admin JWT：仍返回 `contact_person`, `phone`, `website`, `email`
- [ ] GET `/api/admin/roles/companies/:id/full-detail` with admin JWT：返回完整联系方式
- [ ] GET `/admin/search?q=<phone>` with admin JWT：仍然能按 phone 搜索 registeredCompanies

## TC-5: 回归检查
- [ ] 目录公司列表接口（非 publicCompanyController 的接口）联系方式不受影响
- [ ] `/api/public/companies` 接口不再走 `JOIN users`（性能小改进）
- [ ] 列表和详情接口仍按 approved 状态过滤
- [ ] 列表排序（weight_score、home_display_order 等）未改
- [ ] 询价/Lead 表单（ServiceInquiryCard）未受影响

## 预期结果
5 类 TC 全部 PASS。
