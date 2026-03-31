# Unified Admin Panel & User System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify user system with roles (user/designer/company), add inquiry forms with Excel export, add company application & admin binding, and consolidate admin panel.

**Architecture:** New `users` table as auth backbone, existing `designers` and `uae_companies` linked via foreign keys. New `design_inquiries` and `company_applications` tables. Admin panel gets new modules for users, companies, and inquiries. Frontend user dashboard unified under `/dashboard/*`.

**Tech Stack:** Express + MySQL + mysql2, React 19 + TypeScript + Tailwind CSS 4, JWT auth, xlsx for Excel export.

---

## Phase 1: Database & Auth Foundation

### Task 1: Create migration SQL for new tables

**Files:**
- Create: `server/schema/migration-2026-03-31-unified-users.sql`

**Step 1: Write the migration SQL**

```sql
USE tarmeer;

-- 1. New users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) DEFAULT NULL,
  city VARCHAR(128) DEFAULT NULL,
  avatar_url MEDIUMTEXT DEFAULT NULL,
  role ENUM('user', 'designer', 'company') DEFAULT 'user',
  status ENUM('active', 'suspended') DEFAULT 'active',
  email_verified TINYINT(1) DEFAULT 0,
  verification_token VARCHAR(255) DEFAULT NULL,
  verification_token_expires DATETIME DEFAULT NULL,
  reset_token VARCHAR(255) DEFAULT NULL,
  reset_token_expires DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Link designers to users
ALTER TABLE designers ADD COLUMN user_id INT DEFAULT NULL AFTER id;
ALTER TABLE designers ADD INDEX idx_user_id (user_id);

-- 3. Link companies to users (owner who claimed it)
ALTER TABLE uae_companies ADD COLUMN owner_user_id INT DEFAULT NULL AFTER id;
ALTER TABLE uae_companies ADD INDEX idx_owner_user_id (owner_user_id);

-- 4. Design inquiry forms
CREATE TABLE IF NOT EXISTS design_inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  city VARCHAR(128) NOT NULL,
  area_range VARCHAR(64) NOT NULL,
  message TEXT DEFAULT NULL,
  designer_id INT DEFAULT NULL,
  company_id INT DEFAULT NULL,
  user_id INT DEFAULT NULL,
  status ENUM('new', 'contacted', 'resolved', 'archived') DEFAULT 'new',
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_designer (designer_id),
  INDEX idx_company (company_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Company applications (user applies to become renovation company)
CREATE TABLE IF NOT EXISTS company_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  license_number VARCHAR(128) DEFAULT NULL,
  phone VARCHAR(64) DEFAULT NULL,
  city VARCHAR(128) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  documents JSON DEFAULT NULL,
  description TEXT DEFAULT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  admin_notes TEXT DEFAULT NULL,
  linked_company_id INT DEFAULT NULL,
  reviewed_by INT DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Step 2: Run migration on local database**

Run: `mysql -u root tarmeer < server/schema/migration-2026-03-31-unified-users.sql`
Expected: No errors. Verify with `DESCRIBE users; DESCRIBE design_inquiries; DESCRIBE company_applications;`

**Step 3: Commit**

```bash
git add server/schema/migration-2026-03-31-unified-users.sql
git commit -m "feat: add migration for users, design_inquiries, company_applications tables"
```

---

### Task 2: Migrate existing designers to users table

**Files:**
- Create: `server/schema/migrate-designers-to-users.sql`

**Step 1: Write data migration script**

```sql
USE tarmeer;

-- Create user records from existing designers (only approved ones with email)
INSERT INTO users (email, password, full_name, phone, city, avatar_url, role, email_verified, created_at)
SELECT
  d.email, d.password, d.full_name, d.phone, d.city, d.avatar_url,
  'designer', d.email_verified, d.created_at
FROM designers d
WHERE d.email IS NOT NULL
  AND d.deleted_at IS NULL
  AND d.user_id IS NULL
ON DUPLICATE KEY UPDATE id = id;  -- skip if email already exists

-- Link designers to their new user records
UPDATE designers d
  JOIN users u ON u.email = d.email
