# Tarmeer 4.0 — Agent Guide

## Quick Nav

| Topic                    | Location                              |
|--------------------------|---------------------------------------|
| Architecture overview    | `ARCHITECTURE.md`                     |
| UI/Design rules          | `docs/DESIGN.md`                      |
| Frontend conventions     | `docs/FRONTEND.md`                    |
| Reliability invariants   | `docs/RELIABILITY.md`                 |
| SEO rules                | `docs/SEO.md`                         |
| Security policies        | `docs/SECURITY.md`                    |
| Deploy checklist         | `docs/operations/deploy-runbook.md`   |
| Test cases               | `docs/testing/`                       |
| Product specs            | `docs/product-specs/`                 |
| Incident log             | `docs/incident-log/`                  |
| Superpowers (skills)     | `docs/superpowers/`                   |
| Harness tools            | `scripts/harness/README.md`           |
| **Component inventory**  | **`docs/admin-components.md`**        |

---

## Language Rule (ABSOLUTE)

**NO CHINESE ON THE PUBLIC-FACING FRONTEND.** This applies to all pages visible to end users (everything outside `/admin`). Specifically:

- All UI text, labels, button copy, tooltips, error messages, placeholders, and headings must be in English.
- All hardcoded strings in `.tsx`/`.ts` frontend files under `src/` (excluding `src/pages/admin/`, `src/components/admin/`) must be English-only.
- When writing new data (supplier names, descriptions, company entries) to the database via scripts, all user-visible content must be English-only.
- Chinese is allowed **only** in `src/pages/admin/` and `src/components/admin/` (the internal admin panel used by Chinese-speaking staff).

Violation examples (forbidden in public pages):
- `"保存中..."` → must be `"Saving..."`
- `"供应商名称"` → must be `"Supplier Name"`
- `"(春蕾绿茵)"` in a supplier description → must be removed

---

## Critical Rules (never skip)

1. **Deploy**: MUST read `docs/operations/deploy-runbook.md` before ANY deploy.
2. **Data merge**: directory companies (`uae_companies`) BEFORE approved companies (`company_profiles`) — see `ARCHITECTURE.md` § Company Data Merge.
3. **New subdomain**: MUST update CORS whitelist in `server/src/lib/corsOrigins.ts`.
4. **Images**: NEVER store base64 in DB — see Image Storage Rules below.
5. **Test**: MUST run related test cases before deploy — see `docs/testing/`.
6. **Frontend + Backend must match**: if frontend calls a new API, backend must be deployed first.
7. **New page (any kind)**: MUST read `docs/admin-components.md` BEFORE writing any JSX. Map every UI element to existing components. New entity list → extend `AdminGlobalSearch`. New controller function → wire route immediately. Public-facing page → full `<Helmet>` SEO block required + add to `lint-seo.mjs` PUBLIC_PAGES + run `node scripts/harness/lint-seo.mjs`.
8. **SEO**: all public-facing pages MUST have `<Helmet>` with title, description, og:title, og:description, og:image, canonical. Detail pages MUST include JSON-LD structured data. Run `node scripts/harness/lint-seo.mjs` to verify — see `docs/SEO.md`.
9. **Feature completion workflow**: MUST follow the 5-step workflow below before notifying user.
10. **替换已有功能时**：必须同时删除旧实现（state、hooks、JSX、import），不能只加新代码。完成后跑 `npx tsc --noEmit` 确认无未使用变量。
11. **相似页面必须复用结构**：开始写任何新页面或改版前，先找最相似的已有页面，直接复用其布局骨架、组件结构和交互模式，只替换数据层。禁止从零重写已有相似结构。
12. **PC 端与移动端逻辑必须一致**：任何涉及表单、上传、数据提交、页面路由的功能，写代码前必须同时阅读 PC 端和移动端的现有实现，确认以下三点完全一致：（1）交互逻辑（触发条件、校验规则、跳转行为）；（2）数据传输逻辑（API endpoint、payload 结构、字段名）；（3）组件/页面路由（移动端底部导航指向的页面必须与 PC 端侧边栏指向的页面使用相同组件）。如果发现不一致，必须在本次改动中同步修复，不得遗留分叉。
12. **改完代码后的自动流程**：Stop hook 会在每次 Claude 停止时自动运行 tsc 检查（仅当本次 session 修改了 src/ 或 server/src/ 中的 TS/TSX/JS 文件时触发）。tsc 通过后，Claude 必须：（1）运行相关 harness 测试用例；（2）提供本地测试地址（`http://localhost:5173/` 对应路径）；（3）告知用户改了什么 + 测试结果；（4）等用户确认后才能部署。**tsc 失败时 Claude 会被自动唤醒修复，不需要用户介入。**
13. **新路由必须有 harness 覆盖**：新增任何后端路由（`router.get/post/put/patch/delete`）后，必须同时在对应 harness 脚本里补充测试用例（至少覆盖：正常返回码、无 token → 401、无权限 → 403）。路由覆盖用 `node scripts/harness/lint-route-coverage.mjs` 验证。未覆盖的路由不允许部署。
14. **部署流程（用户说"部署"时的完整自动流程）**：
    1. 运行 `node scripts/harness/lint-route-coverage.mjs`（路由注册检查）
    2. 运行本次功能相关的 harness 测试脚本
    3. 运行 `node scripts/harness/test-frozen-contracts.mjs`（契约检查）
    4. 所有测试全部 PASS 后，git push origin HEAD:main
    5. 再执行 `bash deploy-backend-ecs.sh`（如有后端改动）
    6. 再执行 `DEPLOY_SSH_KEY=~/.ssh/tarmeer_ecs DEPLOY_RULES_ACK=YES DEPLOY_USER_APPROVED=YES SKIP_SCHEMA_CHECK=YES bash deploy-simple.sh`
    7. 任何一步 FAIL → 停止，报告失败原因，不继续部署

