# Admin 数据分析合并 + 操作记录 — 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把 4 个 Admin 数据页面合并为 1 个双 tab 页面（注册数据 + 访客数据），新增操作记录页面，全部用 Recharts 图表可视化。

**Architecture:** 前端用 Recharts 替换手写 SVG 图表，后端新增 activity_log 表 + 写入中间件 + 2 个新 API。现有 API 端点保留复用，不改后端数据接口。

**Tech Stack:** Recharts, React 18, TypeScript, Express, MySQL

**执行工作流:** 按 CLAUDE.md 的 harness 流程 — 写代码 → 本地 dev:all → 手动验证 → pre-deploy-gate → 部署

---

## Phase 1: 基础设施（后端）

### Task 1: 安装 Recharts + 创建 activity_log 表

**Files:**
- Modify: `package.json` — 添加 recharts 依赖
- Modify: `server/src/lib/autoMigrate.ts` — 添加 activity_log 表定义

**Step 1:** 安装 recharts
```bash
npm install recharts
```

**Step 2:** 在 autoMigrate.ts 的 tables 数组末尾添加 activity_log 表
```typescript
{
  name: 'activity_log',
  sql: `CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    user_name VARCHAR(100),
    user_role VARCHAR(20),
    action VARCHAR(50) NOT NULL,
    target_type VARCHAR(50),
    target_id INT,
    target_name VARCHAR(200),
    description TEXT,
    ip VARCHAR(45),
    country VARCHAR(50),
    city VARCHAR(50),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_user_role (user_role),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    INDEX idx_target_type (target_type)
  )`,
},
```

**Step 3:** 本地验证 — 启动后端确认表自动创建
```bash
cd server && npx tsc && PORT=3099 DEV_SKIP_EMAIL=true node dist/app.js
# 看日志: [auto-migrate] Ensured table exists: activity_log
```

**Step 4:** Commit
```bash
git add package.json package-lock.json server/src/lib/autoMigrate.ts
git commit -m "chore: add recharts + activity_log table"
```

---

### Task 2: 活动记录写入工具函数

**Files:**
- Create: `server/src/lib/activityLogger.ts`

**功能:** 一个 `logActivity()` 函数，各 controller 调用它写入 activity_log。

```typescript
// server/src/lib/activityLogger.ts
import pool from '../config/database';

interface ActivityEntry {
  userId: number | null;
  userName: string;
  userRole: 'admin' | 'company' | 'homeowner';
  action: string;       // create / update / delete / approve / reject / login / register
  targetType: string;   // project / company_profile / inquiry / user / session
  targetId?: number;
  targetName?: string;
  description: string;  // 可读中文描述
  ip?: string;
  country?: string;
  city?: string;
  metadata?: Record<string, any>;
}

export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    await pool.execute(
      `INSERT INTO activity_log (user_id, user_name, user_role, action, target_type, target_id, target_name, description, ip, country, city, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId, entry.userName, entry.userRole,
        entry.action, entry.targetType, entry.targetId || null,
        entry.targetName || null, entry.description,
        entry.ip || null, entry.country || null, entry.city || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]
    );
  } catch (err) {
    console.error('[ActivityLog] Write failed:', err);
    // fire-and-forget，不影响主流程
  }
}

// 从 req 提取 IP 的辅助函数
export function getClientIp(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.connection?.remoteAddress
    || '';
}
```

**Step 1:** 创建文件
**Step 2:** 编译验证 `npx tsc --noEmit`
**Step 3:** Commit
```bash
git add server/src/lib/activityLogger.ts
git commit -m "feat: add activityLogger utility for activity_log writes"
```

---

### Task 3: 在关键 controller 中埋点写入 activity_log

**Files:**
- Modify: `server/src/controllers/userAuthController.ts` — login, register
- Modify: `server/src/controllers/companyProfileController.ts` — upsertProfile
- Modify: `server/src/controllers/projectController.ts` — create/update/delete project
- Modify: `server/src/controllers/inquiryController.ts` — submit inquiry
- Modify: `server/src/controllers/roleAdminController.ts` — approve/reject/delete
- Modify: `server/src/controllers/companyAdminController.ts` — bind company

**原则:** 每个埋点用 `setImmediate(() => logActivity(...).catch(() => {}))` 异步写入，不阻塞主请求。

**每个埋点格式:**
```typescript
import { logActivity, getClientIp } from '../lib/activityLogger';

