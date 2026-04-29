# Field Survey — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Mobile-first interview survey for field staff to record company visits, with auto-save and admin review.

**Architecture:** New `field_staff` role in existing admin auth system; new `company_interviews` table via autoMigrate; standalone `/field/survey` page (no AdminLayout); admin views at `/admin/interviews` and `/admin/staff`.

**Tech Stack:** React + TypeScript (frontend), Express + MySQL (backend), existing adminAuth middleware, existing adminApi client pattern.

---

## Existing Patterns to Follow

- **Backend auth chain:** `authenticateAdmin` → `requireAdmin` (in `server/src/middleware/adminAuth.ts`)
- **New tables:** add to `REQUIRED_TABLES` array in `server/src/lib/autoMigrate.ts`
- **New column migrations:** add to `REQUIRED_COLUMNS` in `autoMigrate.ts`
- **Routes registration:** import + `app.use('/api/...', router)` in `server/src/app.ts`
- **Admin API client:** `adminApi.*` calls in `src/lib/adminApi.ts`
- **Admin pages:** `useState` + `useEffect` + `adminApi` call pattern (see `AdminAdminsPage.tsx`)
- **Current admin roles:** `'super_admin' | 'sub_admin'` (in `adminAuth.ts` line 9)

---

## Task 1: DB Migration — new table + new role column

**Files:**
- Modify: `server/src/lib/autoMigrate.ts`

**Step 1: Add `company_interviews` table to REQUIRED_TABLES**

Find the `REQUIRED_TABLES` array and add before the closing `];`:

```typescript
  {
    name: 'company_interviews',
    sql: `CREATE TABLE IF NOT EXISTS company_interviews (
      id INT AUTO_INCREMENT PRIMARY KEY,
      interviewer_id INT NOT NULL,
      company_ref_id INT NULL,
      company_name VARCHAR(200) NOT NULL DEFAULT '',
      status ENUM('draft', 'submitted') NOT NULL DEFAULT 'draft',
      section_1 JSON NULL,
      section_2 JSON NULL,
      section_3 JSON NULL,
      section_4 JSON NULL,
      section_5 JSON NULL,
      section_6 JSON NULL,
      section_7 JSON NULL,
      section_8 JSON NULL,
      section_9 JSON NULL,
      submitted_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_interviewer (interviewer_id),
      INDEX idx_status (status),
      INDEX idx_company_ref (company_ref_id)
    )`,
  },
```

**Step 2: Add `field_staff` role support to `admin_users`**

The `role` column is an ENUM — but per MEMORY.md we do NOT use ENUM for extensibility. Since it already exists as ENUM, we need to ALTER it to include `field_staff`. Add to `REQUIRED_COLUMNS`:

```typescript
  {
    table: 'admin_users',
    column: 'role',
    // This alters the ENUM to add field_staff. Check first if field_staff already exists.
    type: "ENUM('super_admin', 'sub_admin', 'field_staff') NOT NULL DEFAULT 'super_admin'",
  },
```

> **Note:** autoMigrate's REQUIRED_COLUMNS only adds missing columns — it won't ALTER an existing ENUM. You need to add a special migration step. Add it as a one-time DDL in a new `REQUIRED_DDL` block, or run manually on RDS. The safest approach is adding a new function in `runAutoMigrate`:

```typescript
// After existing migrations, add:
async function addFieldStaffRole(conn: any) {
  try {
    // Check if field_staff already in ENUM
    const [cols] = await conn.execute(`
      SELECT COLUMN_TYPE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'admin_users'
        AND COLUMN_NAME = 'role'
    `);
    const colType = (cols as any[])[0]?.COLUMN_TYPE || '';
    if (!colType.includes('field_staff')) {
      await conn.execute(`
        ALTER TABLE admin_users
        MODIFY COLUMN role ENUM('super_admin','sub_admin','field_staff') NOT NULL DEFAULT 'super_admin'
      `);
      console.log(`${TAG} Added field_staff to admin_users.role ENUM`);
    }
  } catch (e) {
    console.error(`${TAG} Failed to add field_staff role:`, e);
  }
}
```

Call `await addFieldStaffRole(pool);` inside `runAutoMigrate()` before the final log.

**Step 3: Verify migration runs on server start**

```bash
cd /Users/kp/.warp/worktrees/tarmeer-4.0-local/organ-pipe-horned-toad/server
npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add server/src/lib/autoMigrate.ts
git commit -m "feat: add company_interviews table and field_staff role migration"
```

---

## Task 2: Backend — extend adminAuth middleware

**Files:**
- Modify: `server/src/middleware/adminAuth.ts`

**Step 1: Add field_staff to AdminUser type**

Line 9, change:
```typescript
role: 'super_admin' | 'sub_admin';
```
to:
```typescript
role: 'super_admin' | 'sub_admin' | 'field_staff';
```

**Step 2: Add `requireFieldStaff` middleware**

After `requireSuperAdmin` (line 86), add:

```typescript
/** Allows field_staff OR super_admin. Blocks sub_admin. */
export function requireFieldOrSuperAdmin(req: any, res: any, next: any) {
  if (!req.admin) {
    return res.status(401).json({ error: 'Admin not authenticated.' });
  }
  if (req.admin.role !== 'super_admin' && req.admin.role !== 'field_staff') {
    return res.status(403).json({ error: 'Field staff or super admin access required.' });
  }
  next();
}

/** Blocks field_staff from accessing super admin routes. */
export function blockFieldStaff(req: any, res: any, next: any) {
  if (req.admin?.role === 'field_staff') {
    return res.status(403).json({ error: 'Field staff cannot access this endpoint.' });
  }
  next();
}
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add server/src/middleware/adminAuth.ts
git commit -m "feat: add field_staff role to adminAuth middleware"
```

