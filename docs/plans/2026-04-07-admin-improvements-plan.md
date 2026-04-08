# Admin Panel Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 优化后台管理：去Type列、Home Order限6、独立排序、询盘批量删除+审计、红点查看消失、30天回收站、案例自动发布、案例详情页增删改

**Architecture:** 数据库先行（3张新表+字段），后端API次之，前端最后。所有删除为软删除，审计日志永久保留。

**Tech Stack:** React + TypeScript (frontend), Express + mysql2 (backend), Aliyun RDS MySQL

---

### Task 1: 数据库迁移 — 新表和字段

**Files:**
- Modify: `server/src/lib/autoMigrate.ts`

**Step 1: 添加自动迁移逻辑**

在 `autoMigrate.ts` 的迁移数组中添加三个迁移：

```sql
-- 1. admin_audit_log 审计日志表
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  admin_name VARCHAR(100),
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_ids JSON NOT NULL,
  reason TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);

-- 2. admin_last_seen 红点已读追踪表
CREATE TABLE IF NOT EXISTS admin_last_seen (
  admin_id INT NOT NULL,
  page_key VARCHAR(50) NOT NULL,
  last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_id, page_key)
);

-- 3. inquiries 表添加软删除字段
ALTER TABLE design_inquiries ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE design_inquiries ADD COLUMN deleted_by INT NULL;
```

**Step 2: 验证**

```bash
cd server && npx tsc
```

**Step 3: Commit**

```bash
git add server/src/lib/autoMigrate.ts
git commit -m "feat(db): add admin_audit_log, admin_last_seen tables and inquiry soft delete fields"
```

---

### Task 2: 后端 — 询盘批量删除 + 恢复 + 审计

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/controllers/complaintController.ts` (inquiries handlers are here)

**Step 1: 添加批量删除接口**

在 complaintController.ts 中添加：

```typescript
// PUT /admin/inquiries/batch-delete
export async function batchDeleteInquiries(req: Request, res: Response) {
  const { ids, reason } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return res.status(400).json({ error: 'Deletion reason required' });
  }

  const adminId = (req as any).adminId;
  const adminName = (req as any).adminName || 'Unknown';
  const placeholders = ids.map(() => '?').join(',');

  // 1. 获取被删数据快照
  const [rows] = await pool.query(
    `SELECT * FROM design_inquiries WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    ids
  );

  // 2. 软删除
  await pool.query(
    `UPDATE design_inquiries SET deleted_at = NOW(), deleted_by = ? WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    [adminId, ...ids]
  );

  // 3. 写审计日志
  await pool.query(
    `INSERT INTO admin_audit_log (admin_id, admin_name, action, target_type, target_ids, reason, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [adminId, adminName, 'delete_inquiry', 'inquiry', JSON.stringify(ids), reason.trim(), JSON.stringify(rows)]
  );

  res.json({ deleted: (rows as any[]).length });
}
```

**Step 2: 添加批量恢复接口**

```typescript
// PUT /admin/inquiries/batch-restore
export async function batchRestoreInquiries(req: Request, res: Response) {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const adminId = (req as any).adminId;
  const adminName = (req as any).adminName || 'Unknown';
  const placeholders = ids.map(() => '?').join(',');

  const [result] = await pool.query(
    `UPDATE design_inquiries SET deleted_at = NULL, deleted_by = NULL WHERE id IN (${placeholders}) AND deleted_at IS NOT NULL`,
    ids
  );

  await pool.query(
    `INSERT INTO admin_audit_log (admin_id, admin_name, action, target_type, target_ids, reason, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [adminId, adminName, 'restore_inquiry', 'inquiry', JSON.stringify(ids), 'Restored from recycle bin', null]
  );

  res.json({ restored: (result as any).affectedRows });
}
```

**Step 3: 修改 getInquiries 过滤已删除**

在现有 getInquiries 中，SQL WHERE 条件加上 `AND deleted_at IS NULL`。
新增参数 `deleted=true` 时改为 `AND deleted_at IS NOT NULL`。

**Step 4: 注册路由**

在 admin.ts 中添加：
```typescript
router.put('/inquiries/batch-delete', batchDeleteInquiries);
router.put('/inquiries/batch-restore', batchRestoreInquiries);
```

**Step 5: 验证构建**

```bash
cd server && npx tsc
```

**Step 6: Commit**

```bash
git commit -m "feat(api): add inquiry batch delete/restore with audit logging"
```

---

### Task 3: 后端 — 红点查看消失逻辑

**Files:**
- Modify: `server/src/controllers/complaintController.ts`
- Modify: `server/src/routes/admin.ts`

**Step 1: 添加 mark-seen 接口**

```typescript
// PUT /admin/notifications/mark-seen
export async function markNotificationSeen(req: Request, res: Response) {
  const page = req.query.page as string;
  const validPages = ['inquiries', 'companies', 'complaints', 'users'];
  if (!validPages.includes(page)) {
    return res.status(400).json({ error: 'Invalid page key' });
  }

  const adminId = (req as any).adminId;
  await pool.query(
    `INSERT INTO admin_last_seen (admin_id, page_key, last_seen_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE last_seen_at = NOW()`,
    [adminId, page]
  );

  res.json({ ok: true });
}
```

**Step 2: 修改 getNewCounts 使用 last_seen**

改造现有 getNewCounts，查询时 JOIN admin_last_seen：
- 如果有 last_seen_at，只统计 `created_at > last_seen_at` 的记录
- 如果没有（新管理员），统计全部 pending/new

从 request 获取 adminId，加入查询条件。

**Step 3: 注册路由**

```typescript
router.put('/notifications/mark-seen', markNotificationSeen);
```

**Step 4: Commit**

```bash
git commit -m "feat(api): add mark-seen endpoint and per-admin notification counts"
```

---

### Task 4: 后端 — Home Order 上限校验 + 案例自动发布

**Files:**
- Modify: `server/src/controllers/companyAdminController.ts`

**Step 1: Home Order 保存时校验上限**

在 `updateSingleOrderField` 或 home order 相关函数中，当 field 是 home_display_order 时，增加校验：

```typescript
// 统计当前有多少个非空非零的 home_display_order
const [countResult] = await pool.query(`
  SELECT (
    (SELECT COUNT(*) FROM company_profiles WHERE home_display_order > 0 AND home_display_order IS NOT NULL AND deleted_at IS NULL AND id != ?) +
    (SELECT COUNT(*) FROM uae_companies WHERE home_display_order > 0 AND home_display_order IS NOT NULL AND id != ?)
  ) AS total
`, [currentId, currentId]);

