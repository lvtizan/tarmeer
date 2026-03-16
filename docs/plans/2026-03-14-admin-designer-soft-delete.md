# Admin Designer Soft Delete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a production-safe soft delete and restore flow for admin designer management, including backend APIs, admin UI actions, public-site hiding, local verification, senior QA validation, and a git backup commit on the current branch.

**Architecture:** Extend the `designers` table with soft-delete fields instead of hard deletion. Admin APIs will mark a designer as deleted or restore them, public queries will exclude deleted designers by default, and the admin UI will expose delete/restore actions in both list and detail views with confirmation and reason capture.

**Tech Stack:** React 19, TypeScript, Vite, Express, MySQL schema SQL files, Playwright, server unit/integration-style tests, git on `main`

---

### Task 1: Add database support for soft delete

**Files:**
- Modify: `server/schema/designers.sql`
- Modify: `database/schema.sql`
- Test: `server/src/lib/schemaSql.test.ts`

**Step 1: Write the failing test**

Extend `server/src/lib/schemaSql.test.ts` to assert that the designers schema contains:
- `deleted_at`
- `deleted_by_admin_id`
- `delete_reason`

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/kp/Library/Mobile\ Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0
npm --prefix server test -- schemaSql.test.ts
```

Expected: FAIL because the delete fields are not present.

**Step 3: Write minimal implementation**

Update both schema files to add nullable columns for:
- `deleted_at DATETIME NULL`
- `deleted_by_admin_id BIGINT NULL`
- `delete_reason TEXT NULL`

Keep existing approval fields unchanged.

**Step 4: Run test to verify it passes**

Run the same test command and confirm PASS.

**Step 5: Commit**

```bash
git add server/schema/designers.sql database/schema.sql server/src/lib/schemaSql.test.ts
git commit -m "feat: add designer soft delete schema"
```

### Task 2: Add backend delete and restore APIs

**Files:**
- Modify: `server/src/controllers/designerAdminController.ts`
- Modify: `server/src/routes/admin.ts`
- Modify: `server/src/controllers/designerController.ts`
- Modify: `server/src/controllers/projectController.ts`
- Test: `server/src/controllers/designerAdminController.soft-delete.test.ts`

**Step 1: Write the failing test**

Create `server/src/controllers/designerAdminController.soft-delete.test.ts` covering:
- delete marks designer as deleted instead of removing row
- delete stores reason and admin id
- delete rejects missing reason
- restore clears delete fields
- public-facing queries no longer return deleted designer rows

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/kp/Library/Mobile\ Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0
npm --prefix server test -- designerAdminController.soft-delete.test.ts
```

Expected: FAIL because the controller functions and routes do not exist yet.

**Step 3: Write minimal implementation**

Add backend behavior:
- `DELETE /api/admin/designers/:id`
- `POST /api/admin/designers/:id/restore`
- require an admin permission gate consistent with designer management
- record activity log entries for delete and restore
- exclude soft-deleted designers from public designer/project queries
- prevent deleted designers from authenticating or updating content if needed by current query paths

**Step 4: Run test to verify it passes**

Run the same targeted server test and confirm PASS.

**Step 5: Commit**

```bash
git add server/src/controllers/designerAdminController.ts server/src/routes/admin.ts server/src/controllers/designerController.ts server/src/controllers/projectController.ts server/src/controllers/designerAdminController.soft-delete.test.ts
git commit -m "feat: add admin designer soft delete api"
```

### Task 3: Add admin API client methods

**Files:**
- Modify: `src/lib/adminApi.ts`
- Test: `src/lib/adminApi.soft-delete.test.ts`

**Step 1: Write the failing test**

Create `src/lib/adminApi.soft-delete.test.ts` to assert:
- `deleteDesigner(id, reason)` calls `DELETE /admin/designers/:id` with JSON body
- `restoreDesigner(id)` calls `POST /admin/designers/:id/restore`

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/kp/Library/Mobile\ Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0
npm test -- src/lib/adminApi.soft-delete.test.ts
```

Expected: FAIL because the client methods do not exist.

**Step 3: Write minimal implementation**

Add:
- `deleteDesigner(id: number, reason: string)`
- `restoreDesigner(id: number)`

Keep the existing token handling unchanged.

**Step 4: Run test to verify it passes**

Run the same targeted test and confirm PASS.

**Step 5: Commit**

```bash
git add src/lib/adminApi.ts src/lib/adminApi.soft-delete.test.ts
git commit -m "feat: add admin designer delete client"
```

### Task 4: Add delete and restore actions to admin list page

**Files:**
- Modify: `src/pages/admin/AdminDesignersPage.tsx`
- Test: `tests/admin-designers-soft-delete.spec.ts`

**Step 1: Write the failing test**

Create Playwright coverage for:
- opening admin designers list
- delete action opens confirmation modal
- confirmation requires reason
- deleted designer disappears from active list or is marked deleted
- deleted filter or restore action works

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/kp/Library/Mobile\ Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0
npx playwright test tests/admin-designers-soft-delete.spec.ts --workers=1
```

