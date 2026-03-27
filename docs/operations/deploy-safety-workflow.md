# Deployment Safety Workflow

Last updated: 2026-03-26

## Mandatory Rules

1. Always ask the user for explicit publish approval before any deploy.
2. Read this document before deploying and confirm with `DEPLOY_RULES_ACK=YES`.
3. Never upload hashed assets (`/assets/*.js`, `/assets/*.css`) to the web root.
4. Keep remote structure identical to local `dist/` structure.
5. After deploy, verify every asset referenced by `dist/index.html` returns HTTP 200.

## Required Command

```bash
DEPLOY_RULES_ACK=YES DEPLOY_USER_APPROVED=YES bash deploy-simple.sh
```

- `DEPLOY_RULES_ACK=YES`: confirms rules were read.
- `DEPLOY_USER_APPROVED=YES`: confirms user approved this release.

## Incremental Deploy Rules

1. Build first: `npm run build`
2. Sync `dist/` to remote deploy path: `/tarmeer/tarmeer_web_portal/`
3. Do not manually copy only `index.html` unless matching new `/assets/*` files are also uploaded into `/assets/`
4. Prefer rsync with checksums over manual scp to avoid mismatched versions

## Pre-Deploy Checklist

- User approved deployment in the current conversation
- Rule file reviewed
- Working tree has intended changes only
- Build completed successfully

## Post-Deploy Checklist

- Homepage returns 200
- Critical static asset(s) return 200
- All JS/CSS refs extracted from `dist/index.html` return 200
- Core admin route opens: `/admin/visitors`
- **Avatar images return 200** (not 403) - verify at least one: `/images/designers/avatars/omar-farouk.jpg`

## File Permissions (CRITICAL)

### The Problem
Static assets (images, fonts) must be readable by nginx. Files with `600` permissions cause 403 Forbidden.

### Automatic Fix
The deploy script automatically fixes permissions after rsync:
```bash
find /tarmeer/tarmeer_web_portal -type d -exec chmod 755 {} +
find /tarmeer/tarmeer_web_portal -type f -exec chmod 644 {} +
```

### Manual Verification (if needed)
```bash
ssh root@47.91.108.104 "ls -la /tarmeer/tarmeer_web_portal/images/designers/avatars/ | head -3"
# Should show: -rw-r--r-- (644) NOT -rw------- (600)
```

### Local Prevention
Ensure your local `dist/` has correct permissions before building:
```bash
chmod -R 755 dist/
find dist/ -type f -exec chmod 644 {} +
```

## Rollback Principle

If any check fails after deploy:

1. Stop further changes
2. Restore last known good `dist/` package
3. Re-run asset 200 checks
4. Report root cause and fix before next publish
