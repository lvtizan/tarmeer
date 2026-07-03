# Field Survey Auth + Company Detail Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add branch addresses to company profile, add field-staff login + history re-edit + audit trail to field survey, and improve the admin company detail layout with survey-verified fields.

**Architecture:** Backend is plain JS in `server/dist/` (no TypeScript source — edit `.js` files directly). Field staff are stored in `admin_users` with `role='field_staff'` and use the same JWT format as admins (`{ adminId, type: 'admin' }`). The existing `authenticateAdmin` + `requireFieldOrSuperAdmin` middleware in `server/dist/middleware/adminAuth.js` is reused for field route protection. Frontend token is stored as `field_token` in localStorage.

**Tech Stack:** Next.js (App Router), Express.js (plain JS), MySQL, JWT (jsonwebtoken), bcryptjs, Tailwind CSS, lucide-react

---

## Context (read before implementing)

- All backend edits go to `server/dist/**/*.js` — no TypeScript compilation needed
- After any backend edit: kill port 3002 and restart: `PORT=3002 DEV_SKIP_EMAIL=true node /Users/kp/Code/tarmeer-4.0-local/server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &`
- Frontend hot-reloads; only restart if you edit `next.config.ts`
- Admin JWT payload: `{ adminId: number, type: 'admin' }` — same token works for field staff
- `fieldRequest` in `src/lib/adminApi.ts` currently reads `localStorage.getItem('admin_token')` — we'll change to `field_token`
- `searchCompanies` is at `GET /api/field/companies/search`
- Field routes file: `server/dist/routes/field.js`
- Field controller: `server/dist/controllers/fieldInterviewController.js`
- Admin middleware: `server/dist/middleware/adminAuth.js` — has `authenticateAdmin`, `requireFieldOrSuperAdmin`

---

## Task 1: Branch Addresses — Add DB Column

**Files:**
- Modify: `server/dist/controllers/companyProfileController.js`

**Step 1: Add ensureColumn call at the top of the file**

In `companyProfileController.js`, after the existing imports (around line 18), add a self-executing async block that runs once on module load:

```js
// Ensure branch_addresses column exists
(async () => {
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'company_profiles' AND COLUMN_NAME = 'branch_addresses'`
    );
    if (cols.length === 0) {
      await pool.execute(`ALTER TABLE company_profiles ADD COLUMN branch_addresses JSON NULL`);
      console.log('[profile] added branch_addresses column');
    }
  } catch(e) { console.error('[profile] ensureColumn branch_addresses:', e.message); }
})();
```

Note: `pool` is the variable name for `database_1.default` in this file.

**Step 2: Restart backend and verify column**

```bash
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node /Users/kp/Code/tarmeer-4.0-local/server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 2 && grep "branch_addresses" /tmp/tarmeer-api-3002.log
```

Expected: either `[profile] added branch_addresses column` or silence (column already exists).

**Step 3: Commit**

```bash
git add server/dist/controllers/companyProfileController.js
git commit -m "feat: ensure branch_addresses column on company_profiles"
```

---

## Task 2: Branch Addresses — Backend Read/Write

**Files:**
- Modify: `server/dist/controllers/companyProfileController.js`

**Step 1: Update `upsertProfile` — extract branch_addresses from body**

In `upsertProfile`, after the existing JSON stringification lines (around line 35-38), add:

```js
const branchAddressesJson = Array.isArray(req.body.branch_addresses)
  ? JSON.stringify(req.body.branch_addresses.slice(0, 10).map(a => String(a).slice(0, 300)).filter(Boolean))
  : null;
```

**Step 2: Update the UPDATE query**

In the UPDATE `execute` call (the long SQL string around line 47), add `branch_addresses = ?` to the SET clause and add `branchAddressesJson` to the values array, before the `WHERE user_id = ?` placeholder value.

**Step 3: Update the INSERT query**

In the INSERT `execute` call (around line 81), add `branch_addresses` to the column list and `branchAddressesJson` to the VALUES list (before the closing `)`).

**Step 4: Verify via curl**

```bash
# Get current profile (check branch_addresses is returned)
curl -s http://localhost:3002/api/company/profile \
  -H "Authorization: Bearer <company_token>" | jq '.profile.branch_addresses'