const total = (countResult as any)[0]?.total || 0;
if (value > 0 && total >= 6) {
  return res.status(400).json({ error: '首页最多展示 6 家公司，请先移除一家' });
}
```

对 directory 和 registered company 的 home order 端点都要加这个校验。

**Step 2: 案例自动发布**

在公司审核通过（approveCompanyProfile）时，批量更新项目状态：

```typescript
// 在 approve 逻辑成功后追加：
await pool.query(
  `UPDATE projects SET status = 'published' WHERE company_profile_id = ? AND status = 'pending'`,
  [companyId]
);
```

新项目创建时，如果公司已 approved，直接设 `status = 'published'`。

**Step 3: Commit**

```bash
git commit -m "feat(api): home order max 6 validation + auto-publish projects on company approval"
```

---

### Task 5: 后端 — 案例详情 CRUD API

**Files:**
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/controllers/companyAdminController.ts`

**Step 1: 添加项目 CRUD 接口**

```typescript
// GET /admin/roles/companies/:companyId/projects/:projectId
export async function getAdminProject(req, res) {
  const { companyId, projectId } = req.params;
  const [rows] = await pool.query(
    'SELECT * FROM projects WHERE id = ? AND company_profile_id = ?',
    [projectId, companyId]
  );
  if (!(rows as any[]).length) return res.status(404).json({ error: 'Project not found' });
  res.json({ project: (rows as any[])[0] });
}

// PUT /admin/roles/companies/:companyId/projects/:projectId
export async function updateAdminProject(req, res) {
  const { companyId, projectId } = req.params;
  const { title, description, style, location, year, images, tags } = req.body;
  // 如果 images 包含 base64，先调 persistProjectImages 保存到文件系统
  // 更新 projects 表
  await pool.query(
    `UPDATE projects SET title=?, description=?, style=?, location=?, year=?, images=?, tags=?, updated_at=NOW()
     WHERE id=? AND company_profile_id=?`,
    [title, description, style, location, year, JSON.stringify(images), JSON.stringify(tags), projectId, companyId]
  );
  res.json({ ok: true });
}

// POST /admin/roles/companies/:companyId/projects
export async function createAdminProject(req, res) {
  const { companyId } = req.params;
  const { title, description, style, location, year, images, tags } = req.body;
  // 检查公司状态，如果 approved 则项目直接 published
  const [company] = await pool.query('SELECT status FROM company_profiles WHERE id=?', [companyId]);
  const status = (company as any[])[0]?.status === 'approved' ? 'published' : 'pending';
  // persistProjectImages 处理 base64
  const [result] = await pool.query(
    `INSERT INTO projects (company_profile_id, title, description, style, location, year, images, tags, status) VALUES (?,?,?,?,?,?,?,?,?)`,
    [companyId, title, description, style, location, year, JSON.stringify(images), JSON.stringify(tags), status]
  );
  res.json({ id: (result as any).insertId });
}

// DELETE /admin/roles/companies/:companyId/projects/:projectId
export async function deleteAdminProject(req, res) {
  const { companyId, projectId } = req.params;
  // 软删除
  await pool.query(
    `UPDATE projects SET deleted_at = NOW() WHERE id=? AND company_profile_id=?`,
    [projectId, companyId]
  );
  // 审计日志
  const adminId = (req as any).adminId;
  await pool.query(
    `INSERT INTO admin_audit_log (admin_id, action, target_type, target_ids, reason) VALUES (?, 'delete_project', 'project', ?, 'Admin deleted')`,
    [adminId, JSON.stringify([projectId])]
  );
  res.json({ ok: true });
}

// PUT /admin/roles/companies/:companyId/projects/:projectId/restore
export async function restoreAdminProject(req, res) {
  const { projectId } = req.params;
  await pool.query('UPDATE projects SET deleted_at = NULL WHERE id = ?', [projectId]);
  res.json({ ok: true });
}
```