---

## Task 3: Backend — field interview controller

**Files:**
- Create: `server/src/controllers/fieldInterviewController.ts`

**Step 1: Create the controller**

```typescript
import { Request, Response } from 'express';
import pool from '../config/database';

// POST /api/field/interviews — create draft
export async function createDraft(req: any, res: Response) {
  const interviewerId = req.admin.id;
  try {
    const [result] = await pool.execute(
      `INSERT INTO company_interviews (interviewer_id, status) VALUES (?, 'draft')`,
      [interviewerId]
    );
    const id = (result as any).insertId;
    res.status(201).json({ id });
  } catch (e) {
    console.error('createDraft error:', e);
    res.status(500).json({ error: 'Failed to create draft.' });
  }
}

// GET /api/field/interviews/draft — get latest draft for current user
export async function getMyDraft(req: any, res: Response) {
  const interviewerId = req.admin.id;
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM company_interviews
       WHERE interviewer_id = ? AND status = 'draft'
       ORDER BY updated_at DESC LIMIT 1`,
      [interviewerId]
    );
    const drafts = rows as any[];
    if (drafts.length === 0) return res.json({ draft: null });
    res.json({ draft: drafts[0] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch draft.' });
  }
}

// PATCH /api/field/interviews/:id — auto-save
export async function saveDraft(req: any, res: Response) {
  const { id } = req.params;
  const interviewerId = req.admin.id;
  const {
    company_name, company_ref_id,
    section_1, section_2, section_3, section_4, section_5,
    section_6, section_7, section_8, section_9,
  } = req.body;

  try {
    // Verify ownership
    const [rows] = await pool.execute(
      'SELECT id FROM company_interviews WHERE id = ? AND interviewer_id = ?',
      [id, interviewerId]
    );
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: 'Interview not found.' });
    }

    const fields: Record<string, any> = {};
    if (company_name !== undefined) fields.company_name = String(company_name).slice(0, 200);
    if (company_ref_id !== undefined) fields.company_ref_id = company_ref_id || null;
    if (section_1 !== undefined) fields.section_1 = JSON.stringify(section_1);
    if (section_2 !== undefined) fields.section_2 = JSON.stringify(section_2);
    if (section_3 !== undefined) fields.section_3 = JSON.stringify(section_3);
    if (section_4 !== undefined) fields.section_4 = JSON.stringify(section_4);
    if (section_5 !== undefined) fields.section_5 = JSON.stringify(section_5);
    if (section_6 !== undefined) fields.section_6 = JSON.stringify(section_6);
    if (section_7 !== undefined) fields.section_7 = JSON.stringify(section_7);
    if (section_8 !== undefined) fields.section_8 = JSON.stringify(section_8);
    if (section_9 !== undefined) fields.section_9 = JSON.stringify(section_9);

    if (Object.keys(fields).length === 0) return res.json({ ok: true });

    const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(fields), id];
    await pool.execute(`UPDATE company_interviews SET ${setClauses} WHERE id = ?`, values);
    res.json({ ok: true });
  } catch (e) {
    console.error('saveDraft error:', e);
    res.status(500).json({ error: 'Failed to save.' });
  }
}

// POST /api/field/interviews/:id/submit — submit
export async function submitInterview(req: any, res: Response) {
  const { id } = req.params;
  const interviewerId = req.admin.id;
  try {
    const [rows] = await pool.execute(
      'SELECT id FROM company_interviews WHERE id = ? AND interviewer_id = ? AND status = ?',
      [id, interviewerId, 'draft']
    );
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: 'Draft not found.' });
    }
    await pool.execute(
      `UPDATE company_interviews SET status = 'submitted', submitted_at = NOW() WHERE id = ?`,
      [id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to submit.' });
  }
}

// GET /api/field/companies/search?q= — search uae_companies for linking
export async function searchCompanies(req: any, res: Response) {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.json({ results: [] });
  try {
    const [rows] = await pool.execute(
      `SELECT id, name, city FROM uae_companies WHERE name LIKE ? LIMIT 10`,
      [`%${q}%`]
    );
    res.json({ results: rows });
  } catch (e) {
    res.status(500).json({ error: 'Search failed.' });
  }
}
```

**Step 2: Verify**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add server/src/controllers/fieldInterviewController.ts
git commit -m "feat: add field interview controller (create/save/submit/search)"
```

---

## Task 4: Backend — field routes file

**Files:**
- Create: `server/src/routes/field.ts`
- Modify: `server/src/app.ts`

**Step 1: Create route file**

```typescript
import { Router } from 'express';
import { authenticateAdmin, requireAdmin, requireFieldOrSuperAdmin } from '../middleware/adminAuth';
import {
  createDraft, getMyDraft, saveDraft, submitInterview, searchCompanies,
} from '../controllers/fieldInterviewController';

const router = Router();

// All field routes require admin auth
router.use(authenticateAdmin, requireAdmin, requireFieldOrSuperAdmin);

router.post('/interviews', createDraft);
router.get('/interviews/draft', getMyDraft);
router.patch('/interviews/:id', saveDraft);
router.post('/interviews/:id/submit', submitInterview);
router.get('/companies/search', searchCompanies);

export default router;
```

**Step 2: Register in app.ts**

Add import after existing route imports (around line 22):
```typescript
import fieldRoutes from './routes/field';
```

