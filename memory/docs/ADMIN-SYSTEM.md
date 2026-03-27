# Tarmeer Admin System

## Overview

Admin system for managing designers, tracking statistics, and operating the platform.

### Features

- **Authentication**: Super admin and sub-admin roles with permission-based access
- **Designer Management**: Review, approve, reject, and sort designers
- **Statistics**: Track profile views, clicks, and interactions
- **Audit Logs**: Track all admin activities

## Database Setup

Run the admin tables SQL after the main database is initialized:

```bash
mysql -u root -p tarmeer < server/schema/admin_tables.sql
```

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/check-installation` | Check if system is installed |
| POST | `/api/admin/install` | Create first super admin |
| POST | `/api/admin/login` | Admin login |
| POST | `/api/stats/page-view` | Record page view |
| POST | `/api/stats/click` | Record click event |
| POST | `/api/stats/batch` | Batch record events |
| GET | `/api/stats/designer/:id` | Get public stats for designer |

### Protected Endpoints (Requires Admin Token)

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| GET | `/api/admin/profile` | - | Get current admin profile |
| PUT | `/api/admin/password` | - | Change password |
| GET | `/api/admin/stats/overview` | can_view_stats | Get dashboard stats |
| GET | `/api/admin/activity-logs` | - | Get activity logs |
| GET | `/api/admin/designers` | - | List designers with filters |
| GET | `/api/admin/designers/:id` | - | Get designer details |
| PUT | `/api/admin/designers/:id/approve` | can_approve | Approve designer |
| PUT | `/api/admin/designers/:id/reject` | can_approve | Reject designer |
| PUT | `/api/admin/designers/bulk-approve` | can_approve | Bulk approve designers |
| PUT | `/api/admin/designers/order` | can_sort | Update display order |
| GET | `/api/admin/admins` | super_admin | List all admins |
| POST | `/api/admin/admins` | super_admin | Create sub-admin |
| PUT | `/api/admin/admins/:id` | super_admin | Update admin |
| DELETE | `/api/admin/admins/:id` | super_admin | Delete admin |

## Frontend Routes

| Path | Description |
|------|-------------|
| `/admin` | Dashboard with overview stats |
| `/admin/designers` | Designer management (list & sort) |
| `/admin/stats` | Statistics detail page |
| `/admin/admins` | Admin user management (super admin only) |
| `/admin/login` | Admin login page |
| `/admin/install` | Installation page (first super admin) |

## Permission System

### Super Admin
- Has all permissions
- Can create/manage sub-admins
- Cannot be deleted or deactivated

### Sub-Admin Permissions
- `can_approve`: Approve/reject designers
- `can_sort`: Change designer display order
- `can_view_stats`: View statistics dashboard

## Statistics Tracking

### Page Views
- Designer profile views
- Project views
- Daily aggregation

### Click Events
- Phone clicks
- WhatsApp clicks
- Email clicks
- Contact form submissions

### Usage in Frontend

```tsx
import { usePageView, useClickTracking } from './hooks/useStats';

// Track page view
usePageView('designer', designerId);

// Track clicks
const { trackClick } = useClickTracking(designerId);
<Button onClick={() => { trackClick('whatsapp'); openWhatsApp(); }}>
  Contact via WhatsApp
</Button>
```

## Development

### Run Backend

```bash
cd server
npm install
npm run dev
```

### Run Frontend

```bash
npm install
npm run dev
```

### First Time Setup

1. Run database migrations
2. Start the backend server
3. Visit `/admin/install` to create the first super admin
4. Login at `/admin/login`

## Environment Variables

Backend `.env`:
```
DATABASE_HOST=localhost
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=tarmeer
JWT_SECRET=your_jwt_secret
FRONTEND_URL=http://localhost:5173
```