**Step 2: 注册路由**

```typescript
router.get('/roles/companies/:companyId/projects/:projectId', getAdminProject);
router.put('/roles/companies/:companyId/projects/:projectId', upload.array('images', 20), updateAdminProject);
router.post('/roles/companies/:companyId/projects', upload.array('images', 20), createAdminProject);
router.delete('/roles/companies/:companyId/projects/:projectId', deleteAdminProject);
router.put('/roles/companies/:companyId/projects/:projectId/restore', restoreAdminProject);
```

**Step 3: 添加 projects 表 deleted_at 字段（如不存在）**

在 autoMigrate 中添加：
```sql
ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
```

**Step 4: Commit**

```bash
git commit -m "feat(api): add admin project CRUD with soft delete"
```

---

### Task 6: 前端 — 公司列表改动（Type列、Home Order限制、独立排序）

**Files:**
- Modify: `src/components/admin/AdminCompaniesTableTab.tsx`
- Modify: `src/pages/admin/AdminCompaniesPage.tsx`

**Step 1: 去掉 Type 列**

在 AdminCompaniesTableTab.tsx 中，删除 Type 列的 th 和 td（约 lines 113-164 的 company_type badge 渲染）。

**Step 2: Home Order 上限计数显示**

在 AdminCompaniesPage.tsx 中：
- 加载时统计所有 home_display_order > 0 的公司数量（从 profiles 和 directory 数据合并计算）
- 在表格上方渲染 `Home Display: {count}/6`
- 保存 home order 时，如果 count >= 6 且新值 > 0，toast 提示"首页最多展示 6 家"并阻止保存

**Step 3: 确认无互斥逻辑**

检查代码中是否有 home_display_order 和 list_display_order 的互斥判断，如有则删除。

**Step 4: Commit**

```bash
git commit -m "feat(admin): remove Type column, add Home Order 6-limit counter"
```

---

### Task 7: 前端 — 询盘批量删除 + 回收站

**Files:**
- Modify: `src/pages/admin/AdminInquiriesPage.tsx`
- Modify: `src/lib/adminApi.ts`

**Step 1: 在 adminApi.ts 添加新方法**

```typescript
async batchDeleteInquiries(ids: number[], reason: string) {
  return this.request('/admin/inquiries/batch-delete', {
    method: 'PUT',
    body: JSON.stringify({ ids, reason }),
  });
}

async batchRestoreInquiries(ids: number[]) {
  return this.request('/admin/inquiries/batch-restore', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}

async getInquiries(params: { page?: number; limit?: number; status?: string; search?: string; deleted?: boolean }) {
  // 添加 deleted 参数支持
}
```

**Step 2: 改造 AdminInquiriesPage**

- 添加 state: `selected: Set<number>`, `viewMode: 'active' | 'deleted'`
- 表头加全选 checkbox
- 每行加 checkbox
- 选中 > 0 时显示 "Delete Selected (N)" 按钮
- 点击删除弹出 modal：输入理由（必填）→ 确认 → 调 batchDeleteInquiries
- 顶部加 tab: "Active" / "Deleted (回收站)"
- 回收站模式下显示 "Restore Selected" 按钮

