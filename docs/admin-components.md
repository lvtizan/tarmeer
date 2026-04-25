# Admin & Frontend Component Inventory

**MUST READ before writing any new page (admin or public-facing).**

Run `node scripts/harness/lint-admin-ui.mjs --guide` to print this as a pre-coding checklist.

---

## Decision Tree — Start Here

Before writing a single line of JSX, answer these questions:

```
Need a dropdown / select?          → <AdminSelect />           (NEVER raw <select>)
Need a search input on a page?     → STOP. See Search Rules below
Need a tooltip inside a table?     → <FloatingTip>             (NEVER group-hover)
Need a loading state?              → <Spinner> / <PageSpinner> / <TableSpinner>
Need a success/error notification? → showToast()               (NEVER alert/confirm)
Need a logo?                       → <TarmeerLogo />            (NEVER inline SVG/text)
Need a phone input?                → phoneValidation.ts        (NEVER skip validation)
Need a lead/inquiry form?          → <LeadForm />              (NEVER duplicate form logic)
New entity with admin list?        → Add to AdminGlobalSearch  (see Search Rules below)
New backend controller function?   → Register route immediately (NEVER leave unwired)
```

---

## Component Catalog

### `<AdminSelect />` — ALL dropdowns
- **Path**: `src/components/ui/AdminSelect.tsx`
- **When**: Any filter, status selector, or option picker in admin pages
- **NEVER use**: raw `<select>` tags — they clip inside overflow-hidden containers
- **Usage**:
```tsx
import AdminSelect from '../../components/ui/AdminSelect';
<AdminSelect
  value={status}
  onChange={setStatus}
  options={[
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
  ]}
  placeholder="All Status"
  className="h-9"
/>
```

---

### `<FloatingTip>` — Tooltips inside tables
- **Path**: defined locally in `src/pages/admin/AdminInquiriesPage.tsx` (copy the pattern)
- **When**: Any tooltip inside a table row or overflow-hidden container
- **NEVER use**: `group-hover:block` absolute tooltips — they get clipped and cause scroll
- **Pattern**: fixed positioning via `getBoundingClientRect()`

---

### `<Spinner>` / `<PageSpinner>` / `<TableSpinner>` — Loading states
- **Path**: `src/components/ui/Spinner.tsx`
- `<Spinner>` — inline loading indicator
- `<PageSpinner>` — full-page centered spinner
- `<TableSpinner colSpan={N}>` — table row loading state

---

### `showToast()` — Notifications
- **Path**: `src/components/ui/Toast.tsx`
- **When**: Success messages, error feedback, any user-facing notification
- **NEVER use**: `alert()`, `confirm()`, `prompt()` — native dialogs are blocked by lint
- **Usage**: `showToast('Saved!', 'success')` / `showToast('Error', 'error')`

---

### `<TarmeerLogo />` — Logo
- **Path**: `src/components/TarmeerLogo.tsx`
- **When**: Any page that shows the Tarmeer logo
- **NEVER create**: inline logo markup or SVG

---

### `phoneValidation.ts` — Phone inputs
- **Path**: `src/lib/phoneValidation.ts`
- **Exports**: `validatePhone(digits, countryCode)`, `isPhoneComplete(digits, countryCode)`
- **When**: Every phone input field — fake number rejection + UAE prefix check mandatory

---

### `<LeadForm />` — Lead/inquiry forms
- **Path**: `src/components/form/LeadForm.tsx`
- **When**: Any new homeowner lead form, inquiry form, or company signup form
- **Configure via**: `fields` prop — never duplicate form logic across pages

---

### `AdminGlobalSearch` — Cross-entity search (top bar)
- **Path**: `src/components/admin/AdminGlobalSearch.tsx`
- **Backend**: `server/src/controllers/globalSearchController.ts`
- **Currently indexes**: homeowner leads, company leads, users, registered companies, directory companies
- **Placeholder**: `搜索用户、公司、线索...`
- **Behavior**: search → dropdown results → click → navigate to entity's admin page with `?search=` param

---

## Search Rules (CRITICAL)

Two kinds of search — they are NOT interchangeable:

| Kind | What it does | Component | When to add |
|------|-------------|-----------|-------------|
| **Global search** (top bar) | Cross-entity quick-find, navigates to result | `AdminGlobalSearch` | Every new entity with an admin list page |
| **Page filter** (in-page) | Filters current list, works with other dropdowns | local `<input>` + `useSearchParams` | Every list page with multiple filter dimensions |

**Rules:**
1. Every new admin list page needs BOTH — page filter for UX + global search for discoverability
2. Global search navigates by setting `?search=` URL param; the page reads it via `useSearchParams()`
3. To add a new entity to global search: update `globalSearchController.ts` (backend query) + `AdminGlobalSearch.tsx` (result rendering + navigation)
4. Page filter search input: `h-9 flex-1 min-w-0` — NEVER fixed width (`w-[Xrem]`)

---

## New Admin Page Checklist (run through before writing code)

- [ ] List every UI element needed: dropdowns, search, tooltips, modals, loading, notifications, logo, phone inputs, forms
- [ ] Map each element to existing component in catalog above
- [ ] If filterable list → plan page filter input (uses `useSearchParams`)
- [ ] If new entity → add to `AdminGlobalSearch` + `globalSearchController.ts`
- [ ] If new backend controller functions → open the routes file NOW and add `router.get/post/put/delete` before forgetting
- [ ] Run `node scripts/harness/lint-admin-ui.mjs` after writing to catch violations
