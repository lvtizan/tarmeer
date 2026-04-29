# Field Survey — 装企访谈移动端设计文档

**日期**: 2026-04-29
**功能**: 员工外出访谈装企时用手机快速填写访谈问卷，数据存入 Tarmeer DB，Admin 后台可查。

---

## 一、需求总结

| 维度 | 决策 |
|------|------|
| 使用场景 | 员工到装企现场，手机填写 |
| 认证方式 | Admin 登录，新增 `field_staff` 角色 |
| 数据存储 | Tarmeer DB，新表 `company_interviews` |
| 关联公司 | 可选关联 `uae_companies`，不强制 |
| Admin 查看 | 列表 + 详情（只读），super_admin 可编辑 |
| 导出 | 不需要 |

---

## 二、数据库设计

### 2.1 `admin_users` 表变更

新增字段：
```sql
role ENUM('super_admin', 'field_staff') NOT NULL DEFAULT 'super_admin'
```

### 2.2 新表 `company_interviews`

```sql
CREATE TABLE company_interviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interviewer_id INT NOT NULL,           -- FK admin_users.id
  company_ref_id INT NULL,               -- FK uae_companies.id（可选关联）
  company_name VARCHAR(200) NOT NULL DEFAULT '',
  status ENUM('draft', 'submitted') NOT NULL DEFAULT 'draft',

  -- Section JSON 字段
  section_1 JSON NULL,  -- 公司基础信息
  section_2 JSON NULL,  -- 核心业务
  section_3 JSON NULL,  -- 团队架构
  section_4 JSON NULL,  -- 项目与业绩
  section_5 JSON NULL,  -- 供应链
  section_6 JSON NULL,  -- 优势与挑战
  section_7 JSON NULL,  -- 合作意向
  section_8 JSON NULL,  -- 附加信息
  section_9 JSON NULL,  -- 战略问题

  submitted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (interviewer_id) REFERENCES admin_users(id),
  INDEX idx_interviewer (interviewer_id),
  INDEX idx_status (status),
  INDEX idx_company_ref (company_ref_id)
);
```

---

## 三、问卷选项设计

### Section 1: 公司基础信息
| 字段 | 类型 | 选项 |
|------|------|------|
| company_name | 文字输入 | — |
| year_established | 选择 | Before 2000 / 2000-2010 / 2010-2015 / 2015-2020 / 2020+ |
| registration_location | 选择 | Dubai / Abu Dhabi / Sharjah / Other UAE / Outside UAE |
| office_address | 文字输入 | — |
| company_type | 单选 chips | Local / Joint Venture / Foreign |
| company_size | 单选 chips | 1-10 / 10-30 / 30-100 / 100+ |
| licenses | 多选 chips | Dubai Municipality / DEWA Approved / ISO Certified / RERA / Other |

### Section 2: 核心业务
| 字段 | 类型 | 选项 |
|------|------|------|
| main_business_scope | 多选 chips | Interior Design / Fit-out / FF&E / MEP / Joinery / Landscaping |
| one_stop_service | 单选 chips | Yes / No / Partial |
| main_client_types | 多选 chips | Residential / Commercial / Hospitality / Retail / Government / F&B |

### Section 3: 团队架构
| 字段 | 类型 | 选项 |
|------|------|------|
| total_employees | 单选 chips | 1-10 / 11-30 / 31-100 / 100+ |
| design_team_size | 单选 chips | 0 / 1-3 / 4-10 / 10+ |
| pm_team_size | 单选 chips | 0 / 1-3 / 4-10 / 10+ |
| construction_team | 单选 chips | In-house / Outsourced / Hybrid |
| management_background | 多选 chips | UAE Local / Arab / South Asian / Chinese / European / Mixed |
| owner_nationality | 多选 chips | Emirati / Arab / Indian / Pakistani / Chinese / European / Other |

### Section 4: 项目与业绩
| 字段 | 类型 | 选项 |
|------|------|------|
| projects_last_year | 单选 chips | 1-5 / 6-20 / 21-50 / 50+ |
| annual_revenue_aed | 单选 chips | < 1M / 1-5M / 5-20M / 20-50M / 50M+ |
| typical_contract_value | 单选 chips | < 100K / 100K-500K / 500K-2M / 2M+ |
| main_project_types | 多选 chips | Villa / Apartment / Office / Retail / Hotel / Restaurant / Government |
| representative_projects | 文字输入（可选） | — |

### Section 5: 供应链
| 字段 | 类型 | 选项 |
|------|------|------|
| main_material_sources | 多选 chips | China / Italy / Germany / Local UAE / India / Turkey / Mixed |
| stable_supply_chain | 单选 chips | Yes / No / Partially |
| open_to_chinese_supply | 单选 chips | Very Interested / Open / Neutral / Not Interested |

### Section 6: 优势与挑战
| 字段 | 类型 | 选项 |
|------|------|------|
| key_strengths | 多选 chips | Design Capability / Speed / Price / Quality / Relationships / After-sales |
| main_challenges | 多选 chips | Material Cost / Labour / Cash Flow / Competition / Finding Clients / Logistics |

### Section 7: 合作意向
| 字段 | 类型 | 选项 |
|------|------|------|
| interest_in_chinese_platform | 单选 chips | Very Interested / Interested / Maybe / Not Interested |
| support_needed | 多选 chips | Sourcing / Logistics / Quality Control / Payment Terms / Showroom / Training |
| preferred_cooperation_model | 单选 chips | Platform Membership / Per-project / Revenue Share / Exclusive Supply |

