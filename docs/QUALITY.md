# Quality Standards

---

## Code Quality Standards

- **TypeScript strict mode**: All new code must compile under strict TypeScript settings.
- **No `any` types in new code**: Use proper types or `unknown` with type narrowing. Existing `any` usage is tech debt to be resolved incrementally.
- **UI/CSS consistency**: All pages must use the global design tokens defined in `src/index.css`. Never hardcode colors, font sizes, or input styles inline. See `CLAUDE.md` for the full design token reference.
- **Image storage**: Never store base64 data URLs in the database. All images save to filesystem under `/uploads/`; only relative URL paths in DB.

---

## Tech Debt Tracking

Known issues to fix (from TODO comments in the codebase):

| Location | Issue |
|---|---|
| `src/pages/LoginPage.tsx:25` | `TODO: API -> redirect to /designer/upload` -- Login flow not connected to post-login redirect |
| `src/pages/RegisterPage.tsx:37` | `TODO: connect to backend` -- Registration form not wired to backend API |
| Image quality pipeline (MEMORY.md) | `TODO: Move fingerprint dedup to pre-import step` -- Canvas-based dedup currently runs client-side in `MasonryGallery.tsx`; should move to a Node.js script with sharp/canvas for pre-import filtering |

---

## Testing Requirements

- Related test cases must pass before any deploy.
- If you change a module, run its tests (e.g., `server/src/lib/requestLimits.test.ts` for upload limit changes).
- New features should include test coverage where feasible.
- Verify after deploy: homepage HTTP 200, API health, image access, new API endpoints.

---

## Documentation Requirements

- New features must update the relevant file under `docs/`.
- If a new subdomain is added, update `docs/RELIABILITY.md` (CORS/Nginx sections) and `docs/SECURITY.md` (CORS whitelist).
- If a new production incident occurs, add it to `docs/RELIABILITY.md` (Incident-Derived Rules table).
- Technical decisions and architectural changes should be recorded in MEMORY.md.

---

## Incident Response Process

1. **Immediate**: Identify the symptom and check API health, CORS errors, image access.
2. **Log**: Create an incident entry in `docs/incident-log/` with date, symptoms, root cause, and fix.
3. **Root cause**: Trace the issue to a specific commit or configuration change.
4. **Fix and verify**: Apply the fix, deploy, and verify all checklist items (homepage 200, API health, images).
5. **Codify**: Add a new rule to `docs/RELIABILITY.md` (Incident-Derived Rules table) with the enforcement method.
6. **Prevent**: If possible, add a test or automated check to catch the class of bug in the future.
