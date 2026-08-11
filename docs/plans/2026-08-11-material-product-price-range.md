# Material Product Price Range Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an optional maximum product price and consistently display single prices, starting prices, and price ranges on `/materials` product cards.

**Architecture:** Preserve `supplier_products.price` as the minimum/base price and add nullable `price_max`. Thread the field through every supplier/admin write path and every public read projection, then centralize label generation in the existing supplier-product pricing utility so all card variants share one display contract.

**Tech Stack:** MySQL auto-migration, Express compiled JavaScript controllers, Next.js 16 App Router, React 19, TypeScript, Node test/harness scripts.

---

### Task 1: Lock the price-range contract with failing tests

**Files:**
- Modify: `src/lib/supplierProductUnits.test.mjs`
- Modify: `scripts/harness/supplier-product-currency.mjs`

1. Add unit cases expecting `formatProductPrice(price, unit, from, currency, priceMax)` to return a range when `priceMax >= price`, preserve single/from output when max is null, and suppress invalid inputs.
2. Add harness assertions that `price_max` exists, create/update responses preserve it, max-below-min is rejected, and admin partial updates cannot leave an invalid range.
3. Run `node --test src/lib/supplierProductUnits.test.mjs`; expect failures because the formatter does not accept/render `priceMax`.
4. Run `node scripts/harness/supplier-product-currency.mjs`; expect schema/API assertions to fail because `price_max` is not implemented.

### Task 2: Add schema and backend validation/persistence

**Files:**
- Modify: `server/dist/lib/autoMigrate.js`
- Modify: `server/dist/controllers/supplierProductController.js`
- Modify: `server/dist/controllers/supplierAdminController.js`
- Modify: `server/dist/lib/partnerPublishService.js` if partner payload exposes range data

1. Confirm `server/.env` has `DB_HOST=localhost` before executing migrations or DB harnesses.
2. Add `price_max DECIMAL(12,2) NULL` to the create-table definition and required-column auto-migration list.
3. Extend supplier create/update validation: optional max must be positive and at least the minimum; persist and return it.
4. Extend admin create/partial update. For partial updates, read effective stored bounds before validating the combined result.
5. Add `price_max` to every explicit public product projection and serialization path.
6. Run the DB harness until all new cases pass without weakening assertions.

### Task 3: Centralize frontend formatting and API types

**Files:**
- Modify: `src/lib/supplierProductUnits.ts`
- Modify: `src/lib/materialsApi.ts`
- Modify: `src/lib/materialMacros.ts`
- Test: `src/lib/supplierProductUnits.test.mjs`

1. Implement range formatting in `formatProductPrice`, preserving existing language, currency fallback, number grouping, and unit labels.
2. Add `price_max: number | null` to public product interfaces and API mappers.
3. Add the field to macro/popular/search product interfaces and fetch parsing.
4. Run the formatter test and TypeScript check; both must pass.

### Task 4: Add supplier and admin maximum-price inputs

**Files:**
- Modify: `src/app/supplier/products/page.tsx`
- Modify: `src/app/admin/suppliers/[id]/page.tsx`

1. Add optional maximum-price state initialized/reset with the existing price fields.
2. Use text inputs with `inputMode="decimal"`, matching the existing rule that business-number fields must not use `type="number"`.
3. Validate with the shared parser and show a clear maximum-below-minimum message on click/save.
4. Submit `price_max` as a number or `null`; do not overwrite unrelated fields in the admin partial-update flow.
5. Render the range in supplier/admin product previews using the shared formatter.

### Task 5: Display prices on all public material product cards

**Files:**
- Modify: `src/components/materials/MaterialProductCard.tsx`
- Modify: `src/components/materials/HubFeatured.tsx`
- Modify: `src/components/materials/HubSearchResults.tsx`
- Modify: `src/components/materials/MacroProductGrid.tsx`
- Modify: `src/components/materials/MegaMenuDirectory.tsx` if its product payload includes prices
- Modify: `src/components/materials/ProductDetailClient.tsx`
- Modify: `src/components/materials/SupplierDetailClient.tsx`

1. Grep every public product-card rendering site and confirm its payload contains the five price fields (`price`, `price_max`, `price_unit`, `price_currency`, `price_from`).
2. Render a shared formatted label below the title; omit the element when the formatter returns null.
3. Keep country/currency fallback behavior unchanged and avoid adding UAE-only text to VN views.
4. Verify `/materials` popular cards and product-search cards visually at mobile and desktop widths.

### Task 6: Full verification and review gates

**Files:**
- Modify: `.claude/skills/tarmeer-failure-archaeology/SKILL.md` only if implementation uncovers/fixes an actual prior defect

1. Run `node --test src/lib/supplierProductUnits.test.mjs`.
2. Run `node scripts/harness/supplier-product-currency.mjs` against local MySQL/backend.
3. Run `node scripts/harness/smoke-test.mjs`.
4. Run `node_modules/.bin/next build`; after the build, restart the local 5180 dev server if it was running.
5. Run three independent code-review rounds in order: spec/security, repair/quality, integration/omissions. Fix findings and re-run affected tests before advancing.
6. Review `git diff` for unrelated files and secrets. Do not deploy or modify production data without a separate explicit deployment request.