Add route registration after existing `app.use` calls (around line 165, after supplierRoutes):
```typescript
app.use('/api/field', fieldRoutes);
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add server/src/routes/field.ts server/src/app.ts
git commit -m "feat: register /api/field routes"
```

---

## Task 5: Backend — admin interviews + staff management

**Files:**
- Create: `server/src/controllers/fieldAdminController.ts`
- Modify: `server/src/routes/admin.ts`

**Step 1: Create admin-side controller**

```typescript
import { Request, Response } from 'express';
import pool from '../config/database';
import bcrypt from 'bcryptjs';

// GET /api/admin/interviews
export async function listInterviews(req: any, res: Response) {
  try {
    const [rows] = await pool.execute(`
      SELECT ci.id, ci.company_name, ci.status, ci.submitted_at, ci.created_at,
             au.full_name AS interviewer_name,
             uc.name AS linked_company_name
      FROM company_interviews ci
      JOIN admin_users au ON au.id = ci.interviewer_id
      LEFT JOIN uae_companies uc ON uc.id = ci.company_ref_id
      ORDER BY ci.updated_at DESC
      LIMIT 200
    `);
    res.json({ interviews: rows });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list interviews.' });
  }
}

// GET /api/admin/interviews/:id
export async function getInterview(req: any, res: Response) {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(`
      SELECT ci.*, au.full_name AS interviewer_name, uc.name AS linked_company_name
      FROM company_interviews ci
      JOIN admin_users au ON au.id = ci.interviewer_id
      LEFT JOIN uae_companies uc ON uc.id = ci.company_ref_id
      WHERE ci.id = ?
    `, [id]);
    const items = rows as any[];
    if (items.length === 0) return res.status(404).json({ error: 'Not found.' });
    res.json({ interview: items[0] });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch interview.' });
  }
}

// PATCH /api/admin/interviews/:id — super admin edit
export async function editInterview(req: any, res: Response) {
  const { id } = req.params;
  const allowed = ['company_name','company_ref_id','section_1','section_2','section_3',
    'section_4','section_5','section_6','section_7','section_8','section_9'];
  const fields: Record<string, any> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields[key] = typeof req.body[key] === 'object'
        ? JSON.stringify(req.body[key])
        : req.body[key];
    }
  }
  if (Object.keys(fields).length === 0) return res.json({ ok: true });
  try {
    const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    await pool.execute(
      `UPDATE company_interviews SET ${setClauses} WHERE id = ?`,
      [...Object.values(fields), id]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update interview.' });
  }
}

// GET /api/admin/staff
export async function listStaff(req: any, res: Response) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, email, full_name, is_active, created_at FROM admin_users WHERE role = 'field_staff' ORDER BY created_at DESC`
    );
    res.json({ staff: rows });
  } catch (e) {
    res.status(500).json({ error: 'Failed to list staff.' });
  }
}

// POST /api/admin/staff
export async function createStaff(req: any, res: Response) {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'email, password, fullName required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  try {
    const [existing] = await pool.execute(
      'SELECT id FROM admin_users WHERE email = ?', [email.toLowerCase().trim()]
    );
    if ((existing as any[]).length > 0) {
      return res.status(409).json({ error: 'Email already exists.' });
    }
    const hashed = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO admin_users (email, password, full_name, role) VALUES (?, ?, ?, 'field_staff')`,
      [email.toLowerCase().trim(), hashed, fullName.trim()]
    );
    res.status(201).json({ id: (result as any).insertId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create staff.' });
  }
}

// PATCH /api/admin/staff/:id — toggle active
export async function toggleStaff(req: any, res: Response) {
  const { id } = req.params;
  const { is_active } = req.body;
  try {
    await pool.execute(
      'UPDATE admin_users SET is_active = ? WHERE id = ? AND role = ?',
      [is_active ? 1 : 0, id, 'field_staff']
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update staff.' });
  }
}
```

**Step 2: Add routes to admin.ts**

At the top imports section of `server/src/routes/admin.ts`, add:
```typescript
import {
  listInterviews, getInterview, editInterview,
  listStaff, createStaff, toggleStaff,
} from '../controllers/fieldAdminController';
```

At the bottom of the router (before `export default router`):
```typescript
// Field interviews (super_admin only)
router.get('/interviews', authenticateAdmin, requireAdmin, requireSuperAdmin, listInterviews);
router.get('/interviews/:id', authenticateAdmin, requireAdmin, requireSuperAdmin, getInterview);
router.patch('/interviews/:id', authenticateAdmin, requireAdmin, requireSuperAdmin, editInterview);

// Field staff management (super_admin only)
router.get('/staff', authenticateAdmin, requireAdmin, requireSuperAdmin, listStaff);
router.post('/staff', authenticateAdmin, requireAdmin, requireSuperAdmin, createStaff);
router.patch('/staff/:id', authenticateAdmin, requireAdmin, requireSuperAdmin, toggleStaff);
```

Also import `requireSuperAdmin` from adminAuth if not already imported in admin.ts:
```typescript
import { authenticateAdmin, requireAdmin, requireSuperAdmin } from '../middleware/adminAuth';
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add server/src/controllers/fieldAdminController.ts server/src/routes/admin.ts
git commit -m "feat: add admin interview list/detail and field staff management endpoints"
```

---

## Task 6: Frontend — adminApi client additions

**Files:**
- Modify: `src/lib/adminApi.ts`

**Step 1: Read the file first, then add field API methods**

Add to the `adminApi` object:

```typescript
// Field interviews (admin view)
async getInterviews() {
  return this.request('/admin/interviews');
},
async getInterview(id: number) {
  return this.request(`/admin/interviews/${id}`);
},
async updateInterview(id: number, data: Record<string, any>) {
  return this.request(`/admin/interviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
},

