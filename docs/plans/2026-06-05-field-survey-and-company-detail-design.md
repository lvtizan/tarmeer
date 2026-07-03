# Design: Field Survey Auth + Company Detail Enhancement

Date: 2026-06-05

## Scope

Four features in one release:

1. Company profile — branch addresses
2. Field survey — login authentication + historical record re-edit
3. Field survey — edit audit trail (留痕)
4. Admin company detail — 2:8 layout + double-column details + survey-verified fields with green checkmark

---

## Feature 1: Branch Addresses on Company Profile

### Data
- Add `branch_addresses JSON NULL` column to `company_profiles` (ensureColumn on startup)

### API
- `GET /auth/company/profile` — include `branch_addresses` in response
- `PUT /auth/company/profile` — accept `branch_addresses: string[]`, store as JSON

### UI (`src/components/company/CompanyProfileForm.tsx`)
- Add `branch_addresses: string[]` to `ProfileData` interface and `EMPTY_PROFILE`
- Under main address field, add "Branch Addresses" section
- Each entry: text input + × remove button
- Bottom: "+ Add Branch Address" button
- Max 10 entries

---

## Feature 2: Field Survey Authentication + Historical Re-Edit

### Authentication

**New backend endpoints:**
- `POST /api/field/auth/login` — validate email/password against `admin_users` where `role = 'field_staff'` and `is_active = 1`; return signed JWT (same secret as admin, but include `role: 'field_staff'`)
- `POST /api/field/auth/logout` — stateless (client clears token)

**New middleware:** `fieldStaffAuth`
- Reads `Authorization: Bearer <token>` header
- Verifies JWT, checks `role === 'field_staff'`
- Sets `req.fieldStaff = { id, email, name }`
- Returns 401 if missing/invalid

**Protected routes** (add `fieldStaffAuth` middleware):
- `POST /api/field/interviews` (createDraft)
- `GET /api/field/interviews/draft`
- `PATCH /api/field/interviews/:id`
- `POST /api/field/interviews/:id/submit`
- `POST /api/field/interviews/:id/photos`

**Public routes** (unchanged):
- `GET /api/field/survey-schema`
- `GET /api/field/companies/search`
- `GET /api/field/auth/login` (the new login endpoint itself)

**DB:**
- `company_interviews.interviewer_id` — already exists; `createDraft` now sets it from `req.fieldStaff.id`

### New page: `/field/login`

- Simple card: email + password inputs + Login button
- On success: store JWT in `localStorage` as `field_token`
- Redirect to `/field/survey`
- No email verification required (admin-created accounts)

### Layout auth guard (`src/app/field/layout.tsx`)

- Check `localStorage.field_token` on mount
- If missing or expired → redirect to `/field/login`
- Pass token in all `fieldApi` requests via `Authorization` header

### Historical Record Re-Edit

**Search API enhancement** (`GET /api/field/companies/search?q=xxx`):
- For each matched company, also return recent submitted interviews (max 5 per company):
  ```json
  {
    "results": [
      {
        "id": 42, "name": "Fatin Home Furniture", "city": "Dubai", "source": "uae",
        "interviews": [
          { "id": 101, "submitted_at": "2026-05-10T09:00:00Z", "interviewer_name": "Jane Smith" }
        ]
      }
    ]
  }
  ```

**Frontend search UI:**
- Under each company result, if `interviews.length > 0`, show a collapsible sub-list
- Each interview row: date + interviewer name + "修改" button
- "Match" button = start new survey (existing behavior)
- "修改" button = load existing interview into survey form in edit mode

**Edit mode flow:**
- `fieldApi.loadInterview(id)` → `GET /api/field/interviews/:id` (new field-facing endpoint)
- Hydrate form with existing data
- Save edits via existing `PATCH /api/field/interviews/:id` (open to all authenticated staff, not just original author)
- Submit via `POST /api/field/interviews/:id/re-submit` (new endpoint):
  - Records audit log entry before updating
  - Updates `section_*`, `company_name`, `submitted_at = NOW()`, keeps `status = 'submitted'`

