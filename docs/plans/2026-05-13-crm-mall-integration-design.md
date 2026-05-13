# CRM × Mall Integration Design

**Date**: 2026-05-13
**Author**: Claude
**Status**: Approved

## Overview

Tarmeer.com (Mall) integrates with crm.tarmeer.com (CRM) to allow admin to provision registered companies into CRM, sync company data, and enable SSO between the two systems.

## 1. Database Changes

### 1A. `company_profiles` — add 4 columns

```sql
ALTER TABLE company_profiles
  ADD COLUMN crm_tenant_id        VARCHAR(100) NULL COMMENT 'CRM tenant ID after provision',
  ADD COLUMN crm_provisioned_at   DATETIME     NULL,
  ADD COLUMN crm_mall_partner_id  VARCHAR(50)  NULL COMMENT 'equals id::string, idempotency key',
  ADD COLUMN crm_first_login_at   DATETIME     NULL COMMENT 'First time partner logged into CRM (pushed by CRM)';
```

### 1B. `mall_sso_tokens` — new table (for CRM→Mall reverse SSO)

```sql
CREATE TABLE mall_sso_tokens (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash   VARCHAR(64)  NOT NULL UNIQUE COMMENT 'sha256(rawToken)',
  partner_id   INT UNSIGNED NOT NULL,
  admin_email  VARCHAR(255) NOT NULL COMMENT 'CRM admin who requested SSO',
  redirect_url VARCHAR(2000) NOT NULL DEFAULT '/',
  expires_at   DATETIME     NOT NULL,
  consumed_at  DATETIME     NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_partner (partner_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

## 2. Environment Variables

Add to `.env` (server):
```
MALL_INTEGRATION_SECRET=d6597040c09a67defe5093841eed723121ee5a9d4b16e24001af5311b558cf5b
CRM_BASE_URL=https://crm.tarmeer.com
```

## 3. Backend Service: `crmIntegrationService.ts`

Location: `server/src/lib/crmIntegrationService.ts`

### 3A. HMAC signing (Mall→CRM)

```
signature = HMAC-SHA256(MALL_INTEGRATION_SECRET, `${timestamp}\n${rawBody}`)
Headers: X-Mall-Timestamp, X-Mall-Signature (hex lowercase)
Drift tolerance: ±300s
```

### 3B. HMAC verification (CRM→Mall reverse)

```
signature = HMAC-SHA256(MALL_INTEGRATION_SECRET, `${timestamp}\n${rawBody}`)
Headers: X-Crm-Timestamp, X-Crm-Signature (hex lowercase)
Verify with timingSafeEqual
```

### 3C. Functions

| Function | Direction | Mode | Retry |
|---|---|---|---|
| `provision(companyId)` | Mall→CRM POST /api/integration/mall/partner/provision | Sync (await) | 5 attempts, 1→2→4→8→16s |
| `passwordSync(userId, hash)` | Mall→CRM | Async (fire & log) | same |
| `emailSync(userId, newEmail)` | Mall→CRM | Async | same |
| `partnerSync(companyId)` | Mall→CRM POST /api/integration/mall/partner/sync | Async | same |
| `ssoIssue(companyId)` | Mall→CRM POST /api/integration/mall/sso/issue | Sync (returns consumeUrl) | 3 attempts |

### 3D. Provision payload (PRD §5.1)

```json
{
  "mallPartnerId": "42",
  "partnerName": "company_name",
  "adminEmail": "user.email",
  "adminPasswordHash": "bcrypt hash or null if google-only",
  "adminGoogleId": "google_id or null",
  "adminName": "user.full_name",
  "adminPhone": "user.phone",
  "businessName": "company_name",
  "businessType": "company_types[0]",
  "city": "city",
  "address": "address",
  "tradeRegistrationNo": "trade_license_number",
  "website": "website",
  "description": "description",
  "emiratesServed": ["Dubai"],
  "services": ["Plumbing"]
}
```

On success: save `crm_tenant_id`, `crm_provisioned_at`, `crm_mall_partner_id` to DB.

## 4. Admin Routes

### 4A. Provision endpoint

```
POST /api/admin/profile-companies/:id/crm-provision
Auth: requireAdmin
Effect: calls crmIntegrationService.provision(id), saves crm_tenant_id
Response: { ok: true, crm_tenant_id }
```

### 4B. List endpoint update

`GET /api/admin/roles/companies` — add `crm_tenant_id` to SELECT + response

### 4C. Company detail endpoint update

`GET /api/admin/profile-companies/:id` — add `crm_tenant_id`, `crm_provisioned_at` to response

## 5. Admin UI: `AdminRoleManagementPage.tsx`

### Desktop table (CompaniesTab)

Add "CRM" column in `<thead>` between Services and Status.

Each row: CRM badge/button based on `company.crm_tenant_id`:
- `null` → blue "开通CRM" button → calls provision endpoint → updates local state
- non-null → green "CRM已开通" badge (non-clickable)

### Mobile cards

Add CRM button/badge below existing action buttons.

### Company interface update

Add `crm_tenant_id?: string | null` to `Company` interface.

## 6. Company Dashboard: `CompanyLayout.tsx`

### Sidebar entry

Add "打开CRM" NavLink below Settings, only shown when `crmEnabled` (fetched from profile).

Backend check: `GET /api/auth/company/profile` — add `crm_tenant_id` to response.

### SSO flow

On click:
1. Frontend calls `POST /api/company/crm-sso`
2. Backend calls `crmIntegrationService.ssoIssue(companyId)` → gets `consumeUrl`
3. Backend returns `{ consumeUrl }`
4. Frontend does `window.open(consumeUrl, '_blank')`

### Company SSO route

```
POST /api/company/crm-sso
Auth: company JWT (requireCompanyAuth)
Effect: calls ssoIssue(), returns consumeUrl
```

## 7. Sync Hooks

### 7A. Password change hook

In `userAuthController.ts` / wherever password update occurs:
- After successful bcrypt hash update to DB
- If company has `crm_tenant_id`: fire `crmIntegrationService.passwordSync(userId, newHash)` async

### 7B. Email change hook

- After successful email update
- If company has `crm_tenant_id`: fire `crmIntegrationService.emailSync(userId, newEmail)` async

### 7C. Profile sync hook

In `companyProfileController.ts` `upsertProfile`:
- After successful DB upsert
- If company has `crm_tenant_id`: fire `crmIntegrationService.partnerSync(companyId)` async

## 8. CRM Partner Activated Notification (CRM→Mall)

CRM calls this when a provisioned partner first logs in. Mall stores the timestamp and shows 已激活/未激活 in admin.

### Endpoint

```
POST /api/integration/crm/partner/activated
Auth: X-Crm-Timestamp + X-Crm-Signature (same HMAC secret, ±300s drift)
Body: {
  "mallPartnerId": "42",
  "adminEmail": "boss@xx.com",
  "firstLoginAt": "2026-05-13T08:23:11.000Z",
  "source": "password" | "sso" | "google"
}
Response: { "code": 0 }  — always 200 (idempotent: duplicate push → no-op, still 200)
```

### Idempotency rule

`UPDATE company_profiles SET crm_first_login_at = ? WHERE id = ? AND crm_first_login_at IS NULL`

If already set, skip write, still return `{ "code": 0 }`.

### Admin UI change

CompaniesTab CRM column shows two sub-states:
- `crm_tenant_id` is null → "开通CRM" button (blue)
- `crm_tenant_id` set, `crm_first_login_at` null → green "CRM已开通" + gray "未激活" badge
- `crm_tenant_id` set, `crm_first_login_at` set → green "CRM已开通" + green "已激活" badge

## 9. Reverse SSO (CRM→Mall)

### 8A. Issue endpoint (CRM calls Mall)

```
POST /api/integration/crm/sso/issue
Auth: X-Crm-Timestamp + X-Crm-Signature (HMAC verified)
Body: { mallPartnerId, adminEmail, redirectUrl? }
Effect: generate 32-byte random token, store sha256(token) in mall_sso_tokens
Response: { consumeUrl: "https://www.tarmeer.com/sso/consume?token=..." }
```

### 8B. Consume endpoint

```
GET /sso/consume?token=<rawToken>
No auth required (token IS the auth)
Effect:
  1. sha256(token) → lookup in mall_sso_tokens
  2. Check not expired, not consumed
  3. Mark consumed_at = NOW()
  4. Load company_profiles by partner_id → get user_id
  5. Generate company JWT (same as normal login)
  6. Set httpOnly cookie OR redirect with token in URL
  7. 302 → redirect_url (default: /company/dashboard)
