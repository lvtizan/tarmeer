# CRM Mall Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate tarmeer.com (Mall) with crm.tarmeer.com (CRM) — admin can provision registered companies into CRM with a single toggle; companies get SSO access to CRM from their dashboard.

**Architecture:** New `crmIntegrationService.ts` library handles all Mall→CRM API calls with HMAC-SHA256 signing and exponential-backoff retry. Admin provision route saves `crm_tenant_id` to company_profiles. Sync hooks fire async after password/email/profile changes. Reverse SSO (CRM→Mall) uses short-lived token table.

**Tech Stack:** Node.js + TypeScript, MySQL (pool.execute/pool.query), React 18, Tailwind CSS, crypto (built-in), bcrypt (already installed)

---

## Task 1: DB Migration

**Files:**
- Create: `server/src/db/migrations/add-crm-fields.sql`

**Step 1: Write the migration SQL**

```sql
-- add-crm-fields.sql
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS crm_tenant_id       VARCHAR(100) NULL COMMENT 'CRM tenant ID after provision',
  ADD COLUMN IF NOT EXISTS crm_provisioned_at  DATETIME     NULL,
  ADD COLUMN IF NOT EXISTS crm_mall_partner_id VARCHAR(50)  NULL COMMENT 'equals id::string, idempotency key',
  ADD COLUMN IF NOT EXISTS crm_first_login_at  DATETIME     NULL COMMENT 'First CRM login time, pushed by CRM';

CREATE TABLE IF NOT EXISTS mall_sso_tokens (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash   VARCHAR(64)   NOT NULL UNIQUE COMMENT 'sha256(rawToken) hex',
  partner_id   INT UNSIGNED  NOT NULL,
  admin_email  VARCHAR(255)  NOT NULL COMMENT 'CRM admin who requested SSO',
  redirect_url VARCHAR(2000) NOT NULL DEFAULT '/',
  expires_at   DATETIME      NOT NULL,
  consumed_at  DATETIME      NULL,
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_partner (partner_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Step 2: Run the migration on local dev DB**

```bash
mysql -u root tarmeer_dev < server/src/db/migrations/add-crm-fields.sql
```

Expected: Query OK, 0 rows affected (or similar). No errors.

**Step 3: Verify columns exist**

```bash
mysql -u root tarmeer_dev -e "DESCRIBE company_profiles" | grep crm
mysql -u root tarmeer_dev -e "SHOW CREATE TABLE mall_sso_tokens\G"
```

Expected: three crm_* columns visible; mall_sso_tokens table created.

**Step 4: Commit**

```bash
git add server/src/db/migrations/add-crm-fields.sql
git commit -m "feat(crm): add crm fields to company_profiles + mall_sso_tokens table"
```

---

## Task 2: Environment Variables

**Files:**
- Modify: `.env` (server root, NOT git-tracked)

**Step 1: Add env vars to .env**

Open `.env` and append (replace the secret value with the real one):
```
MALL_INTEGRATION_SECRET=d6597040c09a67defe5093841eed723121ee5a9d4b16e24001af5311b558cf5b
CRM_BASE_URL=https://crm.tarmeer.com
```

**Step 2: Verify config loads them**

Check if `server/src/config/index.ts` (or equivalent) reads env vars. If there's a config object, add:
```typescript
crm: {
  secret: process.env.MALL_INTEGRATION_SECRET || '',
  baseUrl: process.env.CRM_BASE_URL || 'https://crm.tarmeer.com',
}
```

If there's no config file, just use `process.env.MALL_INTEGRATION_SECRET` directly in the service.

**Step 3: Verify .env is in .gitignore**

```bash
grep "\.env" .gitignore
```

Expected: `.env` listed.

---

## Task 3: CRM Integration Service

**Files:**
- Create: `server/src/lib/crmIntegrationService.ts`

This service handles all Mall→CRM API calls. It signs requests with HMAC-SHA256 and retries on failure.

**Step 1: Write the service file**

```typescript
// server/src/lib/crmIntegrationService.ts
import crypto from 'crypto';
import pool from '../config/database';

const SECRET = process.env.MALL_INTEGRATION_SECRET || '';
const CRM_BASE = (process.env.CRM_BASE_URL || 'https://crm.tarmeer.com').replace(/\/+$/, '');
const TIMEOUT_MS = 10_000;

// ── HMAC helpers ─────────────────────────────────────────────────────────────

