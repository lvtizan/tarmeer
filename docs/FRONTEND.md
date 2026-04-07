# Frontend Architecture

---

## Project Structure

```
src/
  App.tsx                  # Root router -- all routes defined here
  index.css                # Global CSS: theme variables, btn-primary, input-standard, focus styles
  main.tsx                 # React entry point

  components/
    Layout.tsx             # Public page shell: Navbar + main + Footer
    Navbar.tsx             # Top navigation (handles role-based dashboard links)
    Footer.tsx             # Site footer with WhatsApp link
    PageContainer.tsx      # Centered content wrapper (max-w-6xl)
    MasonryGallery.tsx     # Portfolio image grid with fingerprint dedup
    Lightbox.tsx           # Full-screen image viewer
    InquiryForm.tsx        # Design inquiry submission form
    ProjectUploader.tsx    # Multi-image project upload widget
    SeoManager.tsx         # Dynamic meta tags per route
    GoogleOneTap.tsx       # Google One Tap sign-in integration
    NotificationBell.tsx   # In-app notification dropdown
    WartimeNotice.tsx      # Maintenance/warning banner

    ui/                    # Shared primitive components
      Avatar.tsx           # User avatar with initials fallback
      SmartImage.tsx       # Image with automatic fallback chain
      Spinner.tsx          # Spinner, PageSpinner, TableSpinner
      LoadingButton.tsx    # Button with inline loading state
      SidebarNavLink.tsx   # Dashboard sidebar nav link (active state)
      HoverDeleteIconButton.tsx  # Delete icon shown on hover

    form/                  # Form primitives
      FormInput.tsx        # FormInput, FormTextarea, FormSelect, FormLabel, FormTag
      SelectField.tsx      # Select with optional leading icon

    admin/                 # Admin panel components
    company/               # Company portal components (CompanyLayout, etc.)
    designer/              # Designer-specific components
    designers/             # Designer listing components
    companies/             # Company listing/card components
    home/                  # Homepage sections
    project/               # Project detail components
    services/              # Service page components

  contexts/
    AdminContext.tsx        # Admin auth state (login, logout, permissions)
    DesignerContext.tsx     # Designer profile + project CRUD

  hooks/
    useAnalyticsTracking.ts  # Page view analytics
    useNavigationHandler.ts  # Navigation helpers
    useStats.ts              # Dashboard statistics
    useVisitorTracking.ts    # Visitor fingerprinting

  layouts/
    UserDashboardLayout.tsx  # Homeowner dashboard shell (sidebar + content)

  lib/
    api.ts                 # ApiClient class -- all authenticated API calls
    publicApi.ts           # Public (no-auth) API functions
    adminApi.ts            # Admin-specific API functions
    imageUrl.ts            # resolveImageUrl() for display
    imageCleanup.ts        # sanitizeImageUrl(), dedup, fallback chains
    categoryNormalize.ts   # Raw category -> display name mapping
    storage.ts             # Safe localStorage wrappers
    constants.ts           # App-wide constants (WhatsApp link, limits)
    errorHandler.ts        # Centralized error handling
    analytics.ts           # Analytics event helpers
    companyData.ts         # Company/portfolio TypeScript interfaces
    designerOrder.ts       # Designer sorting logic
    dropFiles.ts           # Drag-and-drop file handling
    formInputRules.ts      # Input validation rules
    formatNumber.ts        # Number formatting
    projectImageUpload.ts  # Project image upload utilities
    requestDeduplication.ts  # Request dedup middleware

  config/                  # App configuration
  data/                    # Static data files

  pages/
    HomePage.tsx
    AuthPage.tsx           # Login + register (unified)
    AuthCallbackPage.tsx   # OAuth callback handler
    CompaniesPage.tsx      # Company directory listing
    CompanyDetailPage.tsx  # Single company profile + portfolio
    OnboardingPage.tsx     # New user role selection
    SettingsPage.tsx       # Shared settings (used by company + homeowner)
    ShowroomsPage.tsx      # Materials/showroom browser
    ...                    # (27 page files total)

    admin/                 # Admin panel pages (AdminDashboardPage, AdminUsersPage, etc.)
    company/               # Company portal pages (CompanyDashboardPage, CompanyProjectsPage)
    dashboard/             # Homeowner dashboard pages
    designer/              # Designer-specific pages

server/                    # Express backend (separate npm project)
scripts/                   # Scraper, migration, and utility scripts
public/                    # Static assets (images, favicons)
```

---

## Routing Convention

All routes are defined in `src/App.tsx` using react-router-dom v6 `<Routes>` / `<Route>`.

### Route Groups