SET d.user_id = u.id
WHERE d.user_id IS NULL AND d.deleted_at IS NULL;
```

**Step 2: Run on local database**

Run: `mysql -u root tarmeer < server/schema/migrate-designers-to-users.sql`
Expected: Check with `SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM designers WHERE user_id IS NOT NULL;`

**Step 3: Commit**

```bash
git add server/schema/migrate-designers-to-users.sql
git commit -m "feat: migrate existing designers into users table"
```

---

### Task 3: New auth controller using users table

**Files:**
- Create: `server/src/controllers/userAuthController.ts`
- Modify: `server/src/routes/auth.ts`
- Modify: `server/src/middleware/authenticate.ts`

**Step 1: Create userAuthController.ts**

New auth controller that registers/logins against `users` table instead of `designers`.

Key functions:
- `register` — creates user in `users` table with role='user'
- `login` — authenticates against `users` table, JWT payload: `{ userId, email, role }`
- `getMe` — returns user profile + linked designer/company data if any
- `updateProfile` — updates user basic info

Keep the existing `authController.ts` working for backward compatibility during transition. The new controller handles the same endpoints but uses `users` table.

**Step 2: Update authenticate middleware**

Modify JWT verification to handle both old tokens (designer) and new tokens (user). Check `users` table first, fall back to `designers` table for old tokens.

**Step 3: Update auth routes**

Replace route handlers in `server/src/routes/auth.ts` to point to new userAuthController while keeping the same API contract (`POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`).

**Step 4: Test manually**

Run: `npm run dev` in server directory
Test: `curl -X POST http://localhost:3002/api/auth/register -H 'Content-Type: application/json' -d '{"email":"test@test.com","password":"Test1234","fullName":"Test User","city":"Dubai"}'`
Expected: 201 with JWT token, user created in `users` table

**Step 5: Commit**

```bash
git add server/src/controllers/userAuthController.ts server/src/routes/auth.ts server/src/middleware/
git commit -m "feat: new auth system using unified users table"
```

---

### Task 4: Designer upgrade API

**Files:**
- Create: `server/src/controllers/designerApplicationController.ts`
- Modify: `server/src/routes/designers.ts`

**Step 1: Create designer application controller**

Functions:
- `applyAsDesigner(req, res)` — authenticated user submits designer application. Creates `designers` record with `user_id`, `status=pending`. Requires: bio, style, expertise, city.
- `getMyDesignerStatus(req, res)` — returns current user's designer application status.

**Step 2: Add routes**

```
POST /api/designers/apply       — submit designer application (auth required)
GET  /api/designers/my-status   — get my designer status (auth required)
```

**Step 3: Test manually**

Login as regular user, call `/api/designers/apply` with profile data.
Expected: 201, designer record created with status=pending, linked to user.

**Step 4: Commit**

```bash
git add server/src/controllers/designerApplicationController.ts server/src/routes/designers.ts
git commit -m "feat: designer upgrade application API"
```

---

### Task 5: Company application API

**Files:**
- Create: `server/src/controllers/companyApplicationController.ts`
- Create: `server/src/routes/companyApplications.ts`
- Modify: `server/src/app.ts` (register new route)

**Step 1: Create company application controller**

Functions:
- `applyAsCompany(req, res)` — user submits company application. Creates `company_applications` record. Fields: company_name, license_number, phone, city, address, description.
- `getMyCompanyStatus(req, res)` — returns current user's company application status.

**Step 2: Add routes**

```
POST /api/company-applications        — submit application (auth required)
GET  /api/company-applications/mine   — get my application status (auth required)
```

**Step 3: Register route in app.ts**

Add `app.use('/api/company-applications', companyApplicationRoutes);`

**Step 4: Test manually and commit**

```bash
git add server/src/controllers/companyApplicationController.ts server/src/routes/companyApplications.ts server/src/app.ts
git commit -m "feat: company application API"
```

---

## Phase 2: Design Inquiry Form

### Task 6: Inquiry form backend API

**Files:**
- Create: `server/src/controllers/inquiryController.ts`
- Create: `server/src/routes/inquiries.ts`
- Modify: `server/src/app.ts`

**Step 1: Create inquiry controller**

Functions:
- `submitInquiry(req, res)` — public endpoint (no auth required). Creates `design_inquiries` record. Validates: name, phone, city (from whitelist), area_range (from whitelist). Rate limit: 5/hour/IP.
- `getInquiries(req, res)` — admin only. Pagination, filter by status/designer_id/company_id. Search by name/phone.
- `updateInquiryStatus(req, res)` — admin only. Update status + admin_notes.
- `exportInquiries(req, res)` — admin only. Returns .xlsx file.

