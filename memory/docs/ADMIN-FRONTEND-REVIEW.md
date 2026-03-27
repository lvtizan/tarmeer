# Tarmeer 管理后台前端检查报告

**检查范围**：路由 `/admin`、`/admin/designers`、`/admin/stats`、`/admin/admins`、`/admin/login`、`/admin/install`；AdminLayout、各 Admin 页面、PasswordInput；设计系统主色 #b8864a、表格/卡片、响应式、加载/错误/空状态；按钮反馈、分页、弹窗、表单校验。

**结论概要**：主色与焦点样式基本符合设计系统，权限与侧栏高亮正确；存在 **URL 与筛选不同步**、**仪表盘/列表错误态缺失**、**部分交互与可访问性** 问题，以及 **移动端侧栏未适配**。建议优先修复「待审核」链接生效、错误态展示与响应式侧栏。

---

## 1. 布局与导航

### 1.1 侧栏高亮

- **结论**：正确。`NavLink` 使用 `end={true}` 区分 `/admin` 与子路径，激活态为 `bg-[#b8864a] text-white`，与设计系统一致。
- **位置**：`src/components/admin/AdminLayout.tsx` 第 55–61、79–85 行。

### 1.2 权限控制（子管理员不显示「管理员管理」）

- **结论**：正确。`adminItems` 带 `superAdminOnly: true`，通过 `filteredAdminItems = adminItems.filter(item => !item.superAdminOnly || isSuperAdmin)` 过滤，仅 super_admin 看到 "Admin Users"。
- **位置**：`AdminLayout.tsx` 第 11–12、35–37、68–93 行。

### 1.3 登出与用户信息

- **结论**：合理。底部展示头像首字母、姓名、角色（Super Admin / Sub Admin），"Sign out" 全宽按钮。
- **建议**：
  - 登出按钮未使用设计系统焦点样式，键盘聚焦不可见。建议增加 `focus-visible:ring-2 focus-visible:ring-[#b8864a]/40`（或复用 `.focus-primary`）。
  - **文件/行号**：`AdminLayout.tsx` 第 112–117 行。

### 1.4 路由与 Statistics

- `/admin/stats` 当前渲染的是 `AdminDashboardPage`（与 `/admin` index 相同），仪表盘内已含统计，功能上可接受。若产品希望 Statistics 为独立页（例如更详细图表），可再拆出 `AdminStatsPage` 并单独路由。

---

## 2. 仪表盘（AdminDashboardPage）

### 2.1 数字卡片与统计展示

- **结论**：四张概览卡片（Pending / Approved / Rejected / Total）、Daily Profile Views 条形图、Contact Interactions 四格数据、Top Designers 表格，结构清晰；主色 `#b8864a` 用于条形图与排名徽章，符合设计系统。
- **位置**：`src/pages/admin/AdminDashboardPage.tsx` 第 72–126、128–200、202–256 行。

### 2.2 链接「待审核」「管理排序」

- **结论**：「Review pending designers →」指向 `/admin/designers?status=pending`，「Manage order →」指向 `/admin/designers`，仅当 `hasPermission('can_approve')` / `hasPermission('can_sort')` 时显示，逻辑正确。
- **问题**：设计师列表页 **未从 URL 读取 `status`**，用户从仪表盘点击「待审核」进入后，列表仍为「All」，未自动应用 `status=pending` 筛选。
- **建议**：在 `AdminDesignersPage` 使用 `useSearchParams()`，初始化时若存在 `?status=pending`（或 approved/rejected），将 `statusFilter` 设为该值；筛选变更时同步更新 URL（或至少进入时同步一次）。
- **文件**：`src/pages/admin/AdminDesignersPage.tsx`（当前未使用 `useSearchParams`）。

### 2.3 空数据与有数据

- **结论**：Daily Views 与 Contact Interactions 在 `dailyStats.length === 0` 时显示 "No data yet"；Top Designers 在无数据时显示 "No approved designers yet"，空状态完整。

### 2.4 错误状态

- **问题**：`loadData()` 的 `catch` 仅 `console.error`，未设置组件内错误状态，接口失败时界面仍为加载完成后的空数据，用户无法感知失败。
- **建议**：增加 `error` 状态（如 `const [error, setError] = useState<string | null>(null)`），在 catch 中 `setError(err.message)`，在内容区上方展示错误提示（可带重试按钮）；加载中与错误态互斥。
- **文件/行号**：`AdminDashboardPage.tsx` 第 43–53 行。