### Section 8: 附加信息
| 字段 | 类型 | 选项 |
|------|------|------|
| stable_developer_clients | 单选 chips | Yes / No / Some |
| avg_project_duration | 单选 chips | < 1 month / 1-3 months / 3-6 months / 6+ months |
| client_acquisition_channels | 多选 chips | Referral / Social Media / Tenders / Direct Sales / Repeat Clients / Platforms |
| design_software | 多选 chips | AutoCAD / 3ds Max / SketchUp / Revit / Lumion / Other |
| standardized_quotation | 单选 chips | Yes / No / In Progress |

### Section 9: 战略问题
| 字段 | 类型 | 选项 |
|------|------|------|
| open_to_material_construction_split | 单选 chips | Yes / No / Need to Discuss |
| willing_to_share_client_resources | 单选 chips | Yes / No / Case by Case |
| concerns_about_chinese_supply | 多选 chips | Quality / Delivery Time / Communication / MOQ / After-sales / None |
| interested_in_showroom_collab | 单选 chips | Very Interested / Interested / Maybe / Not Interested |

---

## 四、移动端 UX 设计

### 布局
- 全屏白底，不使用 AdminLayout
- 顶部 sticky 导航栏：返回按钮 + "访谈记录" + 保存状态（"已保存 ✓" / "保存中…"）
- 正文：单页滚动，9 个 Section 依次排列
- Section 标题：`text-lg font-bold` + 金色左边框（`#B8864A`）
- 底部 sticky："提交访谈"按钮（`btn-primary w-full`）

### 问题组件 ChipSelect
- 横向 wrap 布局
- 每个 chip：`min-h-[44px] px-4 py-2 rounded-2xl border`（44px 符合移动端触控最小尺寸）
- 未选中：`border-stone-200 text-stone-600 bg-white`
- 选中：`bg-[#b8864a] text-white border-[#b8864a]`
- 支持单选（radio 语义）和多选（checkbox 语义）两种模式

### 文字输入（仅 3 处）
- 公司名（必填）
- 办公地址（可选）
- 代表项目（可选）

### 关联公司搜索
- 公司名输入框下方，300ms debounce 搜索 `uae_companies`
- 匹配结果以卡片形式展示，点击关联，显示"已关联 ✓ [公司名]"

### 自动保存
- 任意字段变更 → 500ms debounce → `PATCH /api/field/interviews/:id`
- 首次进入页面 → `POST /api/field/interviews` 创建草稿，`id` 存 `localStorage['field_draft_id']`
- 页面加载时检测草稿 → Toast 提示"继续上次的访谈"或直接恢复

### 草稿恢复
- 加载草稿数据，回填所有 chip 选中状态和文字输入值
- 提供"清空重填"选项（二次确认）

---

## 五、API 设计

| Method | Path | 说明 | 角色 |
|--------|------|------|------|
| POST | `/api/field/interviews` | 创建草稿 | field_staff + super_admin |
| PATCH | `/api/field/interviews/:id` | 自动保存 | 本人 |
| POST | `/api/field/interviews/:id/submit` | 提交 | 本人 |
| GET | `/api/field/interviews/draft` | 获取最新草稿 | 本人 |
| GET | `/api/field/companies/search?q=` | 搜索 uae_companies | field_staff + super_admin |
| GET | `/api/admin/interviews` | 访谈记录列表 | super_admin |
| GET | `/api/admin/interviews/:id` | 访谈记录详情 | super_admin |
| PATCH | `/api/admin/interviews/:id` | 编辑记录 | super_admin |
| GET | `/api/admin/staff` | 员工账号列表 | super_admin |
| POST | `/api/admin/staff` | 创建 field_staff 账号 | super_admin |
| PATCH | `/api/admin/staff/:id` | 禁用/启用账号 | super_admin |

---

## 六、Admin 后台页面

### `/admin/interviews` 访谈记录列表
- 列：公司名 / 访谈员 / 提交时间 / 关联公司 / 状态（草稿/已提交）
- 点击行 → 详情页（只读展示 9 个 Section）
- super_admin 详情页有"编辑"按钮

### `/admin/staff` 员工账号管理
- 列：姓名 / Email / 状态（启用/禁用）/ 创建时间
- "新建员工"按钮 → Modal（姓名 + Email + 密码）

---

## 七、权限与路由

| 路径 | 允许角色 |
|------|---------|
| `/field/survey` | `field_staff` + `super_admin` |
| `/admin/*` | `super_admin` only |
| 登录后跳转 | `field_staff` → `/field/survey`；`super_admin` → `/admin/dashboard` |

---

## 八、文件结构

```
src/pages/field/
  FieldSurveyPage.tsx         # 主调查页（单页滚动）

src/components/field/
  ChipSelect.tsx              # 单选/多选 chip 组件
  CompanySearchInput.tsx      # 公司名搜索关联组件
  SurveySectionHeader.tsx     # Section 标题组件

server/src/controllers/
  fieldInterviewController.ts
  adminStaffController.ts

server/src/routes/
  field.ts                    # /api/field/*（需在 app.ts 注册）
  adminStaff.ts               # /api/admin/staff/*
```
