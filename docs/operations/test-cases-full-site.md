# Tarmeer Full Site Test Cases

## Role: Anonymous (Not Logged In)

### TC-A.1: Homepage loads
- GET / → 200, has TARMEER logo, Find Company nav

### TC-A.2: Companies listing
- GET /companies → 200, shows company cards

### TC-A.3: Company detail
- GET /companies/:id → 200, shows portfolio + inquiry form

### TC-A.4: Inquiry submission (public)
- POST /api/inquiries with name/phone/city/area_range → 201

### TC-A.5: Inquiry rate limit
- Submit 6 times in 1 hour → 429 on 6th

### TC-A.6: Materials/Showrooms
- GET /materials → 200

### TC-A.7: Legacy redirects
- GET /designers → redirects to /companies
- GET /designers/apply → redirects to /onboarding
- GET /designer/dashboard → redirects to /company

### TC-A.8: Auth page loads
- GET /auth → 200, shows login/register form

### TC-A.9: Protected route redirect
- GET /dashboard without token → redirects to /auth
- GET /company without token → redirects to /auth

---

## Role: New User (Just Registered)

### TC-N.1: Register new email
- POST /api/auth/register → 201, role='user', active_role=null

### TC-N.2: Email verification
- GET /verify-email?token=xxx → verifies, returns JWT
- Frontend stores 'user' (not 'designer') in localStorage

### TC-N.3: After verify → onboarding
- Redirect to /onboarding (not /dashboard)

### TC-N.4: Select homeowner role
- POST /api/auth/select-role {role:'homeowner'} → 200
- active_role set, redirect to /dashboard

### TC-N.5: Select company role
- POST /api/auth/select-role {role:'company'} → 200
- active_role set, redirect to /company

### TC-N.6: Google One Tap new user
- POST /api/auth/google/one-tap → creates user with role='user'
- Redirects to /onboarding

### TC-N.7: OAuth callback
- GET /auth/callback?token=xxx → stores 'user', routes by active_role

---

## Role: Homeowner

### TC-H.1: Dashboard loads
- GET /dashboard → shows checklist + requirements form + profile summary

### TC-H.2: Requirements form auto-save
- Fill area/city/phone → blur → auto-saves (POST /api/auth/homeowner/profile)

### TC-H.3: Photo upload
- Drag images → shows in grid, can set cover, reorder, delete

### TC-H.4: Profile page
- GET /dashboard/profile → edit personal info (name, phone, city, avatar)

### TC-H.5: Company user visits /dashboard
- active_role='company' → auto-redirects to /company

### TC-H.6: No active_role visits /dashboard
- Redirects to /onboarding

---

## Role: Company

### TC-C.1: Dashboard loads
- GET /company/dashboard → shows Company Profile + Services sections

### TC-C.2: Profile auto-save
- Edit company name → blur → saves (POST /api/auth/company/profile)
- "Saving..." → "Saved" indicator

### TC-C.3: Services/Specialties toggle
- Click tag → saves, tag highlights

### TC-C.4: Profile validation
- Required: company_name, contact_person, phone, description, city
- At least one service required

### TC-C.5: Projects page loads
- GET /company/projects → left-right layout with Project Details + Image Board

### TC-C.6: Project image upload
- Drag files → processed, shown in grid
- Set cover, reorder via drag, delete, preview lightbox

### TC-C.7: Folder upload
- Click "Folder" → select directory → all images added

### TC-C.8: URL scraper
- Paste URL → Import → shows scraped images → "Use these" adds to board

### TC-C.9: Project submit validation
- Click "Submit for Review" without title → red hint under title field
- Without style → red hint under style
- Without images → red hint on image board

### TC-C.10: Save draft
- Click "Save Draft" → POST /api/projects with status='draft'

### TC-C.11: Submit for review
- Click "Submit for Review" → POST /api/projects with status='pending'

### TC-C.12: Approval status banner
- pending → amber "Under review"
- approved → green "Profile approved"
- rejected → red with admin notes

### TC-C.13: Preview button
- Click Preview → opens public company page in new tab

### TC-C.14: Sidebar navigation
- Dashboard + Projects nav items
- Profile Incomplete card with % progress bar
- Sidebar fixed, doesn't scroll with page

---

## Role: Admin

### TC-AD.1: Admin login
- POST /api/admin/login → returns admin token

### TC-AD.2: Dashboard stats
- GET /api/admin → shows overview stats

### TC-AD.3: Users management
- GET /api/admin/users → list all users with roles

### TC-AD.4: Companies — scraped list
- GET /api/admin/companies → paginated list with claimed/unclaimed filter

### TC-AD.5: Companies — edit scraped
- PUT /api/admin/companies/:id/edit → updates uae_companies fields

### TC-AD.6: Companies — bind/unbind user
- POST /api/admin/companies/:id/bind → links user to company
- DELETE /api/admin/companies/:id/bind → unlinks

### TC-AD.7: Approvals — list registered companies
- GET /api/admin/roles/companies → list with status filter

### TC-AD.8: Approvals — approve company
- POST /api/admin/roles/companies/:id/approve → status='approved'

### TC-AD.9: Approvals — reject company
- POST /api/admin/roles/companies/:id/reject → status='rejected' + admin_notes

### TC-AD.10: Approvals — edit registered company
- PUT /api/admin/roles/companies/:id/edit → updates all fields

### TC-AD.11: Inquiries list
- GET /api/admin/inquiries → paginated, joins company_profiles

### TC-AD.12: Inquiries export Excel
- GET /api/admin/inquiries/export → downloads .xlsx

### TC-AD.13: Notification emails CRUD
- GET /api/admin/notification-emails → list
- POST → add email
- PUT /:id → toggle active
- DELETE /:id → remove

### TC-AD.14: Company import — download template
- GET /api/admin/companies/import/template → .docx file

### TC-AD.15: Company import — upload + parse
- POST /api/admin/companies/import/parse → parsed fields

### TC-AD.16: Company import — confirm
- POST /api/admin/companies/import/confirm → creates company in both tables

### TC-AD.17: Company merge
- GET /api/admin/companies/merge-candidates → unmerged lists
- POST /api/admin/companies/:id/merge → merges profile with scraped

---

## API Smoke Tests (Production)

### TC-API.1: Public endpoints
- GET /api/designers → 200 (legacy, should still work)
- GET /api/companies → 200
- GET /api/companies/:id → 200

### TC-API.2: Auth endpoints
- POST /api/auth/register → 201 or 400
- POST /api/auth/login → 200 or 401
- POST /api/auth/check-availability → 200
- GET /api/auth/me → 401 without token

### TC-API.3: Protected endpoints without token
- POST /api/auth/select-role → 401
- POST /api/auth/company/profile → 401
- GET /api/notifications → 401

### TC-API.4: Admin endpoints without admin token
- GET /api/admin/users → 401
- GET /api/admin/companies → 401

---

## Cross-cutting

### TC-X.1: Notification bell (logged in)
- Shows in Navbar for all logged-in users
- Click → dropdown with notifications
- Unread count badge

### TC-X.2: Navbar consistency
- Logo left, menu right on all pages
- "Find Company" dropdown works
- Logged in: avatar + bell; Logged out: Login + Join as Company

### TC-X.3: Global form components
- All inputs use FormInput/FormTextarea/FormSelect
- Consistent border-radius 16px
- Focus ring: #b8864a

### TC-X.4: Logout clears state
- Clears token, user, active_role, designer from localStorage
- Redirects to /auth
