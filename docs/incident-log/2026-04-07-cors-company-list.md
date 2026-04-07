# Incident: Company List Not Loading + Images Missing

**Date**: 2026-04-07
**Severity**: High (production site broken)
**Duration**: ~2 hours
**Status**: Resolved

## Symptoms

- Company list page showed "Unable to load designers" / "No company source available"
- Homepage six company entries missing
- Companies that did load had no images

## Root Causes

### Root Cause 1: Missing Nginx bare domain config

`tarmeer.com` (without `www`) had no Nginx server block. Requests to the bare domain fell through to the default server, which redirected to `admin.tarmeer.com`. The backend CORS whitelist did not include `admin.tarmeer.com`, so all API requests originating from that domain were blocked with 429/CORS errors.

**Chain of failure:**
1. User visits `tarmeer.com`
2. No matching Nginx `server_name` block
3. Default server catches request, redirects to `admin.tarmeer.com`
4. Browser makes API calls from `admin.tarmeer.com` origin
5. Backend CORS rejects the origin
6. API returns 429/CORS error
7. Frontend shows "Unable to load designers"

### Root Cause 2: Data source merge order

Commit `02637a3` (2026-04-06) added the `/api/public/companies` merge into the company list. The 11 approved companies from the database (which had no images and no logos) were sorted BEFORE the directory companies (which had full images). Users saw empty company cards at the top of the list, giving the impression that images were missing site-wide.

## Fix Applied

1. **Nginx**: Added `tarmeer.com` server block that redirects to `www.tarmeer.com` for both HTTP and HTTPS.
2. **CORS**: Added `admin.tarmeer.com` to the whitelist in `server/src/lib/corsOrigins.ts`.
3. **Merge order**: Changed `src/lib/publicApi.ts` to place directory companies (with images) before database companies (without images).

## Timeline

| Time  | Event |
|-------|-------|
| 09:xx | User reports site broken |
| 09:xx | Investigation: API returns 429 from curl (antiScraping middleware blocks curl User-Agent) |
| 09:xx | Discovery: `tarmeer.com` redirects to `admin.tarmeer.com` (wrong redirect via default server) |
| 09:xx | Discovery: CORS blocks requests from `admin.tarmeer.com` origin |
| 09:xx | Fix deployed: Nginx bare domain config + CORS whitelist + backend restart |
| 09:xx | Discovery: companies load but top entries have no images (merge order issue) |
| 09:xx | Fix deployed: `publicApi.ts` merge order changed + frontend build + deploy |
| 10:xx | Verified: site fully restored, all company cards display with images |

## Lessons Learned

| Lesson | Rule Added | Location |
|--------|-----------|----------|
| Data sources must be sorted by completeness (image-rich first) | Sort merged data sources by data quality | `docs/RELIABILITY.md` |
| Every new subdomain must be added to the CORS whitelist | New subdomain = CORS update | `docs/SECURITY.md` |
| Every domain/subdomain must have an explicit Nginx server block | No reliance on default server fallthrough | `docs/RELIABILITY.md` |

## Prevention

- Before deploying any Nginx config change, verify that all known domains (`tarmeer.com`, `www.tarmeer.com`, `admin.tarmeer.com`) resolve correctly.
- When merging multiple data sources in the frontend, always sort by data completeness so users see the richest entries first.
- Maintain a canonical list of all domains and subdomains in `docs/SECURITY.md` and cross-check against both Nginx configs and CORS whitelists.
