#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
PID_FILE="/tmp/tarmeer-server.pid"
LOG_FILE="/tmp/tarmeer-server.log"

cd "$SERVER_DIR"

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[backend-up] backend already running on PID $OLD_PID"
    exit 0
  fi
fi

echo "[backend-up] building backend..."
npm run build >/tmp/tarmeer-server-build.log 2>&1

echo "[backend-up] starting backend..."
nohup node dist/app.js </dev/null >"$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" >"$PID_FILE"

for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl --noproxy '*' -sS "http://127.0.0.1:3002/api/health" >/dev/null 2>&1; then
    echo "[backend-up] backend is healthy on http://127.0.0.1:3002 (PID $NEW_PID)"
    exit 0
  fi
  sleep 1
done

echo "[backend-up] backend failed to become healthy in 10s"
echo "[backend-up] log tail:"
tail -n 60 "$LOG_FILE" || true
exit 1
