# Image Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up public-facing images so broken links are filtered out, repeated case-study images are deduplicated, and fake seed-user avatars are no longer shown.

**Architecture:** Add a small image sanitation layer on both the backend and frontend. The backend cleans public designer/project payloads before returning them, while the frontend applies one more strict-pass for rendering, per-page deduplication, and hidden-on-missing behavior.

**Tech Stack:** TypeScript, React, Express, node:test, Vite

---

### Task 1: Backend public image sanitation

**Files:**
- Create: `server/src/lib/publicImageCleanup.ts`
- Create: `server/src/lib/publicImageCleanup.test.ts`
- Modify: `server/src/lib/publicDesignerSerialization.ts`
- Modify: `server/src/lib/publicDesignerSerialization.test.ts`

**Step 1: Write the failing test**
- Add tests for:
  - duplicate image URLs are removed after normalization
  - empty / invalid image values are removed
  - known fake seed avatar URLs are converted to empty values
  - project images are serialized as unique non-empty arrays

**Step 2: Run test to verify it fails**
- Run: `npm test -- publicImageCleanup`
- Expected: FAIL because cleanup helpers do not exist yet.

**Step 3: Write minimal implementation**
- Implement shared backend helpers to normalize URLs, deduplicate image lists, and strip known fake avatar URLs.
- Wire helpers into public designer/project serialization.

**Step 4: Run test to verify it passes**
- Run the targeted backend tests, then the full backend test suite.

### Task 2: Frontend strict rendering cleanup

**Files:**
- Create: `src/lib/imageCleanup.ts`
- Modify: `src/lib/publicApi.ts`
- Modify: `src/components/designers/DesignerCard.tsx`
- Modify: `src/pages/DesignerProfilePage.tsx`
- Modify: `src/components/project/ProjectGallery.tsx`
- Modify: `src/components/project/ProjectDetailContent.tsx`
- Modify: `src/pages/NewHomeDesignPage.tsx`
- Modify: `src/pages/SoftDecorationPage.tsx`

**Step 1: Add a minimal reproducible behavior target**
- Encode cleanup rules in a shared frontend helper:
  - remove empty image URLs
  - remove duplicates after normalization
  - strip known fake avatar URLs
  - allow page-level deduplication when rendering repeated case-study cards

**Step 2: Implement minimal rendering changes**
- Clean API payloads again on the client for safety.
- Hide avatar blocks when there is no real avatar.
- Hide project cards or gallery blocks when a page has no valid unique images to show.
- Deduplicate `New Home Full Case Design` and `Soft Decoration Design` case-study images across each page.

**Step 3: Verify in browser**
- Open homepage, designer list, designer detail, New Home, and Soft Decoration pages.
- Confirm no repeated top case-study covers and no fake seed avatars.

### Task 3: Whole-site image audit script

**Files:**
- Create: `scripts/audit-images.mjs`
- Modify: `package.json`

**Step 1: Implement audit script**
- Scan source files for image URLs.
- Normalize and report:
  - duplicate URLs
  - suspicious avatar URLs matching the seed-avatar list
  - fetch failures for remote URLs

**Step 2: Run audit**
- Run: `node scripts/audit-images.mjs`
- Expected: report printed with duplicate/broken counts.

### Task 4: Verification and QA

**Files:**
- Modify: none unless fixes are needed

**Step 1: Run checks**
- Backend: `npm test` in `server`
- Frontend: `npm run build`
- Audit: `node scripts/audit-images.mjs`

**Step 2: Browser QA**
- Re-test the affected pages.
- Ask a browser testing specialist to verify the user-visible result.