City whitelist: `['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain']`
Area range whitelist: `['< 50m²', '50-100m²', '100-200m²', '200-500m²', '500m²+']`

**Step 2: Add routes**

```
POST   /api/inquiries              — submit form (public, rate-limited)
GET    /api/inquiries              — list all (admin only)
PUT    /api/inquiries/:id/status   — update status (admin only)
GET    /api/inquiries/export       — download Excel (admin only)
```

**Step 3: Install xlsx dependency**

Run: `cd server && npm install xlsx`

**Step 4: Implement Excel export**

Use `xlsx` library. Columns: ID, Name, Phone, City, Area, Message, Designer/Company, Status, Admin Notes, Created At.

**Step 5: Register route, test, commit**

```bash
git add server/src/controllers/inquiryController.ts server/src/routes/inquiries.ts server/src/app.ts server/package.json server/package-lock.json
git commit -m "feat: design inquiry form API with Excel export"
```

---

### Task 7: Inquiry form frontend component

**Files:**
- Create: `src/components/InquiryForm.tsx`
- Modify: `src/pages/CompanyDetailPage.tsx`
- Modify: `src/pages/DesignerProfilePage.tsx` (if designer detail page exists)

**Step 1: Create InquiryForm component**

A sidebar form component with:
- Name (text input)
- Phone (tel input)
- City (select dropdown with 7 UAE emirates)
- Area Range (select dropdown with 5 ranges)
- Message (textarea, optional)
- Submit button

Props: `{ designerId?: number; companyId?: number }`

On submit: POST to `/api/inquiries` with the form data + designerId/companyId.
Show success message after submit. Handle errors gracefully.

Style: Match the Houzz-style card shown in the design screenshot — white card with shadow, stacked fields, prominent submit button.

**Step 2: Add to CompanyDetailPage sidebar**

In `src/pages/CompanyDetailPage.tsx`, add `<InquiryForm companyId={company.id} />` in the sidebar section (where Links and Address currently are).

**Step 3: Add to DesignerProfilePage sidebar (if applicable)**

Add `<InquiryForm designerId={designer.id} />` to designer detail page.

**Step 4: Test in browser, commit**

```bash
git add src/components/InquiryForm.tsx src/pages/CompanyDetailPage.tsx src/pages/DesignerProfilePage.tsx
git commit -m "feat: inquiry form on designer and company detail pages"
```

---

## Phase 3: Admin Panel — New Modules

### Task 8: Admin Users Management page

**Files:**
- Create: `src/pages/admin/AdminUsersPage.tsx`
- Modify: `src/App.tsx` (add route)
- Modify: `src/lib/adminApi.ts` (add API calls)
- Create: `server/src/controllers/userAdminController.ts`
- Modify: `server/src/routes/admin.ts` (add endpoints)

**Step 1: Backend — userAdminController**

Functions:
- `listUsers(req, res)` — paginated list with role/status filters, search by name/email
- `getUserDetail(req, res)` — single user with linked designer/company info
- `updateUserStatus(req, res)` — activate/suspend user
- `updateUserRole(req, res)` — change role (used when admin approves upgrade)

Add routes:
```
GET    /api/admin/users           — list users
GET    /api/admin/users/:id       — user detail
PUT    /api/admin/users/:id/status — suspend/activate
PUT    /api/admin/users/:id/role   — change role
```

**Step 2: Frontend — AdminUsersPage**

Table layout similar to AdminDesignersPage:
- Columns: Name, Email, Role, Status, Registered Date, Actions
- Filters: role (all/user/designer/company), status (active/suspended)
- Search by name or email
- Click row to see user detail

**Step 3: Add route to App.tsx**

```tsx
<Route path="users" element={<AdminUsersPage />} />
```

**Step 4: Update admin sidebar navigation to include Users link**

**Step 5: Test, commit**

```bash
git add src/pages/admin/AdminUsersPage.tsx server/src/controllers/userAdminController.ts server/src/routes/admin.ts src/App.tsx src/lib/adminApi.ts
git commit -m "feat: admin users management page"
```