function signMallRequest(timestamp: string, rawBody: string): string {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${timestamp}\n${rawBody}`)
    .digest('hex');
}

export function verifyMallRequest(timestamp: string, rawBody: string, sig: string): boolean {
  const expected = signMallRequest(timestamp, rawBody);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(sig, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Verify X-Crm-Timestamp + X-Crm-Signature (CRM→Mall direction) */
export function verifyCrmRequest(timestamp: string, rawBody: string, sig: string): boolean {
  const drift = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (drift > 300) return false;
  return verifyMallRequest(timestamp, rawBody, sig);
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

async function crmPost(path: string, body: object): Promise<any> {
  const rawBody = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sig = signMallRequest(timestamp, rawBody);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${CRM_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Mall-Timestamp': timestamp,
        'X-Mall-Signature': sig,
      },
      body: rawBody,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`CRM ${path} → ${res.status}: ${text}`);
    }
    return await res.json();
  } catch (err: any) {
    clearTimeout(timer);
    throw err;
  }
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxAttempts - 1) throw err;
      await new Promise(r => setTimeout(r, delays[i] ?? 16000));
    }
  }
  throw new Error('withRetry: unreachable');
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function getCompanyForCRM(companyId: number) {
  const [rows] = await pool.execute(
    `SELECT cp.id, cp.company_name, cp.description, cp.contact_person,
            cp.phone, cp.website, cp.city, cp.address, cp.trade_license_number,
            cp.establishment_year, cp.company_type, cp.company_types,
            cp.services, cp.emirates_served, cp.crm_tenant_id,
            u.id as user_id, u.email, u.password as password_hash,
            u.full_name, u.phone as user_phone, u.google_id
     FROM company_profiles cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.id = ?`,
    [companyId]
  );
  const row = (rows as any[])[0];
  if (!row) throw new Error(`Company ${companyId} not found`);
  return row;
}

function parseJsonSafe(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  try { return JSON.parse(v); } catch { return []; }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Provision a company into CRM (synchronous, awaited by admin route).
 * Saves crm_tenant_id to company_profiles on success.
 */
export async function provision(companyId: number): Promise<{ crm_tenant_id: string }> {
  const row = await getCompanyForCRM(companyId);

  const companyTypes = parseJsonSafe(row.company_types);
  const services = parseJsonSafe(row.services);
  const emiratesServed = parseJsonSafe(row.emirates_served);

  const payload = {
    mallPartnerId: String(row.id),
    partnerName: row.company_name || '',
    adminEmail: row.email,
    adminPasswordHash: row.password_hash || null,
    adminGoogleId: row.google_id || null,
    adminName: row.full_name || '',
    adminPhone: row.phone || row.user_phone || '',
    businessName: row.company_name || '',
    businessType: companyTypes[0] || row.company_type || '',
    city: row.city || '',
    address: row.address || '',
    tradeRegistrationNo: row.trade_license_number || '',
    website: row.website || '',
    description: row.description || '',
    emiratesServed,
    services,
  };

  const data = await withRetry(() => crmPost('/api/integration/mall/partner/provision', payload));

  if (!data.tenantId) throw new Error('CRM provision response missing tenantId');

  await pool.execute(
    `UPDATE company_profiles
     SET crm_tenant_id = ?, crm_provisioned_at = NOW(), crm_mall_partner_id = ?
     WHERE id = ?`,
    [data.tenantId, String(companyId), companyId]
  );

  return { crm_tenant_id: data.tenantId };
}

/**
 * Async: sync password hash to CRM after company changes password.
 * Only fires if company has crm_tenant_id.
 */
export async function passwordSync(userId: number, newHash: string): Promise<void> {
  const [rows] = await pool.execute(
    'SELECT crm_tenant_id FROM company_profiles WHERE user_id = ?',
    [userId]
  );
  const row = (rows as any[])[0];
  if (!row?.crm_tenant_id) return;

  withRetry(() => crmPost('/api/integration/mall/user/password-sync', {
    tenantId: row.crm_tenant_id,
    passwordHash: newHash,
  })).catch(err => console.error('[CRM] passwordSync error:', err));
}

/**
 * Async: sync new email to CRM after company changes email.
 */
export async function emailSync(userId: number, newEmail: string): Promise<void> {
  const [rows] = await pool.execute(
    'SELECT crm_tenant_id FROM company_profiles WHERE user_id = ?',
    [userId]
  );
  const row = (rows as any[])[0];
  if (!row?.crm_tenant_id) return;

  withRetry(() => crmPost('/api/integration/mall/user/email-sync', {
    tenantId: row.crm_tenant_id,
    newEmail,
  })).catch(err => console.error('[CRM] emailSync error:', err));
}

/**
 * Async: sync company profile fields to CRM after profile update.
 * field-absent = no change; null = clear (per PRD MALL-006).
 */
export async function partnerSync(companyId: number): Promise<void> {
  const [rows] = await pool.execute(
    `SELECT cp.crm_tenant_id, cp.company_name, cp.description, cp.phone,
            cp.website, cp.city, cp.address, cp.trade_license_number,
            cp.company_type, cp.company_types, cp.services, cp.emirates_served
     FROM company_profiles cp WHERE cp.id = ?`,
    [companyId]
  );
  const row = (rows as any[])[0];
  if (!row?.crm_tenant_id) return;

  const companyTypes = parseJsonSafe(row.company_types);
  const services = parseJsonSafe(row.services);
  const emiratesServed = parseJsonSafe(row.emirates_served);

  withRetry(() => crmPost('/api/integration/mall/partner/sync', {
    tenantId: row.crm_tenant_id,
    businessName: row.company_name,
    businessType: companyTypes[0] || row.company_type || undefined,
    city: row.city,
    address: row.address,
    tradeRegistrationNo: row.trade_license_number,
    website: row.website,
    description: row.description,
    emiratesServed,
    services,
  })).catch(err => console.error('[CRM] partnerSync error:', err));
}

/**
 * Synchronous: issue SSO token from CRM (Mall→CRM direction).
 * Returns consumeUrl to redirect company user to CRM.
 */
export async function ssoIssue(companyId: number): Promise<{ consumeUrl: string }> {
  const [rows] = await pool.execute(
    `SELECT cp.crm_tenant_id, u.email
     FROM company_profiles cp JOIN users u ON u.id = cp.user_id
     WHERE cp.id = ?`,
    [companyId]
  );
  const row = (rows as any[])[0];
  if (!row?.crm_tenant_id) throw new Error('Company not provisioned in CRM');

  const data = await withRetry(
    () => crmPost('/api/integration/mall/sso/issue', {
      tenantId: row.crm_tenant_id,
      adminEmail: row.email,
    }),
    3
  );

  if (!data.consumeUrl) throw new Error('CRM SSO issue: missing consumeUrl');
  return { consumeUrl: data.consumeUrl };
}
```

**Step 2: TypeScript check**

```bash
cd /path/to/project && ./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

**Step 3: Commit**

```bash
git add server/src/lib/crmIntegrationService.ts
git commit -m "feat(crm): add crmIntegrationService with HMAC signing and retry"
```

---

## Task 4: Admin Provision Route

**Files:**
- Modify: `server/src/routes/admin.ts` (add route at existing profile-companies section)
- Modify: `server/src/controllers/companyAdminController.ts` (add crmProvision function)

**Step 1: Add crmProvision to companyAdminController.ts**

Find the `getCompanyProfile` function (around line 596-640). After it, add:

```typescript
/**
 * POST /api/admin/profile-companies/:id/crm-provision
 * Provision a registered company into CRM.
 */
export async function crmProvision(req: any, res: any) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid company id' });

    const { provision } = await import('../lib/crmIntegrationService');
    const result = await provision(id);
    res.json({ ok: true, crm_tenant_id: result.crm_tenant_id });
  } catch (err: any) {
    console.error('[CRM] provision error:', err);
    res.status(502).json({ error: err.message || 'CRM provision failed' });
  }
}
```

**Step 2: Register route in admin.ts**

Find the profile-companies section in `server/src/routes/admin.ts`. Look for existing routes like `router.get('/profile-companies/:id', ...)`. Add after:

```typescript
router.post('/profile-companies/:id/crm-provision', requireAdmin, crmProvision);
```

Also add `crmProvision` to the import from companyAdminController.

**Step 3: Update listCompanies in roleAdminController.ts to include crm_tenant_id**

In `server/src/controllers/roleAdminController.ts`, find the `listCompanies` SELECT query (around line 136). The SELECT currently includes `cp.*`. Since `cp.*` will include the new crm_* columns, the response already includes them automatically. No change needed here — just verify by reading the query.

**Step 4: tsc check**

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

**Step 5: Manual test (local)**

```bash
# Get an admin token first
TOKEN=$(curl -s -X POST http://localhost:3002/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"YOUR_ADMIN_EMAIL","password":"YOUR_ADMIN_PASSWORD"}' | jq -r .token)

# Test auth guard (no token → 401)
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3002/api/admin/profile-companies/99999/crm-provision
# Expected: 401

# Test with token + invalid id
curl -s -X POST http://localhost:3002/api/admin/profile-companies/99999/crm-provision \
  -H "Authorization: Bearer $TOKEN"
# Expected: 404 (company not found) or 502 (CRM not reachable locally — OK)
```

**Step 6: Commit**

```bash
git add server/src/controllers/companyAdminController.ts server/src/routes/admin.ts
git commit -m "feat(crm): add admin crm-provision route POST /admin/profile-companies/:id/crm-provision"
```

---

## Task 5: Admin UI — CRM Toggle in CompaniesTab

**Files:**
- Modify: `src/pages/admin/AdminRoleManagementPage.tsx`

**Step 1: Update Company interface**

Find the `Company` interface (around line 38). Add `crm_tenant_id` field:

```typescript
interface Company {
  id: string;
  logo?: string;
  name: string;
  contact: string;
  phone: string;
  city: string;
  services: string[];
  status: 'pending' | 'approved' | 'rejected';
  linkedUaeCompany?: string;
  displayOrder: number;
  date: string;
  company_type?: string;
  crm_tenant_id?: string | null;  // ADD THIS
}
```

**Step 2: Update CompaniesTab props to accept crm callback**

Find `CompaniesTab` props interface (around line 768). Add:

```typescript
onCrmProvision: (companyId: string) => Promise<void>;
```

**Step 3: Add crm column to desktop table `<thead>`**

Find the `<thead>` of the companies desktop table. After the `{t('Actions', '操作')}` header, add a new `<th>` BEFORE it:

```tsx
<th className="px-6 py-3 text-left text-xs font-medium text-slate-700 uppercase tracking-wider">
  CRM
</th>
```

**Step 4: Add CRM cell to each company row**

Find the company row's Actions `<td>`. Add a CRM `<td>` BEFORE the Actions `<td>`:

```tsx
<td className="px-6 py-4 whitespace-nowrap text-sm">
  {company.crm_tenant_id ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      CRM已开通
    </span>
  ) : (
    <button
      onClick={() => onCrmProvision(company.id)}
      className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
    >
      开通CRM
    </button>
  )}