```

### 8C. Frontend consume route

Add `<Route path="/sso/consume" element={<SsoConsumePage />} />` in `App.tsx` (outside Layout).

`SsoConsumePage`: calls `GET /sso/consume` via API, then navigates to dashboard.

## 9. Test Coverage

Harness: `scripts/harness/test-crm-integration.mjs`

| TC | Coverage |
|---|---|
| TC1 | POST provision no token → 401 |
| TC2 | POST provision bad id → 404 |
| TC3 | POST /api/integration/crm/sso/issue bad sig → 401 |
| TC4 | GET /sso/consume bad token → 400 |
| TC5 | GET /sso/consume expired token → 400 |
| TC6 | POST /api/company/crm-sso no token → 401 |

Auth-gated tests (require admin + company credentials):
| TC | Coverage |
|---|---|
| TC7 | Provision → 200 → crm_tenant_id saved |
| TC8 | Profile sync fires after provision |
| TC9 | SSO issue → consumeUrl returned |

## 10. Security Notes

- `MALL_INTEGRATION_SECRET` in `.env` only, never in git
- Constant-time HMAC comparison (`timingSafeEqual`)
- SSO tokens: 32 bytes random, 5 min TTL, single-use
- Token stored as sha256 hash (raw token never persisted)
- `/api/integration/crm/*` requires valid HMAC signature (no other auth)

## 11. Implementation Order

1. DB migration (company_profiles columns + mall_sso_tokens table)
2. `crmIntegrationService.ts` (signing + all 5 functions)
3. Admin provision route + list/detail response updates
4. Admin UI (CompaniesTab CRM column, detail page CRM status)
5. Company dashboard SSO + sidebar entry
6. Sync hooks (profile, password, email)
7. Reverse SSO endpoints (issue + consume)
8. Harness test script
9. Route coverage lint

## 12. Business Rules (from PRD §10)

- MALL-001: mallPartnerId is immutable (company_profiles.id)
- MALL-002: provision is idempotent by mallPartnerId
- MALL-003: password hash is bcrypt, CRM must not re-hash
- MALL-006: partnerSync field-absent = no change, null = clear
- MALL-007: SSO tokens expire 5min, single-use
- MALL-008: emailSync only on verified email changes
- MALL-009: HMAC drift ±300s
- MALL-012: Google-only accounts send adminGoogleId, no adminPasswordHash
- MALL-016: reverse SSO consume sets Mall session (company role)
