# Deploy Runbook

Comprehensive deployment checklist for Tarmeer 4.0. Combines safety workflow, step-by-step commands, and troubleshooting into one reference.

Last updated: 2026-04-07

---

## Pre-Deploy Checklist

- [ ] **Run pre-deploy gate**: `bash scripts/harness/pre-deploy-gate.sh`
- [ ] Identify what changed (frontend / backend / DB / images)
- [ ] Run related test cases (see [Testing Index](../testing/index.md))
- [ ] If new API endpoint: deploy backend FIRST, then frontend
- [ ] If new subdomain: update CORS (`server/src/lib/corsOrigins.ts`) and Nginx config
- [ ] Get explicit user approval before deploying
- [ ] Working tree has intended changes only (`git status`)

---

## Frontend Deploy

```bash
cd /Users/kp/Code/tarmeer-4.0-local

# 1. Type check
./node_modules/.bin/tsc --noEmit --skipLibCheck

# 2. Build
./node_modules/.bin/vite build

# 3. Deploy to ECS
rsync -az --delete -e "ssh -i ~/.ssh/tarmeer_ecs" dist/ root@47.91.108.104:/tarmeer/tarmeer_web_portal/

# 4. Fix file permissions (prevent 403)
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "find /tarmeer/tarmeer_web_portal -type d -exec chmod 755 {} + && \
   find /tarmeer/tarmeer_web_portal -type f -exec chmod 644 {} +"
```

Alternatively, use the full deploy script:

```bash
DEPLOY_RULES_ACK=YES DEPLOY_USER_APPROVED=YES bash deploy-simple.sh
```

Add `SKIP_SCHEMA_CHECK=YES` if the remote schema verify script is missing.
Add `ALLOW_NGINX_ACTIONS=YES` only when user explicitly requests Nginx reload.

### Frontend Deploy Rules

- Never upload hashed assets (`/assets/*.js`, `/assets/*.css`) without the matching `index.html`.
- Always sync the entire `dist/` directory; never copy only `index.html`.
- Keep remote structure identical to local `dist/` structure.
- Never run Nginx commands unless explicitly approved.

---

## Backend Deploy

```bash
cd /Users/kp/Code/tarmeer-4.0-local/server

# 1. Install deps and build
npm ci
npx tsc

# 2. Run the deploy script (builds, bundles, uploads, restarts PM2)
cd /Users/kp/Code/tarmeer-4.0-local
./deploy-backend-ecs.sh
```

The `deploy-backend-ecs.sh` script does the following:
1. Runs `npm ci` and `npm run build` in `server/`
2. Creates a deploy bundle (dist/, schema/, package files)
3. Cleans remote code directories (preserves `public/uploads/` and `.env`)
4. Uploads and extracts the bundle via tar
5. Runs `npm ci --omit=dev` on server
6. Restarts via PM2 (`pm2 restart tarmeer-api`) or nohup fallback

### Backend Config

- Server: `root@47.91.108.104`
- SSH key: `~/.ssh/tarmeer_ecs`
- Remote path: `/tarmeer/tarmeer_api`
- API port: `3002`
- Process manager: PM2 (`tarmeer-api`)

---

## Database Migration

1. Connect to RDS: `rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com`
2. Run migration SQL **BEFORE** deploying code that depends on new columns/tables
3. Always have a rollback SQL ready before running migrations
4. Verify schema after migration:
   ```bash
   ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
     "cd /tarmeer/tarmeer_api && bash server/scripts/verify-schema.sh"
   ```

---

## Image Deploy

```bash
# Sync images to server
rsync -az -e "ssh -i ~/.ssh/tarmeer_ecs" \
  public/images/ root@47.91.108.104:/tarmeer/tarmeer_web_portal/images/

# Fix permissions
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "find /tarmeer/tarmeer_web_portal/images -type d -exec chmod 755 {} + && \
   find /tarmeer/tarmeer_web_portal/images -type f -exec chmod 644 {} +"
```

---

## Post-Deploy Verification

