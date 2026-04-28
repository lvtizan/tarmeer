# Company UX Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 3 frontend issues: rename "Renovation Tags", reorder Materials filter (Dubai first + 跨境 label), show project rejection reason + banner notification.

**Architecture:** Pure frontend changes except Task 3 which also needs backend to send rejection_reason in project list API response (already stored in DB, just needs to be included).

**Tech Stack:** React, TypeScript, Tailwind

---

## Pre-flight note: 服务类型已可修改

`company_type` 下拉已经在 `src/components/company/CompanyProfileForm.tsx:327` 的 Profile 表单里（标签叫 "Company Type"）。后端 `updateProfile` 也支持保存。**无需写代码**，告知用户去 Profile 页面修改即可。

---

### Task 1: Rename "Renovation Tags" → "Project Tags"

**Files:**
- Modify: `src/pages/company/CompanyProjectsPage.tsx:445`

**Step 1: Make the change**

```tsx
// line 445 — change:
<label className={labelCls}>Renovation Tags</label>
// to:
<label className={labelCls}>Project Tags</label>
```

Also check line 446 subtitle (副标题 "Select tags to classify this project") — keep as is, it's fine.

**Step 2: Verify with tsc**

```bash
npx tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/pages/company/CompanyProjectsPage.tsx
git commit -m "fix(company): rename Renovation Tags to Project Tags"
```

---

### Task 2: Materials filter — Dubai first + rename China → 跨境

**Files:**
- Modify: `src/pages/ShowroomsPage.tsx`

**Step 1: Desktop sidebar filter (lines ~244-248)**

Change order and labels:

```tsx
// Before:
<FilterOption selected={originFilter === ''} onClick={() => setOriginFilter('')}>All Origins</FilterOption>
<FilterOption selected={originFilter === 'china'} onClick={() => setOriginFilter('china')}>🇨🇳 China</FilterOption>
<FilterOption selected={originFilter === 'dubai'} onClick={() => setOriginFilter('dubai')}>🇦🇪 Dubai</FilterOption>

// After:
<FilterOption selected={originFilter === ''} onClick={() => setOriginFilter('')}>All Origins</FilterOption>
<FilterOption selected={originFilter === 'dubai'} onClick={() => setOriginFilter('dubai')}>🇦🇪 Dubai</FilterOption>
<FilterOption selected={originFilter === 'china'} onClick={() => setOriginFilter('china')}>🇨🇳 跨境</FilterOption>
```

**Step 2: Mobile pill filter (lines ~300-305)**

```tsx
// Before:
{ value: 'china', label: '🇨🇳 China' },
{ value: 'dubai', label: '🇦🇪 Dubai' },

// After:
{ value: 'dubai', label: '🇦🇪 Dubai' },
{ value: 'china', label: '🇨🇳 跨境' },
```

**Step 3: Result count text (line ~337)**

```tsx
// Before:
{originFilter && ` · ${originFilter === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}`}

// After:
{originFilter && ` · ${originFilter === 'china' ? '🇨🇳 跨境' : '🇦🇪 Dubai'}`}
```

**Step 4: Supplier card badge (lines ~69-73)**

```tsx
// Before:
{s.origin === 'china' ? '🇨🇳 China' : '🇦🇪 Dubai'}

// After:
{s.origin === 'china' ? '🇨🇳 跨境' : '🇦🇪 Dubai'}
```

**Step 5: Verify tsc**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add src/pages/ShowroomsPage.tsx
git commit -m "fix(materials): Dubai first in filter, rename China to 跨境"
```

---

### Task 3: Project rejection — show reason on card + top banner

**Context:**
- `rejection_reason` is stored in DB and returned by `GET /api/company/projects` (line 216 in `projectController.ts` SELECT already includes it)
- Frontend `CompanyProjectsPage.tsx:312-313` shows "Rejected" badge but never displays the reason text
- No notification exists anywhere when a project is rejected

**Sub-task 3a: Show rejection_reason on project card**

File: `src/pages/company/CompanyProjectsPage.tsx`

Find the project card section that renders the status badge (around line 312). After the closing `</div>` of the image block, add the rejection reason:

```tsx
{/* After the image/badge block, inside the card */}
{p.status === 'rejected' && p.rejection_reason && (
  <div className="px-3 pb-2 pt-1">
    <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5 leading-relaxed">
      <span className="font-semibold">Reason: </span>{p.rejection_reason}
    </p>
  </div>
)}
```

**Sub-task 3b: Top banner when rejected projects exist**

In `CompanyProjectsPage.tsx`, after fetching projects, derive:

```tsx
const rejectedProjects = projects.filter(p => p.status === 'rejected');
```

Then render a banner above the project grid (right below the page header, before the "Upload" button area):

```tsx
{rejectedProjects.length > 0 && (
  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
    <div>
      <p className="text-sm font-semibold text-amber-900">
        {rejectedProjects.length === 1
          ? `"${rejectedProjects[0].title}" was not approved`
          : `${rejectedProjects.length} projects need your attention`}
      </p>
      <p className="text-xs text-amber-700 mt-0.5">
        Review the reason below and resubmit after making changes.
      </p>
    </div>
  </div>
)}
```

Add import at top of file:
```tsx
import { AlertCircle } from 'lucide-react';
```

(Check if lucide-react AlertCircle is already imported — if yes skip.)

**Step: Verify tsc**

```bash
npx tsc --noEmit
```

**Step: Commit**

```bash
git add src/pages/company/CompanyProjectsPage.tsx
git commit -m "feat(company): show project rejection reason and alert banner"
```

---

## Testing Checklist

1. **Task 1**: Open `/company/projects` → Upload New Project form → confirm label says "Project Tags"
2. **Task 2**: Open `/materials/` → left sidebar shows Dubai above 跨境 → card badges say 跨境/Dubai → mobile pill same order
3. **Task 3**: Need a project with `status = 'rejected'` and `rejection_reason` set in DB:
   - The amber banner appears at top of `/company/projects`
   - The rejection reason text appears on the project card
   - Projects without rejection are unaffected

---

## Deployment

Backend changes: none (rejection_reason already in SELECT).
Frontend only — deploy with `bash deploy-simple.sh` after user confirms.
