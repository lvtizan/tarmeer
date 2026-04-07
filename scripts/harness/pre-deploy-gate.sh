#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TARGET="${1:-both}"

echo ""
echo "==========================================="
echo "  Tarmeer Pre-Deploy Gate"
echo "  Target: $TARGET"
echo "==========================================="
echo ""

FAILURES=0

run_check() {
  local label="$1"
  shift
  echo "▶ $label"
  if "$@" > /dev/null 2>&1; then
    echo "  ✅ PASSED"
  else
    echo "  ❌ FAILED"
    FAILURES=$((FAILURES + 1))
  fi
  echo ""
}

# 1. Reliability invariants
run_check "Reliability invariants" node "$SCRIPT_DIR/lint-reliability.mjs"

# 2. CORS/Nginx consistency
run_check "CORS/Nginx consistency" node "$SCRIPT_DIR/lint-cors-nginx.mjs"

# 3. Frontend type check
if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "both" ]; then
  run_check "Frontend type check" "$ROOT/node_modules/.bin/tsc" --noEmit --skipLibCheck
fi

# 4. Frontend build
if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "both" ]; then
  run_check "Frontend build" "$ROOT/node_modules/.bin/vite" build
fi

# 5. Backend build
if [ "$TARGET" = "backend" ] || [ "$TARGET" = "both" ]; then
  run_check "Backend build" bash -c "cd '$ROOT/server' && npx tsc"
fi

echo "==========================================="
if [ "$FAILURES" -eq 0 ]; then
  echo "  All checks passed."
else
  echo "  $FAILURES check(s) FAILED."
fi
echo "==========================================="

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi
exit 0
