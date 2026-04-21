# Supplier System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a supplier system with independent auth, public listing/detail pages, supplier dashboard, and admin management.

**Architecture:** Independent `supplier_users` table with its own auth (reusing JWT/bcrypt/Google OAuth patterns). `supplier_profiles` for company info, `supplier_products` for images, `supplier_catalogs` for PDFs, `supplier_leads` for inbound inquiries. Frontend: revamp `/materials` page, add `/materials/suppliers/:slug` detail, `/supplier/auth` login, `/supplier/dashboard`, and admin supplier pages.

**Tech Stack:** Express + MySQL (backend), React + Tailwind (frontend), existing JWT/bcrypt/passport patterns.

---

## Phase 1: Database Tables + Auto-Migrate

### Task 1.1: Add supplier tables to autoMigrate

**Files:**
- Modify: `server/src/lib/autoMigrate.ts` — add 5 tables to `REQUIRED_TABLES`

**Step 1: Add table definitions**

Add to `REQUIRED_TABLES` array in `server/src/lib/autoMigrate.ts`:

```sql
-- supplier_users: independent auth
CREATE TABLE IF NOT EXISTS supplier_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255),
  full_name VARCHAR(100),
  phone VARCHAR(64),
  google_id VARCHAR(255) UNIQUE,
  avatar_url VARCHAR(500),
  email_verified TINYINT(1) DEFAULT 0,
  verification_token VARCHAR(255),
  verification_expires DATETIME,
  reset_token VARCHAR(255),
  reset_expires DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_google_id (google_id)
)

-- supplier_profiles
CREATE TABLE IF NOT EXISTS supplier_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_user_id INT NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  logo_url VARCHAR(500),
  origin ENUM('china','dubai') NOT NULL DEFAULT 'china',
  categories JSON,
  has_physical_store TINYINT(1) DEFAULT 0,
  store_address VARCHAR(500),
  store_lat DECIMAL(10,8),
  store_lng DECIMAL(11,8),
  google_maps_url VARCHAR(500),
  contact_phone VARCHAR(64),
  whatsapp VARCHAR(64),
  website VARCHAR(500),
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_supplier_user (supplier_user_id),
  INDEX idx_slug (slug),
  INDEX idx_status (status),
  INDEX idx_origin (origin)
)

-- supplier_products: product images
CREATE TABLE IF NOT EXISTS supplier_products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_profile_id INT NOT NULL,
  title VARCHAR(255),
  description TEXT,
  image_url VARCHAR(500) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_supplier (supplier_profile_id)
)

-- supplier_catalogs: PDF files
CREATE TABLE IF NOT EXISTS supplier_catalogs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplier_profile_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_supplier (supplier_profile_id)
)

-- supplier_leads: inbound from materials page
CREATE TABLE IF NOT EXISTS supplier_leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_name VARCHAR(100) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  company_name VARCHAR(200),
  category VARCHAR(100),
  origin ENUM('china','dubai'),
  message TEXT,
  source_page VARCHAR(200),
  status ENUM('new','contacted','converted','rejected') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
)
```

**Step 2: Build and verify**

```bash
cd server && npx tsc
PORT=3099 node dist/app.js  # check logs for "[auto-migrate] Ensured table exists: supplier_*"
```

**Step 3: Commit**

```bash
git add server/src/lib/autoMigrate.ts
git commit -m "feat(db): add supplier_users, supplier_profiles, supplier_products, supplier_catalogs, supplier_leads tables"
```

---

## Phase 2: Backend — Supplier Auth

### Task 2.1: Supplier auth middleware

**Files:**
- Create: `server/src/middleware/supplierAuth.ts`

Reuse JWT pattern from `server/src/middleware/auth.ts` but query `supplier_users` table instead of `users`.

```typescript
// authenticateSupplier — verify JWT, attach req.supplierUser
// Same pattern as authenticate() in auth.ts but reads from supplier_users
```

**Step 1: Implement middleware**

**Step 2: Commit**

### Task 2.2: Supplier auth controller

**Files:**
- Create: `server/src/controllers/supplierAuthController.ts`

Functions (mirror `userAuthController.ts` pattern):
- `register(req, res)` — email+password, INSERT supplier_users, send verification email
- `login(req, res)` — email+password, return JWT with `{ supplierUserId, email, type: 'supplier' }`
- `googleCallback(req, res)` — handle Google OAuth, upsert supplier_users by google_id
- `checkAvailability(req, res)` — check if email exists in supplier_users

**Step 3: Commit**

### Task 2.3: Supplier auth routes

**Files:**
- Create: `server/src/routes/supplierAuth.ts`
- Modify: `server/src/app.ts` — mount at `/api/supplier/auth`

Routes:
```
POST /api/supplier/auth/register
POST /api/supplier/auth/login
POST /api/supplier/auth/check-availability
GET  /api/supplier/auth/google  (passport redirect)
GET  /api/supplier/auth/google/callback
```

**Step 4: Build, test manually, commit**

---