---

## 3. 设计师列表（AdminDesignersPage）

### 3.1 表格可读性与状态标签

- **结论**：表头与列（Designer、Contact、Status、Views、Projects、Registered、Actions）清晰；状态用 `getStatusBadge` 渲染为 `rounded-full` 的 pending/approved/rejected 标签，颜色区分明确（黄/绿/红）。
- **位置**：第 155–165、275–334 行。

### 3.2 操作按钮（通过/拒绝/批量）

- **结论**：单条 Approve/Reject 仅对 `status === 'pending'` 显示；批量「Approve Selected (n)」在勾选且 `canApprove` 时显示；拒绝前需填写原因并弹窗确认，逻辑正确。
- **建议**：
  - 错误反馈统一用 `alert()`，体验较差。建议改为页面顶部或弹窗内的错误条（可关闭），与登录/安装页错误展示方式一致。
  - **文件/行号**：第 77–78、96–98、114–116、125–126、354–364 行。

### 3.3 搜索与筛选、分页

- **结论**：Status 下拉（All/Pending/Approved/Rejected）、搜索框（name/email/city）、分页（Previous / Page x of y / Next）存在且与 `loadDesigners` 联动；`total > 20` 且 `viewMode === 'list'` 时显示分页，逻辑正确。
- **问题**：见 2.2，URL `?status=pending` 未与 `statusFilter` 同步。

### 3.4 排序模式（上下移动与保存）

- **结论**：Sort Order 模式下为卡片列表，每行有上/下箭头调整顺序，底部「Save Display Order」调用 `updateDesignerOrder(sortOrder)`；仅 `canSort` 时显示「Sort Order」按钮与排序 UI，逻辑正确。
- **建议**：
  - 排序用箭头为 Unicode 字符（↑/↓），无 `aria-label`，屏幕阅读器不友好。建议改为 `<button aria-label="Move up">` / `aria-label="Move down"`，或使用带 alt 的图标。
  - **文件/行号**：第 382–395 行。

### 3.5 拒绝原因弹窗

- **结论**：弹窗含设计师名、必填的 Rejection Reason 文本框、Cancel / Reject Designer；`!rejectReason.trim()` 时禁用提交，并 `alert('Please provide a rejection reason')`。
- **建议**：将「Please provide a rejection reason」改为弹窗内文案（例如在 textarea 下方显示红色提示），与设计系统及登录页错误展示一致，避免使用 `alert`。
- **文件/行号**：第 406–413、364–365 行。

---

## 4. 管理员列表（AdminAdminsPage）

### 4.1 表格与创建子管理员

- **结论**：表格展示 Admin、Role、Permissions、Status、Last Login、Actions；创建子管理员弹窗含 Full Name、Email、Password、Permissions 勾选，校验「必填」与「密码至少 8 位」，错误信息在弹窗内红色区域展示，体验一致。
- **位置**：`src/pages/admin/AdminAdminsPage.tsx` 第 140–225、223–348 行。

### 4.2 密码输入组件一致性

- **问题**：创建子管理员弹窗中的密码框为原生 `<input type="password">`，未使用 `PasswordInput`，无「显示/隐藏密码」切换，与登录/安装页不一致。
- **建议**：将该密码输入替换为 `PasswordInput`，保持与设计系统及登录/安装页一致（含 `pr-10`、焦点环、显隐切换）。
- **文件/行号**：`AdminAdminsPage.tsx` 第 266–283 行。

---

## 5. 登录页与安装页

### 5.1 表单与错误提示

- **结论**：登录（AdminLoginPage）、安装（AdminInstallPage）均使用 `PasswordInput`；错误信息在表单上方以 `bg-red-50 border border-red-200 text-red-600` 展示，不依赖 `alert`，体验良好。

### 5.2 密码显隐与设计系统

- **结论**：`PasswordInput` 使用 `pr-10` 为右侧图标留空，焦点为 `focus:ring-2 focus:ring-[#b8864a]/40 focus:border-[#b8864a]`，与设计系统一致；显隐按钮为 `type="button"`、`tabIndex={-1}`，避免表单提交与多余 Tab 停留。
- **位置**：`src/components/admin/PasswordInput.tsx` 第 31–57 行。

