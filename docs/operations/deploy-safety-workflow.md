# Deployment Safety Workflow

Last updated: 2026-04-04

> **⚠️ 2026-07-03 状态说明**：本文档中所有关于 `deploy-simple.sh` 的内容已过时——该脚本部署到旧 Vite 目录，**禁止用于前端部署**。现行部署流程见 `.claude/skills/tarmeer-deploy-frontend/SKILL.md` 和 `.claude/skills/tarmeer-deploy-backend/SKILL.md`。
> 本文档仍然有效的部分：nginx 命令默认禁止（含 `ALLOW_NGINX_ACTIONS=YES` 闸门）、版本号 bump 规则、文件权限 644/755、Post-Deploy 检查清单、回滚原则。

## Mandatory Rules

1. Always ask the user for explicit publish approval before any deploy.
2. Read this document before deploying and confirm with `DEPLOY_RULES_ACK=YES`.
3. **Never run any Nginx command in normal deploy flow** (`nginx -t`, `systemctl reload nginx`, `systemctl restart nginx` are forbidden by default).
4. Nginx commands are only allowed when user explicitly approves in current conversation and deploy command includes `ALLOW_NGINX_ACTIONS=YES`.
5. Never upload hashed assets (`/assets/*.js`, `/assets/*.css`) to the web root.
6. Keep remote structure identical to local `dist/` structure.
7. After deploy, verify every asset referenced by `dist/index.html` returns HTTP 200.

## Required Command

```bash
DEPLOY_RULES_ACK=YES DEPLOY_USER_APPROVED=YES bash deploy-simple.sh
```

- `DEPLOY_RULES_ACK=YES`: confirms rules were read.
- `DEPLOY_USER_APPROVED=YES`: confirms user approved this release.
- `ALLOW_NGINX_ACTIONS=YES`: optional and **disabled by default**; only set when user explicitly asks to run Nginx commands.
- If remote schema verify script is missing, use:
  `DEPLOY_RULES_ACK=YES DEPLOY_USER_APPROVED=YES SKIP_SCHEMA_CHECK=YES bash deploy-simple.sh`

## 2026-04-04 Pitfalls (Must Follow)

1. `deploy-simple.sh` schema precheck depends on `/tarmeer/tarmeer_api/server/scripts/verify-schema.sh` on server.
2. If that script does not exist, deploy will fail before rsync; use `SKIP_SCHEMA_CHECK=YES` temporarily and fix server script later.
3. Keep deploy script portable for macOS bash 3.x; do not use `mapfile` in release-critical paths.
4. After any deploy-script change, rerun full deploy checks: homepage 200, avatar 200, and all `dist/index.html` asset refs 200.

## Incremental Deploy Rules

1. Build first: `npm run build`
2. Sync `dist/` to remote deploy path: `/tarmeer/tarmeer_web_portal/`
3. Do not manually copy only `index.html` unless matching new `/assets/*` files are also uploaded into `/assets/`
4. Prefer rsync with checksums over manual scp to avoid mismatched versions

## Version Bump Rule

Every deployment **must** bump the version in `package.json` by `+0.1` (patch level).

1. Before building, update `"version"` in `package.json` (e.g. `4.0.1` → `4.0.2`)
2. Commit the version bump together with the feature/fix commit, or as a separate `chore: bump version to X.Y.Z` commit
3. Push to remote before or after deploy
4. Version format: `major.minor.patch` — each deploy increments `patch` by 1

## Pre-Deploy Checklist

- User approved deployment in the current conversation
- Rule file reviewed
- Version bumped in `package.json`
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
