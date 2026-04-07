# Auth & Roles

## Roles

### homeowner
- Default role for new users who select "I Need Renovation" during onboarding.
- Can browse companies, send inquiries, upload renovation photos, receive matched professionals.
- Dashboard at `/dashboard`.

### company
- Design studio or renovation company.
- Selected during onboarding ("Professional Company") or upgraded from homeowner via application + admin approval.
- Can manage company profile, upload projects, view leads.
- Dashboard at `/company`.

### admin
- Full system access: user management, company management, designer management, inquiry review, analytics, complaints.
- Separate login flow via `admin.tarmeer.com` (redirects `/` to `/admin/login`).
- Admin accounts are created via installation endpoint (`POST /api/admin/install`) or by a super admin (`POST /api/admin/admins`).
- Permissions system: `can_view_stats`, `can_approve`, `can_sort`. Super admin has all permissions.

## Role Switching

- **Homeowner to Company**: User applies at `POST /api/company-applications`. Admin reviews and approves at `PUT /api/admin/company-applications/:id/review`. On approval, role switches to `company`.
- **Company to Homeowner**: User can switch back via `POST /api/auth/switch-role` with `{ role: 'homeowner' }`.
- **Admin**: Entirely separate auth system. Admin accounts use the `admins` table, not the `designers`/`users` tables. Login via `POST /api/admin/login`.

## Auth Methods

### Email/Password
- Registration: `POST /api/auth/register` (email, password, fullName, phone, city).
- Verification email sent with token. Verified at `POST /api/auth/verify-email`.
- Login: `POST /api/auth/login`. Returns JWT token.
- Password reset: `POST /api/auth/forgot-password` then `POST /api/auth/reset-password`.
- Temporary email domains are blocked (mailinator.com, guerrillamail.com, etc.).

### Google OAuth
- Enabled by default when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured on backend.
- Frontend controlled by `VITE_ENABLE_GOOGLE_AUTH` (defaults to enabled unless set to `'false'`).
- Two flows:
  1. **Google One Tap**: `POST /api/auth/google/one-tap` -- verifies ID token via Google tokeninfo endpoint.
  2. **Redirect-based**: `GET /api/auth/google` initiates passport OAuth flow, callback at `GET /api/auth/callback/google`.
- Auto-verifies email on OAuth login.

### Facebook OAuth
- Currently disabled -- missing credentials.
- Frontend controlled by `VITE_ENABLE_FACEBOOK_AUTH` (defaults to disabled unless set to `'true'`).
- When enabled: `GET /api/auth/facebook` initiates flow, callback at `GET /api/auth/callback/facebook`.
- Uses passport-facebook strategy with `profileFields: ['id', 'displayName', 'emails', 'photos']`.

## Token Management

- **JWT**: Signed with `config.jwt.secret`, expires in 7 days.
- **localStorage keys**:
  - `token` -- JWT auth token (managed by `api.ts`).
  - `active_role` -- Current role (`homeowner`, `company`, or `admin`).
  - `user` -- Cached user info object.
  - `designer` -- Legacy cached designer info.
  - `admin_token` -- Separate token for admin sessions.
- **API module** (`src/lib/api.ts`): `api.getToken()`, `api.clearToken()`, `api.request()` automatically attaches `Authorization: Bearer <token>` header.
- On logout: all localStorage keys are cleared, user is redirected to `/auth`.

## Auth Flow Summary

```
/auth (email entry)
  |-- New email --> Create account --> Verification email --> /verify-email --> /onboarding
  |-- Existing email --> Password login --> Route by active_role:
  |     |-- No role --> /onboarding
  |     |-- homeowner --> /dashboard
  |     |-- company --> /company
  |-- Google One Tap --> Auto-create/login --> Route by active_role
  |-- Google OAuth redirect --> /auth/callback --> Route by active_role
```