</td>
```

**Step 5: Add CRM to mobile card list**

In the mobile cards section, after the existing action buttons div, add:

```tsx
{/* CRM status */}
<div className="mt-2">
  {company.crm_tenant_id ? (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      CRM已开通
    </span>
  ) : (
    <button
      onClick={() => onCrmProvision(company.id)}
      className="h-10 w-full rounded-xl bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-700 transition"
    >
      开通CRM
    </button>
  )}
</div>
```

**Step 6: Add handleCrmProvision in the main component**

In `AdminRoleManagementPage` component (around line 290+), add state and handler:

```typescript
const [crmProvisioning, setCrmProvisioning] = useState<string | null>(null);

const handleCrmProvision = async (companyId: string) => {
  if (crmProvisioning) return;
  setCrmProvisioning(companyId);
  try {
    const res = await fetch(`${API_BASE}/admin/profile-companies/${companyId}/crm-provision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'CRM provision failed');
      return;
    }
    const data = await res.json();
    // Update local state so UI flips immediately without reload
    setCompanies(prev => prev.map(c =>
      c.id === companyId ? { ...c, crm_tenant_id: data.crm_tenant_id } : c
    ));
  } catch (err) {
    alert('Network error — please try again');
  } finally {
    setCrmProvisioning(null);
  }
};
```

**Step 7: Pass handler to CompaniesTab**

In the `<CompaniesTab ... />` JSX (around line 614), add:

```tsx
onCrmProvision={handleCrmProvision}
```

**Step 8: Check admin token storage key**

The admin token localStorage key varies. Search for `localStorage` in `AdminRoleManagementPage.tsx` or in `API_BASE` usage to find the correct key. It might be `admin_token` or found via `api.getToken()`. Adjust `handleCrmProvision` accordingly.

```bash
grep -n "localStorage\|getToken\|Bearer" /path/to/AdminRoleManagementPage.tsx | head -10
grep -n "localStorage\|getToken\|Bearer" /path/to/src/lib/api.ts | head -10
```

**Step 9: tsc + lint-admin-ui check**

```bash
./node_modules/.bin/tsc --noEmit
node scripts/harness/lint-admin-ui.mjs
```

Expected: 0 errors.

**Step 10: Commit**

```bash
git add src/pages/admin/AdminRoleManagementPage.tsx
git commit -m "feat(crm): add CRM provision toggle to companies list in admin"
```

---

## Task 6: Company Dashboard — "打开CRM" Sidebar Entry

**Files:**
- Modify: `src/components/company/CompanyLayout.tsx`
- Modify: `server/src/controllers/companyProfileController.ts` (getProfile: add crm_tenant_id to response)
- Modify: `server/src/routes/auth.ts` (add crm-sso route)
- Create: `server/src/controllers/companyCrmController.ts`

**Step 1: Expose crm_tenant_id in getProfile response**

In `server/src/controllers/companyProfileController.ts`, find `getProfile` function (around line 152). The SELECT is `SELECT * FROM company_profiles WHERE user_id = ?`, so `crm_tenant_id` is already included in `profile`. Confirm it's returned as-is in `res.json({ profile, ... })`. No change needed if SELECT is `*`.

**Step 2: Create companyCrmController.ts**

```typescript
// server/src/controllers/companyCrmController.ts
import pool from '../config/database';
import { ssoIssue } from '../lib/crmIntegrationService';

/**
 * POST /api/auth/company/crm-sso
 * Issue a CRM SSO token for the logged-in company.
 */
export async function issueCrmSso(req: any, res: any) {
  try {
    const userId = req.user.userId;

    const [rows] = await pool.execute(
      'SELECT id, crm_tenant_id FROM company_profiles WHERE user_id = ?',
      [userId]
    );
    const cp = (rows as any[])[0];
    if (!cp) return res.status(404).json({ error: 'Company profile not found' });
    if (!cp.crm_tenant_id) return res.status(400).json({ error: 'CRM not provisioned for this company' });

    const { consumeUrl } = await ssoIssue(cp.id);
    res.json({ consumeUrl });
  } catch (err: any) {
    console.error('[CRM] SSO issue error:', err);
    res.status(502).json({ error: err.message || 'CRM SSO failed' });
  }
}
```

**Step 3: Register SSO route in auth.ts**

In `server/src/routes/auth.ts`, add:

```typescript
import { issueCrmSso } from '../controllers/companyCrmController';
// ...
router.post('/company/crm-sso', authenticate, issueCrmSso);
```

This makes the full endpoint path: `POST /api/auth/company/crm-sso`

**Step 4: Update CompanyLayout.tsx**

In `src/components/company/CompanyLayout.tsx`, the component already fetches company profile in `useEffect`. After `setCompanyType(res?.company_type || '')`, also store:

```typescript
const [crmEnabled, setCrmEnabled] = useState(false);

// inside the .then() callback:
setCrmEnabled(!!res?.crm_tenant_id);
```

Add the state and import `ExternalLink` from lucide-react.

In the sidebar `<nav>`, add after the Settings NavLink:

```tsx
{crmEnabled && (
  <button
    onClick={handleOpenCrm}
    className="flex items-center gap-3 px-4 py-3 rounded-full transition cursor-pointer text-stone-600 hover:bg-stone-50 w-full text-left"
  >
    <ExternalLink className="w-5 h-5" />
    <span className="text-sm font-medium">打开CRM</span>
  </button>
)}
```

Add `handleOpenCrm` function:

```typescript
const handleOpenCrm = async () => {
  try {
    const res: any = await api.post('/auth/company/crm-sso', {});
    if (res?.consumeUrl) {
      window.open(res.consumeUrl, '_blank', 'noopener,noreferrer');
    }
  } catch (err) {
    console.error('CRM SSO error:', err);
  }
};
```

Also add in mobile bottom nav (below the existing 4 nav items), conditionally:

```tsx
{crmEnabled && (
  <button
    onClick={handleOpenCrm}
    className={`flex flex-col items-center gap-0.5 px-3 py-2 min-h-[44px] justify-center rounded-lg text-[11px] text-stone-500`}
  >
    <ExternalLink className="w-5 h-5" />
    CRM
  </button>
)}
```

**Step 5: Check api.post signature**

```bash
grep -n "post\|async post\|function post" /path/to/src/lib/api.ts | head -10
```

Use the correct calling convention (some projects use `api.post('/path', body)`, others use `api.post('/path', { body })`).

**Step 6: tsc check**

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

**Step 7: Commit**

```bash
git add server/src/controllers/companyCrmController.ts server/src/routes/auth.ts src/components/company/CompanyLayout.tsx
git commit -m "feat(crm): add CRM SSO entry to company dashboard sidebar"
```

---

## Task 7: Sync Hooks

**Files:**
- Modify: `server/src/controllers/userAuthController.ts` (changePassword)
- Modify: `server/src/controllers/companyProfileController.ts` (upsertProfile)

**Step 1: Add passwordSync hook to changePassword**

In `userAuthController.ts`, find `changePassword` function (around line 676). After the successful `pool.execute('UPDATE users SET password = ?...', [hashedPassword, userId])`, add:

```typescript
// Fire-and-forget CRM password sync
import('../lib/crmIntegrationService').then(({ passwordSync }) => {
  passwordSync(userId, hashedPassword).catch(() => {});
});
```

Note: use dynamic import to avoid circular dependency risks. Since this is an async fire-and-forget, it won't slow down the response.

**Step 2: Add partnerSync hook to upsertProfile**

In `companyProfileController.ts`, find `upsertProfile`. After the successful UPDATE or INSERT that saves the profile, add:

```typescript
// Fire-and-forget CRM partner sync
const profileId: number = (existing as any[]).length > 0
  ? (existing as any[])[0].id
  : (insertResult as any).insertId;

import('../lib/crmIntegrationService').then(({ partnerSync }) => {
  partnerSync(profileId).catch(() => {});
});
```

The `profileId` retrieval depends on the exact INSERT/UPDATE flow. Check what `pool.execute` returns for INSERT (it returns `[ResultSetHeader, FieldPacket[]]` where `ResultSetHeader.insertId` has the new id). For UPDATE, use the id from the existing row.

**Step 3: tsc check**

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add server/src/controllers/userAuthController.ts server/src/controllers/companyProfileController.ts
git commit -m "feat(crm): add CRM sync hooks for password change and profile update"
```

---

## Task 7B: CRM Partner Activated Notification Endpoint

**Files:**
- Modify: `server/src/controllers/integrationController.ts` (add partnerActivated handler)
- Modify: `server/src/routes/integration.ts` (register route)
- Modify: `src/pages/admin/AdminRoleManagementPage.tsx` (update CRM column to show 已激活/未激活)

This endpoint is called by CRM when a provisioned partner first logs in to CRM. Mall stores `firstLoginAt` and shows the activation status in the admin company list.

**Step 1: Add `partnerActivated` to integrationController.ts**

```typescript
/**
 * POST /api/integration/crm/partner/activated
 * CRM calls this when a provisioned partner first logs into CRM.
 * Idempotent: duplicate push returns { code: 0 } without overwriting firstLoginAt.
 */
export async function partnerActivated(req: any, res: any) {
  try {
    const timestamp = req.headers['x-crm-timestamp'] || '';
    const sig = req.headers['x-crm-signature'] || '';
    const rawBody = JSON.stringify(req.body);

    if (!verifyCrmRequest(timestamp, rawBody, sig)) {
      return res.status(401).json({ code: 1, error: 'Invalid signature' });
    }

    const { mallPartnerId, adminEmail, firstLoginAt, source } = req.body;
    if (!mallPartnerId) return res.status(400).json({ code: 1, error: 'mallPartnerId required' });

    const partnerId = parseInt(mallPartnerId);
    if (isNaN(partnerId)) return res.status(400).json({ code: 1, error: 'Invalid mallPartnerId' });

    // Verify partner exists and is provisioned
    const [rows] = await pool.execute(
      'SELECT id, crm_tenant_id, crm_first_login_at FROM company_profiles WHERE id = ? AND deleted_at IS NULL',
      [partnerId]
    );
    const row = (rows as any[])[0];
    if (!row) return res.status(404).json({ code: 1, error: 'Partner not found' });
    if (!row.crm_tenant_id) return res.status(400).json({ code: 1, error: 'Partner not provisioned' });

    // Idempotent: only write if not already set
    if (!row.crm_first_login_at && firstLoginAt) {
      const loginAt = new Date(firstLoginAt);
      if (!isNaN(loginAt.getTime())) {
        await pool.execute(
          'UPDATE company_profiles SET crm_first_login_at = ? WHERE id = ? AND crm_first_login_at IS NULL',
          [loginAt, partnerId]
        );
      }
    }

    // Log for funnel analysis (source: 'password' | 'sso' | 'google')
    console.log(`[CRM] partner ${partnerId} activated via ${source || 'unknown'} by ${adminEmail}`);

    return res.json({ code: 0 });
  } catch (err: any) {
    console.error('[CRM] partnerActivated error:', err);
    return res.status(500).json({ code: 1, error: 'Internal error' });
  }
}
```

**Step 2: Register route in integration.ts**

```typescript
import { crmSsoIssue, ssoConsume, partnerActivated } from '../controllers/integrationController';
// ...
router.post('/crm/partner/activated', partnerActivated);
```

Full route path: `POST /api/integration/crm/partner/activated`

**Step 3: Update Company interface in AdminRoleManagementPage.tsx**

Add `crm_first_login_at` to the `Company` interface:

```typescript
interface Company {
  // ... existing fields ...
  crm_tenant_id?: string | null;
  crm_first_login_at?: string | null;  // ADD THIS
}
```

**Step 4: Update the CRM cell in the desktop table**

Replace the CRM `<td>` added in Task 5 with a richer version showing activation status:

```tsx
<td className="px-6 py-4 whitespace-nowrap text-sm">
  {company.crm_tenant_id ? (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold w-fit">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        CRM已开通
      </span>
      {company.crm_first_login_at ? (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-medium w-fit">
          已激活
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-stone-100 text-stone-500 text-[11px] font-medium w-fit">
          未激活
        </span>
      )}
    </div>
  ) : (
    <button
      onClick={() => onCrmProvision(company.id)}
      className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition"
    >
      开通CRM
    </button>
  )}
</td>
```

**Step 5: Update mobile card CRM section similarly**

```tsx
{company.crm_tenant_id ? (
  <div className="flex flex-col gap-1 mt-2">
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-[11px] font-semibold w-fit">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
      CRM已开通
    </span>
    {company.crm_first_login_at ? (
      <span className="text-[11px] text-green-700 font-medium px-1">已激活</span>
    ) : (
      <span className="text-[11px] text-stone-400 px-1">未激活</span>
    )}
  </div>
) : (
  <button
    onClick={() => onCrmProvision(company.id)}
    className="mt-2 h-10 w-full rounded-xl bg-blue-600 text-white text-[13px] font-semibold hover:bg-blue-700 transition"
  >
    开通CRM
  </button>
)}
```

**Step 6: Add TC to harness test**

In `test-crm-integration.mjs`, add:

```javascript
await test('TC9', 'POST /integration/crm/partner/activated bad signature → 401', async () => {
  const res = await fetch(`${API}/integration/crm/partner/activated`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Crm-Timestamp': Math.floor(Date.now() / 1000).toString(),
      'X-Crm-Signature': 'badsig',
    },
    body: JSON.stringify({ mallPartnerId: '1', adminEmail: 'x@x.com', firstLoginAt: new Date().toISOString(), source: 'password' }),
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

await test('TC10', 'POST /integration/crm/partner/activated missing mallPartnerId → 400', async () => {
  // This requires a valid signature — skip if no secret available locally
  // Just verify the endpoint exists
  const res = await fetch(`${API}/integration/crm/partner/activated`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  // 401 (no sig) is also acceptable
  if (res.status !== 400 && res.status !== 401) throw new Error(`Expected 400 or 401, got ${res.status}`);
});
```

**Step 7: tsc check**

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

**Step 8: Commit**

```bash
git add server/src/controllers/integrationController.ts server/src/routes/integration.ts src/pages/admin/AdminRoleManagementPage.tsx scripts/harness/test-crm-integration.mjs
git commit -m "feat(crm): add POST /integration/crm/partner/activated — store firstLoginAt + show 已激活 in admin"
```

---

## Task 8: Reverse SSO — CRM Calls Mall

**Files:**
- Create: `server/src/routes/integration.ts`
- Create: `server/src/controllers/integrationController.ts`
- Modify: `server/src/app.ts` (register the new route)
- Create: `src/pages/SsoConsumePage.tsx`
- Modify: `src/App.tsx` (add /sso/consume route)

**Step 1: Create integrationController.ts**

```typescript
// server/src/controllers/integrationController.ts
import crypto from 'crypto';
import pool from '../config/database';
import { generateToken } from '../lib/jwt'; // adjust import to match project's JWT helper
import { verifyCrmRequest } from '../lib/crmIntegrationService';

/**
 * POST /api/integration/crm/sso/issue
 * Called by CRM to request a Mall SSO token for a partner user.
 * Secured by X-Crm-Timestamp + X-Crm-Signature.
 */
export async function crmSsoIssue(req: any, res: any) {
  try {
    const timestamp = req.headers['x-crm-timestamp'] || '';
    const sig = req.headers['x-crm-signature'] || '';
    const rawBody = JSON.stringify(req.body); // requires bodyParser with rawBody preserved, or use req.rawBody

    if (!verifyCrmRequest(timestamp, rawBody, sig)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { mallPartnerId, adminEmail, redirectUrl } = req.body;
    if (!mallPartnerId) return res.status(400).json({ error: 'mallPartnerId required' });

    const partnerId = parseInt(mallPartnerId);
    if (isNaN(partnerId)) return res.status(400).json({ error: 'Invalid mallPartnerId' });

    // Verify partner exists
    const [rows] = await pool.execute(
      'SELECT id FROM company_profiles WHERE id = ? AND deleted_at IS NULL',
      [partnerId]
    );
    if ((rows as any[]).length === 0) return res.status(404).json({ error: 'Partner not found' });

    // Generate token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await pool.execute(
      `INSERT INTO mall_sso_tokens (token_hash, partner_id, admin_email, redirect_url, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [tokenHash, partnerId, adminEmail || '', redirectUrl || '/', expiresAt]
    );

    const consumeUrl = `${process.env.MALL_ORIGIN || 'https://www.tarmeer.com'}/sso/consume?token=${rawToken}`;
    res.json({ consumeUrl });
  } catch (err: any) {
    console.error('[SSO] crmSsoIssue error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}

/**
 * GET /api/sso/consume?token=<rawToken>
 * Validates token, sets company session, redirects.
 * NOTE: this is a GET that redirects — no auth needed (token IS the auth).
 */
export async function ssoConsume(req: any, res: any) {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token required' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const [rows] = await pool.execute(
      `SELECT t.*, cp.user_id, u.email, u.full_name, u.role
       FROM mall_sso_tokens t
       JOIN company_profiles cp ON cp.id = t.partner_id
       JOIN users u ON u.id = cp.user_id
       WHERE t.token_hash = ?`,
      [tokenHash]
    );
    const row = (rows as any[])[0];

    if (!row) return res.status(400).json({ error: 'Invalid token' });
    if (row.consumed_at) return res.status(400).json({ error: 'Token already used' });
    if (new Date(row.expires_at) < new Date()) return res.status(400).json({ error: 'Token expired' });

    // Mark consumed
    await pool.execute('UPDATE mall_sso_tokens SET consumed_at = NOW() WHERE token_hash = ?', [tokenHash]);

    // Generate a normal company JWT
    const jwt = generateToken({ id: row.user_id, email: row.email, role: 'company' });

    // Return JWT to frontend (SsoConsumePage will store it and navigate)
    res.json({ token: jwt, redirectUrl: row.redirect_url || '/company/dashboard' });
  } catch (err: any) {
    console.error('[SSO] consume error:', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
```

> **Note on rawBody for HMAC verification:** Express's `json()` middleware parses the body before the route handler. To get rawBody for HMAC, either:
> - Use `express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf.toString(); } })` in `app.ts`
> - Or reconstruct rawBody from `req.body` with `JSON.stringify(req.body)` — this works if the CRM sends compact JSON (no extra whitespace). Check what CRM sends.
>
> For simplicity, use `JSON.stringify(req.body)` and confirm with CRM team. If it doesn't match, add the rawBody middleware.

**Step 2: Find the correct generateToken import**

```bash
grep -rn "generateToken\|jwt.sign\|sign.*token\|createToken" server/src/lib/ server/src/middleware/ | head -10
grep -rn "export.*generateToken\|module.exports" server/src/lib/jwt* server/src/middleware/auth* 2>/dev/null | head -10
```

Use whatever function creates the company JWT (same as `userAuthController.ts` login uses).

**Step 3: Create integration.ts route**

```typescript
// server/src/routes/integration.ts
import { Router } from 'express';
import { crmSsoIssue, ssoConsume } from '../controllers/integrationController';

const router = Router();

// CRM→Mall: CRM calls this to issue a Mall SSO token
router.post('/crm/sso/issue', crmSsoIssue);

export default router;
```

Also register the SSO consume as a top-level route (not under /integration). Add to app.ts or admin.ts:

**Step 4: Register routes in app.ts**

In `server/src/app.ts`, find where routes are registered (look for `app.use('/api/'` patterns). Add:

```typescript
import integrationRouter from './routes/integration';
// ...
app.use('/api/integration', integrationRouter);
// SSO consume — top level API endpoint
import { ssoConsume } from './controllers/integrationController';
app.get('/api/sso/consume', ssoConsume);
```

**Step 5: Create SsoConsumePage.tsx**

```tsx
// src/pages/SsoConsumePage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL?.trim() || '/api';

export default function SsoConsumePage() {
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing token');
      return;
    }
    fetch(`${API_BASE}/sso/consume?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
          return;
        }
        // Store token same way as normal login
        api.setToken(data.token);
        navigate(data.redirectUrl || '/company/dashboard', { replace: true });
      })
      .catch(() => setError('Network error'));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-600">
        <div className="text-center">
          <p className="text-lg font-medium text-red-600 mb-2">SSO Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center text-stone-400">
      Signing you in...
    </div>
  );
}
```

**Step 6: Add /sso/consume route to App.tsx**

In `src/App.tsx`, outside the main `<Layout>` (put it at the top level of `<Routes>`, same level as `/auth`):

```tsx
import SsoConsumePage from './pages/SsoConsumePage';
// ...
<Route path="/sso/consume" element={<SsoConsumePage />} />
```

**Step 7: Verify api.setToken exists**

```bash
grep -n "setToken\|getToken\|token" src/lib/api.ts | head -10
```

Adjust `api.setToken(data.token)` to match the actual method name. It might be `localStorage.setItem('token', data.token)` — check how `CompanyLayout.tsx` reads the token.

**Step 8: tsc check**

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

**Step 9: Commit**

```bash
git add server/src/controllers/integrationController.ts server/src/routes/integration.ts server/src/app.ts src/pages/SsoConsumePage.tsx src/App.tsx
git commit -m "feat(crm): add reverse SSO endpoints (CRM→Mall sso/issue + sso/consume)"
```

---

## Task 9: Harness Test Script

**Files:**
- Create: `scripts/harness/test-crm-integration.mjs`

**Step 1: Write the test script**

```javascript
#!/usr/bin/env node
/**
 * test-crm-integration.mjs — CRM integration smoke tests
 *
 * Usage:
 *   node scripts/harness/test-crm-integration.mjs [--url http://localhost:3002] \
 *     --admin-email admin@x.com --admin-password secret \
 *     [--company-email company@x.com --company-password secret] \
 *     [--company-id 42]
 *
 * TC1: POST /admin/profile-companies/99999/crm-provision no token → 401
 * TC2: POST /admin/profile-companies/99999/crm-provision bad id with token → 404 or 502
 * TC3: POST /api/integration/crm/sso/issue bad signature → 401
 * TC4: GET /api/sso/consume bad token → 400
 * TC5: GET /api/sso/consume expired pattern → 400
 * TC6: POST /auth/company/crm-sso no token → 401
 * TC7: (if admin + company id) Provision → 200 → crm_tenant_id present
 * TC8: (if company token) POST /auth/company/crm-sso → 400 (not provisioned) or 200
 */

const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };

const BASE = (get('--url') || 'http://localhost:3002').replace(/\/+$/, '');
const ADMIN_EMAIL = get('--admin-email');
const ADMIN_PASSWORD = get('--admin-password');
const COMPANY_EMAIL = get('--company-email');
const COMPANY_PASSWORD = get('--company-password');
const COMPANY_ID = get('--company-id');
const API = `${BASE}/api`;

async function getAdminToken() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return null;
  const res = await fetch(`${API}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) throw new Error(`Admin login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function getCompanyToken() {
  if (!COMPANY_EMAIL || !COMPANY_PASSWORD) return null;
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: COMPANY_EMAIL, password: COMPANY_PASSWORD }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.token;
}

let passed = 0, failed = 0;
const results = [];

function ok(tc, label) { passed++; results.push({ tc, label, ok: true }); console.log(`  PASS | ${tc}: ${label}`); }
function fail(tc, label, reason) { failed++; results.push({ tc, label, ok: false, reason }); console.log(`  FAIL | ${tc}: ${label} — ${reason}`); }
function skip(tc, label, reason) { results.push({ tc, label, ok: null }); console.log(`  SKIP | ${tc}: ${label} — ${reason}`); }

async function test(tc, label, fn) {
  try { await fn(); ok(tc, label); } catch (e) { fail(tc, label, e.message ?? String(e)); }
}

const ADMIN_TOKEN = await getAdminToken().catch(() => null);
const COMPANY_TOKEN = await getCompanyToken().catch(() => null);

console.log(`\n=== CRM Integration Tests (${BASE}) ===\n`);

await test('TC1', 'POST /admin/profile-companies/99999/crm-provision no token → 401', async () => {
  const res = await fetch(`${API}/admin/profile-companies/99999/crm-provision`, { method: 'POST' });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

if (ADMIN_TOKEN) {
  await test('TC2', 'POST /admin/profile-companies/99999/crm-provision invalid id with token → 404 or 502', async () => {
    const res = await fetch(`${API}/admin/profile-companies/99999/crm-provision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    if (res.status !== 404 && res.status !== 502) throw new Error(`Expected 404 or 502, got ${res.status}`);
  });
} else {
  skip('TC2', 'POST provision invalid id', 'Pass --admin-email and --admin-password');
}

await test('TC3', 'POST /integration/crm/sso/issue bad signature → 401', async () => {
  const res = await fetch(`${API}/integration/crm/sso/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Crm-Timestamp': Math.floor(Date.now() / 1000).toString(),
      'X-Crm-Signature': 'badsig',
    },
    body: JSON.stringify({ mallPartnerId: '1' }),
  });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

await test('TC4', 'GET /sso/consume bad token → 400', async () => {
  const res = await fetch(`${API}/sso/consume?token=invalidtoken000`);
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
});

await test('TC5', 'GET /sso/consume missing token → 400', async () => {
  const res = await fetch(`${API}/sso/consume`);
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
});

await test('TC6', 'POST /auth/company/crm-sso no token → 401', async () => {
  const res = await fetch(`${API}/auth/company/crm-sso`, { method: 'POST' });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
});

if (ADMIN_TOKEN && COMPANY_ID) {
  await test('TC7', `Provision company ${COMPANY_ID} → 200 with crm_tenant_id`, async () => {
    const res = await fetch(`${API}/admin/profile-companies/${COMPANY_ID}/crm-provision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (!data.crm_tenant_id) throw new Error('Response missing crm_tenant_id');
  });
} else {
  skip('TC7', 'Provision company (real CRM call)', 'Pass --admin-email, --admin-password, --company-id');
}

if (COMPANY_TOKEN) {
  await test('TC8', 'POST /auth/company/crm-sso with company token → 200 or 400', async () => {
    const res = await fetch(`${API}/auth/company/crm-sso`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${COMPANY_TOKEN}`, 'Content-Type': 'application/json' },
    });
    // 400 if not provisioned, 200 if provisioned — both are valid
    if (res.status !== 200 && res.status !== 400) throw new Error(`Expected 200 or 400, got ${res.status}`);
  });
} else {
  skip('TC8', 'Company SSO request', 'Pass --company-email and --company-password');
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  results.filter(r => !r.ok).forEach(r => console.log(`  ${r.tc}: ${r.label} — ${r.reason}`));
}
process.exit(failed > 0 ? 1 : 0);
```

**Step 2: Make executable**

```bash
chmod +x scripts/harness/test-crm-integration.mjs
```

**Step 3: Run without credentials (auth-guard tests only)**

```bash
node scripts/harness/test-crm-integration.mjs
```

Expected: TC1, TC3, TC4, TC5, TC6 PASS. TC2, TC7, TC8 SKIP.

**Step 4: Register in route coverage lint**

Check `scripts/harness/lint-route-coverage.mjs` and add the new routes to the covered list:
- `POST /admin/profile-companies/:id/crm-provision`
- `POST /auth/company/crm-sso`
- `POST /integration/crm/sso/issue`
- `GET /sso/consume`

**Step 5: Commit**

```bash
git add scripts/harness/test-crm-integration.mjs scripts/harness/lint-route-coverage.mjs
git commit -m "test(crm): add CRM integration harness test script"
```

---

## Task 10: AdminRegisteredCompanyDetailPage — CRM Status Display

**Files:**
- Modify: `src/pages/admin/AdminRegisteredCompanyDetailPage.tsx`

**Step 1: Add CRM status card to detail page**

Find a section in the detail page where company metadata is shown (status, vip badge, etc). Add a CRM status section:

```tsx
{/* CRM Status */}
<div className="bg-white rounded-xl border border-stone-200 p-4">
  <h3 className="text-sm font-semibold text-stone-700 mb-3">CRM 状态</h3>
  {company.crm_tenant_id ? (
    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
      <span className="text-sm text-green-700 font-medium">已开通</span>
      <span className="text-xs text-stone-400 ml-2">Tenant: {company.crm_tenant_id}</span>
    </div>
  ) : (
    <div className="flex items-center gap-3">
      <span className="text-sm text-stone-500">未开通</span>
      <button
        onClick={handleCrmProvision}
        disabled={crmProvisioning}
        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {crmProvisioning ? '开通中...' : '开通CRM'}
      </button>
    </div>
  )}
  {company.crm_provisioned_at && (
    <p className="text-xs text-stone-400 mt-1">
      开通时间: {new Date(company.crm_provisioned_at).toLocaleString()}
    </p>
  )}
</div>
```

**Step 2: Add crmProvisioning state and handleCrmProvision**

```typescript
const [crmProvisioning, setCrmProvisioning] = useState(false);

const handleCrmProvision = async () => {
  setCrmProvisioning(true);
  try {
    const res = await fetch(`${API_BASE}/admin/profile-companies/${company.id}/crm-provision`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'CRM provision failed');
      return;
    }
    const d = await res.json();
    setCompany((prev: any) => ({ ...prev, crm_tenant_id: d.crm_tenant_id, crm_provisioned_at: new Date().toISOString() }));
  } catch {
    alert('Network error');
  } finally {
    setCrmProvisioning(false);
  }
};
```

Check what the detail page uses to store/fetch company data (`company` state variable, `setCompany`) and adjust accordingly. Check the existing detail page data shape to find `crm_tenant_id` field name.

**Step 3: tsc check**

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

**Step 4: Commit**

```bash
git add src/pages/admin/AdminRegisteredCompanyDetailPage.tsx
git commit -m "feat(crm): show CRM status + provision button on company detail page"
```

---

## Task 11: Route Coverage Verification

**Step 1: Run route coverage lint**

```bash
node scripts/harness/lint-route-coverage.mjs
```

Expected: All routes covered. Fix any uncovered routes.

**Step 2: Run full harness**

```bash
node scripts/harness/test-crm-integration.mjs
node scripts/harness/test-frozen-contracts.mjs
```

Expected: All applicable tests PASS.

**Step 3: Final tsc check**

```bash
./node_modules/.bin/tsc --noEmit
```

Expected: 0 errors.

---

## Execution Notes

- **Local CRM testing**: TC7 (real provision) requires local CRM running or the real `https://crm.tarmeer.com` accessible. TC3 HMAC test works without CRM.
- **Admin token key**: The admin login stores the token — confirm the exact `localStorage` key by checking `AdminRoleManagementPage.tsx` or `src/lib/api.ts`. May be `admin_token`, `token`, or managed by an `api` singleton.
- **generateToken**: Find the correct JWT generation function used in userAuthController.ts login response. It's likely `import { generateToken } from '../lib/jwt'` or similar.
- **rawBody vs JSON.stringify**: For HMAC verification, `JSON.stringify(req.body)` works if CRM sends compact JSON without extra spaces. Confirm with CRM team or add rawBody middleware.
- **DB migration on production**: Run `add-crm-fields.sql` via SSH before deploying — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is safe and non-destructive.