---

### Task 9: Admin Company Management page

**Files:**
- Create: `src/pages/admin/AdminCompaniesPage.tsx`
- Create: `src/pages/admin/AdminCompanyApplicationsPage.tsx`
- Modify: `src/App.tsx`
- Create: `server/src/controllers/companyAdminController.ts`
- Modify: `server/src/routes/admin.ts`

**Step 1: Backend — companyAdminController**

Functions:
- `listCompanies(req, res)` — paginated uae_companies list, filter by owner status (claimed/unclaimed)
- `listApplications(req, res)` — paginated company_applications, filter by status
- `reviewApplication(req, res)` — approve/reject with notes
- `bindUserToCompany(req, res)` — **KEY**: admin sets `uae_companies.owner_user_id = userId` and updates `users.role = 'company'` and `company_applications.linked_company_id`
- `unbindCompany(req, res)` — remove owner_user_id from company

Routes:
```
GET    /api/admin/companies                    — list companies
GET    /api/admin/company-applications         — list applications
PUT    /api/admin/company-applications/:id/review  — approve/reject
POST   /api/admin/companies/:companyId/bind    — bind user to company { userId }
DELETE /api/admin/companies/:companyId/bind    — unbind
```

**Step 2: Frontend — AdminCompaniesPage**

Two tabs:
- **Companies** — all 100 companies, shows which ones have been claimed (owner badge). Search, filter by claimed/unclaimed.
- **Applications** — pending applications with approve/reject actions.

Approve flow UI:
1. Admin clicks "Review" on an application
2. Modal shows applicant info + company details they submitted
3. Admin searches existing companies to find a match
4. Admin clicks "Bind to this company" or "Create new company"
5. Confirm → API call to bind

**Step 3: Add routes, test, commit**

```bash
git add src/pages/admin/AdminCompaniesPage.tsx src/pages/admin/AdminCompanyApplicationsPage.tsx server/src/controllers/companyAdminController.ts server/src/routes/admin.ts src/App.tsx
git commit -m "feat: admin company management with user binding"
```

---

### Task 10: Admin Inquiries Management page

**Files:**
- Create: `src/pages/admin/AdminInquiriesPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/lib/adminApi.ts`

**Step 1: Frontend — AdminInquiriesPage**

Features:
- Table: Name, Phone, City, Area, Message (truncated), Designer/Company, Status, Date
- Filters: status (new/contacted/resolved/archived), date range
- Search by name/phone
- Click row to expand detail with full message
- Status update dropdown
- Admin notes textarea
- **Export Excel button** — calls `/api/inquiries/export`, triggers download

**Step 2: Add adminApi functions**

```ts
fetchInquiries(params): Promise<{ inquiries, pagination }>
updateInquiryStatus(id, status, notes): Promise<void>
exportInquiriesUrl(params): string  // returns URL for download
```

**Step 3: Add route to App.tsx, test, commit**

```bash
git add src/pages/admin/AdminInquiriesPage.tsx src/App.tsx src/lib/adminApi.ts
git commit -m "feat: admin inquiries page with Excel export"
```

---

## Phase 4: User Dashboard Redesign

### Task 11: Unified user dashboard layout and routes

**Files:**
- Create: `src/layouts/UserDashboardLayout.tsx`
- Create: `src/pages/dashboard/DashboardHomePage.tsx`
- Create: `src/pages/dashboard/DashboardProfilePage.tsx`
- Create: `src/pages/dashboard/ApplyDesignerPage.tsx`
- Create: `src/pages/dashboard/ApplyCompanyPage.tsx`
- Create: `src/pages/dashboard/MyInquiriesPage.tsx`
- Modify: `src/App.tsx` — add `/dashboard/*` routes, keep `/designer/*` as redirects

**Step 1: Create UserDashboardLayout**

Top bar: Tarmeer Dashboard, user name, Home link, Logout.
Sidebar navigation (role-aware):
- All users: Dashboard, Profile
- Users only: Apply as Designer, Apply as Company
- Designers: My Projects, Received Inquiries
- Companies: Company Profile, Received Inquiries

**Step 2: Create DashboardHomePage**

Shows:
- Welcome message
- Current role badge (User / Designer / Company)
- If designer pending: "Your designer application is under review"
- If company pending: "Your company application is under review"
- If user: CTAs to apply as designer or company
- If designer/company: stats (received inquiries count, project count)