---

## No Hardcoding Rules (MUST FOLLOW)

任何情况下都不得在代码中写死业务数据、配置值或状态值。违反此规则会导致数据与代码脱节，产生静默 bug（VIP 徽章消失、联系方式泄漏等均源于硬编码）。

### 禁止硬编码的场景

1. **布尔状态字段**：绝不写 `field = false` / `field = true` 作为字段赋值，必须从 DB 读取再转换（如 `!!(row.is_signed)`）。
2. **枚举/分类值**：新增业务类型（company_type、service_tag 等）必须同时更新：后端验证数组、数据库字段（VARCHAR 不用 ENUM）、前端 label 映射、i18n、表单选项。禁止在任意一处遗漏。
3. **API 响应字段**：SELECT 语句里没有的字段不得出现在响应对象里（结果是 `undefined`，`!!undefined === false` 静默出错）。新增响应字段必须同时加进 SELECT。
4. **权限级别**：路由 middleware 不得按"感觉"写 `requireSuperAdmin`，必须对照 `docs/SECURITY.md` 的权限矩阵。sub_admin 能操作的接口只用 `requireAdmin`。
5. **URL / 域名**：不得在代码里写死生产域名（`tarmeer.com`、`47.91.108.104` 等），使用环境变量（`VITE_API_URL`、`API_BASE`）。唯一例外：SEO `<Helmet>` 的 canonical / og:url 可写死生产域名。
6. **数据库连接信息**：所有 host/user/password 从 `.env` 读取，禁止直接写在代码里。
7. **图片路径扩展名**：不得假设上传文件的格式（`.webp` vs `.jpg`），路径从 DB 读取原样使用，或在存储时记录实际扩展名。
8. **分页 / 限制数字**：LIMIT/OFFSET 必须从参数读取并做整数校验，不得在 SQL 里写死（`LIMIT 10` 可以做默认值但要可覆盖）。

### 检查要点（每次写新代码前自查）

