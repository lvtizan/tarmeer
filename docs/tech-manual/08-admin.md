# 08 — Admin 后台

## 页面列表（21 个）

| 页面 | 路径 | 功能 |
|------|------|------|
| AdminDashboardPage | `/admin/dashboard` | 概览面板：统计数字、最近活动 |
| AdminUsersPage | `/admin/users` | 用户管理：列表、搜索、角色变更 |
| AdminUserDetailPage | `/admin/users/:id` | 用户详情：profile、项目、操作历史 |
| AdminDesignersPage | `/admin/designers` | 设计师列表（Legacy）|
| AdminDesignerDetailPage | `/admin/designers/:id` | 设计师详情 |
| AdminCompaniesPage | `/admin/companies` | 公司管理：目录公司 + 注册公司 |
| AdminCompanyDetailPage | `/admin/companies/:id` | 公司详情：profile、portfolio、审核 |
| AdminRegisteredCompanyDetailPage | `/admin/registered-companies/:id` | 注册公司详情 |
| AdminCompanyImportPage | `/admin/companies/import` | Excel 批量导入公司 |
| AdminInquiriesPage | `/admin/inquiries` | 询盘管理：状态、CRM、导出、批量操作 |
| AdminProjectDetailPage | `/admin/projects/:id` | 项目详情：审核、编辑 |
| AdminComplaintsPage | `/admin/complaints` | DMCA/版权投诉处理 |
| AdminAnalyticsPage | `/admin/analytics` | 分析看板：访客、事件、[[知识库/概念/趋势|趋势]] |
| AdminRoleManagementPage | `/admin/roles` | 子管理员 + 权限管理 |
| AdminNotificationEmailsPage | `/admin/notification-emails` | 通知邮箱配置 |
| AdminAdminsPage | `/admin/admins` | Admin 账号管理 |
| AdminHelpPage | `/admin/help` | 帮助文档 |
| AdminLoginPage | `/admin/login` | Admin 登录 |
| AdminInstallPage | `/admin/install` | 首次安装（创建超级管理员） |
| AdminForgotPasswordPage | `/admin/forgot-password` | Admin 忘记密码 |
| AdminResetPasswordPage | `/admin/reset-password` | Admin 重置密码 |

---

## API 端点（100+）

**文件**: `server/src/routes/admin.ts`

### 用户管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/admin/users` | 用户列表（分页、搜索、角色筛选） |
| GET | `/admin/users/:id` | 用户详情 |
| PUT | `/admin/users/:id` | 更新用户 |
| PUT | `/admin/users/:id/role` | 变更角色 |
| DELETE | `/admin/users/:id` | 软删除用户 |

### 公司管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/admin/companies` | 目录公司列表 |
| GET | `/admin/companies/:id` | 公司详情 |
| PUT | `/admin/companies/:id` | 更新公司信息 |
| PUT | `/admin/companies/:id/display-order` | 设置排序 |
| PUT | `/admin/companies/:id/signed` | 标记签约 |
| POST | `/admin/companies/import` | Excel 批量导入 |
| GET | `/admin/registered-companies` | 注册公司列表 |
| PUT | `/admin/registered-companies/:id/approve` | 审核通过 |
| PUT | `/admin/registered-companies/:id/reject` | 驳回 |
| PUT | `/admin/registered-companies/:id/bind` | 绑定到目录公司 |

### 项目管理

| 方法 | 路径 | 功能 |
|------|------|------|
| PUT | `/admin/projects/:id/approve` | 审核通过项目 |
| PUT | `/admin/projects/:id/reject` | 驳回项目 |
| PUT | `/admin/roles/companies/:companyId/projects/:projectId` | 更新项目 |
| PUT | `/admin/roles/companies/:companyId/projects/:projectId/restore` | 恢复已删除 |

### 询盘管理

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/admin/inquiries` | 询盘列表（分页、状态、搜索） |
| PUT | `/admin/inquiries/:id` | 更新状态/备注 |
| GET | `/admin/inquiries/export` | Excel 导出 |
| POST | `/admin/inquiries/batch-delete` | 批量软删除 |
| POST | `/admin/inquiries/batch-restore` | 批量恢复 |
| POST | `/admin/inquiries/:id/resend-crm` | CRM 重试 |

### 分析与访客

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/admin/analytics/overview` | 分析概览 |
| GET | `/admin/analytics/events` | 事件列表 |
| GET | `/admin/visitors` | 访客日志 |
| GET | `/admin/visitors/stats` | 访客统计 |

---

## 权限系统 (RBAC)

### Admin 角色

| 角色 | 说明 |
|------|------|
| 超级管理员 | 拥有所有权限，可管理其他 Admin |
| 子管理员 | 只有 `permissions` JSON 中列出的权限 |

### 权限列表