```

Expected: `null` (not yet set, no error).

**Step 5: Commit**

```bash
git add server/dist/controllers/companyProfileController.js
git commit -m "feat: add branch_addresses read/write to company profile API"
```

---

## Task 3: Branch Addresses — Frontend UI

**Files:**
- Modify: `src/components/company/CompanyProfileForm.tsx`

**Step 1: Add `branch_addresses` to `ProfileData` interface and `EMPTY_PROFILE`**

In the `ProfileData` interface (around line 59), add:
```ts
branch_addresses: string[];
```

In `EMPTY_PROFILE` (around line 72), add:
```ts
branch_addresses: [],
```

**Step 2: Hydrate branch_addresses in the form load**

Find where the form state is initialized from the API response (`api.get('/auth/company/profile')`). Add:
```ts
branch_addresses: Array.isArray(d.branch_addresses) ? d.branch_addresses : [],
```

**Step 3: Add Branch Addresses section to the form JSX**

Find the address field section in the JSX. After the main address `<FormInput>`, add:

```tsx
{/* Branch Addresses */}
<div className="space-y-2">
  <FormLabel>Branch Addresses</FormLabel>
  {profile.branch_addresses.map((addr, idx) => (
    <div key={idx} className="flex gap-2">
      <input
        type="text"
        value={addr}
        onChange={e => {
          const next = [...profile.branch_addresses];
          next[idx] = e.target.value;
          setProfile(p => ({ ...p, branch_addresses: next }));
        }}
        placeholder={`Branch address ${idx + 1}`}
        className="flex-1 h-10 px-3 rounded-lg border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-[#b8864a]/30 focus:border-[#b8864a] focus:bg-white"
      />
      <button
        type="button"
        onClick={() => setProfile(p => ({ ...p, branch_addresses: p.branch_addresses.filter((_, i) => i !== idx) }))}
        className="h-10 w-10 flex items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  ))}
  {profile.branch_addresses.length < 10 && (
    <button
      type="button"
      onClick={() => setProfile(p => ({ ...p, branch_addresses: [...p.branch_addresses, ''] }))}
      className="flex items-center gap-1.5 text-sm text-[#b8864a] hover:underline"
    >
      <Plus className="w-4 h-4" />
      Add Branch Address
    </button>
  )}
</div>
```

Make sure `X` and `Plus` are imported from `lucide-react`.

**Step 4: Include `branch_addresses` in the save payload**

Find where the form data is sent to the API (the `save()` function / PUT call). Add `branch_addresses: profile.branch_addresses` to the payload.

**Step 5: Test in browser**

Navigate to `http://localhost:5180/company/profile`. The "Branch Addresses" section should appear under the main address field. Add one branch address, save, reload — it should persist.

**Step 6: Commit**

```bash
git add src/components/company/CompanyProfileForm.tsx
git commit -m "feat: add branch addresses UI to company profile form"
```

---

## Task 4: Field Staff Login Page

**Files:**
- Create: `src/app/field/login/page.tsx`

**Step 1: Create the login page**

```tsx
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function FieldLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }
      // Field staff must have role field_staff (or super_admin for testing)
      if (data.admin?.role !== 'field_staff' && data.admin?.role !== 'super_admin') {
        setError('This account does not have field staff access.');
        return;
      }
      localStorage.setItem('field_token', data.token);
      localStorage.setItem('field_user', JSON.stringify(data.admin));
      router.replace('/field/survey');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-stone-100 px-8 py-10">
        <div className="w-12 h-12 rounded-2xl bg-[#b8864a]/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-6 h-6 text-[#b8864a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-[#1c1917] text-center mb-1">Field Staff Login</h1>
        <p className="text-sm text-stone-400 text-center mb-6">Sign in to access the survey</p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="your@email.com"
              className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20 focus:border-[#b8864a] focus:bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20 focus:border-[#b8864a] focus:bg-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full h-11 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Test in browser**

Navigate to `http://localhost:5180/field/login`. Login with a field_staff account. Should redirect to `/field/survey`.

**Step 3: Commit**

```bash
git add src/app/field/login/page.tsx
git commit -m "feat: add field staff login page"
```

---

## Task 5: Field Layout Auth Guard + Token Injection

**Files:**
- Modify: `src/app/field/layout.tsx`

**Step 1: Replace the layout with auth guard**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function FieldLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Login page never redirects
    if (pathname === '/field/login') {
      setReady(true);
      return;
    }
    const token = localStorage.getItem('field_token');
    if (!token) {
      router.replace('/field/login');
      return;
    }
    // Check expiry (JWT payload is base64 — decode second segment)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('field_token');
        localStorage.removeItem('field_user');
        router.replace('/field/login');
        return;
      }
    } catch { /* malformed token — kick to login */
      localStorage.removeItem('field_token');
      router.replace('/field/login');
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) return <div className="min-h-screen bg-[#faf9f7]" />;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {children}
    </div>
  );
}
```

**Step 2: Test**

Navigate to `http://localhost:5180/field/survey` without logging in — should redirect to `/field/login`.
After login it should reach the survey.