**Step 3: Create DashboardProfilePage**

Edit: name, phone, city, avatar. Calls `PUT /api/auth/me` to update.

**Step 4: Create ApplyDesignerPage**

Form: bio, style, expertise, city, sample work description.
Submit calls `POST /api/designers/apply`.
After submit: show "Application submitted, pending review" status.

**Step 5: Create ApplyCompanyPage**

Form: company_name, license_number, phone, city, address, description.
Submit calls `POST /api/company-applications`.
After submit: show pending status.

**Step 6: Create MyInquiriesPage**

Lists inquiries received by this designer/company.
Calls `GET /api/inquiries/mine` (new endpoint — returns inquiries where designer_id or company_id matches current user's linked records).

**Step 7: Update App.tsx routes**

```tsx
<Route path="/dashboard" element={<AuthProtectedRoute><UserDashboardLayout /></AuthProtectedRoute>}>
  <Route index element={<DashboardHomePage />} />
  <Route path="profile" element={<DashboardProfilePage />} />
  <Route path="projects" element={<DesignerProjectsPage />} />  {/* reuse existing */}
  <Route path="upload" element={<DesignerUploadPage />} />       {/* reuse existing */}
  <Route path="upload/:id" element={<DesignerUploadPage />} />
  <Route path="company" element={<CompanyProfilePage />} />
  <Route path="inquiries" element={<MyInquiriesPage />} />
  <Route path="apply/designer" element={<ApplyDesignerPage />} />
  <Route path="apply/company" element={<ApplyCompanyPage />} />
</Route>
{/* Redirect old designer routes */}
<Route path="/designer/*" element={<Navigate to="/dashboard" replace />} />
```

**Step 8: Test all routes in browser, commit**

```bash
git add src/layouts/ src/pages/dashboard/ src/App.tsx
git commit -m "feat: unified user dashboard with role-based navigation"
```

---

## Phase 5: Integration & Deployment

### Task 12: Update admin sidebar navigation

**Files:**
- Modify: `src/layouts/AdminLayout.tsx` (or wherever admin nav lives)

Add links for new modules:
- Dashboard (existing)
- Users (new)
- Designers (existing)
- Companies (new)
- Inquiries (new)
- Analytics (existing)
- Settings (existing)

**Step 1: Update nav items, commit**

---

### Task 13: Update auth flow on frontend

**Files:**
- Modify: `src/pages/AuthPage.tsx` — registration creates user (not designer)
- Modify: `src/contexts/DesignerContext.tsx` — add UserContext or merge into unified context
- Create: `src/contexts/UserContext.tsx` — stores current user info + role

After login, redirect to `/dashboard` instead of `/designer/dashboard`.

**Step 1: Create UserContext, update AuthPage, commit**

---

### Task 14: Run migrations on production

**Step 1: SSH to server, run migration SQL on RDS**

```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104
mysql -h rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com -u tarmeerCRM -p tarmeer < migration-2026-03-31-unified-users.sql
mysql -h rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com -u tarmeerCRM -p tarmeer < migrate-designers-to-users.sql
```

**Step 2: Deploy backend**

```bash
./deploy-backend-ecs.sh
```

**Step 3: Build and deploy frontend**

```bash
DEPLOY_RULES_ACK=YES DEPLOY_USER_APPROVED=YES bash deploy-simple.sh
```

**Step 4: Verify on production**

- Test registration: new user goes to `users` table
- Test login: returns JWT with userId and role
- Test inquiry form on company detail page
- Test admin panel new modules

---

## Summary

| Phase | Tasks | Scope |
|-------|-------|-------|
| 1. Database & Auth | Tasks 1-5 | New tables, auth migration, upgrade APIs |
| 2. Inquiry Form | Tasks 6-7 | Backend API + frontend component |
| 3. Admin Modules | Tasks 8-10 | Users, Companies, Inquiries admin pages |
| 4. User Dashboard | Tasks 11-13 | Unified dashboard with role-based UI |
| 5. Deployment | Task 14 | Production migration & deploy |

Each phase is independently deployable. Phase 1 is backward compatible (old designer login still works). Phases can be done sequentially over multiple sessions.