## Phase 3: Backend — Supplier Profile + Products + Catalogs CRUD

### Task 3.1: Supplier profile controller

**Files:**
- Create: `server/src/controllers/supplierProfileController.ts`

Functions:
- `getMyProfile(req, res)` — GET own profile (auth required)
- `upsertProfile(req, res)` — POST create/update profile (auto-generate slug from company_name)
- `uploadLogo(req, res)` — POST upload logo to `/uploads/suppliers/{id}/logo.{ext}`
- `getPublicProfile(req, res)` — GET by slug (public, no auth)
- `listPublicSuppliers(req, res)` — GET list with filters (origin, category), pagination

### Task 3.2: Supplier products controller

**Files:**
- Create: `server/src/controllers/supplierProductController.ts`

Functions:
- `listProducts(req, res)` — GET by supplier_profile_id (public)
- `addProduct(req, res)` — POST with image upload to `/uploads/suppliers/{id}/products/`
- `updateProduct(req, res)` — PUT
- `deleteProduct(req, res)` — DELETE
- `reorderProducts(req, res)` — PUT sort_order batch update

### Task 3.3: Supplier catalogs controller

**Files:**
- Create: `server/src/controllers/supplierCatalogController.ts`

Functions:
- `listCatalogs(req, res)` — GET by supplier_profile_id (public)
- `uploadCatalog(req, res)` — POST PDF upload to `/uploads/suppliers/{id}/catalogs/`
- `deleteCatalog(req, res)` — DELETE

### Task 3.4: Supplier leads controller

**Files:**
- Create: `server/src/controllers/supplierLeadController.ts`

Functions:
- `submitLead(req, res)` — POST public (rate limited)
- `listLeads(req, res)` — GET admin only

### Task 3.5: Routes + mount

**Files:**
- Create: `server/src/routes/suppliers.ts` — all supplier routes
- Modify: `server/src/app.ts` — mount at `/api/suppliers`

Route structure:
```
# Public
GET  /api/suppliers                          → listPublicSuppliers
GET  /api/suppliers/:slug                    → getPublicProfile
GET  /api/suppliers/:slug/products           → listProducts
GET  /api/suppliers/:slug/catalogs           → listCatalogs
POST /api/suppliers/leads                    → submitLead (rate limited)

# Authenticated supplier
GET  /api/suppliers/me/profile               → getMyProfile
POST /api/suppliers/me/profile               → upsertProfile
POST /api/suppliers/me/logo                  → uploadLogo
POST /api/suppliers/me/products              → addProduct
PUT  /api/suppliers/me/products/:id          → updateProduct
DELETE /api/suppliers/me/products/:id        → deleteProduct
PUT  /api/suppliers/me/products/reorder      → reorderProducts
POST /api/suppliers/me/catalogs              → uploadCatalog
DELETE /api/suppliers/me/catalogs/:id        → deleteCatalog
```

**Step: Build, test key endpoints with curl, commit**

---

## Phase 4: Backend — Admin Supplier Endpoints

### Task 4.1: Admin supplier controller

**Files:**
- Create: `server/src/controllers/supplierAdminController.ts`

Functions:
- `listSuppliers(req, res)` — paginated, with search/filter (origin, status, category)
- `getSupplierDetail(req, res)` — full detail by id
- `updateSupplierStatus(req, res)` — approve/reject
- `updateSupplier(req, res)` — edit any field
- `deleteSupplier(req, res)` — cascade delete (products + catalogs + profile + user)
- `listSupplierLeads(req, res)` — paginated leads

### Task 4.2: Admin routes

**Files:**
- Modify: `server/src/routes/admin.ts` — add supplier admin routes

Routes:
```
GET    /api/admin/suppliers              → listSuppliers
GET    /api/admin/suppliers/:id          → getSupplierDetail
PUT    /api/admin/suppliers/:id          → updateSupplier
PUT    /api/admin/suppliers/:id/status   → updateSupplierStatus
DELETE /api/admin/suppliers/:id          → deleteSupplier
GET    /api/admin/supplier-leads         → listSupplierLeads
```

**Step: Build, commit**

---

## Phase 5: Frontend — Remove Homepage CTA + Materials Page Redesign

### Task 5.1: Remove "Are you a renovation company?" from homepage

**Files:**
- Modify: `src/pages/HomePage.tsx:82-87` — delete the section

**Step: Remove, verify build, commit**

### Task 5.2: Rewrite Materials/Showrooms page

**Files:**
- Modify: `src/pages/ShowroomsPage.tsx` — keep showroom hero section at top, replace brand cards with API-driven supplier list

Page structure:
1. **Showroom hero** (keep existing: Tarmeer showroom info, address, hours)
2. **Filter bar**: origin (All / China / Dubai), category tags
3. **Supplier grid**: cards with logo, name, description snippet, origin badge, category tags, physical store badge + map button
4. **Pagination**
5. **Bottom CTA**: "Are you a supplier? Join us" → opens lead form modal

Data source: `GET /api/suppliers?origin=&category=&page=`