**Step 3: Commit**

```bash
git commit -m "feat(admin): inquiry batch delete with reason modal and recycle bin"
```

---

### Task 8: 前端 — 红点查看消失

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/lib/adminApi.ts`

**Step 1: 在 adminApi.ts 添加 markSeen**

```typescript
async markNotificationSeen(page: string) {
  return this.request(`/admin/notifications/mark-seen?page=${page}`, { method: 'PUT' });
}
```

**Step 2: 修改 AdminLayout.tsx**

在路由变化时（useEffect on pathname），如果当前路径匹配 NOTIFICATION_MAP，调 `markNotificationSeen(pageKey)` 并在回调中刷新 notification counts。

```typescript
useEffect(() => {
  const pageKey = Object.entries(NOTIFICATION_MAP).find(([path]) => pathname.startsWith(path))?.[1];
  if (pageKey) {
    // 将 notifKey 转为 page_key 格式
    const pageMap: Record<string, string> = {
      newComplaints: 'complaints',
      newInquiries: 'inquiries',
      newCompanyApps: 'companies',
      newUsers: 'users',
    };
    adminApi.markNotificationSeen(pageMap[pageKey]).then(() => {
      fetchNotificationCounts(); // 刷新计数
    });
  }
}, [pathname]);
```

**Step 3: Commit**

```bash
git commit -m "feat(admin): red dot disappears after page visit (mark-seen)"
```

---

### Task 9: 前端 — 案例状态标签移除

**Files:**
- Modify: `src/pages/admin/AdminRegisteredCompanyDetailPage.tsx`
- Modify: `src/pages/admin/AdminCompanyDetailPage.tsx`

**Step 1: 移除项目卡片上的状态 badge**

在两个详情页的 Portfolio 项目卡片中，删除 status badge 的渲染代码（pending/published/rejected 标签）。

**Step 2: Commit**

```bash
git commit -m "feat(admin): remove project status badges (auto-publish on company approval)"
```

---

### Task 10: 前端 — 案例二级详情页（增删改）

**Files:**
- Create: `src/pages/admin/AdminProjectDetailPage.tsx`
- Modify: `src/pages/admin/AdminRegisteredCompanyDetailPage.tsx` (添加点击入口)
- Modify: `src/pages/admin/AdminCompanyDetailPage.tsx` (添加点击入口)
- Modify: `src/App.tsx` (添加路由)
- Modify: `src/lib/adminApi.ts`

**Step 1: 在 adminApi.ts 添加项目 CRUD 方法**

```typescript
async getAdminProject(companyId: string, projectId: string) {
  return this.request(`/admin/roles/companies/${companyId}/projects/${projectId}`);
}

