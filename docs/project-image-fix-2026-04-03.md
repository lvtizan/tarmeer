# Project Image Display Fix (2026-04-03)

## Problem
- Designer/Company portfolio images failed to display in production.
- Symptom: project image URLs returned `404`, especially in admin detail pages.

## Root Cause
- Historical project images were stored as `base64` data in DB (`projects.images`), causing large payloads and unstable loading.
- After migration to URL-based images, Nginx did not correctly route `/uploads/...` requests.
- Existing Nginx static file rule matched `.jpg/.png` first, causing `404` before proxying to backend.

## Final Solution
1. **Data migration (DB -> file URL)**
   - Converted historical `base64` images in `projects.images` to files under:
   - `/tarmeer/tarmeer_api/public/uploads/projects/...`
   - Rewrote DB image entries to URL paths:
   - `/uploads/projects/{designerId}/{projectId}/{yyyy}/{mm}/{uuid}.{ext}`

2. **Runtime write-path fix (prevent regression)**
   - Updated project create/update logic to persist incoming `data:image/...` as files and store URL only.
   - New uploads now follow URL-based storage by default.

3. **Nginx routing fix**
   - Added `location ^~ /uploads/ { proxy_pass http://localhost:3002/uploads/; ... }`
   - Ensured `/uploads/` route is evaluated before static extension fallback rule.

## Production Execution Summary
- Migration scope:
  - `scanned=201`
  - `migrated=20`
  - `skipped=181`
  - `failed=0`
- Validation:
  - `remaining_base64_projects = 0`
  - Sample migrated image URLs returned `HTTP 200` on:
    - `https://tarmeer.com/uploads/...`
    - `https://www.tarmeer.com/uploads/...`

## Safety / Rollback
- Backup created before migration:
  - `/tarmeer/backups/projects_before_image_migration_20260403_213725.sql.gz`
- Full production dump also pulled locally for recovery.

## Impact
- Existing broken portfolio images are restored.
- New project uploads no longer return to `base64` storage.
- Payload size and rendering stability are improved for portfolio pages.
