# Balanced Materials Feed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent one supplier from monopolizing the default Materials product feed while preserving newest-first discovery, full category views, and complete search results.

**Architecture:** Add an explicit `balanced=1` opt-in to the public product feed. Only the default Products hub sends it. The backend keeps the existing country/approved/published/image predicates, ranks each supplier's products by newest upload, groups them in two-product rounds, and paginates the resulting deterministic order. Category, scene, and query requests retain their existing newest-first ordering.

**Tech Stack:** Next.js client component, TypeScript API client, Node/Express controller, MySQL 8 window functions, Node static harness.

---

### Task 1: Specify the opt-in client contract

**Files:**
- Modify: `src/lib/materialsApi.ts`
- Test: `scripts/harness/materials-directory-interaction.mjs`

1. Add a failing harness assertion that `fetchMaterialProducts` accepts and serializes `balanced=1` only when requested.
2. Extend the typed fetch parameter with `balanced?: boolean` and append `balanced=1` only for `true`.
3. Run `node scripts/harness/materials-directory-interaction.mjs` and verify it passes.

### Task 2: Limit only the default hub feed

**Files:**
- Modify: `src/components/materials/HubFeatured.tsx`
- Test: `scripts/harness/materials-directory-interaction.mjs`

1. Add a failing assertion that the default hub request passes `balanced: !selectedCategory`.
2. Use the same request object for initial and Load More requests.
3. Do not alter search requests; concrete category selection must not balance results.
4. Run the harness and verify it passes.

### Task 3: Add balanced SQL ordering behind the opt-in

**Files:**
- Modify: `server/dist/controllers/supplierProductController.js`
- Test: `scripts/harness/materials-directory-interaction.mjs`

1. Add a failing assertion that balancing is gated on `balanced=1` and absence of `category`, `scene`, and `q`.
2. For eligible default requests, select through a CTE with `ROW_NUMBER() OVER (PARTITION BY p.supplier_profile_id ORDER BY p.id DESC) AS supplier_rank`.
3. Order CTE output by `CEIL(supplier_rank / 2) ASC, id DESC`, then apply the validated `LIMIT/OFFSET`; preserve the shared country predicate and the existing total count query.
4. Retain the existing `ORDER BY p.id DESC` path for category, scene, and query requests.
5. Run the harness and verify it passes.

### Task 4: Verify, review, deploy, and archive

**Files:**
- Modify: `.claude/skills/tarmeer-failure-archaeology/SKILL.md`

1. Run `node scripts/harness/materials-directory-interaction.mjs && node_modules/.bin/tsc --noEmit && git diff --check`.
2. Run three independent reviews: spec/security, quality/regression, and integration/verification.
3. Deploy server controller first, restart `tarmeer-api`; then push frontend, production-build `tarmeer_web_next`, restart `tarmeer-next`, and verify BUILD_ID plus HTTP 200.
4. Verify default results are balanced, category/search remain complete, and AE/VN country filters remain in force.
5. Archive the prevention rule: fairness is opt-in only and must never change search, category, or country semantics.