async updateAdminProject(companyId: string, projectId: string, data: any) {
  return this.request(`/admin/roles/companies/${companyId}/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

async createAdminProject(companyId: string, data: any) {
  return this.request(`/admin/roles/companies/${companyId}/projects`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

async deleteAdminProject(companyId: string, projectId: string) {
  return this.request(`/admin/roles/companies/${companyId}/projects/${projectId}`, {
    method: 'DELETE',
  });
}

async restoreAdminProject(companyId: string, projectId: string) {
  return this.request(`/admin/roles/companies/${companyId}/projects/${projectId}/restore`, {
    method: 'PUT',
  });
}
```

**Step 2: 创建 AdminProjectDetailPage.tsx**

页面结构：
```
┌─ ← Back to Portfolio ─────────────────────────┐
│                                                 │
│  ◀ Prev   Project Title        Next ▶          │
│           style · location · year               │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │         Image Gallery                     │   │
│  │   (grid of all project images)            │   │
│  │   [Add Image] button                      │   │
│  │   Each image has × delete button          │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  Description: [editable textarea]               │
│  Title: [editable input]                        │
│  Style: [editable input]                        │
│  Location: [editable input]                     │
│  Year: [editable input]                         │
│                                                 │
│  [Save Changes]  [Delete Project]               │
└─────────────────────────────────────────────────┘
```

功能：
- URL: `/admin/companies/:companyId/projects/:projectId`
- 从 URL params 获取 companyId 和 projectId
- 加载项目详情 + 同公司所有项目列表（用于左右切换）
- 左右箭头切换到上一个/下一个项目（更新 URL）
- 编辑表单：标题、描述、风格、地点、年份
- 图片画廊：显示所有图片，可删除、可添加
- Save 按钮调 updateAdminProject
- Delete 按钮调 deleteAdminProject（确认对话框）
- Back 按钮返回公司详情页

**Step 3: 添加路由**

在 App.tsx 中添加：
```typescript
<Route path="/admin/companies/:companyId/projects/:projectId" element={<AdminProjectDetailPage />} />
```

**Step 4: 在公司详情页添加入口**

在 AdminRegisteredCompanyDetailPage 和 AdminCompanyDetailPage 的项目卡片上：
- 点击图片 → navigate 到 `/admin/companies/${companyId}/projects/${projectId}`
- 在 Portfolio 标题旁加 "Add Project" 按钮

**Step 5: Commit**

```bash
git commit -m "feat(admin): add project detail page with CRUD and image management"
```

---

### Task 11: 后端 — 30天定时清理

**Files:**
- Create: `server/src/lib/cleanupScheduler.ts`
- Modify: `server/src/app.ts`

**Step 1: 创建定时清理模块**

```typescript
import { pool } from '../config/database'; // 或实际的数据库连接路径

export function startCleanupScheduler() {
  // 每天凌晨 3 点运行
  const INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  async function cleanup() {
    try {
      // 1. 清理 30 天前软删除的 inquiries
      const [inquiries] = await pool.query(
        `SELECT * FROM design_inquiries WHERE deleted_at < NOW() - INTERVAL 30 DAY`
      );
      if ((inquiries as any[]).length > 0) {
        // 先存快照到审计日志
        await pool.query(
          `INSERT INTO admin_audit_log (admin_id, admin_name, action, target_type, target_ids, reason, metadata)
           VALUES (0, 'system', 'hard_delete_expired', 'inquiry', ?, '30-day retention expired', ?)`,
          [JSON.stringify((inquiries as any[]).map(i => i.id)), JSON.stringify(inquiries)]
        );
        // 硬删除
        await pool.query(`DELETE FROM design_inquiries WHERE deleted_at < NOW() - INTERVAL 30 DAY`);
        console.log(`[cleanup] Hard-deleted ${(inquiries as any[]).length} expired inquiries`);
      }

      // 2. 清理 30 天前软删除的 projects
      const [projects] = await pool.query(
        `SELECT id, title, company_profile_id FROM projects WHERE deleted_at < NOW() - INTERVAL 30 DAY`
      );
      if ((projects as any[]).length > 0) {
        await pool.query(
          `INSERT INTO admin_audit_log (admin_id, admin_name, action, target_type, target_ids, reason, metadata)
           VALUES (0, 'system', 'hard_delete_expired', 'project', ?, '30-day retention expired', ?)`,
          [JSON.stringify((projects as any[]).map(p => p.id)), JSON.stringify(projects)]
        );
        await pool.query(`DELETE FROM projects WHERE deleted_at < NOW() - INTERVAL 30 DAY`);
        console.log(`[cleanup] Hard-deleted ${(projects as any[]).length} expired projects`);
      }
    } catch (err) {
      console.error('[cleanup] Error:', err);
    }
  }

  // 启动时运行一次，之后每 24 小时
  cleanup();
  setInterval(cleanup, INTERVAL);
}
```

**Step 2: 在 app.ts 启动**

在服务器启动后调用：
```typescript
import { startCleanupScheduler } from './lib/cleanupScheduler';
// 在 app.listen 回调中：
startCleanupScheduler();
```

**Step 3: Commit**

```bash
git commit -m "feat(api): add 30-day cleanup scheduler for soft-deleted records"
```

---

### Task 12: 验证 + 部署前门禁

**Step 1: 后端构建**

```bash
cd server && npx tsc
```

**Step 2: 前端构建**

```bash
cd .. && ./node_modules/.bin/tsc --noEmit --skipLibCheck && ./node_modules/.bin/vite build
```

**Step 3: 跑 harness 门禁**

```bash
bash scripts/harness/pre-deploy-gate.sh
```

**Step 4: 本地测试**

```bash
npm run dev:all
```

手动测试：
- 公司列表无 Type 列
- Home Order 计数显示，第 7 个被拦截
- 询盘批量删除 + 回收站恢复
- 红点进入页面后消失
- 案例无状态标签
- 案例详情页可编辑/删除/左右切换

**Step 5: Commit**

```bash
git commit -m "chore: verify all admin improvements pass gate"
```
