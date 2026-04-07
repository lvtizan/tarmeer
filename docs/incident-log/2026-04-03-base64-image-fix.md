# Incident: Base64 Images Stored in Database Causing Bloat and Display Failures

**Date**: 2026-04-03
**Severity**: Medium (portfolio images broken in production)
**Duration**: Resolved same day
**Status**: Resolved

## Symptoms

- Designer/company portfolio images failed to display in production.
- Project image URLs returned 404, particularly on admin detail pages.
- Large API payloads due to base64-encoded image data in database rows.

## Root Cause

Historical project images were stored as raw base64 data strings directly in the `projects.images` column. This caused:

1. **Payload bloat**: Each base64 image added hundreds of KB to API responses, making page loads slow and unstable.
2. **Nginx routing conflict**: After a partial migration to URL-based images, the Nginx static file rule for `.jpg`/`.png` extensions matched before the `/uploads/` proxy rule, returning 404 for URL-based images.
3. **Mixed storage**: Some projects had URL-based images, others still had base64, creating inconsistent rendering behavior.

## Fix Applied

### 1. Data migration (base64 to file URL)

Converted all remaining base64 images in `projects.images` to files on disk:
- Storage path: `/tarmeer/tarmeer_api/public/uploads/projects/{designerId}/{projectId}/{yyyy}/{mm}/{uuid}.{ext}`
- DB entries rewritten to store only the URL path.
- Scope: 201 projects scanned, 20 migrated, 181 already URL-based, 0 failures.

### 2. Runtime write-path fix

Updated project create/update API logic to intercept incoming `data:image/...` payloads, persist them as files, and store only the resulting URL. New uploads follow URL-based storage by default.

### 3. Nginx routing fix

Added a high-priority location block:
```
location ^~ /uploads/ { proxy_pass http://localhost:3002/uploads/; }
```
This ensures `/uploads/` is evaluated before the generic static extension fallback rule.

### 4. Validation

- `remaining_base64_projects = 0` after migration.
- Sample migrated image URLs returned HTTP 200 on both `tarmeer.com` and `www.tarmeer.com`.

## Backup / Rollback

- Pre-migration backup: `/tarmeer/backups/projects_before_image_migration_20260403_213725.sql.gz`
- Full production dump pulled locally.

## Rule Added

> **NEVER store images as base64 data URLs in the database.** All image data must be saved to the filesystem under `/uploads/` and only the relative URL path stored in the DB. See `CLAUDE.md` Image Storage Rules for enforcement details.

This rule is codified in `CLAUDE.md` under "Image Storage Rules (MUST FOLLOW)" with specific path conventions and utility references.
