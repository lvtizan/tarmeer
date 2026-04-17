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

## Mobile Adaptation Rules

These rules apply to all pages. Violations should be fixed whenever a page is touched.

### 1. Step Indicators / Stepper

- **Always use `grid grid-cols-N`**, never `flex` with fixed-width connectors.
- Connector lines must be **absolute-positioned** from the center of one column to the center of the next (`left-1/2 right-0` / `right-1/2 left-0`, `top-[18px]`).
- The circle must have `relative z-10` so it renders above the connector line.
- Labels must **wrap** — never add `whitespace-nowrap` to step labels.
- Label font: `text-[10px]` with `text-center leading-tight px-1`.

```tsx
// Correct pattern
<div className="grid grid-cols-3 relative">
  {steps.map((step, i) => (
    <div className="flex flex-col items-center relative">
      {i > 0 && <div className="absolute top-[18px] right-1/2 left-0 h-0.5 bg-stone-200" />}
      {i < steps.length - 1 && <div className="absolute top-[18px] left-1/2 right-0 h-0.5 bg-stone-200" />}
      <div className="relative z-10 w-9 h-9 rounded-full ...">...</div>
      <span className="mt-1.5 text-[10px] text-center leading-tight px-1">...</span>
    </div>
  ))}
</div>
```

### 2. Card Grids

- **2 cards**: `grid-cols-2` — always symmetric.
- **3 cards**: `grid-cols-3` with smaller padding (`p-3 sm:p-4`), not `grid-cols-2` which creates an orphaned third card.
- **4+ cards**: `grid-cols-2 sm:grid-cols-4` (2 on mobile, 4 on desktop).
- Secondary hint text inside cards: `hidden sm:block` on mobile to avoid cramping.
- Font sizes in cards: `text-xl sm:text-2xl` for numbers, `text-[11px] sm:text-xs` for labels.

### 3. Select / Dropdown Controls

- **Never use native `<select>`** — Android renders it as a dark-background OS dialog with poor contrast.
- Always use `<AdminSelect>` from `src/components/ui/AdminSelect.tsx`.
- `AdminSelect` is a custom div-based dropdown: white background, 15px text, stone border, max-h-60 scrollable list.
- Touch target per option: `py-3` minimum (≈ 44px).

### 4. Form Inputs

- Input height: `h-[50px]` — keep on all screen sizes (adequate touch target).
- Labels: `text-xs font-medium uppercase tracking-wider text-stone-500` — do not shrink on mobile.
- Required field markers: red asterisk `<span className="text-red-500">*</span>` on all required labels.
- Validation: show red border (`border-red-400`) only after first submit attempt (`tried` state pattern).

### 5. Touch Targets

- All interactive elements (buttons, links, nav items): `min-h-[44px]`.
- Dropdown list items: `py-3` (≈ 44px).
- Icon-only buttons: `w-10 h-10` minimum with `flex items-center justify-center`.

### 6. Typography Minimums

| Use | Class | Min size |
|-----|-------|----------|
| Body / input text | `text-[15px]` | 15px |
| Labels / captions | `text-xs` | 12px |
| Step labels / micro | `text-[10px]` | 10px |
| Never below | — | 10px |

- Never use `text-stone-300` or lighter for readable text (contrast too low).
- `text-stone-400` only for placeholder text inside inputs.

### 7. Layout & Spacing

- Page-level padding: `px-4 sm:px-6` (16px on mobile, 24px on sm+).
- Card internal padding: `p-3 sm:p-4`.
- Section gaps: `space-y-4` on mobile, `space-y-6` on desktop where needed.
- Horizontal overflow: avoid any `whitespace-nowrap` on text that could exceed 320px.

### 8. Testing Checklist (before deploy)

When touching a page with UI components, verify on 375px viewport:
- [ ] No horizontal scroll
- [ ] All text readable (no truncation/clipping)
- [ ] Step circles centered within their columns
- [ ] Card grids symmetric (no orphaned cards)
- [ ] Select dropdowns open with white background
- [ ] All touch targets ≥ 44px

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

---

## Admin List Page Conventions

All admin list pages (Inquiries, Companies, Users, Designers) MUST follow these patterns:

### Filter Row
- All filter controls use uniform `h-9` (36px) height
- AdminSelect: `className="!h-9 !px-3 !text-sm"` to override default h-[50px]
- Search input: `h-9 px-4 rounded-2xl border border-stone-200 bg-stone-50/80 text-sm`
- No labels above filter controls (placeholder text is sufficient)
- Layout: `flex items-center gap-2` or `gap-3`

### Batch Action Bar
Shown when `selected.size > 0`, positioned between filters and table:
- Container: `flex items-center gap-3 bg-white border border-stone-200 rounded-2xl px-4 h-11`
- Selected count: `text-sm text-stone-500` — format: "N selected"
- Delete button: `flex items-center gap-1.5 h-8 px-3 rounded-xl border border-red-200 bg-white text-red-600 text-sm font-medium hover:bg-red-50 transition` with Trash2 icon (size 14)
- Restore button: `h-8 px-4 text-sm text-white bg-[#b8864a] rounded-xl hover:bg-[#a07840] transition`
- NEVER use filled red background (bg-red-50/bg-red-600) for delete buttons — always white bg with red border

### Table
- Container: `bg-white rounded-2xl border border-stone-200 shadow-sm`
- Header row: `bg-stone-50 border-b border-stone-200`
- Column headers: `text-left px-4 py-3 font-medium text-stone-600`
- Body rows: `border-b border-stone-100 hover:bg-stone-50 transition`
- Default sort: project_count or created_at DESC (most relevant first)
