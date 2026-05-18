# Supplier Edit Modal Design

**Goal:** Add a working edit modal to the admin supplier detail page, covering basic info and product management.

**Architecture:** Single modal component (`SupplierEditModal`) with two tabs — Basic Info and Products. Reuses existing backend endpoints, existing `ProductEditModal` and `ProjectModal` sub-components, and follows the same interaction pattern as `CompanyEditModal`.

**Tech Stack:** React, TypeScript, Tailwind, `adminApi`, `AdminSelect`, `PhoneCountryInput`

---

## Scope

### New files
- `src/components/admin/SupplierEditModal.tsx`

### Modified files
- `src/pages/admin/AdminSupplierDetailPage.tsx` — wire edit button to modal

### Unchanged (already working)
- Backend `PUT /admin/suppliers/:id` — supports all basic info fields
- Backend product routes (`PUT /admin/suppliers/:id/products/:productId`, `DELETE`)
- `ProjectModal`, `ProductEditModal` — reused as-is
- Hover "Set as Cover" on project cards

---

## Tab 1 — Basic Info

Fields (two-column grid, matching CompanyEditModal layout):

| Row | Left | Right |
|-----|------|-------|
| 1 | Company Name | Origin (AdminSelect: China / Dubai) |
| 2 | Phone (PhoneCountryInput) | WhatsApp |
| 3 | Website | Status (AdminSelect: pending/approved/rejected) |
| 4 | Description (auto-resize textarea, full width) | |
| 5 | Categories (multi-select tags from `/admin/supplier-categories`) | |
| 6 | Has Physical Store (toggle) | Store Address + Google Maps URL (shown only when toggle is on) |

Save → `PUT /admin/suppliers/:id` with allowed fields.

---

## Tab 2 — Products

Compact row list: `[thumb 40px] Title · Category ··· [Edit] [Delete]`

- Edit → opens existing `ProductEditModal`
- Delete → `showConfirm` → `DELETE /admin/suppliers/:id/products/:productId`
- "＋ Add Product" button at bottom → opens a new `ProductAddModal` (inline within `SupplierEditModal` file) with fields: image upload + title + category

Product operations update local state immediately on success (no full reload).

---

## Data Flow

1. Modal opens → parallel fetch: supplier detail (`GET /admin/suppliers/:id`) + supplier categories (`GET /admin/supplier-categories`)
2. Tab 1 save → `PUT /admin/suppliers/:id` → call `onSaved()` to refresh parent
3. Tab 2 edits → individual product API calls → update local `products` state
4. Modal close → parent re-fetches supplier if `onSaved` was called

---

## Edge Cases

- `categories` stored as JSON array in DB → serialize on save
- Physical store toggle off → clear `store_address` and `google_maps_url` before saving
- Product title/category can be null — show placeholder text
- New product requires image upload before save is enabled