// Field staff management
async getStaff() {
  return this.request('/admin/staff');
},
async createStaff(data: { email: string; password: string; fullName: string }) {
  return this.request('/admin/staff', { method: 'POST', body: JSON.stringify(data) });
},
async toggleStaff(id: number, is_active: boolean) {
  return this.request(`/admin/staff/${id}`, { method: 'PATCH', body: JSON.stringify({ is_active }) });
},
```

Add field-specific API helper (separate from adminApi since it uses different base path):

```typescript
const FIELD_API_BASE = '/api/field';

async function fieldRequest(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('admin_token');
  const res = await fetch(`${FIELD_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const fieldApi = {
  createDraft: () => fieldRequest('/interviews', { method: 'POST' }),
  getDraft: () => fieldRequest('/interviews/draft'),
  saveDraft: (id: number, data: Record<string, any>) =>
    fieldRequest(`/interviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  submit: (id: number) =>
    fieldRequest(`/interviews/${id}/submit`, { method: 'POST' }),
  searchCompanies: (q: string) =>
    fieldRequest(`/companies/search?q=${encodeURIComponent(q)}`),
};
```

**Step 2: Verify TypeScript**

```bash
cd /Users/kp/.warp/worktrees/tarmeer-4.0-local/organ-pipe-horned-toad
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/lib/adminApi.ts
git commit -m "feat: add fieldApi and admin interview/staff API client methods"
```

---

## Task 7: Frontend — ChipSelect component

**Files:**
- Create: `src/components/field/ChipSelect.tsx`

**Step 1: Create component**

```tsx
interface ChipSelectProps {
  options: string[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
}

export default function ChipSelect({ options, value, onChange, multi = false }: ChipSelectProps) {
  const selected = multi
    ? (Array.isArray(value) ? value : [])
    : value as string;

  function toggle(opt: string) {
    if (multi) {
      const arr = Array.isArray(value) ? value : [];
      onChange(arr.includes(opt) ? arr.filter(v => v !== opt) : [...arr, opt]);
    } else {
      onChange(opt === selected ? '' : opt);
    }
  }

  function isSelected(opt: string) {
    return multi ? (Array.isArray(value) && value.includes(opt)) : value === opt;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`min-h-[44px] px-4 py-2 rounded-2xl border text-sm font-medium transition-colors ${
            isSelected(opt)
              ? 'bg-[#b8864a] text-white border-[#b8864a]'
              : 'border-stone-200 text-stone-600 bg-white'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/components/field/ChipSelect.tsx
git commit -m "feat: add ChipSelect component for survey"
```

---

## Task 8: Frontend — FieldSurveyPage

**Files:**
- Create: `src/pages/field/FieldSurveyPage.tsx`

This is the main survey page. Key structure:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { fieldApi } from '../../lib/adminApi';
import ChipSelect from '../../components/field/ChipSelect';

// ── Survey data schema ────────────────────────────────────────
const SECTIONS = [
  {
    title: 'Section 1: Company Basic Information',
    key: 'section_1',
    fields: [
      { key: 'company_type', label: 'Company Type', type: 'single', options: ['Local', 'Joint Venture', 'Foreign'] },
      { key: 'year_established', label: 'Year Established', type: 'single', options: ['Before 2000', '2000-2010', '2010-2015', '2015-2020', '2020+'] },
      { key: 'registration_location', label: 'Registration Location', type: 'single', options: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Other UAE', 'Outside UAE'] },
      { key: 'company_size', label: 'Company Size', type: 'single', options: ['1-10', '10-30', '30-100', '100+'] },
      { key: 'licenses', label: 'Licenses / Certifications', type: 'multi', options: ['Dubai Municipality', 'DEWA Approved', 'ISO Certified', 'RERA', 'Other'] },
    ],
  },
  {
    title: 'Section 2: Core Business',
    key: 'section_2',
    fields: [
      { key: 'main_business_scope', label: 'Main Business Scope', type: 'multi', options: ['Interior Design', 'Fit-out', 'FF&E', 'MEP', 'Joinery', 'Landscaping'] },
      { key: 'one_stop_service', label: 'One-Stop Service (Design + Build + Materials + Furniture)?', type: 'single', options: ['Yes', 'No', 'Partial'] },
      { key: 'main_client_types', label: 'Main Client Types', type: 'multi', options: ['Residential', 'Commercial', 'Hospitality', 'Retail', 'Government', 'F&B'] },
    ],
  },
  {
    title: 'Section 3: Team Structure',
    key: 'section_3',
    fields: [
      { key: 'total_employees', label: 'Total Employees', type: 'single', options: ['1-10', '11-30', '31-100', '100+'] },
      { key: 'design_team_size', label: 'Design Team Size', type: 'single', options: ['0', '1-3', '4-10', '10+'] },
      { key: 'pm_team_size', label: 'Project Management Team Size', type: 'single', options: ['0', '1-3', '4-10', '10+'] },
      { key: 'construction_team', label: 'Construction Team', type: 'single', options: ['In-house', 'Outsourced', 'Hybrid'] },
      { key: 'management_background', label: 'Management Background', type: 'multi', options: ['UAE Local', 'Arab', 'South Asian', 'Chinese', 'European', 'Mixed'] },
      { key: 'owner_nationality', label: 'Owner / Shareholder Nationality', type: 'multi', options: ['Emirati', 'Arab', 'Indian', 'Pakistani', 'Chinese', 'European', 'Other'] },
    ],
  },
  {
    title: 'Section 4: Projects & Performance',
    key: 'section_4',
    fields: [
      { key: 'projects_last_year', label: 'Projects Completed Last Year', type: 'single', options: ['1-5', '6-20', '21-50', '50+'] },
      { key: 'annual_revenue_aed', label: 'Annual Revenue (AED)', type: 'single', options: ['< 1M', '1-5M', '5-20M', '20-50M', '50M+'] },
      { key: 'typical_contract_value', label: 'Typical Contract Value Range', type: 'single', options: ['< 100K', '100K-500K', '500K-2M', '2M+'] },
      { key: 'main_project_types', label: 'Main Project Types', type: 'multi', options: ['Villa', 'Apartment', 'Office', 'Retail', 'Hotel', 'Restaurant', 'Government'] },
    ],
  },
  {
    title: 'Section 5: Supply Chain',
    key: 'section_5',
    fields: [
      { key: 'main_material_sources', label: 'Main Material Sources', type: 'multi', options: ['China', 'Italy', 'Germany', 'Local UAE', 'India', 'Turkey', 'Mixed'] },
      { key: 'stable_supply_chain', label: 'Stable Supply Chain?', type: 'single', options: ['Yes', 'No', 'Partially'] },
      { key: 'open_to_chinese_supply', label: 'Open to Chinese Material Supply?', type: 'single', options: ['Very Interested', 'Open', 'Neutral', 'Not Interested'] },
    ],
  },
  {
    title: 'Section 6: Strengths & Challenges',
    key: 'section_6',
    fields: [
      { key: 'key_strengths', label: 'Key Strengths', type: 'multi', options: ['Design Capability', 'Speed', 'Price', 'Quality', 'Relationships', 'After-sales'] },
      { key: 'main_challenges', label: 'Main Challenges', type: 'multi', options: ['Material Cost', 'Labour', 'Cash Flow', 'Competition', 'Finding Clients', 'Logistics'] },
    ],
  },
  {
    title: 'Section 7: Cooperation Intent',
    key: 'section_7',
    fields: [
      { key: 'interest_in_chinese_platform', label: 'Interest in Cooperating with Chinese Supply Platform', type: 'single', options: ['Very Interested', 'Interested', 'Maybe', 'Not Interested'] },
      { key: 'support_needed', label: 'Support Needed', type: 'multi', options: ['Sourcing', 'Logistics', 'Quality Control', 'Payment Terms', 'Showroom', 'Training'] },
      { key: 'preferred_cooperation_model', label: 'Preferred Cooperation Model', type: 'single', options: ['Platform Membership', 'Per-project', 'Revenue Share', 'Exclusive Supply'] },
    ],
  },
  {
    title: 'Section 8: Additional Information',
    key: 'section_8',
    fields: [
      { key: 'stable_developer_clients', label: 'Stable Developer / Client Resources?', type: 'single', options: ['Yes', 'No', 'Some'] },
      { key: 'avg_project_duration', label: 'Average Project Duration', type: 'single', options: ['< 1 month', '1-3 months', '3-6 months', '6+ months'] },
      { key: 'client_acquisition_channels', label: 'Client Acquisition Channels', type: 'multi', options: ['Referral', 'Social Media', 'Tenders', 'Direct Sales', 'Repeat Clients', 'Platforms'] },
      { key: 'design_software', label: 'Design Software Used', type: 'multi', options: ['AutoCAD', '3ds Max', 'SketchUp', 'Revit', 'Lumion', 'Other'] },
      { key: 'standardized_quotation', label: 'Standardized Quotation System?', type: 'single', options: ['Yes', 'No', 'In Progress'] },
    ],
  },
  {
    title: 'Section 9: Strategic Questions',
    key: 'section_9',
    fields: [
      { key: 'open_to_material_construction_split', label: 'Open to Material + Construction Separation Model?', type: 'single', options: ['Yes', 'No', 'Need to Discuss'] },
      { key: 'willing_to_share_client_resources', label: 'Willing to Share Client Resources for Joint Projects?', type: 'single', options: ['Yes', 'No', 'Case by Case'] },
      { key: 'concerns_about_chinese_supply', label: 'Main Concerns About Chinese Supply Chain', type: 'multi', options: ['Quality', 'Delivery Time', 'Communication', 'MOQ', 'After-sales', 'None'] },
      { key: 'interested_in_showroom_collab', label: 'Interested in Showroom / Sample Collaboration?', type: 'single', options: ['Very Interested', 'Interested', 'Maybe', 'Not Interested'] },
    ],
  },
];

type SectionData = Record<string, string | string[]>;
type AllSections = { [key: string]: SectionData };

export default function FieldSurveyPage() {
  const [draftId, setDraftId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [companyRefId, setCompanyRefId] = useState<number | null>(null);
  const [companyRefName, setCompanyRefName] = useState('');
  const [sections, setSections] = useState<AllSections>({});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [companySuggestions, setCompanySuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const companySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize: check for existing draft
  useEffect(() => {
    (async () => {
      try {
        const storedId = localStorage.getItem('field_draft_id');
        if (storedId) {
          const { draft } = await fieldApi.getDraft();
          if (draft && draft.id === Number(storedId)) {
            hydrateDraft(draft);
            return;
          }
        }
        // Create new draft
        const { id } = await fieldApi.createDraft();
        setDraftId(id);
        localStorage.setItem('field_draft_id', String(id));
      } catch (e) {
        console.error('Init error:', e);
      }
    })();
  }, []);

  function hydrateDraft(draft: any) {
    setDraftId(draft.id);
    setCompanyName(draft.company_name || '');
    setCompanyRefId(draft.company_ref_id || null);
    const restored: AllSections = {};
    for (let i = 1; i <= 9; i++) {
      const key = `section_${i}`;
      if (draft[key]) {
        try {
          restored[key] = typeof draft[key] === 'string' ? JSON.parse(draft[key]) : draft[key];
        } catch {
          restored[key] = {};
        }
      }
    }
    setSections(restored);
  }

  const triggerSave = useCallback((
    id: number,
    cName: string,
    cRefId: number | null,
    secs: AllSections
  ) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await fieldApi.saveDraft(id, {
          company_name: cName,
          company_ref_id: cRefId,
          ...Object.fromEntries(
            Object.entries(secs).map(([k, v]) => [k, v])
          ),
        });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('idle');
      }
    }, 500);
  }, []);

  function updateSection(sectionKey: string, fieldKey: string, value: string | string[]) {
    setSections(prev => {
      const updated = {
        ...prev,
        [sectionKey]: { ...(prev[sectionKey] || {}), [fieldKey]: value },
      };
      if (draftId) triggerSave(draftId, companyName, companyRefId, updated);
      return updated;
    });
  }

  function handleCompanyNameChange(val: string) {
    setCompanyName(val);
    if (draftId) triggerSave(draftId, val, companyRefId, sections);
    // Debounce search
    if (companySearchTimerRef.current) clearTimeout(companySearchTimerRef.current);
    if (val.length > 1) {
      companySearchTimerRef.current = setTimeout(async () => {
        try {
          const { results } = await fieldApi.searchCompanies(val);
          setCompanySuggestions(results);
          setShowSuggestions(results.length > 0);
        } catch {
          setShowSuggestions(false);
        }
      }, 300);
    } else {
      setShowSuggestions(false);
    }
  }

  function selectCompany(company: any) {
    setCompanyRefId(company.id);
    setCompanyRefName(company.name);
    setCompanyName(company.name);
    setShowSuggestions(false);
    if (draftId) triggerSave(draftId, company.name, company.id, sections);
  }

  async function handleSubmit() {
    if (!draftId) return;
    setIsSubmitting(true);
    try {
      await fieldApi.submit(draftId);
      localStorage.removeItem('field_draft_id');
      setSubmitted(true);
    } catch (e: any) {
      alert(e.message || 'Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  }

  function startNew() {
    localStorage.removeItem('field_draft_id');
    window.location.reload();
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-center px-6">
        <div className="text-5xl mb-4">✓</div>
        <h1 className="text-xl font-bold text-[#2c2c2c] mb-2">Interview Submitted</h1>
        <p className="text-stone-500 text-sm mb-8">Record saved successfully.</p>
        <button onClick={startNew} className="btn-primary w-full max-w-xs">
          Start New Interview
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] pb-24">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-[#2c2c2c] text-sm">Interview Survey</span>
        <span className={`text-xs ${saveStatus === 'saving' ? 'text-stone-400' : saveStatus === 'saved' ? 'text-green-600' : 'text-stone-300'}`}>
          {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : ''}
        </span>
      </div>

      <div className="px-4 pt-6 space-y-8 max-w-lg mx-auto">
        {/* Company name */}
        <div>
          <label className="block text-sm font-medium text-stone-500 mb-1">Company Name *</label>
          <div className="relative">
            <input
              value={companyName}
              onChange={e => handleCompanyNameChange(e.target.value)}
              placeholder="Enter company name"
              className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A] focus:bg-white"
            />
            {showSuggestions && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-2xl shadow-lg z-20 overflow-hidden">
                {companySuggestions.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCompany(c)}
                    className="w-full text-left px-4 py-3 text-sm hover:bg-stone-50 border-b border-stone-100 last:border-0"
                  >
                    <span className="font-medium">{c.name}</span>
                    {c.city && <span className="text-stone-400 ml-2">{c.city}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          {companyRefName && companyRefId && (
            <p className="text-xs text-green-600 mt-1">✓ Linked to existing company record</p>
          )}
        </div>

        {/* All 9 sections */}
        {SECTIONS.map(section => (
          <div key={section.key}>
            <h2 className="text-base font-bold text-[#2c2c2c] mb-4 pl-3 border-l-4 border-[#b8864a]">
              {section.title}
            </h2>
            <div className="space-y-5">
              {section.fields.map(field => {
                const sectionData = sections[section.key] || {};
                const val = sectionData[field.key] ?? (field.type === 'multi' ? [] : '');
                return (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-stone-500 mb-2">{field.label}</label>
                    <ChipSelect
                      options={field.options}
                      value={val}
                      multi={field.type === 'multi'}
                      onChange={v => updateSection(section.key, field.key, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky submit button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3">
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !companyName}
          className="btn-primary w-full disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting…' : 'Submit Interview'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/pages/field/FieldSurveyPage.tsx
git commit -m "feat: add FieldSurveyPage with all 9 sections, auto-save, company search"
```

---

## Task 9: Frontend — AdminContext + login redirect

**Files:**
- Modify: `src/contexts/AdminContext.tsx`
- Modify: `src/pages/admin/AdminLoginPage.tsx`

**Step 1: Add `isFieldStaff` to AdminContext**

In `AdminContext.tsx`, add to the `AdminContextType` interface:
```typescript
isFieldStaff: boolean;
```

In the provider return value, add:
```typescript
isFieldStaff: admin?.role === 'field_staff',
```

Also expose it from the `useAdmin` hook.

**Step 2: Update AdminLoginPage redirect**

In `AdminLoginPage.tsx`, change the login success handler from:
```typescript
navigate('/admin');
```
to:
```typescript
const result = await login(email, password);
// login sets admin in context — but we need role from the response
// adminApi.login returns { admin: { role, ... } }
// Check result.admin.role:
if (result?.admin?.role === 'field_staff') {
  navigate('/field/survey');
} else {
  navigate('/admin');
}
```

> Note: Check if `adminApi.login()` returns the admin object. If `login()` in AdminContext doesn't return the result, modify the `login` function to return it, or read the role from localStorage after login.

The simplest fix: in `AdminContext.tsx` `login()` function, make it return the result:
```typescript
const login = async (email: string, password: string) => {
  const result = await adminApi.login(email, password);
  setAdmin({ ... });
  return result; // add this return
};
```

Then in `AdminLoginPage.tsx`:
```typescript
const result = await login(email, password);
if (result?.admin?.role === 'field_staff') {
  navigate('/field/survey');
} else {
  navigate('/admin');
}
```

Also update the `useEffect` that auto-redirects logged-in admin:
```typescript
useEffect(() => {
  if (admin) {
    if (admin.role === 'field_staff') {
      navigate('/field/survey');
    } else {
      navigate('/admin');
    }
  }
}, [admin, navigate]);
```

**Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/contexts/AdminContext.tsx src/pages/admin/AdminLoginPage.tsx
git commit -m "feat: redirect field_staff to /field/survey after login"
```

---

## Task 10: Frontend — Add routes in App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add import**

```tsx
import FieldSurveyPage from './pages/field/FieldSurveyPage';
```

**Step 2: Add route**

Before the `/admin/login` route (around line 204), add:
```tsx
<Route path="/field/survey" element={<AdminProvider><FieldSurveyPage /></AdminProvider>} />
```

The `AdminProvider` handles auth check — `field_staff` users will already have their token set.

**Step 3: Add auth guard**

Create `src/components/field/FieldAuthGuard.tsx`:
```tsx
import { useAdmin } from '../../contexts/AdminContext';
import { Navigate } from 'react-router-dom';

export default function FieldAuthGuard({ children }: { children: React.ReactNode }) {
  const { admin, isLoading } = useAdmin();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="text-stone-400 text-sm">Loading…</div></div>;
  if (!admin) return <Navigate to="/admin/login" replace />;
  if (admin.role !== 'field_staff' && admin.role !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }
  return <>{children}</>;
}
```

Update route to use guard:
```tsx
<Route path="/field/survey" element={
  <AdminProvider>
    <FieldAuthGuard>
      <FieldSurveyPage />
    </FieldAuthGuard>
  </AdminProvider>
} />
```

**Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/App.tsx src/components/field/FieldAuthGuard.tsx
git commit -m "feat: add /field/survey route with auth guard"
```

---

## Task 11: Frontend — AdminInterviewsPage

**Files:**
- Create: `src/pages/admin/AdminInterviewsPage.tsx`

Follow exact same pattern as `AdminAdminsPage.tsx`:
- `useState` for `interviews`, `isLoading`, `selectedInterview`
- `useEffect` → `adminApi.getInterviews()` → set state
- Table with columns: Company Name / Interviewer / Submitted At / Status
- Click row → side panel or navigate to detail

```tsx
import { useState, useEffect } from 'react';
import { adminApi } from '../../lib/adminApi';
import { PageSpinner } from '../../components/ui/Spinner';

interface Interview {
  id: number;
  company_name: string;
  interviewer_name: string;
  status: 'draft' | 'submitted';
  submitted_at: string | null;
  linked_company_name: string | null;
  created_at: string;
}

export default function AdminInterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminApi.getInterviews()
      .then((r: any) => setInterviews(r.interviews))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <PageSpinner />;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#2c2c2c] mb-6">Interview Records</h1>
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Company</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Interviewer</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {interviews.map(iv => (
              <tr key={iv.id} className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                onClick={() => window.location.href = `/admin/interviews/${iv.id}`}>
                <td className="px-4 py-3 font-medium text-[#2c2c2c]">
                  {iv.company_name || <span className="text-stone-400 italic">Unnamed</span>}
                  {iv.linked_company_name && (
                    <span className="ml-2 text-xs text-[#b8864a]">↗ {iv.linked_company_name}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-600">{iv.interviewer_name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    iv.status === 'submitted' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                  }`}>{iv.status}</span>
                </td>
                <td className="px-4 py-3 text-stone-400 text-xs">
                  {iv.submitted_at ? new Date(iv.submitted_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {interviews.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400">No interviews yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Add route in App.tsx**

Inside the `/admin` route children:
```tsx
<Route path="interviews" element={<AdminInterviewsPage />} />
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/admin/AdminInterviewsPage.tsx src/App.tsx
git commit -m "feat: add AdminInterviewsPage"
```

---

## Task 12: Frontend — AdminStaffPage

**Files:**
- Create: `src/pages/admin/AdminStaffPage.tsx`

Follow `AdminAdminsPage.tsx` pattern exactly:
- List field_staff accounts
- Create modal (fullName + email + password)
- Toggle active/inactive button per row

```tsx
import { useState, useEffect } from 'react';
import { adminApi } from '../../lib/adminApi';
import { PageSpinner } from '../../components/ui/Spinner';

interface StaffMember {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    try {
      const r: any = await adminApi.getStaff();
      setStaff(r.staff);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }

  async function handleCreate() {
    setError('');
    setIsSubmitting(true);
    try {
      await adminApi.createStaff(form);
      setShowModal(false);
      setForm({ email: '', password: '', fullName: '' });
      loadStaff();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggle(id: number, currentActive: boolean) {
    await adminApi.toggleStaff(id, !currentActive);
    setStaff(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentActive } : s));
  }

  if (isLoading) return <PageSpinner />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#2c2c2c]">Field Staff</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">+ New Staff</button>
      </div>
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Name</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Status</th>
              <th className="text-left px-4 py-3 font-medium text-stone-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {staff.map(s => (
              <tr key={s.id} className="border-b border-stone-100">
                <td className="px-4 py-3 font-medium text-[#2c2c2c]">{s.full_name}</td>
                <td className="px-4 py-3 text-stone-600">{s.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                  }`}>{s.is_active ? 'Active' : 'Disabled'}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleToggle(s.id, s.is_active)}
                    className="text-xs text-stone-500 hover:text-[#b8864a]">
                    {s.is_active ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">New Field Staff</h2>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="space-y-3">
              {['fullName', 'email', 'password'].map(key => (
                <div key={key}>
                  <label className="block text-sm font-medium text-stone-500 mb-1 capitalize">
                    {key === 'fullName' ? 'Full Name' : key}
                  </label>
                  <input
                    type={key === 'password' ? 'password' : 'text'}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full h-[50px] px-5 rounded-2xl border border-stone-200 bg-stone-50/80 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#B8864A]/15 focus:border-[#B8864A]"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 h-11 rounded-2xl border border-stone-200 text-stone-600 text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={isSubmitting} className="flex-1 btn-primary disabled:opacity-50">
                {isSubmitting ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add route in App.tsx**

```tsx
<Route path="staff" element={<AdminStaffPage />} />
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/pages/admin/AdminStaffPage.tsx src/App.tsx
git commit -m "feat: add AdminStaffPage for field staff management"
```

---

## Task 13: Frontend — Admin sidebar menu items

**Files:**
- Modify: `src/components/admin/AdminSidebar.tsx` (or wherever the nav links are)

**Step 1: Find the sidebar file**

```bash
grep -r "AdminCompaniesPage\|/admin/designers" src/components/admin/ --include="*.tsx" -l
```

**Step 2: Add Interviews and Staff links**

Add to the nav links array (following existing pattern):
```tsx
{ href: '/admin/interviews', label: 'Interviews', icon: '📋' },
{ href: '/admin/staff', label: 'Field Staff', icon: '👥' },
```

**Step 3: Verify**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add src/components/admin/
git commit -m "feat: add Interviews and Staff links to admin sidebar"
```

---

## Task 14: Final — run harness + local test

**Step 1: Build server**

```bash
cd /Users/kp/.warp/worktrees/tarmeer-4.0-local/organ-pipe-horned-toad/server
npm run build
```

**Step 2: Start local server**

```bash
PORT=3099 DEV_SKIP_EMAIL=true node dist/app.js
```

**Step 3: Test API endpoints**

```bash
# Should return 401 (no token)
curl http://localhost:3099/api/field/interviews

# Login as existing super_admin and get token, then:
TOKEN="<token_from_login>"

# Create draft
curl -X POST http://localhost:3099/api/field/interviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Auto-save
curl -X PATCH http://localhost:3099/api/field/interviews/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Test Co","section_1":{"company_type":"Local"}}'

# Submit
curl -X POST http://localhost:3099/api/field/interviews/1/submit \
  -H "Authorization: Bearer $TOKEN"

# Admin list
curl http://localhost:3099/api/admin/interviews \
  -H "Authorization: Bearer $TOKEN"
```

**Step 4: Run lint-admin-ui harness**

```bash
cd /Users/kp/.warp/worktrees/tarmeer-4.0-local/organ-pipe-horned-toad
node scripts/harness/lint-admin-ui.mjs
```

**Step 5: Run frozen contracts test**

```bash
node scripts/harness/test-frozen-contracts.mjs
```

**Step 6: Frontend dev test**

```bash
npm run dev
```

Open `http://localhost:5173/admin/login` → login with super_admin → verify redirect to `/admin`
Open `http://localhost:5173/admin/interviews` → verify page loads
Open `http://localhost:5173/admin/staff` → create field_staff user → login as that user → verify redirect to `/field/survey` → fill survey → submit → check admin panel shows submitted record.

---

## Summary

| Task | What it does |
|------|-------------|
| 1 | DB: `company_interviews` table + `field_staff` role |
| 2 | Middleware: `requireFieldOrSuperAdmin`, `blockFieldStaff` |
| 3 | Controller: `fieldInterviewController.ts` |
| 4 | Routes: `/api/field/*` registered in app.ts |
| 5 | Controller + routes: admin interview list/detail + staff CRUD |
| 6 | Frontend: `adminApi` + `fieldApi` client methods |
| 7 | Component: `ChipSelect` |
| 8 | Page: `FieldSurveyPage` (main survey, auto-save) |
| 9 | Auth: login redirect by role |
| 10 | Route: `/field/survey` + `FieldAuthGuard` |
| 11 | Admin page: `AdminInterviewsPage` |
| 12 | Admin page: `AdminStaffPage` |
| 13 | Sidebar: add nav links |
| 14 | Test: API + harness + e2e |