| Prefix | Layout | Auth | Description |
|---|---|---|---|
| `/admin/*` | `AdminLayout` | Admin token | Admin panel (wrapped in `AdminProvider`) |
| `/company/*` | `CompanyLayout` | `ProtectedRoute` | Company portal (dashboard, projects, settings) |
| `/dashboard/*` | `UserDashboardLayout` | `ProtectedRoute` | Homeowner dashboard |
| `/onboarding` | None | `ProtectedRoute` | Post-registration role selection |
| `/auth` | `Layout` | None | Login/register page |
| `/*` | `Layout` | None | All public pages |

### Page-to-Route Mapping

All pages are **lazy-loaded** via `React.lazy()` with a shared `<Suspense fallback={<PageLoader />}>`.

Key routes:
- `/` -> `HomePage`
- `/companies` -> `CompaniesPage`
- `/companies/:id` -> `CompanyDetailPage`
- `/materials` -> `ShowroomsPage`
- `/materials/:category` -> `MaterialCategoryPage`
- `/materials/brands/:slug` -> `BrandPage`
- `/services/new-home-design` -> `NewHomeDesignPage`
- `/auth` -> `AuthPage`

### Legacy Redirects

- `/designer/*` -> `/company`
- `/designers` -> `/companies`
- `/designers/apply` -> `/onboarding`
- `/login`, `/register` -> `/auth`
- `/showrooms` -> `/materials`

---

## Auth Pattern

There is no single `AuthContext`. Authentication is handled through two separate systems:

### User Auth (api.ts)

- Token stored in localStorage key `"token"` via `api.setToken()` / `api.getToken()`
- `ProtectedRoute` checks `api.getToken()` -- redirects to `/auth` if missing
- User profile stored in localStorage key `"user"` (JSON)
- Role stored in localStorage key `"active_role"` (string: `"company"`, `"homeowner"`, etc.)

```tsx
// Check if logged in
const token = api.getToken();

// Get current role
const activeRole = localStorage.getItem('active_role');

// Fetch current user
const { user } = await api.getMe();
```

### Admin Auth (AdminContext.tsx)

- Separate token in localStorage key `"admin_token"` (managed by `adminApi`)
- `AdminProvider` wraps admin routes, provides `useAdmin()` hook
- Supports permission checks: `hasPermission('can_approve')`, `isSuperAdmin`

```tsx
const { admin, login, logout, hasPermission, isSuperAdmin } = useAdmin();
```

### Designer Context (DesignerContext.tsx)

- Not auth per se, but manages designer profile + projects for logged-in company users
- Profile cached in localStorage key `"designer"` (JSON)
- Provides `useDesigner()` hook with profile CRUD and project management

```tsx
const { profile, saveProfile, projects, addProject, deleteProject } = useDesigner();
```

### Role-Based Navigation

The Navbar reads `localStorage.getItem('active_role')` to determine which dashboard link to show and where the profile icon navigates. On logout, `active_role` is removed from localStorage.

---

## Image Handling

### resolveImageUrl() -- for display

Location: `src/lib/imageUrl.ts`

Normalizes any image URL for rendering in `<img src>`:
- Handles relative paths, `public/` prefixes, protocol-relative URLs
- Rewrites admin subdomain URLs to www subdomain
- Routes `/uploads/*` through `/api/uploads/*` (backend static route)
- Applies hotfix path corrections for known broken images
- Passes through base64 data URLs unchanged

```tsx
import { resolveImageUrl } from '../lib/imageUrl';
<img src={resolveImageUrl(company.logo)} />
```

### sanitizeImageUrl() -- for data processing

Location: `src/lib/imageCleanup.ts`

Cleans and normalizes URLs for storage/comparison. Similar to `resolveImageUrl` but also:
- Rejects unrecognized URL formats (returns `''`)
- Filters out seeded avatar URLs (Unsplash stock photos)
- Provides `sanitizeImageUrls()` for batch dedup
- Provides `sanitizeAvatarUrl()` which also strips known seed avatars

### SmartImage -- for fallback

Location: `src/components/ui/SmartImage.tsx`

Drop-in `<img>` replacement that automatically tries alternative file extensions (jpg, png, webp, avif) when the primary source fails. Tracks globally failed URLs to avoid re-requesting.

```tsx
import SmartImage from './ui/SmartImage';
<SmartImage src={project.coverImage} alt="Project" className="w-full" />
```

### MasonryGallery -- for portfolios

Location: `src/components/MasonryGallery.tsx`

Renders portfolio images in a responsive masonry grid (1/2/3 columns). Features:
- Category tabs with counts
- Paginated loading (12 per page)
- On-load quality filters: hides images < 200x150px, extreme aspect ratios (> 3.5 or < 0.25)
- Canvas fingerprint dedup: 16x16 grayscale thumbnail, similarity > 0.92 = hidden
- Dark image detection: average brightness < 45 = hidden
- Automatic extension fallback on error
- Framer Motion animations (fade in + stagger)
- Click behavior: Lightbox (claimed) or external redirect (scraped)