Expected: FAIL because no delete/restore UI exists yet.

**Step 3: Write minimal implementation**

Update the admin designers page to include:
- delete button per designer
- delete confirmation modal with reason
- deleted/all/active filter
- restore action for deleted designers
- clear inline success/error feedback

Do not mix this with unrelated sorting refactors.

**Step 4: Run test to verify it passes**

Run the same Playwright spec and confirm PASS.

**Step 5: Commit**

```bash
git add src/pages/admin/AdminDesignersPage.tsx tests/admin-designers-soft-delete.spec.ts
git commit -m "feat: add admin designer delete flow to list"
```

### Task 5: Add delete and restore actions to admin designer detail page

**Files:**
- Modify: `src/pages/admin/AdminDesignerDetailPage.tsx`
- Test: `tests/admin-designer-detail-soft-delete.spec.ts`

**Step 1: Write the failing test**

Create a focused test to verify:
- detail page shows delete action for active designer
- delete reason is required
- deleted designer shows restore action
- after restore, status returns to active management state

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/kp/Library/Mobile\ Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0
npx playwright test tests/admin-designer-detail-soft-delete.spec.ts --workers=1
```

Expected: FAIL because detail-page delete/restore UI does not exist.

**Step 3: Write minimal implementation**

Add delete and restore controls to the detail page without breaking project moderation actions.

**Step 4: Run test to verify it passes**

Run the same spec and confirm PASS.

**Step 5: Commit**

```bash
git add src/pages/admin/AdminDesignerDetailPage.tsx tests/admin-designer-detail-soft-delete.spec.ts
git commit -m "feat: add admin designer delete flow to detail"
```

### Task 6: Hide deleted designers from public experience

**Files:**
- Modify: `src/data` or public query consumers only if needed by current architecture
- Modify: `server/src/lib/publicDesignersQuery.ts`
- Modify: `server/src/lib/publicProjectsQuery.ts`
- Test: `server/src/lib/publicDesignersQuery.test.ts`
- Test: `server/src/lib/publicProjectsQuery.test.ts`

**Step 1: Write the failing test**

Add assertions that deleted designers and their public projects are excluded from public API results.

**Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/kp/Library/Mobile\ Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0
npm --prefix server test -- publicDesignersQuery.test.ts publicProjectsQuery.test.ts
```

Expected: FAIL because current public queries do not know about soft delete.

**Step 3: Write minimal implementation**

Update public query filters to exclude rows with `deleted_at IS NOT NULL`.

**Step 4: Run test to verify it passes**

Run the same tests and confirm PASS.

**Step 5: Commit**

```bash
git add server/src/lib/publicDesignersQuery.ts server/src/lib/publicProjectsQuery.ts server/src/lib/publicDesignersQuery.test.ts server/src/lib/publicProjectsQuery.test.ts
git commit -m "feat: hide deleted designers from public queries"
```

### Task 7: Local regression verification

**Files:**
- No code changes required unless fixes are needed

**Step 1: Run focused frontend and backend tests**

Run:

```bash
cd /Users/kp/Library/Mobile\ Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0
npm run build
npm --prefix server test -- designerAdminController.soft-delete.test.ts publicDesignersQuery.test.ts publicProjectsQuery.test.ts schemaSql.test.ts
npx playwright test tests/admin-designers-soft-delete.spec.ts tests/admin-designer-detail-soft-delete.spec.ts --workers=1
```

Expected: all PASS.

**Step 2: Run local manual smoke checks**

Verify manually:
- admin delete
- admin restore
- deleted designer absent from public list
- deleted designer no longer reachable publicly

**Step 3: Commit final local fixes if needed**

```bash
git add <relevant files>
git commit -m "fix: address soft delete regressions"
```

### Task 8: Request senior QA validation

**Files:**
- Create or update: `docs/plans/2026-03-14-admin-designer-soft-delete.md`

**Step 1: Prepare QA handoff**

Summarize:
- feature scope
- test accounts/data setup
- exact admin URLs
- expected delete/restore behavior
- public-site expected behavior

**Step 2: Senior QA validates locally**

Required scenarios:
- delete approved designer
- delete pending designer
- restore deleted designer
- verify public site exclusion
- verify no unintended effect on other designers

**Step 3: Record QA outcome**

Document pass/fail notes and any blocking defects before asking user to验收.

### Task 9: User acceptance and git backup on current branch

**Files:**
- No new files unless QA notes require them

**Step 1: Notify user only after local + senior QA pass**

Include:
- changed behavior
- verification summary
- any known limits

**Step 2: After user acceptance, create backup commit on current branch**

Run:

```bash
git status --short
git add <only soft-delete related files>
git commit -m "feat: add admin designer soft delete workflow"
git rev-parse --short HEAD
```

Expected: a clean backup point on `main` for this feature.

**Step 3: Deploy only after explicit user go-ahead**

Do not deploy before:
- local verification passed
- senior QA passed
- user acceptance passed

