# Homeowners

## Overview

Homeowners are the demand side of the platform. They register to find and connect with renovation companies and design studios in the UAE.

## Registration

1. User visits `/auth` page.
2. Enters email address. System checks availability via `POST /api/auth/check-availability`.
3. **New email**: Creates account with email + password. Verification email sent.
4. **Existing email**: Prompts for password login.
5. **Google OAuth**: One-tap login or redirect-based OAuth flow. Auto-verifies email.
6. **Facebook OAuth**: Currently disabled (missing credentials; controlled by `VITE_ENABLE_FACEBOOK_AUTH` env var).
7. After email verification, user lands on `/onboarding` to select role.

## Role Selection (Onboarding)

On first login (no `active_role` set), user is redirected to `/onboarding` where they choose:

- **"I Need Renovation"** (homeowner) -- redirects to `/dashboard`
- **"Professional Company"** (company) -- redirects to `/company`

Selection is persisted via `POST /api/auth/select-role` and stored in `localStorage` as `active_role`.

## Browse Companies

- Homeowners can browse all companies at `/companies` without logging in.
- Filters: city, founded year, style, services, search by name.
- Click on a company card navigates to `/companies/:id` detail page.

## Send Inquiries

- From company detail pages, homeowners can submit design inquiries.
- Inquiry endpoints: `POST /api/inquiries` (public, rate-limited), `GET /api/inquiries/mine` (authenticated).
- Inquiries include project details, contact info, and target company.

## Dashboard Features (`/dashboard`)

The homeowner dashboard (`HomeownerDashboardPage.tsx`) provides:

1. **Renovation requirements form**: area range, city, address, phone, renovation stage, budget range, notes.
2. **Photo uploads**: Before/after renovation progress photos with drag-and-drop support.
3. **Progress checklist**:
   - Step 1: Submit renovation requirements (area, city, phone, budget).
   - Step 2: Upload renovation progress photos (optional).
   - Step 3: Get matched with a verified company (handled by Tarmeer team).
4. **Assigned designer/company view**: Once admin assigns a professional, homeowner can see their contact info via `GET /api/auth/homeowner/assigned-designer`.

## Role Switch to Company

- A homeowner can apply to become a company via `/dashboard/apply-company` (`ApplyCompanyPage.tsx`).
- Submits: company name, license number, phone, city, address, description.
- Application is reviewed by admin.
- On approval, user's `active_role` switches to `company` and they gain access to the company dashboard.
- Role switching (back and forth) is available via `POST /api/auth/switch-role`.

## Settings

- Profile editing: name, email (read-only), phone, city, avatar upload.
- Password change.
- Available at `/settings` (`SettingsPage.tsx`).