**Step 3: Commit**

```bash
git add src/app/field/layout.tsx
git commit -m "feat: add auth guard to field layout"
```

---

## Task 6: Update fieldRequest to Use field_token

**Files:**
- Modify: `src/lib/adminApi.ts`

**Step 1: Update `fieldRequest` function (around line 1005)**

Change:
```ts
const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
```
To:
```ts
const token = typeof window !== 'undefined'
  ? (localStorage.getItem('field_token') || localStorage.getItem('admin_token'))
  : null;
```

(Fallback to `admin_token` so super admins can also access field routes without logging in separately.)

**Step 2: Also update the `uploadPhoto` method (around line 1035)**

Same change for the `token` line in `uploadPhoto`:
```ts
const token = typeof window !== 'undefined'
  ? (localStorage.getItem('field_token') || localStorage.getItem('admin_token'))
  : null;
```

**Step 3: Add login/logout/loadInterview/reSubmit to fieldApi object**

After `getSurveySchema`, add:

```ts
login: (email: string, password: string) =>
  fetch('/api/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(r => r.json()),

logout: () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('field_token');
    localStorage.removeItem('field_user');
  }
},

loadInterview: (id: number) => fieldRequest(`/interviews/${id}/load`),

reSubmit: (id: number, data: Record<string, unknown>) =>
  fieldRequest(`/interviews/${id}/re-submit`, { method: 'POST', body: JSON.stringify(data) }),
```

**Step 4: Commit**

```bash
git add src/lib/adminApi.ts
git commit -m "feat: update fieldRequest to use field_token, add login/reSubmit methods"
```

---

## Task 7: Protect Field Routes + interviewer_id

**Files:**
- Modify: `server/dist/routes/field.js`
- Modify: `server/dist/controllers/fieldInterviewController.js`

**Step 1: Update `field.js` routes to add auth middleware**

```js
const { authenticateAdmin, requireFieldOrSuperAdmin } = require('../middleware/adminAuth');

// Public routes (no auth needed)
router.get('/survey-schema', getSurveySchema);
router.get('/companies/search', searchCompanies);

// Protected routes (field staff or super admin)
router.use(authenticateAdmin, requireFieldOrSuperAdmin);
router.post('/interviews', createDraft);
router.get('/interviews/draft', getMyDraft);
router.get('/interviews/:id/load', loadInterview);          // NEW
router.patch('/interviews/:id', saveDraft);
router.post('/interviews/:id/submit', submitInterview);
router.post('/interviews/:id/re-submit', reSubmitInterview); // NEW
router.post('/interviews/:id/photos', uploadPhotoMiddleware, uploadPhoto);
```

Make sure to export `loadInterview` and `reSubmitInterview` from the controller file.

**Step 2: Update `createDraft` to set `interviewer_id`**

In `fieldInterviewController.js`, in `createDraft`:

Change:
```js
const [result] = await pool.execute(`INSERT INTO company_interviews (status) VALUES ('draft')`);
```
To:
```js
const interviewerId = req.adminId || null;
const [result] = await pool.execute(
  `INSERT INTO company_interviews (status, interviewer_id) VALUES ('draft', ?)`,
  [interviewerId]
);
```

**Step 3: Add `loadInterview` function**

Add at the bottom of `fieldInterviewController.js`:

```js
async function loadInterview(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      `SELECT ci.*, COALESCE(au.full_name, '—') AS interviewer_name
       FROM company_interviews ci
       LEFT JOIN admin_users au ON au.id = ci.interviewer_id
       WHERE ci.id = ? AND ci.status = 'submitted'`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Interview not found.' });
    res.json({ interview: rows[0] });
  } catch(e) {
    res.status(500).json({ error: 'Failed to load interview.' });
  }
}
exports.loadInterview = loadInterview;
```

**Step 4: Restart backend and verify 401 on unprotected call**

```bash
# Restart
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node /Users/kp/Code/tarmeer-4.0-local/server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 2

# Should return 401 now (no token)
curl -s http://localhost:3002/api/field/interviews -X POST | jq .
```
Expected: `{ "error": "Authentication token is required." }`

**Step 5: Commit**

```bash
git add server/dist/routes/field.js server/dist/controllers/fieldInterviewController.js
git commit -m "feat: protect field routes with auth, set interviewer_id on createDraft"
```

---

## Task 8: Search Companies Returns Historical Interviews

**Files:**
- Modify: `server/dist/controllers/fieldInterviewController.js`

**Step 1: Update `searchCompanies` to include recent interviews per company**

Replace the existing `searchCompanies` function:

```js
async function searchCompanies(req, res) {
  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.json({ results: [] });
  const like = `%${q}%`;
  try {
    const [rows] = await pool.execute(
      `(SELECT id, name_en AS name, city, 'uae' AS source FROM uae_companies WHERE name_en LIKE ? AND name_en IS NOT NULL)
       UNION
       (SELECT id, company_name AS name, city, 'profile' AS source FROM company_profiles WHERE company_name LIKE ? AND deleted_at IS NULL)
       ORDER BY name
       LIMIT 20`,
      [like, like]
    );

    // For each company, fetch recent submitted interviews
    const results = await Promise.all(rows.map(async (company) => {
      const [ivRows] = await pool.execute(
        `SELECT ci.id, ci.submitted_at, COALESCE(au.full_name, '—') AS interviewer_name
         FROM company_interviews ci
         LEFT JOIN admin_users au ON au.id = ci.interviewer_id
         WHERE ci.company_ref_id = ? AND ci.company_ref_source = ? AND ci.status = 'submitted'
         ORDER BY ci.submitted_at DESC
         LIMIT 5`,
        [company.id, company.source]
      );
      return { ...company, interviews: ivRows };
    }));

    res.json({ results });
  } catch(e) {
    res.status(500).json({ error: 'Search failed.' });
  }
}
```

**Step 2: Test**

```bash
curl -s "http://localhost:3002/api/field/companies/search?q=fatin" | jq '.results[0].interviews'
```

Expected: an array (possibly empty) of interview records.

**Step 3: Commit**

```bash
git add server/dist/controllers/fieldInterviewController.js
git commit -m "feat: searchCompanies returns historical submitted interviews per company"
```

---

## Task 9: Audit Log Table + reSubmitInterview

**Files:**
- Modify: `server/dist/controllers/fieldInterviewController.js`

**Step 1: Add `ensureEditLogsTable` call at module load**

At the top of `fieldInterviewController.js` (after the existing `ensureColumns` function), add:

```js
async function ensureEditLogsTable() {
  try {
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS interview_edit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        interview_id INT NOT NULL,
        editor_id INT NOT NULL,
        editor_name VARCHAR(100) NOT NULL,
        snapshot_before JSON,
        edit_summary TEXT,
        edited_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_interview_id (interview_id)
      )
    `);
  } catch(e) {
    console.error('[field] ensureEditLogsTable:', e.message);
  }
}
// Run on module load
ensureEditLogsTable();
```

**Step 2: Update `submitInterview` to write first audit log entry**

In `submitInterview`, after the UPDATE query:

```js
// Write initial audit log
const editorId = req.adminId || 0;
const [editorRows] = await pool.execute(
  'SELECT full_name FROM admin_users WHERE id = ?', [editorId]
);
const editorName = editorRows[0]?.full_name || '—';
await pool.execute(
  `INSERT INTO interview_edit_logs (interview_id, editor_id, editor_name, snapshot_before, edit_summary)
   VALUES (?, ?, ?, NULL, 'Initial submission')`,
  [id, editorId, editorName]
);
```

**Step 3: Add `reSubmitInterview` function**

```js
async function reSubmitInterview(req, res) {
  const { id } = req.params;
  const allowed = ['company_name','company_ref_id','company_ref_source',
    'section_1','section_2','section_3','section_4','section_5',
    'section_6','section_7','section_8','section_9'];

  try {
    // Fetch current state for snapshot
    const [rows] = await pool.execute(
      'SELECT * FROM company_interviews WHERE id = ? AND status = ?',
      [id, 'submitted']
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Submitted interview not found.' });
    const current = rows[0];

    // Build update
    const fields = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields[key] = typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key];
      }
    }
    if (Object.keys(fields).length > 0) {
      const setClauses = Object.keys(fields).map(k => `${k} = ?`).join(', ');
      await pool.execute(
        `UPDATE company_interviews SET ${setClauses}, submitted_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [...Object.values(fields), id]
      );
    }

    // Build edit summary (field-level diff)
    const summaryParts = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        const oldVal = typeof current[key] === 'object' ? JSON.stringify(current[key]) : String(current[key] || '');
        const newVal = typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : String(req.body[key]);
        if (oldVal !== newVal) summaryParts.push(`${key}: "${oldVal}" → "${newVal}"`);
      }
    }
    const editSummary = summaryParts.length > 0 ? summaryParts.join('; ') : 'Re-submitted (no field changes)';

    // Snapshot: store all sections from before
    const snapshotBefore = {};
    for (const key of allowed) snapshotBefore[key] = current[key];

    // Write audit log
    const editorId = req.adminId || 0;
    const [editorRows] = await pool.execute('SELECT full_name FROM admin_users WHERE id = ?', [editorId]);
    const editorName = editorRows[0]?.full_name || '—';
    await pool.execute(
      `INSERT INTO interview_edit_logs (interview_id, editor_id, editor_name, snapshot_before, edit_summary)
       VALUES (?, ?, ?, ?, ?)`,
      [id, editorId, editorName, JSON.stringify(snapshotBefore), editSummary]
    );

    res.json({ ok: true });
    // Re-run merge in case data changed
    mergeInterviewToProfile(parseInt(id, 10)).catch(() => {});
  } catch(e) {
    console.error('reSubmitInterview error:', e);
    res.status(500).json({ error: 'Failed to re-submit.' });
  }
}
exports.reSubmitInterview = reSubmitInterview;
```

**Step 4: Update `getInterview` (admin) to include edit logs**

In `fieldAdminController.js`, update `getInterview`:

```js
async function getInterview(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      `SELECT ci.*, COALESCE(au.full_name, '—') AS interviewer_name,
              CASE ci.company_ref_source
                WHEN 'profile' THEN cp.company_name
                ELSE uc.name_en
              END AS linked_company_name
       FROM company_interviews ci
       LEFT JOIN admin_users au ON au.id = ci.interviewer_id
       LEFT JOIN uae_companies uc ON uc.id = ci.company_ref_id AND ci.company_ref_source = 'uae'
       LEFT JOIN company_profiles cp ON cp.id = ci.company_ref_id AND ci.company_ref_source = 'profile'
       WHERE ci.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found.' });

    // Fetch edit logs
    const [logRows] = await pool.execute(
      `SELECT id, editor_id, editor_name, edit_summary, edited_at
       FROM interview_edit_logs WHERE interview_id = ? ORDER BY edited_at ASC`,
      [id]
    );

    res.json({ interview: rows[0], edit_logs: logRows });
  } catch(e) {
    res.status(500).json({ error: 'Failed to fetch interview.' });
  }
}
```

**Step 5: Restart and verify table created**

```bash
lsof -i :3002 | grep LISTEN | awk '{print $2}' | xargs kill 2>/dev/null; sleep 1
PORT=3002 DEV_SKIP_EMAIL=true node /Users/kp/Code/tarmeer-4.0-local/server/dist/app.js > /tmp/tarmeer-api-3002.log 2>&1 &
sleep 2 && tail -5 /tmp/tarmeer-api-3002.log
```

**Step 6: Commit**

```bash
git add server/dist/controllers/fieldInterviewController.js server/dist/controllers/fieldAdminController.js
git commit -m "feat: add interview_edit_logs table, audit on submit/re-submit"
```

---

## Task 10: Survey Page — Search UI with History + Edit Mode

**Files:**
- Modify: `src/app/field/survey/page.tsx`

**Step 1: Update `CompanySuggestion` interface**

```ts
interface PastInterview {
  id: number;
  submitted_at: string;
  interviewer_name: string;
}

