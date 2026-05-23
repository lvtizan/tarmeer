# Company Leads Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Leads" sidebar entry in the company dashboard that shows a list of homeowner inquiry cards with full details and a status toggle (New / Contacted / Converted).

**Architecture:** The backend already has `GET /api/inquiries/mine` (returns `design_inquiries` filtered by the logged-in company's `company_id`). We add one new route `PATCH /api/inquiries/:id/my-status` for company-level status updates (distinct from the admin-only status endpoint). The frontend gets one new page `CompanyLeadsPage.tsx` plus sidebar + route wiring.

**Tech Stack:** TypeScript, React, React Router, Lucide icons, Tailwind CSS, Express, mysql2.

---

## Context You Must Know

- **design_inquiries** table columns relevant here: `id`, `name`, `phone`, `city`, `area_range`, `message`, `status` (enum: new/contacted/resolved/archived), `created_at`, `source_company_name`, `source_company_slug`
- `status = 'resolved'` is what we expose as "Converted" (already in the enum). **Do not add new enum values.**
- The `getMyInquiries` function in `server/src/controllers/inquiryController.ts` already queries `design_inquiries WHERE company_id = (user's company_id)`. We reuse it.
- The existing `PUT /api/inquiries/:id/status` is **admin-only** — we add a separate company route.
- **CompanyLayout sidebar** is at `src/components/company/CompanyLayout.tsx`. Nav items use `<NavLink>` with `navCls` helper.
- **App.tsx company routes** live at line ~283. Pattern: `<Route path="leads" element={<CompanyLeadsPage />} />`
- **Frozen contract**: `PATCH /:id/my-status` must ONLY allow `status` values `new`, `contacted`, `resolved`. Never `archived` (admin-only).
- **No Chinese on public pages** — but company portal is internal (Chinese OK if needed, but this feature is English-only anyway).
- **AdminSelect / TarmeerLogo rules** do not apply here (no dropdowns, no logo on this page).

---

## Task 1: Backend — company status update endpoint

**Files:**
- Modify: `server/src/controllers/inquiryController.ts` (add `updateMyInquiryStatus`)
- Modify: `server/src/routes/inquiries.ts` (register new route)

### Step 1: Add `updateMyInquiryStatus` to inquiryController.ts

Add this function at the bottom of `server/src/controllers/inquiryController.ts`:

```typescript
export async function updateMyInquiryStatus(req: any, res: any) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required.' });

    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['new', 'contacted', 'resolved'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed: new, contacted, resolved.' });
    }

    // Verify the inquiry belongs to this company
    const [companyRows] = await pool.execute(
      'SELECT id FROM company_profiles WHERE user_id = ? LIMIT 1',
      [userId]
    );
    const companyId = (companyRows as any[])[0]?.id;
    if (!companyId) return res.status(403).json({ error: 'No company profile found.' });

    const [rows] = await pool.execute(
      'SELECT id FROM design_inquiries WHERE id = ? AND company_id = ? AND deleted_at IS NULL LIMIT 1',
      [id, companyId]
    );
    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: 'Inquiry not found.' });
    }

    await pool.execute(
      'UPDATE design_inquiries SET status = ? WHERE id = ?',
      [status, id]
    );

    res.json({ ok: true, status });
  } catch (error) {
    console.error('updateMyInquiryStatus error:', error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
}
```

### Step 2: Register route in inquiries.ts

In `server/src/routes/inquiries.ts`:

1. Add `updateMyInquiryStatus` to the import line:
```typescript
import { submitInquiry, getInquiries, updateInquiryStatus, exportInquiries, getMyInquiries, updateMyInquiryStatus } from '../controllers/inquiryController';
```

2. Add the new route **after** `router.get('/mine', ...)`:
```typescript
router.patch('/:id/my-status', authenticate, updateMyInquiryStatus);
```

The order matters — `/mine` must stay before `/:id/my-status`.

### Step 3: Compile and verify no TS errors

```bash
cd /Users/kp/Code/tarmeer-4.0-local/server && npx tsc --noEmit --skipLibCheck
```
Expected: 0 errors.

### Step 4: Write harness test

Create/extend `scripts/harness/test-company-leads.mjs`:

```javascript
// scripts/harness/test-company-leads.mjs
// Tests: GET /api/inquiries/mine + PATCH /api/inquiries/:id/my-status
// Usage: node scripts/harness/test-company-leads.mjs

import http from 'http';

const BASE = 'http://localhost:3099';
let pass = 0; let fail = 0;

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3099, path, method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const r = http.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function check(label, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); fail++; }
}

async function setup() {
  // Insert test company user + company_profiles + design_inquiry
  const pool = (await import('../../server/dist/config/database.js')).default;
  await pool.execute("DELETE FROM design_inquiries WHERE source_company_name = '__harness_lead_test__'");
  await pool.execute("DELETE FROM company_profiles WHERE company_name = '__harness_company_leads__'");
  await pool.execute("DELETE FROM users WHERE email = 'harness-leads@test.tarmeer'");

  await pool.execute(
    "INSERT INTO users (email, password, full_name, role) VALUES ('harness-leads@test.tarmeer', '', 'Harness Leads', 'company')"
  );
  const [[{ id: userId }]] = await pool.execute("SELECT id FROM users WHERE email = 'harness-leads@test.tarmeer'");

  await pool.execute(
    "INSERT INTO company_profiles (user_id, company_name, status) VALUES (?, '__harness_company_leads__', 'approved')",
    [userId]
  );
  const [[{ id: companyId }]] = await pool.execute("SELECT id FROM company_profiles WHERE user_id = ?", [userId]);

  await pool.execute(
    `INSERT INTO design_inquiries (name, phone, city, area_range, message, company_id, source_company_name, status)
     VALUES ('Test Lead', '+971501234567', 'Dubai', '100-150 sqm', 'Test message', ?, '__harness_lead_test__', 'new')`,
    [companyId]
  );
  const [[{ id: inquiryId }]] = await pool.execute("SELECT id FROM design_inquiries WHERE company_id = ? ORDER BY id DESC LIMIT 1", [companyId]);

  return { pool, userId, companyId, inquiryId };
}

async function getToken(userId) {
  const pool = (await import('../../server/dist/config/database.js')).default;
  const jwt = (await import('../../server/dist/lib/jwt.js'));
  const signToken = jwt.signToken ?? jwt.default?.signToken;
  return signToken({ userId, role: 'company' });
}

async function cleanup(pool) {
  await pool.execute("DELETE FROM design_inquiries WHERE source_company_name = '__harness_lead_test__'");
  await pool.execute("DELETE FROM company_profiles WHERE company_name = '__harness_company_leads__'");
  await pool.execute("DELETE FROM users WHERE email = 'harness-leads@test.tarmeer'");
  await pool.end?.();
}

async function main() {
  console.log('\n=== Company Leads Harness ===\n');
  const { pool, userId, companyId, inquiryId } = await setup();
  const token = await getToken(userId);
  const auth = { Authorization: `Bearer ${token}` };

  // 1. No token → 401
  const r1 = await req('GET', '/api/inquiries/mine', null, {});
  check('GET /mine without token → 401', r1.status === 401);

  // 2. With token → 200 + array
  const r2 = await req('GET', '/api/inquiries/mine', null, auth);
  check('GET /mine with token → 200', r2.status === 200);
  check('GET /mine returns inquiries array', Array.isArray(r2.body.inquiries));
  check('GET /mine contains our test inquiry', r2.body.inquiries.some(i => i.id === inquiryId));

  // 3. PATCH my-status: invalid status → 400
  const r3 = await req('PATCH', `/api/inquiries/${inquiryId}/my-status`, { status: 'archived' }, auth);
  check('PATCH my-status archived → 400', r3.status === 400);

  // 4. PATCH my-status: contacted → 200
  const r4 = await req('PATCH', `/api/inquiries/${inquiryId}/my-status`, { status: 'contacted' }, auth);
  check('PATCH my-status contacted → 200', r4.status === 200);
  check('PATCH my-status returns ok:true', r4.body.ok === true);

  // 5. PATCH my-status: wrong inquiry (id=999999) → 404
  const r5 = await req('PATCH', '/api/inquiries/999999/my-status', { status: 'contacted' }, auth);
  check('PATCH my-status wrong id → 404', r5.status === 404);

  // 6. PATCH my-status: no token → 401
  const r6 = await req('PATCH', `/api/inquiries/${inquiryId}/my-status`, { status: 'new' }, {});
  check('PATCH my-status no token → 401', r6.status === 401);

  await cleanup(pool);

  console.log(`\nResults: ${pass} PASS / ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
```

### Step 5: Start local server and run harness

```bash
cd /Users/kp/Code/tarmeer-4.0-local/server && npx tsc --skipLibCheck && cd ..
PORT=3099 DEV_SKIP_EMAIL=true node server/dist/app.js &
sleep 2
node scripts/harness/test-company-leads.mjs
kill %1
```

Expected: `6 PASS / 0 FAIL`

### Step 6: Commit

```bash
git add server/src/controllers/inquiryController.ts server/src/routes/inquiries.ts scripts/harness/test-company-leads.mjs
git commit -m "feat: add PATCH /api/inquiries/:id/my-status for company portal

Test results: 6/6 PASS"
```

---

## Task 2: Frontend — CompanyLeadsPage

**Files:**
- Create: `src/pages/company/CompanyLeadsPage.tsx`

### Step 1: Write the page

```tsx
// src/pages/company/CompanyLeadsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { Inbox, Phone, MapPin, Clock, CheckCircle2, Circle, Star } from 'lucide-react';
import { api } from '../../lib/api';

interface Inquiry {
  id: number;
  name: string | null;
  phone: string;
  city: string | null;
  area_range: string;
  message: string | null;
  status: 'new' | 'contacted' | 'resolved';
  created_at: string;
}

type FilterTab = 'all' | 'new' | 'contacted' | 'resolved';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STATUS_CONFIG = {
  new:       { label: 'New',       color: 'bg-stone-100 text-stone-600',  icon: Circle },
  contacted: { label: 'Contacted', color: 'bg-blue-50 text-blue-700',     icon: CheckCircle2 },
  resolved:  { label: 'Converted', color: 'bg-green-50 text-green-700',   icon: Star },
} as const;

const STATUS_CYCLE: Record<Inquiry['status'], Inquiry['status']> = {
  new: 'contacted',
  contacted: 'resolved',
  resolved: 'new',
};

function LeadCard({ inquiry, onStatusChange }: { inquiry: Inquiry; onStatusChange: (id: number, status: Inquiry['status']) => void }) {
  const [updating, setUpdating] = useState(false);
  const cfg = STATUS_CONFIG[inquiry.status] ?? STATUS_CONFIG.new;
  const Icon = cfg.icon;

  const handleStatusClick = async () => {
    if (updating) return;
    const next = STATUS_CYCLE[inquiry.status];
    setUpdating(true);
    try {
      await api.patch(`/inquiries/${inquiry.id}/my-status`, { status: next });
      onStatusChange(inquiry.id, next);
    } catch {
      // silent — keep current status
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col gap-3">
      {/* Header row: name + status */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[#2c2c2c]">{inquiry.name || 'Anonymous'}</p>
          <a
            href={`tel:${inquiry.phone}`}
            className="flex items-center gap-1 text-[13px] text-[#b8864a] hover:underline mt-0.5"
          >
            <Phone className="w-3.5 h-3.5" />
            {inquiry.phone}
          </a>
        </div>
        <button
          onClick={handleStatusClick}
          disabled={updating}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition shrink-0 ${cfg.color} ${updating ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'}`}
          title="Click to change status"
        >
          <Icon className="w-3.5 h-3.5" />
          {cfg.label}
        </button>
      </div>

      {/* Meta: city + area */}
      {(inquiry.city || inquiry.area_range) && (
        <div className="flex items-center gap-1 text-[13px] text-stone-500">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {[inquiry.city, inquiry.area_range].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Message — full, no truncation */}
      {inquiry.message && (
        <p className="text-[14px] text-stone-700 leading-relaxed bg-stone-50 rounded-xl px-4 py-3">
          {inquiry.message}
        </p>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-1 text-[12px] text-stone-400">
        <Clock className="w-3.5 h-3.5" />
        {timeAgo(inquiry.created_at)}
      </div>
    </div>
  );
}

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'new',       label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'resolved',  label: 'Converted' },
];

export default function CompanyLeadsPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/inquiries/mine?limit=100');
      setInquiries(res.inquiries ?? []);
    } catch {
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = (id: number, status: Inquiry['status']) => {
    setInquiries(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  };

  const filtered = tab === 'all' ? inquiries : inquiries.filter(i => i.status === tab);
  const newCount = inquiries.filter(i => i.status === 'new').length;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#2c2c2c]">Leads</h1>
        <p className="text-sm text-stone-500 mt-1">
          Homeowner inquiries submitted through your company page.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t.key
                ? 'bg-[#b8864a] text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {t.label}
            {t.key === 'new' && newCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[11px] rounded-full px-1.5 py-0.5">
                {newCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-16 text-stone-400 text-sm">Loading leads…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Inbox className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">
            {tab === 'all'
              ? 'No leads yet. Once homeowners submit inquiries on your company page, they will appear here.'
              : `No ${tab} leads.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map(inq => (
            <LeadCard key={inq.id} inquiry={inq} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Step 2: Verify TypeScript compiles

```bash
cd /Users/kp/Code/tarmeer-4.0-local && npx tsc --noEmit --skipLibCheck
```
Expected: 0 errors.

### Step 3: Commit

```bash
git add src/pages/company/CompanyLeadsPage.tsx
git commit -m "feat: add CompanyLeadsPage with lead cards and status toggle"
```

---

## Task 3: Wire route + sidebar + mobile nav

**Files:**
- Modify: `src/App.tsx` (~line 82–85 lazy imports, ~line 286–290 routes)
- Modify: `src/components/company/CompanyLayout.tsx`

### Step 1: Add lazy import in App.tsx

Find the block of company page imports (around line 82–85). Add:
```tsx
const CompanyLeadsPage = lazyRetry(() => import('./pages/company/CompanyLeadsPage'));
```

### Step 2: Add route in App.tsx

Inside the company `<Route path="/company" ...>` block (after `<Route path="articles" ...>`), add:
```tsx
<Route path="leads" element={<CompanyLeadsPage />} />
```

### Step 3: Update CompanyLayout sidebar — desktop

In the `<nav>` section inside `<aside>`, add between Projects and Articles:

```tsx
import { ..., Inbox } from 'lucide-react';
```

Add the NavLink (after the Projects NavLink, before Articles):
```tsx
<NavLink to="/company/leads" className={navCls}>
  <Inbox className="w-5 h-5" />
  <span className="text-sm font-medium">Leads</span>
  {newLeadsCount > 0 && (
    <span className="ml-auto bg-red-500 text-white text-[11px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
      {newLeadsCount}
    </span>
  )}
</NavLink>
```

### Step 4: Add newLeadsCount state to CompanyLayout

In `CompanyLayout`, add state and fetch:

```tsx
const [newLeadsCount, setNewLeadsCount] = useState(0);
```

Inside the existing `useEffect` (after the `api.get('/auth/company/profile')` call), add:
```tsx
api.get('/inquiries/mine?limit=100').then((res: any) => {
  if (!mounted) return;
  const all: any[] = res?.inquiries ?? [];
  setNewLeadsCount(all.filter((i: any) => i.status === 'new').length);
}).catch(() => {});
```

### Step 5: Mobile bottom nav

In the bottom `<nav>` (mobile), add after Projects and before Upload:
```tsx
<NavLink to="/company/leads" className={({ isActive }) => `flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] ${isActive ? 'text-[#b8864a] font-semibold' : 'text-stone-500'}`}>
  <div className="relative">
    <Inbox className="w-5 h-5" />
    {newLeadsCount > 0 && (
      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full" />
    )}
  </div>
  Leads
</NavLink>
```

### Step 6: Verify TypeScript compiles

```bash
npx tsc --noEmit --skipLibCheck
```
Expected: 0 errors.

### Step 7: Verify lint-route-coverage passes

```bash
node scripts/harness/lint-route-coverage.mjs
```
Expected: no new uncovered routes reported.

### Step 8: Commit

```bash
git add src/App.tsx src/components/company/CompanyLayout.tsx
git commit -m "feat: wire Leads route + sidebar entry with new-leads badge"
```

---

## Task 4: Run all tests and verify

### Step 1: Start local server

```bash
cd /Users/kp/Code/tarmeer-4.0-local/server && npx tsc --skipLibCheck && cd ..
PORT=3099 DEV_SKIP_EMAIL=true node server/dist/app.js &
sleep 2
```

### Step 2: Run harness

```bash
node scripts/harness/test-company-leads.mjs
```
Expected: `6 PASS / 0 FAIL`

### Step 3: Run frozen contracts

```bash
node scripts/harness/test-frozen-contracts.mjs
```
Expected: all PASS.

### Step 4: Kill server

```bash
kill %1
```

### Step 5: Final summary commit (if any fixes were needed)

```bash
git add -A
git commit -m "fix: address test failures from leads feature"
```

---

## Local Test Checklist

After `pnpm dev` / `npm run dev`:

1. Log in as a company user at `http://localhost:5180/company/dashboard`
2. Sidebar shows "Leads" between Projects and Articles — ✓
3. If there are leads with `status=new`, a red badge number appears — ✓
4. Click Leads → see `/company/leads` page — ✓
5. Cards show name, phone (as clickable tel link), city + area, full message, time — ✓
6. Click status pill → cycles New → Contacted → Converted → New — ✓
7. Status pill updates immediately (optimistic) — ✓
8. Tab filter works: All / New / Contacted / Converted — ✓
9. Empty state shows when no leads or no leads in filtered tab — ✓
10. Mobile: bottom nav shows Leads icon with red dot if new leads — ✓
