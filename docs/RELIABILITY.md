# Reliability Invariants

All rules in this document are derived from production incidents. Every rule MUST be enforced before deploy.

---

## Data Source Merge Rules

- When merging multiple data sources, ALWAYS sort by data completeness (companies with images before those without).
- `fetchPublicCompanies` in `src/lib/publicApi.ts` fetches two sources in parallel:
  1. **Directory companies** (`/api/companies`) -- have portfolio images scraped from the web.
  2. **Approved companies** (`/api/public/companies`) -- user-submitted profiles that may have no images yet.
- Directory companies MUST appear first in the merged list. Approved companies are appended only if their name does not already appear in the directory set (deduplication by lowercase name).
- Never let empty-data records push complete records out of view.
- When adding any new data source to the merge, verify that the new source's field completeness does not degrade the ordering of existing results.

---

## Subdomain / CORS Safety

- Adding a new subdomain requires updating the production whitelist in `server/src/lib/corsOrigins.ts`.
- Current production CORS whitelist:
  - `https://www.tarmeer.com`
  - `https://tarmeer.com`
  - `https://designer.tarmeer.com`
  - `https://admin.tarmeer.com`
- Production IPs are also allowed: `http://47.91.108.104`, `https://47.91.108.104`.
- After updating CORS, you MUST also verify that an Nginx server block exists for the new subdomain.
- Development origins (localhost ports 5173-5181, 4175) are always included regardless of NODE_ENV.

---

## Nginx Rules

- Every domain and subdomain must have an explicit Nginx `server` block.
- The bare domain (`tarmeer.com`) must redirect to `www.tarmeer.com` via a dedicated server block.
- Never rely on the Nginx default server block fallback -- requests that fall through to the wrong server block can cause CORS failures and expose unintended backends.

---

## Image Storage

- NEVER store base64 data URLs in the database.
- All images must be saved to the filesystem under `/uploads/`, with only the relative URL path stored in the DB.
- Avatars: `/uploads/avatars/{id}-{uuid}.{ext}`
- Project images: `/uploads/projects/{designerId}/{projectId}/{year}/{month}/{uuid}.{ext}`
- Enforce with `validateNoBase64Images()` in `server/src/lib/projectPersistence.ts` -- this function throws if any image value starts with `data:`.
- If base64 data is found in the DB, run: `node scripts/migrate-base64-avatars.mjs --apply`

---

## Deployment Invariants

1. **Frontend + backend must match**: if frontend calls a new API endpoint, deploy backend FIRST, then frontend.
2. **Always verify after deploy**:
   - Homepage returns HTTP 200.
   - API health endpoint responds.
   - At least one image URL loads correctly.
   - Any newly added API endpoint returns expected data.
3. **Never deploy without running related test cases** (at minimum, the tests in the changed module).
4. **Check all five areas before deploy**: frontend build, backend build, database schema, data sync, image sync (see Deployment Checklist in MEMORY.md).

---

## Incident-Derived Rules

| Rule | Source Incident | Enforcement Method |
|---|---|---|
| Directory companies (with images) must sort before approved companies (without images) in merged list | 2026-04-07: Company list images disappeared after merge logic in commit `02637a3` placed imageless approved companies before directory companies | Code review of any change to `fetchPublicCompanies` in `src/lib/publicApi.ts`; verify directory-first ordering |
| New subdomain must be added to CORS whitelist in `server/src/lib/corsOrigins.ts` | 2026-04-07: `admin.tarmeer.com` was missing from CORS whitelist, causing all API requests to be blocked (429/CORS) | Checklist item before deploy; grep for production array in `corsOrigins.ts` |
| Bare domain (`tarmeer.com`) must have explicit Nginx server block redirecting to `www.tarmeer.com` | 2026-04-07: No Nginx server block for `tarmeer.com`, requests fell through to `admin.tarmeer.com` default block | Nginx config review on any domain change; test bare domain redirect with `curl -I` |
| Never store base64 data URLs in database | Image storage incidents; base64 bloats DB and breaks queries | `validateNoBase64Images()` enforced in `projectPersistence.ts`; migration script available |
| Always verify API health + image access + homepage 200 after deploy | Post-deploy verification catches silent failures | Manual verification checklist after every deploy |
| Deploy backend before frontend when frontend references new API endpoints | API-not-found errors on production if frontend deploys first | Deploy order documented in checklist; CI/CD should enforce ordering |