interface CompanySuggestion {
  id: number;
  name: string;
  city?: string;
  source?: string;
  interviews: PastInterview[];
}
```

**Step 2: Add edit mode state variables**

Add near the top of the component state:
```ts
const [editingInterviewId, setEditingInterviewId] = useState<number | null>(null);
```

**Step 3: Update the search suggestion list JSX**

In the `!companyRefId` (search screen), update the suggestions list to show history:

```tsx
{companySuggestions.map((c) => (
  <div key={c.id} className="border-b border-stone-100 last:border-0">
    {/* Company row */}
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-[#1c1917] truncate">{c.name}</p>
        {c.city && <p className="text-xs text-stone-400 mt-0.5">{c.city}</p>}
      </div>
      <button
        type="button"
        onClick={() => selectCompany(c)}
        className="shrink-0 h-8 px-4 rounded-full bg-[#b8864a] text-white text-sm font-semibold active:opacity-80 transition-opacity"
      >
        Match
      </button>
    </div>
    {/* Historical interviews */}
    {c.interviews && c.interviews.length > 0 && (
      <div className="px-4 pb-3 space-y-1.5 bg-stone-50/60">
        <p className="text-[11px] text-stone-400 font-medium uppercase tracking-wide mb-1">Previous records</p>
        {c.interviews.map(iv => (
          <div key={iv.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs text-stone-500">{iv.interviewer_name}</span>
              <span className="text-xs text-stone-300 mx-1.5">·</span>
              <span className="text-xs text-stone-400">{new Date(iv.submitted_at).toLocaleDateString()}</span>
            </div>
            <button
              type="button"
              onClick={() => loadExistingInterview(c, iv.id)}
              className="shrink-0 h-7 px-3 rounded-full border border-[#b8864a] text-[#b8864a] text-xs font-semibold active:opacity-80 transition-opacity"
            >
              修改
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
))}
```

**Step 4: Add `loadExistingInterview` function**

```ts
async function loadExistingInterview(company: CompanySuggestion, interviewId: number) {
  setShowSuggestions(false);
  setCompanySearchQuery('');
  try {
    const { interview } = await fieldApi.loadInterview(interviewId) as { interview: DraftData };
    if (interview) {
      setEditingInterviewId(interviewId);
      // Reuse hydrateDraft but with interview id (not draft id)
      setDraftId(interviewId);
      setCompanyRefId(company.id);
      setCompanyRefName(company.name);
      setCompanyName(company.name);
      setCompanyRefSource(company.source || 'uae');
      // Hydrate sections
      const restored: AllSections = {};
      for (let i = 1; i <= 8; i++) {
        const key = `section_${i}`;
        if (interview[key]) {
          try {
            restored[key] = typeof interview[key] === 'string'
              ? JSON.parse(interview[key] as string) : interview[key] as SectionData;
          } catch { restored[key] = {}; }
        }
      }
      setSections(restored);
      if (interview.photos) {
        const raw = typeof interview.photos === 'string' ? JSON.parse(interview.photos as string) : interview.photos;
        if (Array.isArray(raw)) {
          setPhotos((raw as PhotoRecord[]).map(p => ({ ...p, dataUrl: (p as unknown as {url: string}).url || '' })));
        }
      }
    }
  } catch(e) {
    alert(e instanceof Error ? e.message : 'Failed to load interview');
  }
}
```

**Step 5: Update `handleSubmit` to use reSubmit when in edit mode**

In `handleSubmit`, change:
```ts
await fieldApi.submit(draftId);
```
To:
```ts
if (editingInterviewId) {
  await fieldApi.reSubmit(editingInterviewId, {
    company_name: companyName,
    company_ref_id: companyRefId,
    company_ref_source: companyRefSource,
    ...sections,
    section_9: { emirate: locEmirate, group: locGroup, district: locDistrict },
  });
} else {
  await fieldApi.submit(draftId);
}
if (typeof window !== 'undefined') localStorage.removeItem('field_draft_id');
setEditingInterviewId(null);
setSubmitted(true);
```

**Step 6: Show "editing" badge in the sticky header when in edit mode**

In the sticky top bar (when company is selected), after the company name, add:
```tsx
{editingInterviewId && (
  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
    Editing #{editingInterviewId}
  </span>
)}
```

**Step 7: Test the full flow**

1. Login at `/field/login`
2. Search a company that has a prior submission
3. Click "修改" — form should populate with old data
4. Change a field, click "Submit Survey"
5. Check admin visit-records — edit log should appear

**Step 8: Commit**

```bash
git add src/app/field/survey/page.tsx
git commit -m "feat: survey page supports loading and re-submitting existing interviews"
```

---

## Task 11: Admin Visit-Records — Show Edit Logs

**Files:**
- Modify: `src/app/admin/visit-records/page.tsx`

**Step 1: Add `EditLog` interface**

```ts
interface EditLog {
  id: number;
  editor_id: number;
  editor_name: string;
  edit_summary: string;
  edited_at: string;
}
```

**Step 2: Update `VisitRecordDetail` to include `edit_logs`**

```ts
interface VisitRecordDetail extends VisitRecord {
  // ...existing fields...
  edit_logs?: EditLog[];
}
```

**Step 3: Update `openDetail` to store edit_logs**

The `adminApi.getInterview(id)` now returns `{ interview, edit_logs }`. Update detail state to include it:

Add state: `const [editLogs, setEditLogs] = useState<EditLog[]>([]);`

In `openDetail`:
```ts
const data = await adminApi.getInterview(id);
setDetail(data.interview || data);
setEditLogs(data.edit_logs || []);
```

**Step 4: Add edit log section to the detail view JSX**

After the last survey section card, add:

```tsx
{editLogs.length > 0 && (
  <div className="bg-white rounded-xl border border-stone-200 p-5">
    <h2 className="text-xs font-semibold text-stone-700 uppercase tracking-wide border-l-2 border-[#b8864a] pl-2 mb-4">
      修改历史 ({editLogs.length})
    </h2>
    <div className="space-y-3">
      {editLogs.map((log, i) => (
        <div key={log.id} className="flex gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs text-stone-500 font-medium mt-0.5">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-stone-800">{log.editor_name}</span>
              <span className="text-xs text-stone-400">{formatDate(log.edited_at)}</span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{log.edit_summary}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

**Step 5: Commit**

```bash
git add src/app/admin/visit-records/page.tsx
git commit -m "feat: show edit history timeline in visit-record detail view"
```

---

## Task 12: Admin Company Detail — Layout + Double Column + Survey Verified

**Files:**
- Modify: `src/app/admin/companies/[id]/page.tsx`

**Step 1: Update `CompanyDetail` interface to include survey fields**

Add to the `CompanyDetail` interface:

```ts
office_type: string | null;
one_stop_service: string | null;
has_construction_permit: number | null;
total_employees: string | null;
pm_team_size: string | null;
design_team_size: string | null;
construction_team: string | null;
owner_nationality: string | null;
main_project_types: string | null;
min_project_value: string | null;
max_project_value: string | null;
material_sources: string | null;
latest_interview_id: number | null;
```

**Step 2: Change desktop layout ratio**

Find the desktop layout div (around line 426):
```tsx
<div className="hidden md:flex md:items-start gap-6">
  <div className="w-80 flex-shrink-0 space-y-4">
```
Change to:
```tsx
<div className="hidden md:flex md:items-start gap-6">
  <div className="flex-[2] min-w-0 space-y-4">
```

And the right side:
```tsx
<div className="flex-1 min-w-0">
```
Change to:
```tsx
<div className="flex-[8] min-w-0">
```

**Step 3: Update `DetailsCard` to double-column grid**

Change the `DetailsCard` component:

```tsx
const DetailsCard = () => (
  <div className="bg-white rounded-xl border border-stone-200 p-5 text-sm">
    <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">{t('Details', '详情')}</h2>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {company.city && <InfoRow label={t('City', '城市')} value={company.city} />}
      {company.area && <InfoRow label={t('Area', '区域')} value={company.area} />}
      {company.address && <InfoRow label={t('Address', '地址')} value={company.address} />}
      {company.year_established && <InfoRow label={t('Est.', '成立')} value={String(company.year_established)} />}
      {company.license_number && <InfoRow label={t('License', '执照')} value={company.license_number} />}
      {company.phone && <InfoRow label={t('Phone', '电话')} value={company.phone} />}
      {company.whatsapp && <InfoRow label="WhatsApp" value={company.whatsapp} />}
      {company.email && <InfoRow label={t('Email', '邮箱')} value={company.email} />}
      {company.website && <InfoRow label={t('Website', '网站')} value={company.website} isLink />}
      {company.instagram && <InfoRow label="Instagram" value={company.instagram} isLink />}
      {company.facebook && <InfoRow label="Facebook" value={company.facebook} isLink />}
      {company.linkedin && <InfoRow label="LinkedIn" value={company.linkedin} isLink />}
    </div>
  </div>
);
```

**Step 4: Add `SurveyVerifiedCard` component**

Add after `OwnerCard`:

```tsx
const SurveyVerifiedCard = () => {
  if (!company.latest_interview_id) return null;
  const VERIFIED_FIELDS: { key: keyof CompanyDetail; label: string }[] = [
    { key: 'office_type', label: '办公室类型' },
    { key: 'one_stop_service', label: '一站式服务' },
    { key: 'total_employees', label: '员工总数' },
    { key: 'pm_team_size', label: 'PM 团队' },
    { key: 'design_team_size', label: '设计团队' },
    { key: 'construction_team', label: '施工团队' },
    { key: 'min_project_value', label: '最小合同额' },
    { key: 'max_project_value', label: '最大合同额' },
  ];
  const filled = VERIFIED_FIELDS.filter(f => {
    const v = company[f.key];
    return v !== null && v !== undefined && v !== '';
  });
  if (filled.length === 0) return null;

  function renderValue(key: keyof CompanyDetail) {
    const v = company[key];
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'string') {
      try { const parsed = JSON.parse(v); if (Array.isArray(parsed)) return parsed.join(', '); } catch { /* ignore */ }
    }
    return String(v);
  }

  return (
    <div className="bg-white rounded-xl border border-green-200 p-5 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-4 h-4 text-green-500" />
        <h2 className="text-xs font-semibold text-green-700 uppercase tracking-wide">
          {t('Field Verified', '实地认证')}
        </h2>
        <a
          href={`/admin/visit-records?detail=${company.latest_interview_id}`}
          className="ml-auto text-xs text-[#b8864a] hover:underline"
        >
          #{company.latest_interview_id}
        </a>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {filled.map(f => (
          <div key={f.key} className="flex gap-2">
            <span className="text-stone-400 flex-shrink-0">{f.label}</span>
            <span className="text-stone-700 flex items-center gap-1">
              {renderValue(f.key)}
              <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

Make sure `CheckCircle2` is imported from `lucide-react`.

**Step 5: Add `SurveyVerifiedCard` to both mobile and desktop layouts**

In the mobile layout, after `<OwnerCard />`:
```tsx
<SurveyVerifiedCard />
```

In the desktop layout left sidebar, after `<OwnerCard />`:
```tsx
<SurveyVerifiedCard />
```

**Step 6: Verify in browser**

Open a company in admin that has a submitted interview. The left sidebar should be wider (2:8), details card should be double-column, and if the company has survey data, a green "实地认证" card should appear.

**Step 7: Commit**

```bash
git add src/app/admin/companies/[id]/page.tsx
git commit -m "feat: admin company detail 2:8 layout, double-column details, survey verified card"
```

---

## Final Verification Checklist

- [ ] Company profile branch addresses: add, remove, save, reload ✓
- [ ] `/field/login` blocks access to `/field/survey` without login ✓
- [ ] Field staff login stores `field_token`, redirects to survey ✓
- [ ] `POST /api/field/interviews` returns 401 without token ✓
- [ ] Survey search shows historical interviews under each company ✓
- [ ] Clicking "修改" loads old interview data into form ✓
- [ ] Re-submitting writes an audit log entry ✓
- [ ] Admin visit-records detail shows "修改历史" section ✓
- [ ] Admin company detail: wider left column, double-column details ✓
- [ ] Companies with interview data show green "实地认证" card ✓