- 我写的这个值会变吗？→ 如果会，必须从配置/DB/参数读。
- 这个字段是 DB 里的布尔列？→ 用 `!!()` 转换，不要写 `= true/false`。
- 这个枚举值在几个地方用到？→ 列出所有地方，改一处必须全改。
- 这条 SQL 的 SELECT 包含响应对象用到的所有字段吗？→ 逐字段对照。

---

## Feature Completion Workflow (MUST FOLLOW)

Every feature MUST go through these steps before notifying the user. No exceptions.

### Step 0: Component Inventory Check (before any code)
**ALWAYS run this for any new page or UI feature — admin or public-facing.**
1. Run `node scripts/harness/lint-admin-ui.mjs --guide` — prints full component catalog
2. List every UI element the page needs (dropdowns, search, tooltips, modals, notifications, logo, phone, forms)
3. Map each element to the existing component from `docs/admin-components.md`
4. **Search**: decide if entity needs to be added to `AdminGlobalSearch` (any new admin list page → yes)
5. **Backend**: if new controller functions → open the routes file and add `router.*` NOW, before writing controller code
6. Only after this mapping is complete, start coding

### Step 1: Database Walk-through
- List ALL tables touched by this feature
- Trace FK relationships and shared fields (email, phone, user_id)
- **Auth features**: MUST check users, admin_users, company_profiles, designers tables
- Verify: every INSERT has matching SELECT, every UPDATE has matching read path

### Step 1.5: Pitfall Check (before coding)
- Read MEMORY.md pitfall records before starting development
- Check each pitfall against current feature for relevance
- Key pitfalls: image permissions (chmod), JSON field parsing (Array.isArray), prepared statement LIMIT/OFFSET, nginx route conflicts
- **Admin page changes**: MUST run `node scripts/harness/lint-admin-ui.mjs` before AND after coding
- **涉及图片/文件写入**：`fs.writeFile` 必须传 `{ mode: 0o644 }`，`fs.mkdir` 必须传 `{ mode: 0o755 }`，sharp `.toFile()` 后必须加 `fs.chmod(outPath, 0o644)`，否则文件 600 权限 → nginx 403
- **涉及 CSS 全局样式**：修改 `src/index.css` 前检查 `.btn-primary` 是否在 `@layer components {}` 内；在 `@layer` 外的组件样式会覆盖 Tailwind utilities（hidden/sm:hidden），导致移动端响应式失效

### Step 2: Write Test Cases
- Create/update test case doc in `docs/testing/`
- Cover: happy path, edge cases, error handling, permission checks
- **Auth features extra**: email delivery, phone collection, PhoneRequiredModal, role permissions
- **Company features extra**: company_profiles sync, CRM push, minimum project count

### Step 3: Local Automated Test
- Start local server: `PORT=3099 DEV_SKIP_EMAIL=true node dist/app.js`
- Run test cases via node script, verify API responses + DB state
- ALL cases must PASS before proceeding

### Step 4: Auto-commit
- Commit feature code + test case docs together
- Include test results in commit message (e.g. "Test results: 5/5 PASS")

### Step 4.5: Pre-deploy Pitfall Check
- rsync MUST use `--chmod=a+r` (macOS 600 permissions → nginx 403)
- New frontend API calls → deploy backend FIRST
- JSON fields: use `Array.isArray()` not `.split()`
- `pool.execute` LIMIT/OFFSET → use `pool.query` with integer concatenation
- nginx legacy URL rules must not conflict with valid routes
- **uploads 路径不可混淆**：用户上传文件由后端保存在 `/tarmeer/tarmeer_api/public/uploads/`，nginx 的 `/uploads/` location 必须 alias 到此路径。禁止改成 `tarmeer_web_portal/public/uploads/`（前端静态目录，无上传文件）。
- **手动 rsync supplier 图片**：rsync 到 `/tarmeer/tarmeer_api/public/uploads/suppliers/` 时必须加 `--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r`，否则 macOS 600 权限触发 403（服务器已有 default ACL + cron 兜底，但 rsync 本身加 --chmod 是第一道防线）
- **新建 uploads 子目录**：新的供应商/类型目录需要手动运行 `setfacl -R -d -m o::rx <新目录路径>` 使其继承 default ACL

