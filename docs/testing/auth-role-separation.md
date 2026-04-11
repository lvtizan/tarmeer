# Auth Role Separation Test Cases

## TC-AR.1: /auth register defaults to homeowner
- POST /api/auth/register with `{ email, password, role: 'homeowner' }`
- Response: user created with `active_role='homeowner'`, `onboarding_completed=1`
- After email verify + login → redirects to /dashboard (NOT /onboarding)

## TC-AR.2: /join register sets company role
- POST /api/auth/register with `{ email, password, role: 'company' }`
- Response: user created with `active_role='company'`, `onboarding_completed=1`
- After email verify + login → redirects to /company (NOT /onboarding)

## TC-AR.3: /auth Google OAuth passes role=homeowner
- GET /api/auth/google?role=homeowner → redirects to Google with state=homeowner
- After OAuth callback → user.active_role='homeowner'
- AuthCallbackPage → navigates to /dashboard

## TC-AR.4: /join Google OAuth passes role=company
- GET /api/auth/google?role=company → redirects to Google with state=company
- After OAuth callback → user.active_role='company'
- AuthCallbackPage → navigates to /company

## TC-AR.5: /join email continue passes role
- Enter email on /join hero card → redirects to /auth?role=company&email=xxx
- AuthPage reads role=company from URL
- Register request includes role='company'

## TC-AR.6: Existing user login unaffected
- Existing user with active_role='homeowner' logs in via /auth → /dashboard
- Existing user with active_role='company' logs in via /auth → /company
- No onboarding redirect for any existing user

## TC-AR.7: Register without role (backward compat)
- POST /api/auth/register without role field
- User created with role='user', active_role=null
- Login → goes to /dashboard (not /onboarding)

## TC-AR.8: AuthCallbackPage no onboarding redirect
- OAuth callback with no active_role → /dashboard (NOT /onboarding)
- OAuth callback with active_role='company' → /company

## TC-AR.9: TypeScript compiles
- `npx tsc --noEmit` (frontend) → no errors
- `cd server && npx tsc --noEmit` (backend) → no errors
