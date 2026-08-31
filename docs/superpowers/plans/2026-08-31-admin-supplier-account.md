# Admin Supplier Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins with supplier-management access to create supplier accounts that are immediately email-verified.

**Architecture:** Add one protected admin endpoint that creates a supplier user and pending supplier profile in the current admin country. Reuse existing bcrypt, slug, audit-log, admin API client, and supplier-list UI patterns. Public supplier registration is not modified.

**Tech Stack:** Next.js client components, Express, MySQL via mysql2, bcryptjs, Node harness scripts.

---

### Task 1: Specify the protected creation contract

**Files:**
- Create: `scripts/harness/admin-create-supplier-account.mjs`
- Modify: `scripts/harness/smoke-test.mjs`

- [ ] **Step 1: Write the failing test**

Create a database-backed harness that inserts a temporary super-admin, calls `createAdminSupplierAccount` with a fake authenticated request, then asserts the result has `email_verified = 1`, a pending profile in the requested country, a bcrypt password hash, and an activity-log entry. Add an ordinary admin request that attempts a different country and assert its created profile remains in that admin's country.

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/harness/admin-create-supplier-account.mjs`

Expected: FAIL because `createAdminSupplierAccount` is not exported.

- [ ] **Step 3: Wire it into smoke verification**

Add an `execSync('node scripts/harness/admin-create-supplier-account.mjs', ...)` check to `scripts/harness/smoke-test.mjs` next to the supplier-admin checks.

- [ ] **Step 4: Run the focused test again**

Run: `node scripts/harness/admin-create-supplier-account.mjs`

Expected: still FAIL for the missing endpoint, proving the harness checks the intended behavior.

### Task 2: Implement the protected endpoint

**Files:**
- Modify: `server/dist/controllers/supplierAdminController.js`
- Modify: `server/dist/routes/admin.js`

- [ ] **Step 1: Add minimal controller behavior**

Export `createAdminSupplierAccount(req, res)`. Require `companyName`, `email`, and a password of at least 8 characters; normalize email; reject existing `supplier_users` or `users` email; hash password with bcryptjs; generate a unique slug using `slugify`; insert `supplier_users` with `email_verified = 1`; insert a `pending` `supplier_profiles` row; and record `supplier_account_create` with `logSupplierAction`.

- [ ] **Step 2: Preserve country isolation**

Accept the active UI country only for `super_admin`; for every other admin use `req.admin.country`. Validate allowed countries (`ae`, `vn`) before inserting the profile.

- [ ] **Step 3: Roll back partial writes**

Use a database transaction so a profile insert failure cannot leave an orphan login account. Return `409` for duplicate email and non-sensitive `400` validation errors.

- [ ] **Step 4: Register the route**

Add `POST /admin/suppliers` before `/admin/suppliers/:id`, protected by `requirePermission('can_view_suppliers')`.

- [ ] **Step 5: Run the focused test**

Run: `node scripts/harness/admin-create-supplier-account.mjs`

Expected: PASS with the direct-login and country-isolation assertions green.

### Task 3: Add the supplier-admin creation form

**Files:**
- Modify: `src/lib/adminApi.ts`
- Modify: `src/app/admin/suppliers/page.tsx`

- [ ] **Step 1: Add the API client method**

Add `createSupplierAccount({ companyName, email, password, phone, country })` that posts JSON to `/suppliers`.

- [ ] **Step 2: Add the form UI**

Add a compact `New Supplier Account` form to the suppliers page with company name, email, optional phone, and an 8-character password. Do not show an email-verification checkbox or an invitation-email control.

- [ ] **Step 3: Refresh only the active country list**

On success, close and reset the form, show a confirmation toast explaining the account can log in immediately, and refetch the list using the current country.

- [ ] **Step 4: Run static UI regression checks**

Run: `node scripts/harness/admin-suppliers-sort.mjs`

Expected: PASS, confirming the existing sort regression guard still holds.

### Task 4: Verify, review, and record the production fix

**Files:**
- Modify: `.claude/skills/tarmeer-failure-archaeology/SKILL.md`

- [ ] **Step 1: Type-check and run full smoke suite**

Run: `node_modules/.bin/tsc --noEmit`

Run: `NO_PROXY='*' node scripts/harness/smoke-test.mjs`

Expected: both exit 0, including the new supplier-account harness.

- [ ] **Step 2: Run three independent code-review rounds**

Review specification/security, then quality, then integration/omissions. Fix every actionable issue before continuing to the next round.

- [ ] **Step 3: Record the failure-prevention rule**

Append an entry documenting why privileged account creation must stay separate from public registration and retain country-scoped auditability.

- [ ] **Step 4: Commit only the feature files**

Run: `git add server/dist/controllers/supplierAdminController.js server/dist/routes/admin.js src/lib/adminApi.ts src/app/admin/suppliers/page.tsx scripts/harness/admin-create-supplier-account.mjs scripts/harness/smoke-test.mjs docs/plans/2026-08-31-admin-supplier-account-design.md docs/superpowers/plans/2026-08-31-admin-supplier-account.md .claude/skills/tarmeer-failure-archaeology/SKILL.md`

Run: `git commit -m "feat(admin): create verified supplier accounts"`