### Step 5: Notify User
- Report: what was done, test results, ready to deploy or not
- Wait for user confirmation before deploying

---

## Image Storage Rules (MUST FOLLOW)

1. **NEVER** store images as base64 data URLs in the database. All image data must be saved to the filesystem under `/uploads/` and only the relative URL path stored in the DB.
2. Avatar uploads go to `/uploads/avatars/{id}-{uuid}.{ext}`.
3. Project images go to `/uploads/projects/{designerId}/{projectId}/{year}/{month}/{uuid}.{ext}`.
4. Use `projectImageStorage.ts` utilities (`persistProjectImages`, `isImageDataUrl`) for project images.
5. If you encounter existing base64 data in the DB, run `node scripts/migrate-base64-avatars.mjs --apply` to convert it.
6. Any API endpoint that accepts image data must validate and convert base64 to file before saving.

---

## UI/CSS Rules (MUST FOLLOW)

All pages MUST use the global design tokens defined in `src/index.css`. NEVER hardcode colors, font sizes, or input styles inline. Use these:

### Colors (CSS variables)
- `var(--color-tarmeer-primary)` = `#b8864a` — all accent, focus rings, active states
- `var(--color-tarmeer-text)` = `#2c2c2c` — primary text (AAA contrast on white)
- `var(--color-tarmeer-muted)` = `#6b6b6b` — secondary text (AA contrast)
- `var(--color-tarmeer-bg)` = `#faf9f7` — page background
- Placeholder text: `text-stone-400` (#a1a1a1)
- Labels: `text-stone-500` (#6b7280) at `text-sm` (14px)

### Text contrast (AAA = 7:1 minimum)
- Body text: `text-[#2c2c2c]` on white (contrast 12.6:1)
- Secondary: `text-[#6b6b6b]` on white (contrast 5.7:1 — AA)
- NEVER use `text-stone-300` for readable text. Only for decorative placeholders.

### Global component classes
- Primary button: `className="btn-primary"` (defined in index.css)
- Input fields: `h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white`
- Tags (selected): `bg-[#b8864a] text-white rounded-2xl`
- Tags (unselected): `border border-stone-200 text-stone-600 rounded-2xl`
- Cards: `bg-white rounded-2xl border border-stone-200 shadow-sm`

### Font sizes
- Page title: `text-xl font-bold` (20px)
- Section label: `text-sm font-medium` (14px)
- Body/input text: `text-[15px]`
- Small/meta: `text-xs` (12px)

### Border radius
All interactive elements use `rounded-2xl` (20px) to match global `--radius-2xl`.

### Global UI Components (MUST USE)
- **Logo**: Always use `<TarmeerLogo />` from `src/components/TarmeerLogo.tsx`. NEVER create inline logo markup.
- **Select/Dropdown**: Always use `<AdminSelect />` from `src/components/ui/AdminSelect.tsx`. NEVER use raw `<select>` tags.
- **Phone Validation**: Always use `validatePhone()` + `isPhoneComplete()` from `src/lib/phoneValidation.ts`. All phone inputs MUST have inline validation (fake number rejection, UAE prefix check).
- **Lead/Inquiry Forms**: Use `<LeadForm />` from `src/components/form/LeadForm.tsx` (when available). Configure via `fields` prop, NEVER duplicate form logic across pages. Existing forms (Banner, InquiryForm, CompanySignupForm) should be migrated to LeadForm when touched.

### Rules
1. NEVER create local `inputClass` constants — use the standard pattern above
2. NEVER use `text-sm` (14px) for main content — minimum `text-[15px]`
3. NEVER use colors outside the theme variables
4. All focus states use `ring-[#B8864A]/15` — no blue outlines
5. Labels always use `text-sm font-medium text-stone-500`
6. NEVER create inline logo/brand elements — use `<TarmeerLogo />`
7. NEVER use raw `<select>` — use `<AdminSelect />`
8. NEVER create new phone input without `phoneValidation.ts` validation
9. NEVER duplicate form logic — new lead/inquiry forms MUST use the shared `<LeadForm />` component (when built), or at minimum reuse `phoneValidation.ts` and `AdminSelect`
10. **移动端按钮与卡片必须适配移动端布局**：任何按钮或卡片在移动端（< sm/640px）必须满足以下要求：
    - 按钮：在 hero 或固定区域内，移动端不可见的按钮用 `hidden sm:inline-flex`；移动端底部单独提供全宽 CTA（`w-full sm:hidden`）；绝不在小屏幕上让按钮与标题文字并排挤压
    - 卡片：移动端单列（`grid-cols-1 sm:grid-cols-2`），内边距适当缩小（`p-4 sm:p-6`），图片高度用 `aspect-ratio` 而非固定高度
    - `btn-primary` 必须保持在 `@layer components` 内（`src/index.css`），否则 `hidden`/`sm:hidden` 等 Tailwind utilities 无法覆盖其 display，导致移动端按钮显示错误
11. **一个界面只允许一个主操作按钮（btn-primary），禁止重复**：同一页面内，功能相同的主按钮只能出现一次。典型违规：页面标题行右侧有"添加 X"，空状态（empty state）区块内又出现第二个"添加 X"。修复规则：
    - 空状态区块只放图标 + 文字说明，**不放任何按钮**
    - 唯一的主操作入口固定在页面标题行右侧
    - 检查方法：在组件中搜索 `btn-primary`，出现 2 次以上立即排查是否功能重复

---

## 双 Navbar 禁止规则（MUST FOLLOW）

双 Navbar 有两种来源，必须同时防范：

### 情形 A：Portal 路由嵌套在 `<Layout>` 内

**任何独立 Portal（Supplier Dashboard、Company Dashboard、Admin 等）的路由必须放在主站 `<Layout>` 之外。**

- 主站 `<Layout>` 包含 `<Navbar>`，所有放在其内的路由都会自动获得主站导航
- Supplier / Company / Admin 等有自己 header 的 Portal 路由必须与 `/auth` 同级，独立放在 `<Routes>` 顶层
- 正确做法（参考 `src/App.tsx`）：
  ```tsx
  // ✅ 正确 — 与 /auth 同级，在 <Layout> 之外
  <Route path="/supplier" element={<SupplierLayout />}>...</Route>

  // ❌ 错误 — 嵌套在 <Layout> 内，会双 Navbar
  <Route path="/*" element={<Layout>}>
    <Route path="/supplier" element={<SupplierLayout />}>...</Route>
  </Route>
  ```
- **每次新增 Portal 路由时，第一件事检查它是否在 `<Layout>` 外面**

### 情形 B：公共页面组件内部渲染了自己的 `<header>`

**任何路由在 `<Layout>` 内的页面组件，不得在 JSX 中渲染 `<header>`、`<nav>` 或任何充当顶栏功能的元素（含 TarmeerLogo + 导航链接的组合）。**

根因：`<Layout>` 已经渲染 `<Navbar>`，页面再出一个 `<header>` 就产生双顶栏。
典型错误（已在 `ForSuppliersPage.tsx` 出现过）：

```tsx
// ❌ 错误 — 此页面在 <Layout> 内，不能再有自己的 header
export default function ForSuppliersPage() {
  return (
    <>
      <header className="sticky top-0 ...">  {/* 双 Navbar！ */}
        <TarmeerLogo />
        <span>Supplier Portal</span>
      </header>
      ...
    </>
  );
}
```

**检查方法（写新页面 / 改页面时必做）：**
1. 在 `src/App.tsx` 搜索该页面的路径，确认它的父级是 `<Layout>` 还是独立 Portal Layout
2. 如果父级是 `<Layout>`：页面组件内禁止出现 `<header>`、`<nav>` 标签或 `<TarmeerLogo />` + 导航链接的组合
3. 如果父级是独立 Portal Layout（SupplierLayout、CompanyLayout、AdminLayout）：页面本身也不需要再加 `<header>`，layout 已处理

**快速自检命令（改完页面后跑）：**
```bash
grep -n "<header\|<nav " src/pages/<PageName>.tsx
# 有输出就需要确认：此页面是否在 <Layout> 内？如果是，必须删掉这个 header/nav
```

## Portal/Dashboard 内容区居中规则（MUST FOLLOW）

**任何带 sidebar 的 Dashboard/Portal，`<main>` 内的内容 wrapper 必须加 `max-w-4xl mx-auto`（或合适的 max-w），禁止内容靠左贴边。**

- 错误：`<div className="p-6"><Outlet /></div>` → 内容在 sidebar 右侧左对齐，宽屏下视觉失衡
- 正确：`<div className="p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto"><Outlet /></div>`
- 适用：SupplierLayout、CompanyLayout、AdminLayout 的 `<main>` 内层 div

## Admin Layout 规则（MUST FOLLOW）

**AdminLayout root 必须用 `h-screen overflow-hidden flex flex-col`，禁止用 `min-h-screen`。**

- `min-h-screen` → root 随内容增高超过 100vh → body 滚动 → header/sidebar 随页面滚动（布局崩坏）
- `h-screen overflow-hidden` → root 固定 100vh → 只有 `<main className="flex-1 overflow-auto">` 内部滚动
- 改动 `AdminLayout.tsx` 时，第一件事检查 root div 是否为 `h-screen overflow-hidden`
- 正确结构：`<div className="h-screen overflow-hidden flex flex-col">` → `<header shrink-0>` → `<div className="flex flex-1 overflow-hidden">` → `<aside>` + `<main className="flex-1 overflow-auto [scrollbar-gutter:stable]">`
- **`<main>` 必须加 `[scrollbar-gutter:stable]`**：内容高度变化时滚动条槽位保持固定，防止竖向滚动条出现/消失时挤压页面宽度造成横向跳动。

---

## Admin 搜索/筛选栏布局规则（MUST FOLLOW）

Admin 列表页的工具栏（tabs + 搜索 + 筛选）必须遵循以下布局规则：

- **PC 端（sm+）**：tabs、搜索框（`flex-1`）、筛选下拉 三者在同一行，不换行
- **移动端（< sm）**：tabs 一行，搜索框 + 筛选下拉 另起一行（`basis-full` 让搜索框强制换行）
- **同一页面只允许一个搜索框**：多 tab 页面用 unified search，根据 active tab 绑定对应的 search state，切 tab 时 value 随之重置
- **搜索框 class 模板**：`basis-full sm:basis-auto sm:flex-1 h-9 px-3 rounded-lg border border-stone-200 bg-stone-50 text-[15px] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white min-w-0`
- **外层容器**：`flex flex-wrap items-center gap-2`（`flex-wrap` 允许移动端换行，`gap-2` 统一间距）
- 禁止在子组件（table/card 组件）内部再加搜索框，搜索逻辑统一在页面级管理

---

## Frozen Contracts (改前必须获得用户明确许可)

以下行为是已定好的功能规范。**任何涉及这些文件的改动，必须先确认不会破坏对应契约，否则需要用户明确指示"这次允许改"。**

改完后必须运行：`node scripts/harness/test-frozen-contracts.mjs`

---

### A. API 契约

#### A1. 目录装企详情 `GET /api/companies/:slug`
- 文件：`server/src/controllers/companyController.ts`
- **注册装企分支（owner_user_id 有值）必须返回**：
  - `is_claimed: true`
  - `projects[]` 非空数组，每项含 `title`、`slug`、`images[]`
- `sanitizePublicCompany()` 中 `is_claimed = !!(owner_user_id)`，**不得在响应路径中将 owner_user_id 设为 null**
- 文件：`server/src/lib/publicCompaniesSerialization.ts`

#### A2. 注册装企详情 `GET /api/public/companies/:id`
- 文件：`server/src/controllers/publicCompanyController.ts`
- 必须返回：`contact_person: null`、`phone: null`、`website: null`（注册装企付费获客，联系方式不公开）
- 必须返回：`is_claimed: true`、`is_registered: true`

#### A3. 注册装企列表 `GET /api/public/companies`
- 文件：`server/src/controllers/publicCompanyController.ts`
- `phone: null`、`contact_person: null`、`website: null` — 同 A2

#### A4. 目录装企（uae_companies）
- 文件：`server/src/lib/publicCompaniesSerialization.ts`
- **phone 永远返回 `''`**（业务决策 2026-05-11：全平台隐藏 WA/电话号，引导走平台询价留资）
- `sanitizePublicCompany()` 对**未认领**目录公司（`owner_user_id IS NULL`）正常返回 `email`，认领后隐藏 `email`、`website`
- `is_claimed` 基于 `owner_user_id` 计算，不得硬编码
- **已知返祖风险**：认领后目录公司的 slug 仍走 `/api/companies/:slug` → `sanitizePublicCompany()`，若不在此处过滤，phone 会穿透到前端
- **已知返祖风险**：认领后目录公司的 slug 仍走 `/api/companies/:slug` → `sanitizePublicCompany()`，若不在此处过滤，联系方式会穿透到前端
#### A5. VIP 签约标志 `is_signed`
- 文件：`server/src/controllers/companyController.ts`（注册装企分支）、`server/src/lib/publicCompaniesSerialization.ts`（目录装企）
- `GET /api/companies/:slug` 和 `GET /api/public/companies` 必须返回 `is_signed: boolean`，值必须来自 DB（`!!(company.is_signed)`），**禁止硬编码为 `false`**
- 注册装企分支的 SELECT 语句必须包含 `cp.is_signed`，否则字段为 undefined，`!!undefined === false` 导致 VIP 徽章静默消失
- toggle-signed 路由（`PUT /admin/roles/companies/:id/toggle-signed`）**不得加 `requireSuperAdmin`**，只需 `requireAdmin`，否则 sub_admin 操作被 403 静默丢弃
- **已知返祖风险**：修改 `getCompanyBySlug` 时，若重写 SELECT 语句忘记带 `cp.is_signed`，VIP 徽章会无声消失且无报错

#### A6. CRM 推送隔离
- 文件：`server/src/controllers/companyLeadController.ts`
- 装企线索 → 只能调用 `pushCompanyLeadToCRM()`（company tenant）
- 业主线索 → 只能调用 `pushLeadToCRM()`（homeowner tenant）
- mirror inquiry → 只打 DB 标记（`crm_sync_status = 'synced'`），**绝不调用任何 CRM 推送函数**
- 两个函数的 tenantId 不得混用

---

### B. 前端 UI 契约

#### B1. 公司详情页 — 项目展示触发条件
- 文件：`src/pages/CompanyDetailPage.tsx` 约 line 480
- 触发条件：`company.isClaimed && company.projects && company.projects.length > 0`
- `portfolioMode` 初始值必须是 `'project'`（line 56）
- **不得删除或弱化这个条件**

#### B2. 公司详情页 — 项目卡片展示样式
- 文件：`src/pages/CompanyDetailPage.tsx`
- 布局：2 列网格（`grid-cols-1 sm:grid-cols-2`），卡片为 16:9 比例（`aspect-video`）
- 卡片内容：封面图 + 项目标题 + 地点（或描述摘要）+ 多图时显示图片数量角标
- 当 `portfolioMode === 'project'` 且 `hasProjectCategories` 为 true 时，使用项目分类视图
- 否则退回到 `portfolioMode === 'style'` 的 MasonryGallery 展示

#### B3. 公司详情页 — 图片点击行为
- 文件：`src/pages/CompanyDetailPage.tsx` 约 line 153
- isClaimed + projects 有数据时：点击图片 → 跳转 `/companies/${id}/${projectSlug}`
- 其他情况：点击图片 → 打开 Lightbox

#### B4. 公司详情页 — 联系方式展示
- 注册装企或已认领装企（`isClaimed = true`）：不显示 phone / email / website / contact_person
- 目录装企（`isClaimed = false`，未被认领）：正常显示
- **双重防线**：后端 `sanitizePublicCompany()` 对 `isClaimed` 公司返回空字符串；前端 `!company.isClaimed &&` 条件守卫联系块，两处必须同时存在
- **已知返祖风险**：若仅依赖 API 不返回 phone（旧方案），认领目录公司的 phone 会穿透；必须在 `sanitizePublicCompany` 中主动过滤

#### B5. 公司列表数据合并顺序
- 文件：`src/lib/publicApi.ts`，函数 `fetchPublicCompanies()`
- 目录公司（`/api/companies`）排在前
- 注册装企（`/api/public/companies`）排在后
- 按公司名（toLowerCase）去重，目录公司优先保留

#### B6. Google One Tap 排除路径
- 文件：`src/components/GoogleOneTap.tsx`
- 不弹窗的路径前缀（`EXCLUDED_PATHS`）：`/auth`、`/login`、`/register`、`/designer/`、`/for-companies`、`/join`、`/admin`、`/verify-email`
- 不得缩减此列表

---

### C. 基础设施契约

#### C1. CORS 生产白名单
- 文件：`server/src/lib/corsOrigins.ts`
- 当前白名单：`https://www.tarmeer.com`、`https://tarmeer.com`、`https://admin.tarmeer.com`
- 新增子域名必须同步添加，否则跨域请求被拦截

#### C2. DB 字段写入截断
- 文件：`server/src/controllers/companyLeadController.ts`
- 所有字符串字段写入前必须 slice：`sourcePage` ≤ 500，`companyName` ≤ 200，`contactName` ≤ 100，`city` ≤ 100，`companyType` ≤ 100，`scopeOfBusiness` ≤ 500

#### C3. 级联删除顺序
- 装企删除顺序：`projects` → `designers` → `articles` → `company_applications` → `notifications` → `design_inquiries` → `company_profiles` → `users`
- 业主删除顺序：`notifications` → `design_inquiries` → `homeowner_profiles` → `users`

---

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- **New page / new feature** → MUST invoke brainstorming FIRST. Brainstorming must include Step 0 component inventory scan before any code is written.
- **Feature complete** → MUST invoke feature-done BEFORE notifying user (auto-trigger: DB walk, pitfall check, tests, commit)
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- **任何新版面设计、布局改动、UI 组件修改** → 改前/改后必须主动自检以下设计基准，发现问题立即修正，不等用户指出：
  1. **列/网格均匀分布** — 不允许某列极窄或极宽；用 `grid-cols-N` 等分或 `fr` 单位，禁止嵌套 grid 导致列宽失衡
  2. **间距一致** — gap/padding/margin 使用 design token（`gap-4`/`gap-6`/`gap-8`），不混用随意数值
  3. **对齐正确** — 文字左对齐，数字/价格右对齐，标题与内容对齐基线，图标与文字垂直居中
  4. **主次层级分明** — 标题 > 正文 > 辅助信息，字重/字号/颜色须有明显区分
  5. **文字不换行异常** — 给容器足够宽度，长文加 `line-clamp` 兜底，禁止单词在窄列中意外断行
  6. **移动端适配** — 宽屏多列在移动端降为单列或双列，触摸区域 ≥ 44px，不出现横向溢出

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