// 在操作成功后:
setImmediate(() => {
  logActivity({
    userId: req.user?.userId || null,
    userName: '...',
    userRole: 'company',
    action: 'create',
    targetType: 'project',
    targetId: projectId,
    targetName: projectTitle,
    description: `上传了项目「${projectTitle}」`,
    ip: getClientIp(req),
  }).catch(() => {});
});
```

**需要埋点的位置（15 处）:**

1. `userAuthController.ts` `login()` 成功后 — action: login
2. `userAuthController.ts` `register()` 成功后 — action: register
3. `userAuthController.ts` `oauthCallback()` 成功后 — action: login
4. `companyProfileController.ts` `upsertProfile()` — action: update, targetType: company_profile
5. `projectController.ts` 创建项目成功后 — action: create, targetType: project
6. `projectController.ts` 编辑项目成功后 — action: update, targetType: project
7. `projectController.ts` 删除项目成功后 — action: delete, targetType: project
8. `inquiryController.ts` 提交询盘成功后 — action: create, targetType: inquiry
9. `roleAdminController.ts` `approveCompany()` — action: approve
10. `roleAdminController.ts` `rejectCompany()` — action: reject
11. `roleAdminController.ts` `deleteCompanyProfile()` — action: delete
12. `roleAdminController.ts` `deleteUser()` — action: delete, targetType: user
13. `companyAdminController.ts` `bindUserToCompany()` — action: bind
14. `companyAdminController.ts` `adminCreateProject()` — action: create, targetType: project
15. `homeownerController.ts` 编辑资料 — action: update, targetType: homeowner_profile

**Step 1:** 逐个文件添加 import + 埋点
**Step 2:** `npx tsc --noEmit` 编译验证
**Step 3:** 本地启动，执行一次登录，检查 activity_log 表有记录
**Step 4:** Commit
```bash
git commit -m "feat: add activity logging to 15 controller actions"
```

---

### Task 4: 操作记录后端 API

**Files:**
- Create: `server/src/controllers/activityLogController.ts`
- Modify: `server/src/routes/admin.ts` — 挂载路由

**API 1: GET /api/admin/activity-log**

Query params: page, limit, role, action, target_type, search, start_date, end_date

返回:
```json
{
  "logs": [
    {
      "id": 1,
      "user_id": 10,
      "user_name": "Zhang Design",
      "user_role": "company",
      "action": "create",
      "target_type": "project",
      "target_id": 55,
      "target_name": "Modern Villa",
      "description": "上传了项目「Modern Villa」",
      "ip": "185.x.x.x",
      "country": "UAE",
      "city": "Dubai",
      "created_at": "2026-04-20T14:30:00Z"
    }
  ],
  "pagination": { "page": 1, "limit": 30, "total": 156 }
}
```

**API 2: GET /api/admin/activity-log/stats**

返回:
```json
{
  "today": { "total": 45, "active_companies": 8, "active_homeowners": 12, "admin_actions": 5 },
  "action_distribution": [
    { "action": "create", "count": 20 },
    { "action": "update", "count": 15 },
    { "action": "login", "count": 30 }
  ],
  "daily_trend": [
    { "date": "2026-04-20", "admin": 5, "company": 20, "homeowner": 15 }
  ]
}
```

**API 3: GET /api/admin/stats/registration-sources**

返回注册来源 + 装企类型分布（给前端饼图用）:
```json
{
  "signup_sources": [
    { "source": "for-companies-landing", "count": 25 },
    { "source": "google-oauth", "count": 10 }
  ],
  "company_types": [
    { "type": "design_studio", "count": 8 },
    { "type": "renovation_company", "count": 12 }
  ]
}
```

**路由挂载** 在 admin.ts:
```typescript
import { getActivityLogs, getActivityLogStats } from '../controllers/activityLogController';
import { getRegistrationSources } from '../controllers/designerAdminController';

