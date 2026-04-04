# QA Smoke Workflow

## Rule
Run `npm run qa:smoke` after every functional change before handing to QA.

## Agent Rule
Before reporting completion to user:
1. Ask testing expert to review the changed path and verification coverage.
2. Execute automated checks locally.
3. If checks fail, fix first; do not hand back to user.
4. Only report after checks pass, with concrete command outputs summarized.

## Command
```bash
cd "/Users/kp/Code/tarmeer-4.0-local"
npm run qa:smoke
```

## What It Checks
1. Frontend TypeScript compile (`npx tsc --noEmit`)
2. Frontend build sanity (`npm run build`)
3. Backend build + unit tests (`server npm run test`)
4. Prints manual QA checklist for auth flow

## Manual QA Items (Auth)
1. `/login` sign-in with valid account should enter dashboard.
2. Wrong password should show a clear error without page crash.
3. In `Create account`, required fields and agreement checkbox should block submit until valid.
4. API path should work for both `localhost` and `127.0.0.1` development hosts.

## Image URL Workflow (Mandatory)
1. All image rendering must use dynamic URL resolution; do not hardcode image domains.
2. Frontend must use `resolveImageUrl()` from `src/lib/imageUrl.ts` for portfolio/cover/avatar URLs.
3. Backend should return source URL/path from DB or normalized internal path; do not inject placeholder providers.
4. Forbidden in production code:
   - `https://picsum.photos/...`
   - `https://placeholder.com/...`
   - Any hardcoded `https://www.tarmeer.com/...` fallback that ignores DB value.
5. Legacy compatibility is done by deterministic mapping rules only (example: old `showcase/cover-x` -> internal cover path), not random placeholders.

## Local Run Workflow (Mandatory)
1. Start backend first:
```bash
cd /Users/yiming/Code/tarmeer/server
npm run dev
```
2. Start frontend with fixed host/port:
```bash
cd /Users/yiming/Code/tarmeer
npm run dev -- --host 127.0.0.1 --port 5173
```
3. Keep `VITE_API_URL` empty/default (`/api`) in local dev, so Vite proxy forwards to `127.0.0.1:3002`.

## 500 Error Triage Workflow
When browser reports:
- `POST /api/stats/event 500`
- `GET /api/admin/check-installation 500`

Run this check order:
1. `curl -i --max-time 8 http://127.0.0.1:3002/api/admin/check-installation`
2. `curl -i --max-time 8 -H 'Content-Type: application/json' -d '{"eventName":"page_view","pagePath":"/admin/login"}' http://127.0.0.1:3002/api/stats/event`
3. `curl -i --max-time 8 http://127.0.0.1:5173/api/admin/check-installation`
4. If `3002` is 200 but `5173` fails, frontend dev server/proxy is wrong; restart frontend with fixed command above.

## Display Order Workflow (Ops Rule)
1. `companies` (approved company profiles) and `directory` (scraped companies) both support `display_order`.
2. Order is global unique across both lists.
3. Allowed: different number ranges by list (example: companies `1234`, directory `5678`).
4. Forbidden: duplicate number across two lists; API returns conflict and asks for another number.

## 2026-04-04 Pitfall Recap (Must Follow)
1. Do not hardcode image domains or placeholder providers for portfolio rendering.
2. Legacy image compatibility must use deterministic mapping, not random fallback images.
3. Admin local login failures with `500` are usually run-state/proxy issues before code issues; verify `3002` then `5173` proxy.
4. Keep frontend API base as `/api` in local dev unless there is a confirmed, tested override.
5. Home page company 6-card module must not re-sort by `projectCount`; use backend returned order.
6. Main `/companies` list should prioritize approved profile companies (ops-managed order), then append non-duplicate directory entries.
7. Applications tab red dot should depend on pending count and stay visually near tab count label.
8. Any sort policy changes must be reflected in workflow docs and local test guide in the same task.
9. Legacy avatar URLs like `/images/showcase/avatar-xx.png` are deprecated and must be sanitized to empty in both frontend and backend cleanup layers (`src/lib/imageCleanup.ts`, `server/src/lib/publicImageCleanup.ts`).
10. Do not let deprecated avatar URLs hit network; rendering should fall back to default avatar/initials without 404 spam.
11. On `admin.tarmeer.com`, all root-relative static image URLs (for example `/images/...`, `/uploads/...`) must be resolved dynamically to `https://www.tarmeer.com/...` via `resolveImageUrl()`, to prevent repeated 404s on the admin subdomain.
12. Keep public anti-scraping rate limits for public endpoints, but skip generic API rate-limit checks for authenticated `/api/admin/*` routes; admin login routes still rely on dedicated `adminLoginRateLimit`.
13. Image URL normalization is mandatory across backend and frontend:
    - Accept and normalize `images/...`, `uploads/...`, `./uploads/...`, `public/images/...`, `//cdn...`, `www...`.
    - Convert to canonical renderable forms (`/images/...`, `/uploads/...`, `https://...`).
    - Drop non-renderable values early (empty/invalid).
14. Test coverage priority for image safety:
    - Company list + company detail image serialization.
    - Avatar sanitization (seed + legacy showcase cleanup).
    - Homeowner project image serialization (`recent_projects`).
15. Golden rule: no non-displayable image should reach UI rendering path; if an image fails, fallback should preserve layout and avoid repeated network 404 spam.