```typescript
const AVAILABLE_PERMISSIONS = [
  'can_approve',        // 审核公司/项目
  'can_delete',         // 删除操作
  'can_manage_roles',   // 管理子管理员
  'can_export',         // 导出数据
  'can_import',         // 导入数据
  // ...
];
```

### 权限检查

```typescript
// 中间件级
router.put('/projects/:id/approve',
  authenticateAdmin,
  requirePermission('can_approve'),
  approveProject
);

// 前端级
const { hasPermission, isSuperAdmin } = useAdmin();
if (hasPermission('can_delete')) {
  // 显示删除按钮
}
```

---

## Word 模板导入（公司）

**文件**: `server/src/services/companyImportService.ts`

**技术**: `docx` (生成 Word) + `mammoth` (解析 Word) + `xlsx` (Excel 导出)

### 三步流程

```
Step 1: 下载空白 Word 模板（21 个字段，中英双语标签）
  ↓
Step 2: 填写后上传 → mammoth 解析提取字段值 → 预览确认
  ↓
Step 3: 确认导入 → 同时写入 company_profiles + uae_companies 两张表
         ├── company_profiles: status='approved'（Admin 导入自动审核通过）
         └── uae_companies: is_active=1, is_verified=1
```

### 模板字段（21 个）

| 字段 | 必填 | 示例 |
|------|------|------|
| company_name | 是 | Algedra Interior Design |
| company_name_ar | 否 | الكيدرا للتصميم الداخلي |
| company_type | 是 | 19种类型之一（见下方枚举） |
| contact_person | 是 | Ahmed Ali |
| phone | 是 | +971 50 123 4567 |
| city | 是 | Dubai |
| description | 是 | Brief description... |
| services | 是 | 逗号分隔，32种服务之一（见下方枚举） |
| email / website / whatsapp | 否 | — |
| address / year / license / specialties / social URLs | 否 | — |

#### company_type 枚举（19种）

| 分组 | 值 | 中文说明 |
|------|----|---------|
| Design | `design_studio` | 设计公司 |
| Construction | `renovation_company` | 装修公司 |
| Construction | `general_contractor` | 总承包商 |
| Construction | `fitout_contractor` | 精装承包商 |
| Systems & MEP | `mep_contractor` | 机电承包商 |
| Systems & MEP | `fire_fighting` | 消防工程 |
| Systems & MEP | `smart_home` | 智能家居 |
| Systems & MEP | `waterproofing` | 防水工程 |
| Specialty Trade | `glass_aluminium` | 玻璃铝材 |
| Specialty Trade | `carpentry_joinery` | 木工细木工 |
| Specialty Trade | `stone_marble` | 石材大理石 |
| Specialty Trade | `steel_fabrication` | 钢结构 |
| Specialty Trade | `specialty_trade` | 其他专项 |
| Services | `maintenance_company` | 维保公司 |
| Services | `cleaning_services` | 清洁服务 |
| Services | `manpower_supply` | 劳务供应 |
| Services | `landscaping` | 园林景观 |
| Services | `swimming_pool` | 游泳池承包商 |
| Furnishing | `furnishing` | 家具软装 |

#### services 枚举（32种）

**设计类：** Interior Design · Architecture · Design & Build  
**施工类：** Fit-Out · Renovation · Construction · MEP  
**家具类：** Furniture · Joinery · Turnkey Solutions  
**服务类：** Project Management · Landscape · Maintenance  
**专项类：** Glass & Aluminium · Painting & Finishing · Flooring & Tiling · Demolition · Steel & Fabrication · Curtains & Blinds · Cleaning Services · Pools · HVAC & Ducting · Fire Fighting · Smart Home & Automation · Waterproofing · Solar Systems · Epoxy & PU Flooring · Scaffolding · Lighting Installation · Stone & Marble Fixing · Gypsum & Partitions · Deep Cleaning

---

## 审计日志

**表**: `admin_audit_log`

```sql
id         INT AUTO_INCREMENT
admin_id   INT NOT NULL           -- 操作人
admin_name VARCHAR(100)           -- 操作人姓名
action     VARCHAR(50)            -- delete_inquiry / restore_inquiry / ...
target_type VARCHAR(50)           -- inquiry / company / user
target_ids  JSON                  -- [1, 2, 3]
reason      TEXT                  -- 删除原因
metadata    JSON                  -- { snapshot: [完整数据快照] }
created_at  TIMESTAMP
```

### 快照恢复

每次批量删除 inquiry 前：
1. `SELECT * FROM design_inquiries WHERE id IN (...)`
2. 完整数据保存到 `metadata.snapshot`
3. 执行 soft delete
4. 写入审计日志

即使从回收站也删除了，仍可从 `admin_audit_log.metadata` 中恢复原始数据。