### Dedup Utilities

`imageCleanup.ts` exports several dedup functions:
- `imageDedupKey(url)` -- strips query string for comparison
- `dedupeImageEntries(items)` -- dedup array of `{ image }` objects
- `dedupeProjectCards(projects)` -- dedup project cover images across cards
- `dedupeDesignerCardImages(designers)` -- dedup project images across designer cards
- `getImageFallbackCandidates(url)` -- generate alt-extension URLs for retry

---

## Component Conventions

### When to Use Shared Components

| Need | Component | Location |
|---|---|---|
| User avatar | `<Avatar>` | `ui/Avatar.tsx` |
| Image with fallback | `<SmartImage>` | `ui/SmartImage.tsx` |
| Loading spinner | `<Spinner>`, `<PageSpinner>`, `<TableSpinner>` | `ui/Spinner.tsx` |
| Button with loading | `<LoadingButton>` | `ui/LoadingButton.tsx` |
| Sidebar nav link | `<SidebarNavLink>` | `ui/SidebarNavLink.tsx` |
| Delete button on hover | `<HoverDeleteIconButton>` | `ui/HoverDeleteIconButton.tsx` |
| Form input | `<FormInput>`, `<FormTextarea>`, `<FormSelect>` | `form/FormInput.tsx` |
| Form label | `<FormLabel>` | `form/FormInput.tsx` |
| Tag/chip toggle | `<FormTag>` | `form/FormInput.tsx` |
| Select with icon | `<SelectField>` | `form/SelectField.tsx` |
| Page width wrapper | `<PageContainer>` | `PageContainer.tsx` |

### Form Patterns

Forms typically follow this structure:
1. Wrap in `<form onSubmit={handleSubmit}>` with `e.preventDefault()`
2. Use `useState` for each field (no form library)
3. Display errors in a `text-red-500 text-sm` paragraph
4. Submit button uses `btn-primary` class or `<LoadingButton>`
5. Success feedback via state toggle or navigation

### Loading / Error States

- **Page loading**: `<PageSpinner text="Loading..." />`
- **Table loading**: `<TableSpinner colSpan={n} />`
- **Inline loading**: `<Spinner size="sm" />`
- **Button loading**: `<LoadingButton loading={isSubmitting}>Save</LoadingButton>`
- **Suspense fallback**: `<PageLoader />` (defined in App.tsx -- SVG spinner + "Loading...")
- **Error display**: Typically a `<p className="text-red-500 text-sm">{error}</p>` below the form

---

## State Management

### Contexts

| Context | Provider Location | Hook | Purpose |
|---|---|---|---|
| `AdminContext` | Wraps `/admin/*` routes | `useAdmin()` | Admin auth, permissions |
| `DesignerContext` | Wraps company portal | `useDesigner()` | Designer profile + projects |

### localStorage Keys

| Key | Type | Purpose |
|---|---|---|
| `token` | string | JWT auth token (user) |
| `admin_token` | string | JWT auth token (admin) |
| `user` | JSON | Current user profile object |
| `designer` | JSON | Designer profile cache |
| `active_role` | string | Current role (`"company"`, `"homeowner"`, etc.) |
| `admin_lang` | string | Admin panel language preference |

All localStorage access should use the safe wrappers from `src/lib/storage.ts` (`safeGetItem`, `safeSetItem`, `safeGetJSON`, `safeSetJSON`, `safeRemoveItem`) to handle Safari private mode and quota errors.

---

## Build & Dev

### Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server (frontend only, port 5180) |
| `npm run dev:all` | Start frontend + backend concurrently |
| `npm run build` | `tsc && vite build` -- typecheck + production build |
| `npm run preview` | Preview production build locally |
| `npm run deploy` | Run `deploy.config.sh` |
| `npm run audit:images` | Audit image files |
| `npm run qa:smoke` | Run smoke tests |
| `npm run backend:up` | Start backend |
| `npm run backend:health` | Health check backend |

### Vite Proxy Config

In development, Vite proxies these paths to the backend at `http://127.0.0.1:3002`:

- `/api` -- all API requests
- `/uploads` -- uploaded file access

This means frontend code can use relative paths like `/api/auth/me` or `/uploads/avatars/1.jpg` in development and they will be proxied to the Express backend.

### Key Dependencies

- **React 19** + **react-router-dom 6**
- **Tailwind CSS 4** (via `@tailwindcss/vite` plugin)
- **framer-motion** -- page transitions, gallery animations
- **lucide-react** -- icon library
- **TypeScript 5.7**
- **Vite 6**

### Backend

The Express backend lives in `server/` as a separate npm project. It runs on port 3002 and serves the API + uploaded files.