---

## Feature 3: Edit Audit Trail

### New table: `interview_edit_logs`

```sql
CREATE TABLE IF NOT EXISTS interview_edit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interview_id INT NOT NULL,
  editor_id INT NOT NULL,
  editor_name VARCHAR(100) NOT NULL,
  snapshot_before JSON,
  edit_summary TEXT,
  edited_at DATETIME NOT NULL DEFAULT NOW(),
  INDEX idx_interview_id (interview_id)
);
```

Created via `ensureTable()` on server startup.

### Log entries

- **First submit** (draft → submitted): insert log with `snapshot_before = null`, `edit_summary = 'Initial submission'`
- **Re-submit**: insert log with `snapshot_before = {section_1…section_9 before edit}`, `edit_summary = auto-generated diff string` (e.g. "Changed section_1.year_established from '2010-2015' to '2015-2020'; section_3.total_employees from '10-30' to '30-50'")

### Admin UI (`src/app/admin/visit-records/page.tsx` detail view)

- Below survey section cards, add "修改历史" section
- Timeline style: each log entry shows `edited_at` · `editor_name` · `edit_summary`
- If only one log (initial submit), show "首次提交" without diff

---

## Feature 4: Admin Company Detail — Layout + Survey Verified Fields

### Left/right ratio

Desktop layout change in `src/app/admin/companies/[id]/page.tsx`:
- Left sidebar: `w-80 flex-shrink-0` → `flex-[2] min-w-0`
- Right content: `flex-1 min-w-0` → `flex-[8] min-w-0`

### DetailsCard — double column

Change from single-column `space-y-2.5` list to `grid grid-cols-2 gap-x-6 gap-y-2.5`.

### SurveyVerifiedCard (new component inline)

Show only when `company.latest_interview_id != null`.

Fields to display (from `SURVEY_FIELD_MAP` synced columns):
- `office_type` → "办公室类型"
- `one_stop_service` → "一站式服务"
- `has_construction_permit` → "施工许可证"
- `total_employees` → "员工总数"
- `pm_team_size` → "PM 团队"
- `design_team_size` → "设计团队"
- `construction_team` → "施工团队"
- `owner_nationality` → "业主国籍"
- `main_project_types` → "主要项目类型"
- `min_project_value` / `max_project_value` → "合同范围"
- `material_sources` → "材料来源"

Each non-null value: displayed with a small `CheckCircle2` (lucide-react, `text-green-500 w-3.5 h-3.5`) after the value.

### API

`getCompanyFullDetail` response: include all synced survey columns (already in `company_profiles` table after `ensureColumns` runs).

---

## File Change Summary

### Server (TypeScript source in `server/src/`)
| File | Change |
|------|--------|
| `controllers/fieldInterviewController.ts` | Add `fieldStaffAuth` middleware, `login`, `re-submit` + audit log, `loadInterview`, search returns interviews |
| `routes/field.ts` | Add login route, protect routes, add re-submit + loadInterview |
| `controllers/companyProfileController.ts` | Add `branch_addresses` read/write |

### Frontend
| File | Change |
|------|--------|
| `src/app/field/login/page.tsx` | New login page |
| `src/app/field/layout.tsx` | Auth guard, token injection |
| `src/app/field/survey/page.tsx` | Load existing interview, edit mode, re-submit |
| `src/lib/adminApi.ts` | Add `fieldApi.login`, `fieldApi.loadInterview`, `fieldApi.reSubmit` |
| `src/components/company/CompanyProfileForm.tsx` | Add branch_addresses field |
| `src/app/admin/companies/[id]/page.tsx` | 2:8 layout, double-column details, SurveyVerifiedCard |
| `src/app/admin/visit-records/page.tsx` | Show edit_logs in detail view |

---

## Constraints

- External field staff accounts: no email verification, admin-creates directly
- Any authenticated field staff can edit any submitted interview (not restricted to original author)
- Audit log is append-only; no deletion of log entries
- `branch_addresses` is optional; empty array = no branch addresses shown