- [ ] `curl -sS -o /dev/null -w "%{http_code}" https://www.tarmeer.com/` returns 200
- [ ] `curl -sS -o /dev/null -w "%{http_code}" https://www.tarmeer.com/api/health` returns 200
- [ ] Company list page loads with images
- [ ] Image access works (no 403): `curl -sS -o /dev/null -w "%{http_code}" https://www.tarmeer.com/images/designers/avatars/omar-farouk.jpg`
- [ ] All JS/CSS refs in `dist/index.html` return 200 on production
- [ ] Admin route opens: `/admin/visitors`
- [ ] Verify new functionality works end-to-end
- [ ] Check browser console for errors
- [ ] **Run smoke test**: `node scripts/harness/smoke-production.mjs`

### Quick Diagnostic Commands

```bash
# Check remote file permissions
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "ls -la /tarmeer/tarmeer_web_portal/images/designers/avatars/ | head -3"

# Check remote directory structure
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "ls -la /tarmeer/tarmeer_web_portal/"

# Check Nginx config (only when approved)
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "nginx -t"

# Check HTTP status of any asset
curl -sS -o /dev/null -w "%{http_code}" https://www.tarmeer.com/path/to/asset
```

---

## Rollback

### Frontend Rollback
- Redeploy the previous `dist/` build
- If you kept the previous build: `rsync -az --delete -e "ssh -i ~/.ssh/tarmeer_ecs" dist-backup/ root@47.91.108.104:/tarmeer/tarmeer_web_portal/`
- Re-run post-deploy verification

### Backend Rollback
- `ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 "cd /tarmeer/tarmeer_api && pm2 restart tarmeer-api"`
- For code rollback: redeploy previous server build via `deploy-backend-ecs.sh`

### Database Rollback
- Have rollback SQL ready **before** running any migration
- Test rollback SQL on staging first

### General Rollback Principle
1. Stop further changes immediately
2. Restore last known good state
3. Re-run all post-deploy checks
4. Identify root cause before next deploy attempt

---

## Common Issues & Troubleshooting

### File Permission Issues (403 Forbidden)

**Symptoms**: Homepage loads but images/avatars return 403. Browser dev tools shows static resources failing.

**Cause**: File permissions are `600` (owner-only). Nginx cannot read the files.

**Fix**:
```bash
ssh -i ~/.ssh/tarmeer_ecs root@47.91.108.104 \
  "find /tarmeer/tarmeer_web_portal -type d -exec chmod 755 {} + && \
   find /tarmeer/tarmeer_web_portal -type f -exec chmod 644 {} +"
```

**Prevention**: `deploy-simple.sh` automatically fixes permissions after rsync. Ensure local `public/` directory has correct permissions before building.

### Schema Validation Failure

**Symptoms**: Deploy script reports "Schema validation failed" or cannot find `verify-schema.sh`.

**Cause**: Remote server structure does not match script expectations, or script path is outdated.

**Fix**:
- Skip schema validation: `SKIP_SCHEMA_CHECK=YES`
- Or manually sync the backend schema files to the server

### Asset 404 Errors

**Symptoms**: Page loads but JS/CSS return 404. `index.html` references files that do not exist on server.

**Cause**: Only `index.html` was uploaded without the matching `/assets/*` files (incomplete incremental deploy).

**Fix**:
```bash
# Always sync the entire dist/ directory
rsync -az --delete -e "ssh -i ~/.ssh/tarmeer_ecs" \
  dist/ root@47.91.108.104:/tarmeer/tarmeer_web_portal/
```

### TypeScript Compilation Errors

Common errors and fixes:
- `TS6133` (unused variable): prefix with `_` (e.g., `const _unused = value;`)
- `TS2347` (untyped function call): add proper type annotations
- `TS2451` (duplicate declaration): check for conflicting imports

```bash
# Use explicit React hook imports instead of React.xxx
import { useState, useCallback } from 'react';
```

---

## Deploy Order Summary

| Change Type | Deploy Order |
|-------------|-------------|
| Frontend only | Build + rsync `dist/` |
| Backend only | `deploy-backend-ecs.sh` |
| Frontend + Backend (new API) | Backend first, then frontend |
| Database schema | Migration SQL first, then code deploy |
| Images only | rsync images + fix permissions |
| New subdomain | Update CORS + Nginx config, then deploy |
