# Admin Panel Improvements Design

> 日期：2026-04-07
> 状态：待实施

**Goal:** 优化后台管理界面：简化公司列表、限制首页展示数量、增加询盘批量删除（带审计）、红点查看消失、30天回收站、案例状态自动化、案例详情页增删改

---

## 1. 公司列表去掉 Type 列

- Companies Tab 表格移除 "Type" 列（company_type 字段：renovation_company/design_studio 区分不再需要）
- Directory Tab 同步处理（如有 Type 列）
- 数据库字段保留，仅前端不显示

## 2. Home Order 最多 6 个 + 实时计数

- 表格上方显示 **"Home Display: 3/6"** 实时计数
- Companies Tab 和 Directory Tab 的 Home Order **共享 6 个上限**
- 保存时前端校验：已有 6 个非空非零 Home Order 时，拒绝第 7 个，toast 提示"首页最多展示 6 家，请先移除一家"
- 清空或输 0 = 从首页移除，计数实时减少
- 后端也做校验，防止绕过前端

## 3. List Order 与 Home Order 完全独立

- 两个字段各自独立保存，互不影响
- 移除任何互斥逻辑（如果存在）
- 同一公司可以 Home Order=1, List Order=1

## 4. Inquiries 批量删除 + 操作记录

### 前端
- 每行加 checkbox，表头全选
- 选中后顶部出现 "Delete Selected (N)" 按钮
- 点击弹出对话框：必填删除理由 → 确认后调 API
- 页面顶部加 tab 筛选："Active / Deleted (回收站)"
- 回收站里可以一键恢复

### 后端
- `PUT /admin/inquiries/batch-delete` — 软删除 + 记录审计日志
- `PUT /admin/inquiries/batch-restore` — 从回收站恢复
- inquiries 表添加 `deleted_at TIMESTAMP NULL` 和 `deleted_by INT NULL` 字段

### 审计日志表

```sql
CREATE TABLE admin_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  admin_name VARCHAR(100),
  action VARCHAR(50) NOT NULL,       -- 'delete_inquiry', 'restore_inquiry'
  target_type VARCHAR(50) NOT NULL,  -- 'inquiry'
  target_ids JSON NOT NULL,          -- [1, 2, 3]
  reason TEXT,
  metadata JSON,                     -- 被删数据快照
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 5. 红点查看后消失

### 数据库

```sql
CREATE TABLE admin_last_seen (
  admin_id INT NOT NULL,
  page_key VARCHAR(50) NOT NULL,
  last_seen_at TIMESTAMP NOT NULL,
  PRIMARY KEY (admin_id, page_key)
);
```

### 逻辑
- 进入页面时调 `PUT /admin/notifications/mark-seen?page=inquiries`
- 红点计数改为：`created_at > last_seen_at` 的记录数
- page_key: inquiries, companies, complaints, users

## 6. 删除 30 天恢复机制

- 所有删除操作为软删除（`deleted_at` 字段）
- 回收站 tab 显示已删除数据，支持恢复
- 后端定时任务：每天扫描 `deleted_at < NOW() - 30 天`，硬删除
- `admin_audit_log` 永久保留不受 30 天限制
- 硬删除前将完整数据写入 audit_log metadata

## 7. 案例状态去掉

- 公司 approved 时，后端批量设 `projects.status = 'published'`
- Portfolio 卡片移除 "pending" / "published" 状态标签
- 新增项目自动继承公司状态（公司已 approved → 项目直接 published）

## 8. 案例二级详情页（管理员增删改）

### 入口
- 点击 portfolio 卡片图片 → 进入项目详情页

### 详情页
- 顶部 "← Back to Portfolio" 返回
- 左右箭头切换上一个/下一个项目
- 显示：标题、风格、地点、年份、描述文案
- 图片画廊：大图展示所有项目图片

### 管理员操作
- 编辑：标题、描述、风格、地点、年份
- 图片：添加新图片、删除图片、调整顺序
- 删除整个项目（软删除，进回收站）
- Portfolio 列表页加 "Add Project" 按钮

### API
- `GET /admin/roles/companies/:companyId/projects/:projectId` — 获取项目详情
- `PUT /admin/roles/companies/:companyId/projects/:projectId` — 更新项目信息
- `POST /admin/roles/companies/:companyId/projects` — 新增项目
- `DELETE /admin/roles/companies/:companyId/projects/:projectId` — 软删除项目
- `PUT /admin/roles/companies/:companyId/projects/:projectId/restore` — 恢复项目
