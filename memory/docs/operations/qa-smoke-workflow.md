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
