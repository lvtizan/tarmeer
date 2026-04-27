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

---

## Admin Layout 规则（MUST FOLLOW）

**AdminLayout root 必须用 `h-screen overflow-hidden flex flex-col`，禁止用 `min-h-screen`。**

- `min-h-screen` → root 随内容增高超过 100vh → body 滚动 → header/sidebar 随页面滚动（布局崩坏）
- `h-screen overflow-hidden` → root 固定 100vh → 只有 `<main className="flex-1 overflow-auto">` 内部滚动
- 改动 `AdminLayout.tsx` 时，第一件事检查 root div 是否为 `h-screen overflow-hidden`
- 正确结构：`<div className="h-screen overflow-hidden flex flex-col">` → `<header shrink-0>` → `<div className="flex flex-1 overflow-hidden">` → `<aside>` + `<main className="flex-1 overflow-auto">`

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
- `sanitizePublicCompany()` 对**未认领**目录公司（`owner_user_id IS NULL`）正常返回 `phone`、`email`
- **已认领**目录公司（`owner_user_id` 有值，即 `isClaimed = true`）必须隐藏 `phone`、`email`、`website`（同注册装企）
- `is_claimed` 基于 `owner_user_id` 计算，不得硬编码
- **已知返祖风险**：认领后目录公司的 slug 仍走 `/api/companies/:slug` → `sanitizePublicCompany()`，若不在此处过滤，phone 会穿透到前端

#### A5. CRM 推送隔离
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
