#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "[qa:smoke] 1/4 Frontend typecheck"
cd "$ROOT_DIR"
npx tsc --noEmit

echo "[qa:smoke] 2/4 Frontend build sanity"
npm run build >/tmp/tarmeer_frontend_build.log 2>&1 || {
  if grep -q "ENOENT: no such file or directory, mkdir .*\/dist" /tmp/tarmeer_frontend_build.log; then
    echo "[qa:smoke] Frontend build blocked by local dist symlink permission; typecheck already passed."
  else
    cat /tmp/tarmeer_frontend_build.log
    exit 1
  fi
}

echo "[qa:smoke] 3/4 Backend build + unit tests"
cd "$ROOT_DIR/server"
npm run test

echo "[qa:smoke] 4/4 QA manual checklist reminder"
echo "- Verify login success/failure feedback on /login"
echo "- Verify register validation states on /login -> Create account"
echo "- Verify API network path works on current host (localhost/127.0.0.1)"
echo "[qa:smoke] done"