### 5.3 主按钮与焦点

- **结论**：登录/安装页提交按钮为 `bg-[#b8864a] hover:bg-[#a67c47]`，与设计系统一致。若希望与全站 `.btn-primary` 完全统一，可改为 `className="... btn-primary"` 并补 `focus-visible` 样式（当前未显式加 focus 环，但全局 `button:focus-visible` 已处理）。

---

## 6. 问题与建议汇总

### 6.1 功能/UX

| 问题 | 位置 | 建议 |
|------|------|------|
| 仪表盘「待审核」链接带 `?status=pending`，但设计师列表不读 URL | AdminDesignersPage | 使用 `useSearchParams` 初始化并同步 `statusFilter` 与 URL |
| 仪表盘接口失败无界面提示 | AdminDashboardPage 第 43–53 行 | 增加 `error` 状态与错误区/重试 |
| 设计师列表/排序错误、拒绝原因校验用 `alert` | AdminDesignersPage 多处 | 改为页面内错误条或弹窗内文案 |
| 拒绝原因未填时仅 alert | AdminDesignersPage 第 85–87、364–365 行 | 在弹窗内 textarea 下方显示红色提示文案 |

### 6.2 样式与设计系统

| 问题 | 位置 | 建议 |
|------|------|------|
| 仪表盘「Contact Interactions」使用 blue/green/purple/amber | AdminDashboardPage 第 168–193 行 | 设计系统建议以主色衍生；可改为主色/灰阶或保留语义色但在文档中说明 |
| 管理员创建弹窗未使用 PasswordInput | AdminAdminsPage 第 266–283 行 | 改用 PasswordInput，与登录/安装一致 |

### 6.3 可访问性

| 问题 | 位置 | 建议 |
|------|------|------|
| 侧栏「Sign out」无可见焦点环 | AdminLayout 第 112–117 行 | 为按钮添加 `focus-visible:ring-2 focus-visible:ring-[#b8864a]/40` |
| 排序模式上下箭头无 aria-label | AdminDesignersPage 第 382–395 行 | 为两个按钮添加 `aria-label="Move up"` / `"Move down"` |
| 弹窗/模态框未做焦点陷阱与 Esc 关闭 | 拒绝弹窗、创建管理员弹窗 | 可选：使用焦点陷阱、Esc 关闭、`aria-modal="true"`、`role="dialog"` |

### 6.4 响应式

| 问题 | 位置 | 建议 |
|------|------|------|
| 侧栏固定 `w-64`，小屏不折叠 | AdminLayout 第 42–43 行 | 小屏下改为抽屉/折叠（如 `md:w-64` + 移动端汉堡菜单 + 遮罩），保证主内容区可读 |

### 6.5 其他

- **Loading 统一**：各页 Loading 多为 "Loading..." 文案，可考虑统一为同一组件（如带 logo 或 spinner），与设计系统统一。
- **分页**：当前仅「上一页/下一页」与页码文案，若总页数较多，可后续增加跳页或每页条数选择（非必须）。

---

## 7. 检查清单速览

| 项目 | 状态 |
|------|------|
| 侧栏高亮当前路由 | 通过 |
| 子管理员不显示「管理员管理」 | 通过 |
| 登出与用户信息展示 | 通过（建议补焦点样式） |
| 仪表盘数字卡片与图表 | 通过 |
| 仪表盘「待审核」「管理排序」链接 | 链接有效，但 status 未从 URL 同步 |
| 仪表盘空状态 | 通过 |
| 仪表盘错误状态 | 缺失，需补充 |
| 设计师列表表格与状态标签 | 通过 |
| 通过/拒绝/批量操作 | 通过（建议错误不用 alert） |
| 搜索、筛选、分页 | 通过 |
| 排序模式上下移动与保存 | 通过（建议 aria-label） |
| 拒绝原因弹窗校验提示 | 建议改为内联提示 |
| 登录/安装页表单与错误 | 通过 |
| PasswordInput 显隐与样式 | 通过 |
| 管理员创建弹窗密码框 | 建议改用 PasswordInput |
| 主色 #b8864a 与焦点环 | 基本符合 |
| 响应式侧栏 | 未做移动端适配 |

以上为本次管理后台前端检查的结论与具体建议；标注的文件与行号可直接用于修改定位。