### Task 5.3: Supplier lead form modal

**Files:**
- Create: `src/components/suppliers/SupplierLeadModal.tsx`

Fields: contact name, phone (with validation), company name, category dropdown, origin radio, message. POST to `/api/suppliers/leads`.

**Step: Build, verify, commit**

---

## Phase 6: Frontend — Supplier Detail Page

### Task 6.1: Create supplier detail page

**Files:**
- Create: `src/pages/SupplierDetailPage.tsx`

Structure (similar to CompanyDetailPage):
1. **Header**: logo, company name, origin badge (China/Dubai), category tags
2. **Physical store section**: address + Google Maps button (if has_physical_store)
3. **About**: description
4. **Products gallery**: masonry/grid of product images with titles
5. **Catalogs**: downloadable PDF list
6. **Inquiry form**: contact supplier (reuse InquiryForm pattern)

Data: `GET /api/suppliers/:slug` + `/products` + `/catalogs`

### Task 6.2: Add routes to App.tsx

**Files:**
- Modify: `src/App.tsx`

```
/materials/suppliers/:slug → SupplierDetailPage
```

Remove old brand route: `/materials/brands/:slug`

**Step: Build, verify, commit**

---

## Phase 7: Frontend — Supplier Auth + Dashboard

### Task 7.1: Supplier auth page

**Files:**
- Create: `src/pages/supplier/SupplierAuthPage.tsx`

Google OAuth + email login/register, same UI pattern as CompanyAuthPage but hits `/api/supplier/auth/*` endpoints.

### Task 7.2: Supplier dashboard page

**Files:**
- Create: `src/pages/supplier/SupplierDashboardPage.tsx`
- Create: `src/pages/supplier/SupplierLayout.tsx` (simple sidebar layout)

Dashboard sections:
- **Profile form**: company name, description, origin, categories, store info, contact
- **Products**: upload/manage product images with title+description
- **Catalogs**: upload/manage PDF files
- **Preview link**: view public profile

### Task 7.3: Add routes to App.tsx

```
/supplier/auth       → SupplierAuthPage
/supplier/dashboard  → SupplierLayout > SupplierDashboardPage
```

**Step: Build, verify, commit**

---

## Phase 8: Frontend — Admin Supplier Pages

### Task 8.1: Admin supplier list page

**Files:**
- Create: `src/pages/admin/AdminSuppliersPage.tsx`

Table: name, origin badge, categories, status, physical store, join time (HH:mm), actions.
Filters: origin, status, search.

### Task 8.2: Admin supplier detail page

**Files:**
- Create: `src/pages/admin/AdminSupplierDetailPage.tsx`

Full detail view + approve/reject + edit + delete.

### Task 8.3: Admin supplier leads page

**Files:**
- Create: `src/pages/admin/AdminSupplierLeadsPage.tsx`

Table: contact name, phone, company, category, origin, status, created_at.

### Task 8.4: Add to admin layout + routes

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx` — add "Suppliers" / "供应商" nav item with `Package` icon
- Modify: `src/App.tsx` — add admin routes:

```
/admin/suppliers           → AdminSuppliersPage
/admin/suppliers/:id       → AdminSupplierDetailPage
/admin/supplier-leads      → AdminSupplierLeadsPage
```

**Step: Build, verify, commit**

---

## Phase 9: Data Migration + Cleanup

### Task 9.1: Migrate brands.ts data to DB

**Files:**
- Create: `scripts/harness/migrate-brands-to-suppliers.mjs`

Script: read `src/data/brands.ts` entries, create supplier_users (dummy email like `brand-{slug}@tarmeer.local`), create supplier_profiles, create supplier_products from works array.

### Task 9.2: Remove old brand files

**Files:**
- Delete: `src/data/brands.ts`
- Delete: `src/pages/BrandPage.tsx`
- Delete: `src/pages/MaterialCategoryPage.tsx`
- Modify: `src/App.tsx` — remove brand/material-category routes

**Step: Run migration, verify data, remove old files, build, commit**

---

## Phase 10: Local Verification

### Task 10.1: Harness test

**Files:**
- Create: `scripts/harness/test-supplier-system.mjs`

Test cases:
- TC1: supplier register + login
- TC2: create/update profile
- TC3: upload product
- TC4: upload catalog
- TC5: public list + filter by origin
- TC6: public detail by slug
- TC7: submit supplier lead
- TC8: admin list/detail/approve/delete

### Task 10.2: Manual walkthrough

1. Start local: `PORT=3099 DEV_SKIP_EMAIL=true node dist/app.js` + `npm run dev`
2. Visit `/materials` — verify showroom hero + supplier list + filters + lead form
3. Visit `/materials/suppliers/:slug` — verify detail page
4. Visit `/supplier/auth` — register, login
5. Visit `/supplier/dashboard` — complete profile, upload products, upload PDF
6. Visit `/admin/suppliers` — list, approve, detail
7. Verify homepage "Are you a renovation company?" is gone
