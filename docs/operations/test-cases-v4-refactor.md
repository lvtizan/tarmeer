# Tarmeer V4 Refactor Test Cases

## Module 1: Auth & Onboarding Flow

### TC-1.1: New user registration → onboarding redirect
- Register new email → verify email → should redirect to `/onboarding` (NOT `/dashboard`)
- Expected: `active_role` is null, user sees role selection page

### TC-1.2: Existing homeowner login → dashboard redirect
- Login with homeowner account → should redirect to `/dashboard`
- Expected: `active_role = 'homeowner'` in localStorage

### TC-1.3: Existing company login → company portal redirect
- Login with company account → should redirect to `/company`
- Expected: `active_role = 'company'` in localStorage

### TC-1.4: Onboarding role selection stores active_role
- Select homeowner → localStorage should have `active_role = 'homeowner'`
- Select company → localStorage should have `active_role = 'company'`

### TC-1.5: OAuth (Google) new user → onboarding
- Google login with new email → should land on `/onboarding`

### TC-1.6: OAuth callback stores user (not designer)
- After OAuth callback → localStorage has `user` key, NOT `designer`

### TC-1.7: Legacy designer token → graceful handling
- Old `{id, email}` JWT → linked designer gets user data; unlinked → 401 re-login

---

## Module 2: Designer Removal / Company Focus

### TC-2.1: /designers redirects to /companies
- Visit `/designers` → should 302 to `/companies`

### TC-2.2: /designers/apply redirects to /onboarding
- Visit `/designers/apply` → should redirect to `/onboarding`

### TC-2.3: Dashboard has no "Become Designer" button
- Login as role='user' → dashboard sidebar should NOT show "Become a Designer"

### TC-2.4: Dashboard has no designer-specific nav
- No "My Projects" or "Inquiries" nav for role='user'

### TC-2.5: /dashboard/apply/designer redirects to /onboarding
- Navigate to `/dashboard/apply/designer` → redirect to `/onboarding`

---

## Module 3: Company Profile (Frontend ↔ Backend)

### TC-3.1: Services uses correct options list
- Company dashboard edit form → Services section should show: Interior Design, Architecture, Fit-Out, etc.
- Should NOT show: Residential, Villa, Commercial (those are specialties)

### TC-3.2: Company profile save works (JSON, not FormData)
- Fill all required fields → Save → should succeed without error
- Verify data persists on page reload

### TC-3.3: Company profile loads correctly from DB
- Existing company profile → all fields populated correctly
- services/specialties parsed from JSON strings

### TC-3.4: New company → auto-starts in edit mode
- Company with no profile → page shows edit form (not empty display)

---

## Module 4: Inquiry System (No Designer)

### TC-4.1: Inquiry submission without designer_id
- Submit inquiry on company detail page → POST body should NOT contain `designer_id`
- Only `company_id` present

### TC-4.2: Admin inquiry list joins company_profiles
- GET /api/admin/inquiries → `company_name` column from `company_profiles` table
- No reference to `designers` table

### TC-4.3: My inquiries (company) uses company_profiles
- Company user → GET /api/inquiries/mine → queries by company_profiles.id
- Not by designers.id or uae_companies.owner_user_id

---

## Module 5: Notification System

### TC-5.1: Inquiry triggers in-app notification
- Submit inquiry → check `notifications` table → new row with type='inquiry'

### TC-5.2: Company registration triggers notification
- New company profile (INSERT) → `notifications` table has type='company_registration'

### TC-5.3: Notification bell shows unread count
- Admin panel → bell icon shows unread count badge
- Click bell → dropdown shows notification list

### TC-5.4: Mark all read
- Click "Mark all read" → unread count becomes 0

### TC-5.5: Email notification group send
- Configure emails in /admin/notification-emails
- Submit inquiry → all active emails receive notification

### TC-5.6: Admin notification email CRUD
- Add email → appears in list
- Toggle off → is_active = 0
- Delete → removed from list

---

## Module 6: Admin Company Edit

### TC-6.1: Edit scraped company (uae_companies)
- Admin → Companies tab → click Edit → modal opens with all fields
- Change name → Save → verify DB updated

### TC-6.2: Edit registered company (company_profiles)
- Admin → Roles → Companies tab → click Edit → modal opens
- Can change status, services, etc. → Save → verify

### TC-6.3: All fields editable
- Scraped: name_en, name_ar, phone, email, website, city, address, services, etc.
- Profile: company_name, contact_person, phone, status, company_type, services, etc.

---

## Module 7: Company Import (Word Template)

### TC-7.1: Download template
- Admin → Import Company → Download Template → valid .docx file

### TC-7.2: Upload and parse
- Fill template → Upload → parsed data shown in preview

### TC-7.3: Preview allows editing
- All fields editable before confirm

### TC-7.4: Confirm import
- Click Confirm → company created in both `company_profiles` and `uae_companies`
- Status auto-approved

---

## Module 8: Designer Upgrade Migration

### TC-8.1: Orphan designers get users
- Run migration → designers without user_id get users table rows

### TC-8.2: Company name uses "Name Design Studio"
- Upgraded designer → company_name = "FullName Design Studio"
- Empty name → uses email prefix

### TC-8.3: Projects linked to company_profiles
- Designer projects → company_profile_id populated
