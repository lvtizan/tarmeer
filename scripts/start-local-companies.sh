#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"

BACKEND_PORT="${BACKEND_PORT:-3005}"
FRONTEND_PORT="${FRONTEND_PORT:-4175}"

BACKEND_LOG="/tmp/tarmeer-local-backend-${BACKEND_PORT}.log"
FRONTEND_LOG="/tmp/tarmeer-local-frontend-${FRONTEND_PORT}.log"
BACKEND_PID_FILE="/tmp/tarmeer-local-backend-${BACKEND_PORT}.pid"
FRONTEND_PID_FILE="/tmp/tarmeer-local-frontend-${FRONTEND_PORT}.pid"

cleanup_pid_file() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local old_pid
    old_pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "${old_pid:-}" ]] && kill -0 "$old_pid" 2>/dev/null; then
      kill "$old_pid" 2>/dev/null || true
      sleep 1
      kill -9 "$old_pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  if [[ -n "${pids:-}" ]]; then
    kill $pids 2>/dev/null || true
    sleep 1
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    if [[ -n "${pids:-}" ]]; then
      kill -9 $pids 2>/dev/null || true
    fi
  fi
}

wait_for_http() {
  local url="$1"
  local attempts="${2:-30}"

  for _ in $(seq 1 "$attempts"); do
    if curl --noproxy '*' -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

echo "[local-companies] preparing clean ports..."
cleanup_pid_file "$BACKEND_PID_FILE"
cleanup_pid_file "$FRONTEND_PID_FILE"
kill_port "$BACKEND_PORT"
kill_port "$FRONTEND_PORT"

echo "[local-companies] building backend..."
cd "$SERVER_DIR"
npm run build >/tmp/tarmeer-local-backend-build.log 2>&1

echo "[local-companies] starting backend on :$BACKEND_PORT"
nohup env PORT="$BACKEND_PORT" node dist/app.js >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" >"$BACKEND_PID_FILE"

if ! wait_for_http "http://127.0.0.1:${BACKEND_PORT}/api/health" 20; then
  echo "[local-companies] backend failed to start"
  tail -n 80 "$BACKEND_LOG" || true
  exit 1
fi

echo "[local-companies] starting frontend on :$FRONTEND_PORT"
cd "$ROOT_DIR"
nohup env VITE_API_URL="http://127.0.0.1:${BACKEND_PORT}/api" npm run dev -- --host 127.0.0.1 --port "$FRONTEND_PORT" >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >"$FRONTEND_PID_FILE"

if ! wait_for_http "http://127.0.0.1:${FRONTEND_PORT}/companies" 30; then
  echo "[local-companies] frontend failed to start"
  tail -n 80 "$FRONTEND_LOG" || true
  exit 1
fi

echo
echo "[local-companies] ready"
echo "Backend:  http://127.0.0.1:${BACKEND_PORT}/api/health"
echo "Frontend: http://127.0.0.1:${FRONTEND_PORT}/companies"
echo "Backend log:  $BACKEND_LOG"
echo "Frontend log: $FRONTEND_LOG"
