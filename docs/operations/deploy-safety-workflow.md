# Deploy Safety Workflow (Must Read Before Upload)

Last updated: 2026-03-17

## Goal

Prevent low-level online deployment failures such as:

- images returning `403 Forbidden`
- homepage blank / `500` due to missing `index.html` or mismatched assets
- partial deploy causing old/new bundle inconsistency

## Mandatory Rules

1. Do not deploy unless user explicitly says "go online".
2. Always complete local verification before deploy:
   - `npm run qa:smoke`
   - `npm run build`
3. Deploy through the script only. Do not use ad-hoc manual `scp` steps.
4. After upload, always normalize file permissions:
   - directories: `755`
   - files: `644`
5. Run production health checks immediately after deploy:
   - `https://www.tarmeer.com` returns `200`
   - one critical page (e.g. `/materials`) returns `200`
   - one avatar image URL returns `200`
   - one Chinese logo image URL returns `200`
6. If any check fails, stop and fix immediately before announcing completion.

## Root Cause We Just Had

- Static files were uploaded with owner-only permissions (`600` / `-rw-------`).
- Nginx could not read those files, so image URLs returned `403`.
- A partial deploy also risked missing root files (`index.html`) and broken entry loading.

## Pre-Deploy Checklist

- [ ] I have read this file.
- [ ] User explicitly approved online deployment.
- [ ] Local QA smoke passed.
- [ ] Local build passed.
- [ ] Target branch/commit is correct.
- [ ] No unrelated risky changes included.

## Post-Deploy Checklist

- [ ] Homepage status code is `200`.
- [ ] Core page status code is `200`.
- [ ] Avatar image status code is `200`.
- [ ] Chinese logo image status code is `200`.
- [ ] Manual browser hard-refresh verification is done.

## Emergency Rollback (Minimal)

If production is broken:

1. Re-upload `dist/index.html` and `dist/assets`.
2. Re-upload required `images` folder.
3. Re-run permission normalization:
   - `find /tarmeer/tarmeer_web_portal -type d -exec chmod 755 {} \;`
   - `find /tarmeer/tarmeer_web_portal -type f -exec chmod 644 {} \;`
4. Re-check all URLs above until all are `200`.
