# Unified Admin Panel & User System Redesign

> Date: 2026-03-31
> Status: Approved

## Goal

Unify the admin panel, user system, and role management into a single platform. Users can register and upgrade to Designer or Renovation Company roles. Admin panel manages all users, approvals, inquiry forms, and company binding.

## Architecture: Independent Users Table + Associated Role Tables

### Database Schema Changes

#### New: `users` table
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) DEFAULT NULL,
  city VARCHAR(128) DEFAULT NULL,
  avatar_url MEDIUMTEXT DEFAULT NULL,
  role ENUM('user', 'designer', 'company') DEFAULT 'user',
  status ENUM('active', 'suspended') DEFAULT 'active',
  email_verified TINYINT(1) DEFAULT 0,
  verification_token VARCHAR(255) DEFAULT NULL,
  verification_token_expires DATETIME DEFAULT NULL,
  reset_token VARCHAR(255) DEFAULT NULL,
  reset_token_expires DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### Modified: `designers` table
- Add `user_id INT DEFAULT NULL` foreign key to `users.id`
- Existing designers without user_id continue to work (backward compatible)
- When a user upgrades to designer, a designer record is created and linked

#### Modified: `uae_companies` table
- Add `owner_user_id INT DEFAULT NULL` foreign key to `users.id`
- Only admin can set this field (bind user to company)
- Existing companies without owner remain as scraped-only data

#### New: `design_inquiries` table
```sql
CREATE TABLE design_inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  city VARCHAR(128) NOT NULL,
  area_range VARCHAR(64) NOT NULL,
  message TEXT DEFAULT NULL,
  designer_id INT DEFAULT NULL,
  company_id INT DEFAULT NULL,
  user_id INT DEFAULT NULL,
  status ENUM('new', 'contacted', 'resolved', 'archived') DEFAULT 'new',
  admin_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_designer (designer_id),
  INDEX idx_company (company_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

#### New: `company_applications` table
```sql
CREATE TABLE company_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  license_number VARCHAR(128) DEFAULT NULL,
  phone VARCHAR(64) DEFAULT NULL,
  city VARCHAR(128) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  documents JSON DEFAULT NULL,
  description TEXT DEFAULT NULL,
  requested_company_id INT DEFAULT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  admin_notes TEXT DEFAULT NULL,
  linked_company_id INT DEFAULT NULL,
  reviewed_by INT DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Role Upgrade Flows

#### User -> Designer
1. User clicks "Apply as Designer" in dashboard
2. Submits profile info (bio, expertise, style, portfolio samples)
3. Creates designer record with `status=pending`, linked to `user_id`
4. Admin reviews in admin panel -> approve/reject
5. On approve: user.role = 'designer', designer.status = 'approved'

#### User -> Renovation Company
1. User clicks "Apply as Company" in dashboard
2. Submits company info (name, license, city, description)
3. Creates company_application record with `status=pending`
4. Admin reviews application
5. Admin **manually binds** user to existing scraped company OR creates new company
6. On approve: user.role = 'company', uae_companies.owner_user_id = user.id

### Admin Panel Modules

| Route | Module | Features |
|-------|--------|----------|
| `/admin/dashboard` | Dashboard | Stats overview: users, pending approvals, today's inquiries, visitors |
| `/admin/users` | User Management | List all users, filter by role/status, search, suspend/activate |
| `/admin/designers` | Designer Management | Existing: approve/reject, sort display_order, bulk ops, stats |
| `/admin/companies` | Company Management | Review applications, **bind user to scraped company**, edit company info |
| `/admin/inquiries` | Inquiry Forms | View all submissions, filter by status/company/designer, add notes, **export Excel** |
| `/admin/analytics` | Analytics | Existing: visitors, events, page views |
| `/admin/settings` | Settings | Admin accounts, permissions (existing) |

### Frontend User Dashboard

Unified `/dashboard/*` replaces current `/designer/*`:

| Route | Access | Description |
|-------|--------|-------------|
| `/dashboard` | All users | Overview, role status, upgrade CTA |
| `/dashboard/profile` | All users | Edit name, phone, city, avatar |
| `/dashboard/inquiries` | Designer/Company | View received inquiry forms |
| `/dashboard/projects` | Designer | Manage portfolio projects |
| `/dashboard/company` | Company | Edit company profile, manage portfolio |
| `/dashboard/apply/designer` | User (no role) | Submit designer application |
| `/dashboard/apply/company` | User (no role) | Submit company application |

### Inquiry Form (Designer/Company Detail Page)

Placed in sidebar of designer and company detail pages.

Fields:
- Name (text, required)
- Phone (tel, required)
- City (select: Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Fujairah, Umm Al Quwain)
- Area Range (select: < 50m², 50-100m², 100-200m², 200-500m², 500m²+)
- Message (textarea, optional)

On submit: creates `design_inquiries` record linked to current designer_id or company_id.
Rate limit: 5 submissions per hour per IP.

### Excel Export (Admin Inquiries)

Admin can export filtered inquiries as .xlsx with columns:
ID, Name, Phone, City, Area, Message, Designer/Company, Status, Notes, Date

### Migration Strategy

1. Create `users` table
2. Migrate existing `designers` data: for each designer, create a user record and link via `user_id`
3. Add `owner_user_id` to `uae_companies` (nullable, no migration needed)
4. Create `design_inquiries` and `company_applications` tables
5. Update auth routes to use `users` table
6. Keep existing `contacts` table for backward compatibility

### Tech Stack (unchanged)
- Backend: Express + MySQL + mysql2
- Frontend: React 19 + TypeScript + Tailwind CSS 4 + Framer Motion
- Auth: JWT (7-day expiration)
- Export: xlsx library (server-side generation)