router.get('/activity-log', requirePermission('can_view_stats'), getActivityLogs);
router.get('/activity-log/stats', requirePermission('can_view_stats'), getActivityLogStats);
router.get('/stats/registration-sources', requirePermission('can_view_stats'), getRegistrationSources);
```

**Step 1:** 创建 activityLogController.ts
**Step 2:** 在 designerAdminController.ts 添加 getRegistrationSources
**Step 3:** 挂载路由
**Step 4:** 编译验证 + 本地测试 curl
**Step 5:** Commit
```bash
git commit -m "feat: add activity-log + registration-sources API endpoints"
```

---

### Task 5: adminApi.ts 前端 API 函数

**Files:**
- Modify: `src/lib/adminApi.ts`

添加 3 个函数:
```typescript
getActivityLogs(params: { page?: number; limit?: number; role?: string; action?: string; search?: string; start_date?: string; end_date?: string })
getActivityLogStats()
getRegistrationSources()
```

**Commit:**
```bash
git commit -m "feat: add activity log + registration sources to adminApi"
```

---

## Phase 2: 前端 — 合并数据分析页

### Task 6: 创建合并后的 AdminAnalyticsPage（注册数据 tab）

**Files:**
- Rewrite: `src/pages/admin/AdminAnalyticsPage.tsx` — 完全重写为双 tab 页面
- Delete: `src/pages/admin/AdminDashboardPage.tsx` — 功能并入
- Delete: `src/pages/admin/AdminStatsPage.tsx` — 功能并入
- Delete: `src/pages/admin/AdminVisitorsPage.tsx` — 功能并入

**注册数据 tab 包含:**
1. 时间范围选择器（7/30/90 天）
2. 3 张汇总卡片 + 环比
3. 每日注册趋势图（Recharts BarChart，可切 AreaChart）
4. 两个饼图并排: 注册来源分布 + 装企类型分布（Recharts PieChart）
5. 14 天明细表（可展开行）

**数据来源:** 复用现有 `adminApi.getDailyStats()` + 新增 `adminApi.getRegistrationSources()`

**Step 1:** 重写 AdminAnalyticsPage.tsx，先实现注册数据 tab
**Step 2:** `npx tsc --noEmit` 编译
**Step 3:** 本地 `npm run dev` 打开 /admin 验证图表渲染
**Step 4:** Commit
```bash
git commit -m "feat: analytics page — registration data tab with Recharts"
```

---

### Task 7: 访客数据 tab

**在 AdminAnalyticsPage.tsx 中添加第二个 tab:**

1. 6 张汇总卡片 + 环比
2. 每日访问趋势图（Recharts ComposedChart — 柱状+折线双轴）
3. 热门装企访问量（水平 BarChart）
4. 热门页面排行表
5. 访客 IP 列表（分页）
6. 权重配置（折叠面板）

**数据来源:** 复用现有 `adminApi.getAnalyticsOverview()` + `getCompanyVisitors()` + `getVisitors()` + `getWeightConfig()`

**Step 1:** 添加访客数据 tab 内容
**Step 2:** 本地验证
**Step 3:** Commit
```bash
git commit -m "feat: analytics page — visitor data tab with charts"
```

---

### Task 8: 删除旧页面 + 更新路由

**Files:**
- Delete: `src/pages/admin/AdminDashboardPage.tsx`
- Delete: `src/pages/admin/AdminStatsPage.tsx`
- Delete: `src/pages/admin/AdminVisitorsPage.tsx`
- Modify: `src/App.tsx` — 删除旧路由，/admin 指向新 AnalyticsPage
- Modify: `src/components/admin/AdminLayout.tsx` — 侧边栏调整

**侧边栏改动:**
- 删除 Stats Report 和 Visitors 入口
- /admin 的 label 从 "Analytics" 改为 "数据分析"
- 「公司」→「装企」（Companies label）
- 准备「操作记录」入口（Task 9 实现页面后启用）

**Step 1:** 删除 3 个旧页面文件
**Step 2:** 更新 App.tsx 路由
**Step 3:** 更新 AdminLayout.tsx 侧边栏
**Step 4:** `npx tsc --noEmit` 编译（确认无残留引用）
**Step 5:** 本地验证导航和页面
**Step 6:** Commit
```bash
git commit -m "refactor: remove 3 old admin pages, merge into analytics"
```

---

## Phase 3: 前端 — 操作记录页

### Task 9: AdminActivityLogPage

**Files:**
- Create: `src/pages/admin/AdminActivityLogPage.tsx`
- Modify: `src/App.tsx` — 添加 /admin/activity-log 路由
- Modify: `src/components/admin/AdminLayout.tsx` — 启用操作记录入口

**页面包含:**
1. 4 张汇总卡片（今日操作、活跃装企、活跃业主、管理操作）
2. 两个图表并排: 操作类型分布饼图 + 每日操作趋势面积图
3. 筛选栏（角色、操作类型、搜索、日期范围）
4. 操作记录列表（聚合展示 + 展开明细 + 可点击链接）
5. 分页 + CSV 导出按钮

**颜色规则:**
- 创建/审批: 绿色左边框
- 删除/拒绝: 红色左边框
- 编辑/更新: 黄色左边框
- 登录: 灰色左边框

**聚合逻辑（前端实现）:**
从 API 拿到 flat 列表后，前端按 user_id + date + action + target_type 分组聚合。

**Step 1:** 创建 AdminActivityLogPage.tsx
**Step 2:** App.tsx 添加路由
**Step 3:** AdminLayout.tsx 添加侧边栏入口（ClipboardList icon）
**Step 4:** 本地验证
**Step 5:** Commit
```bash
git commit -m "feat: add activity log page with charts, filters, aggregation"
```

---

## Phase 4: 验证 & 部署

### Task 10: Harness 测试

**Files:**
- Create: `scripts/harness/test-analytics-merge.mjs`
- Create: `docs/testing/admin-analytics-merge.md`

**测试用例:**
- TC-1: /admin 页面加载，注册数据 tab 显示 3 张卡片 + 图表
- TC-2: 切换到访客数据 tab，显示 6 张卡片 + 图表
- TC-3: 7/30/90 天切换器正常工作
- TC-4: /admin/activity-log 页面加载
- TC-5: activity_log API 返回正确数据
- TC-6: registration-sources API 返回 signup_sources + company_types
- TC-7: 旧路由 /admin/stats、/admin/visitors 不再存在（404 或重定向）
- TC-8: 侧边栏显示「数据分析」和「操作记录」
- TC-9: CSV 导出功能
- TC-10: 登录操作写入 activity_log

**Step 1:** 写测试用例文档
**Step 2:** 写 harness 脚本
**Step 3:** 启动本地服务器运行 harness
**Step 4:** Commit
```bash
git commit -m "test: add analytics merge harness tests"
```

### Task 11: Pre-deploy + 部署

**Step 1:** `bash scripts/harness/pre-deploy-gate.sh`
**Step 2:** 确认用户批准部署
**Step 3:** 后端先部署 `./deploy-backend-ecs.sh`
**Step 4:** 验证 API health + activity_log 表创建
**Step 5:** 前端部署 `vite build + rsync`
**Step 6:** 冒烟测试 `node scripts/harness/smoke-production.mjs`
**Step 7:** Commit version bump

---

## 已知 bug（顺手修）

- 装企列表页顶部搜索装企名字没有返回数据（在 Task 8 调整侧边栏时排查）

---

## 执行顺序总结

| Phase | Task | 说明 | 预计 |
|-------|------|------|------|
| 1 | T1 | recharts + activity_log 表 | 5min |
| 1 | T2 | activityLogger 工具函数 | 5min |
| 1 | T3 | 15 处 controller 埋点 | 20min |
| 1 | T4 | 操作记录 API（3 个端点） | 15min |
| 1 | T5 | adminApi 前端函数 | 5min |
| 2 | T6 | 注册数据 tab + Recharts | 30min |
| 2 | T7 | 访客数据 tab + Recharts | 25min |
| 2 | T8 | 删旧页面 + 路由 + 侧边栏 | 10min |
| 3 | T9 | 操作记录页面 | 30min |
| 4 | T10 | harness 测试 | 15min |
| 4 | T11 | 部署 | 10min |
