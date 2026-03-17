# QA Smoke Workflow

## Rule
Run `npm run qa:smoke` after every functional change before handing to QA.

## Command
```bash
cd "/Users/kp/Library/Mobile Documents/com~apple~CloudDocs/AI项目/迪拜网站/tarmeer-4.0"
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
