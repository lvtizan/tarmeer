# Tarmeer 4.0 — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Nginx (SSL)                       │
│   www.tarmeer.com / admin.tarmeer.com                │
├──────────────────────┬──────────────────────────────┤
│   Frontend (Vite)    │     Backend (Express)         │
│   /dist → static     │     :3002 → /api/*            │
├──────────────────────┼──────────────────────────────┤
│  Pages               │  Routes → Controllers         │
│  Components          │  Services / Lib                │
│  Contexts            │  Middleware (auth/CORS/rate)   │
│  Lib (utils)         │  Config                        │
├──────────────────────┴──────────────────────────────┤
│               MySQL (Aliyun RDS)                      │
│   rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com │
└─────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer       | Technology                                          |
|-------------|-----------------------------------------------------|
| Frontend    | React 18 + TypeScript + Vite + Tailwind CSS 4       |
| Backend     | Express + TypeScript + mysql2 (connection pool)     |
| Auth        | Passport.js (Google/Facebook OAuth) + JWT + sessions|
| Email       | Nodemailer → Aliyun DirectMail (SMTP)               |
| Deploy      | Aliyun ECS + Nginx + PM2                            |
| Database    | Aliyun RDS MySQL (utf8mb4)                          |
| Dev proxy   | Vite dev server → localhost:3002                    |
| Build       | Vite (vendor + animations manual chunks)            |

---

## Business Domains

### Companies (core)
The primary entity. Two sources of company data:

1. **Directory companies** (`uae_companies` table) — scraped from UAE design firm websites. 100 companies in `scripts/uae-scraper/companies-data-final.json`. Shown in the public directory at `/companies`.
2. **Registered companies** (`company_profiles` table) — created when a user signs up with `role=company` and completes onboarding. Approved ones also appear in the directory.

Key files:
- Frontend: `src/pages/CompaniesPage.tsx`, `src/pages/CompanyDetailPage.tsx`, `src/components/companies/`
- Backend: `server/src/routes/companies.ts`, `server/src/routes/publicCompanies.ts`, `server/src/controllers/companyController.ts`, `server/src/controllers/publicCompanyController.ts`, `server/src/controllers/companyAdminController.ts`
- Data merge: directory companies listed BEFORE approved companies (reliability invariant)

### Homeowners
Browse companies, submit design inquiries, manage their own dashboard.

Key files:
- Frontend: `src/pages/dashboard/HomeownerDashboardPage.tsx`, `src/pages/dashboard/HomeownerProjectsPage.tsx`
- Backend: `server/src/controllers/homeownerController.ts`, `server/src/controllers/inquiryController.ts`

### Auth
Unified user system with role switching. Users register as `homeowner` or `company`, can switch roles. OAuth via Google One Tap and Facebook.

Key files:
- Frontend: `src/pages/AuthPage.tsx`, `src/pages/AuthCallbackPage.tsx`, `src/pages/OnboardingPage.tsx`, `src/components/GoogleOneTap.tsx`
- Backend: `server/src/routes/auth.ts`, `server/src/controllers/userAuthController.ts`, `server/src/controllers/onboardingController.ts`, `server/src/middleware/passport.ts`, `server/src/middleware/auth.ts`, `server/src/lib/jwtManager.ts`
- Roles: `homeowner`, `company`, `admin` (separate `admin_users` table)
- Role switching: `POST /api/auth/switch-role`

### Admin
Separate admin portal at `/admin`. Super-admin and sub-admin with granular permissions.

Key files:
- Frontend: `src/pages/admin/` (21 pages), `src/components/admin/AdminLayout.tsx`, `src/contexts/AdminContext.tsx`, `src/lib/adminApi.ts`
- Backend: `server/src/routes/admin.ts` (100+ endpoints), `server/src/controllers/adminController.ts`, `server/src/middleware/adminAuth.ts`
- Capabilities: user/company/designer CRUD, approval workflows, analytics, visitor tracking, role management, company import, notification email config, complaint handling

### Company Portal
Authenticated company dashboard for managing profile and projects.

Key files:
- Frontend: `src/pages/company/CompanyDashboardPage.tsx`, `src/pages/company/CompanyProjectsPage.tsx`, `src/components/company/CompanyLayout.tsx`
- Backend: `server/src/controllers/companyProfileController.ts`, `server/src/controllers/projectController.ts`

### Home / Marketing
Landing page, service pages, materials/showrooms directory, contact form.

Key files:
- Frontend: `src/pages/HomePage.tsx`, `src/pages/NewHomeDesignPage.tsx`, `src/pages/SoftDecorationPage.tsx`, `src/pages/HouseExteriorDesignPage.tsx`, `src/pages/ShowroomsPage.tsx`, `src/pages/MaterialCategoryPage.tsx`, `src/pages/BrandPage.tsx`, `src/pages/ContactPage.tsx`
- Backend: `server/src/routes/contact.ts`, `server/src/routes/stats.ts`

### Designers (legacy)
Original entity before company system. Still in DB and has routes, but frontend redirects `/designers` to `/companies`.

Key files:
- Backend: `server/src/routes/designers.ts`, `server/src/controllers/designerController.ts`
- Legacy redirects in `src/App.tsx` lines 140-143

---

## Frontend Structure

```
src/
├── App.tsx                    # Router: all routes defined here
├── main.tsx                   # Entry point (React 18 createRoot)
├── index.css                  # Global styles, CSS vars, Tailwind base
├── pages/
│   ├── admin/                 # 21 admin pages (AdminDashboardPage, AdminUsersPage, etc.)
│   ├── company/               # CompanyDashboardPage, CompanyProjectsPage
│   ├── dashboard/             # Homeowner dashboard pages
│   ├── designer/              # Legacy designer pages
│   ├── HomePage.tsx           # Landing page
│   ├── CompaniesPage.tsx      # Public company directory
│   ├── CompanyDetailPage.tsx  # Company detail with portfolio
│   ├── AuthPage.tsx           # Login/register (tabbed)
│   ├── OnboardingPage.tsx     # Post-registration role setup
│   ├── ShowroomsPage.tsx      # Materials marketplace
│   └── ...                    # Service pages, legal pages, etc.
├── components/
│   ├── admin/                 # AdminLayout, tables, modals
│   ├── companies/             # CompanyCard
│   ├── company/               # CompanyLayout (authed portal)
│   ├── home/                  # Banner, CompanySection, PricingSection, etc.
│   ├── ui/                    # Avatar, Spinner, SmartImage, LoadingButton, etc.
│   ├── form/                  # FormInput, SelectField
│   ├── services/              # Service pages components
│   ├── Layout.tsx             # Public page shell (Navbar + Footer)
│   ├── Navbar.tsx             # Main navigation bar
│   ├── Footer.tsx             # Site footer
│   ├── MasonryGallery.tsx     # Image gallery with dedup + dark-image filtering
│   ├── Lightbox.tsx           # Image lightbox viewer
│   ├── InquiryForm.tsx        # Design inquiry submission form
│   └── SeoManager.tsx         # Dynamic meta tags
├── contexts/
│   ├── AdminContext.tsx        # Admin auth state
│   └── DesignerContext.tsx     # Designer/company auth state (legacy name)
├── lib/
│   ├── api.ts                 # API client (fetch wrapper + token management)
│   ├── adminApi.ts            # Admin API client (20+ endpoints)
│   ├── publicApi.ts           # Public API client (companies, designers, projects)
│   ├── categoryNormalize.ts   # 180 scraped categories → ~10 display names
│   ├── imageUrl.ts            # Image URL resolution helpers
│   ├── imageCleanup.ts        # Client-side image quality filtering
│   ├── storage.ts             # LocalStorage helpers
│   ├── errorHandler.ts        # Global error handling
│   └── ...
├── hooks/
│   ├── useStats.ts            # Analytics tracking hook
│   ├── useVisitorTracking.ts  # Visitor session tracking
│   └── useAnalyticsTracking.ts
├── layouts/
│   └── UserDashboardLayout.tsx # Homeowner dashboard shell
├── config/
│   └── site-config.ts         # Site-wide configuration
└── data/
    ├── companies.ts           # Company data types and static data
    ├── designers.ts           # Designer data types
    ├── materials.ts           # Materials/showroom data
    └── brands.ts              # Brand directory data
```

---

## Backend Structure

```
server/src/
├── app.ts                          # Express app setup, middleware chain, route mounting
├── config/
│   ├── index.ts                    # Centralized config (port, DB, JWT, SMTP, OAuth)
│   ├── database.ts                 # MySQL connection pool (mysql2)
│   ├── email.ts                    # Email transport config
│   └── oauth.ts                    # Google/Facebook OAuth credentials
├── routes/
│   ├── auth.ts                     # /api/auth/* — register, login, OAuth, profile, role switching
│   ├── admin.ts                    # /api/admin/* — 100+ admin endpoints
│   ├── companies.ts                # /api/companies/* — directory company CRUD
│   ├── publicCompanies.ts          # /api/public/companies/* — public listing + detail
│   ├── designers.ts                # /api/designers/* — legacy designer routes
│   ├── projects.ts                 # /api/projects/* — project CRUD
│   ├── inquiries.ts                # /api/inquiries/* — design inquiry submissions
│   ├── companyApplications.ts      # /api/company-applications/* — apply to become company
│   ├── complaints.ts               # /api/complaints/* — DMCA/copyright complaints
│   ├── contact.ts                  # /api/contact/* — contact form
│   ├── notifications.ts            # /api/notifications/* — in-app notifications
│   └── stats.ts                    # /api/stats/* — page views, clicks, events
├── controllers/
│   ├── userAuthController.ts       # User registration, login, password reset
│   ├── onboardingController.ts     # Role selection, profile setup
│   ├── homeownerController.ts      # Homeowner profile CRUD
│   ├── companyProfileController.ts # Company profile CRUD
│   ├── companyController.ts        # Directory company queries
│   ├── publicCompanyController.ts  # Public company listing with merge logic
│   ├── companyAdminController.ts   # Admin company management (28KB, largest controller)
│   ├── companyMergeController.ts   # Merge registered company with scraped entry
│   ├── adminController.ts          # Admin auth (login, install, password)
│   ├── roleAdminController.ts      # Admin role/permission management
│   ├── designerController.ts       # Designer CRUD
│   ├── designerAdminController.ts  # Admin designer management
│   ├── projectController.ts        # Project CRUD with image storage
│   ├── inquiryController.ts        # Inquiry CRUD + export
│   ├── complaintController.ts      # Complaint submission + admin review
│   ├── contactController.ts        # Contact form handler
│   ├── statsController.ts          # Analytics event recording
│   ├── visitorAdminController.ts   # Visitor log admin views
│   ├── analyticsAdminController.ts # Analytics admin views
│   └── userAdminController.ts      # Admin user management
├── middleware/
│   ├── auth.ts                     # JWT authentication (user)
│   ├── adminAuth.ts                # JWT authentication (admin)
│   ├── passport.ts                 # Passport.js strategies (Google, Facebook)
│   ├── authRateLimit.ts            # Auth-specific rate limiting
│   └── antiScraping.ts             # Bot/scraper detection on public endpoints
├── services/
│   ├── emailService.ts             # Transactional emails (verification, reset, notifications)
│   ├── notificationService.ts      # In-app notification creation + email relay
│   ├── companyImportService.ts     # Bulk company import from Excel
│   └── portfolioScraper.ts         # Live portfolio scraping for company onboarding
├── lib/
│   ├── autoMigrate.ts              # Idempotent schema migrations on startup
│   ├── corsOrigins.ts              # CORS whitelist management
│   ├── jwtManager.ts               # JWT sign/verify with rotation support
│   ├── rateLimitPolicy.ts          # Rate limit skip rules (dev, health, static)
│   ├── requestLimits.ts            # Request body size limits
│   ├── projectImageStorage.ts      # Image file persistence (base64 → disk)
│   ├── ipLocation.ts               # IP geolocation for visitor tracking
│   ├── linkedDesigner.ts           # Link user account to legacy designer record
│   ├── publicCompaniesQuery.ts     # Public company list query builder
│   ├── publicDesignersQuery.ts     # Public designer list query builder
│   ├── publicProjectsQuery.ts      # Public project list query builder
│   ├── publicCompaniesSerialization.ts  # Company response shaping
│   ├── publicDesignerSerialization.ts   # Designer response shaping
│   ├── publicImageCleanup.ts       # Server-side image quality filtering
│   ├── companyProfileDraft.ts      # Draft save/load for company profiles
│   ├── designerApproval.ts         # Designer approval business logic
│   ├── designerSoftDelete.ts       # Soft delete for designers
│   └── ...test.ts files            # Unit tests (vitest)
```

---

## API Routes Summary

### Public (no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/public/companies` | List approved companies (directory + registered merged) |
| GET | `/api/public/companies/categories` | Service category list |
| GET | `/api/public/companies/:id` | Company detail with portfolio |
| GET | `/api/companies` | Directory companies list |
| GET | `/api/companies/:slug` | Directory company by slug |
| GET | `/api/designers` | List approved designers |
| GET | `/api/designers/:id` | Designer detail |
| GET | `/api/projects` | List published projects |
| GET | `/api/projects/:id` | Project detail |
| POST | `/api/contact` | Submit contact form |
| POST | `/api/complaints` | Submit DMCA complaint |
| POST | `/api/stats/*` | Record page views, clicks, events |

### Auth (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Register (email/password) |
| POST | `/login` | Login |
| POST | `/check-availability` | Check email availability |
| POST | `/verify-email` | Verify email token |
| POST | `/resend-verification` | Resend verification email |
| POST | `/forgot-password` | Request password reset |
| POST | `/reset-password` | Reset password with token |
| GET | `/me` | Get current user profile |
| PUT | `/me` | Update profile |
| POST | `/select-role` | Initial role selection |
| POST | `/switch-role` | Switch between homeowner/company |
| GET/POST | `/google/*` | Google OAuth flow |
| GET/POST | `/facebook/*` | Facebook OAuth flow |
| POST | `/google/one-tap` | Google One Tap sign-in |
| GET/POST | `/company/profile` | Company profile CRUD |
| GET/POST | `/homeowner/profile` | Homeowner profile CRUD |

### Authenticated User
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/projects` | Create project |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/inquiries` | Submit design inquiry |
| GET | `/api/inquiries/mine` | My inquiries |
| POST | `/api/company-applications` | Apply to become company |
| GET | `/api/notifications` | List notifications |
| PUT | `/api/notifications/:id/read` | Mark notification read |

### Admin (`/api/admin`) — requires admin JWT
Designers, users, companies, inquiries, complaints, analytics, visitors, roles, notification emails, company import, sub-admin management. ~100 endpoints. See `server/src/routes/admin.ts` for full list.

---

## Database Tables

| Table | Description |
|-------|-------------|
| `users` | Unified user accounts (homeowner/company roles, OAuth IDs, soft delete) |
| `designers` | Legacy designer profiles (linked via `user_id` FK to users) |
| `projects` | Portfolio projects (belongs to designer, status workflow) |
| `contacts` | Contact form submissions |
| `uae_companies` | Scraped directory companies (100 entries, display_order fields) |
| `company_profiles` | Registered company profiles (linked to users via `user_id`) |
| `company_applications` | Company role applications (approval workflow) |
| `design_inquiries` | Design inquiry submissions from homeowners |
| `complaints` | DMCA/copyright complaint submissions |
| `notifications` | In-app notifications for users |
| `notification_emails` | Admin notification email recipients |
| `admin_users` | Admin accounts (separate from users, with permissions JSON) |
| `visitor_logs` | Site visitor tracking |
| `analytics_events` | Analytics event store |

Schema definition: `database/schema.sql` (base tables)
Auto-migration: `server/src/lib/autoMigrate.ts` (adds columns/indexes on startup, idempotent, add-only)

---

## Deployment Architecture

```
Server: 47.91.108.104 (Aliyun ECS, Dubai region)
SSH:    ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104

┌─────────────────────────────────────────────────┐
│  Nginx (ports 80/443, SSL termination)           │
│                                                   │
│  www.tarmeer.com    → /tarmeer/tarmeer_web_portal/│
│  admin.tarmeer.com  → /tarmeer/tarmeer_web_crm/   │
│  */api/*            → proxy_pass :3002             │
│  tarmeer.com        → 301 → www.tarmeer.com        │
├─────────────────────────────────────────────────┤
│  Frontend (static)                                │
│  /tarmeer/tarmeer_web_portal/   ← vite build dist │
├─────────────────────────────────────────────────┤
│  Backend (PM2)                                    │
│  /tarmeer/tarmeer_api/          ← compiled JS      │
│  Port: 3002                                       │
├─────────────────────────────────────────────────┤
│  CRM (separate app)                               │
│  /tarmeer/tarmeer_web_crm/                        │
├─────────────────────────────────────────────────┤
│  Shared uploads: /tarmeer/tarmeer_web_crm/server/uploads │
│  Primary uploads: /tarmeer/tarmeer_api/public/uploads    │
└─────────────────────────────────────────────────┘

Database: Aliyun RDS MySQL
  Host: rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com
  DB:   tarmeer
```

### Deploy Commands
- **Frontend**: `vite build` then `rsync dist/ → ECS /tarmeer/tarmeer_web_portal/`
- **Backend**: `./deploy-backend-ecs.sh` (build → tar → scp → PM2 restart)
- **Nginx configs**: `nginx-tarmeer.conf`, `nginx-admin.conf`, `nginx-tarmeer-staging.conf`

---

## Key Design Decisions

### Company Data Merge
Public company listing merges two sources: `uae_companies` (scraped directory) and `company_profiles` (registered). Directory companies always appear first. When a registered company is bound to a scraped entry (`owner_user_id` on `uae_companies`), they merge into one listing.

### Image Quality Pipeline
Five-stage filtering to ensure portfolio quality:
1. URL-level filter (skip logos, icons, SVGs, social media)
2. File-level filter (sips: remove < 200x150px or < 5KB)
3. Canvas fingerprint dedup (16x16 grayscale, similarity > 0.92 = duplicate)
4. Dark image detection (avg brightness < 45 = hidden)
5. Aspect ratio filter (> 3.5 or < 0.25 = hidden)

### Auth Architecture
- Users table is the single source of truth for all non-admin accounts
- `role` field: permanent capability, `active_role`: current view mode
- Admin uses separate `admin_users` table with `permissions` JSON column
- JWT tokens for both user and admin (different secrets not required but different middleware)

### Category Normalization
180 raw scraped categories mapped to ~10 display names via keyword heuristics in `src/lib/categoryNormalize.ts`.
