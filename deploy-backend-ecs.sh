#!/usr/bin/env bash
# Deploy tarmeer-4.0 **backend API** to ECS (no nginx changes).
# Usage: ./deploy-backend-ecs.sh
# You will be prompted for SSH password unless you use key-based auth.
# Nginx: your backend colleague must point /api to this app (e.g. proxy_pass to port 3002).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_HOST="${DEPLOY_HOST:-47.91.108.104}"
BACKEND_PATH="${BACKEND_PATH:-/tarmeer/tarmeer_api}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/tarmeer_ecs}"
API_PORT="${API_PORT:-3002}"

SSH_OPTS="-p $SSH_PORT -o StrictHostKeyChecking=accept-new"
[[ -f "$SSH_KEY" ]] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"

echo "Building backend..."
cd server
npm ci
npm run build
cd ..

echo "Creating backend deploy bundle..."
TMP_DEPLOY=$(mktemp -d)
cp server/package.json server/package-lock.json "$TMP_DEPLOY/"
cp -r server/dist "$TMP_DEPLOY/"
cp -r server/schema "$TMP_DEPLOY/"
cp server/.env.example "$TMP_DEPLOY/.env.example" 2>/dev/null || true

echo "Deploying backend to ${DEPLOY_USER}@${DEPLOY_HOST}:${BACKEND_PATH}..."
ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p ${BACKEND_PATH} && rm -rf ${BACKEND_PATH}/*"
(cd "$TMP_DEPLOY" && tar czf - .) | ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" "cd ${BACKEND_PATH} && tar xzf -"
rm -rf "$TMP_DEPLOY"

echo "Installing production deps and starting process on server..."
ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" "cd ${BACKEND_PATH} && \
  npm ci --omit=dev && \
  ([ -f .env ] || { cp .env.example .env 2>/dev/null || touch .env; echo 'Created .env from .env.example - please set JWT_SECRET and DB_* on server.'; }) && \
  if command -v pm2 >/dev/null 2>&1; then \
    (pm2 describe tarmeer-api >/dev/null 2>&1 && pm2 restart tarmeer-api) || pm2 start dist/app.js --name tarmeer-api; \
    pm2 save 2>/dev/null || true; \
  else \
    (pkill -f 'node dist/app.js' 2>/dev/null || true); \
    nohup node dist/app.js > backend.log 2>&1 & \
    echo 'Started with nohup (no pm2). PID:' \$!; \
  fi"

echo ""
echo "Done. Backend should be listening on port ${API_PORT}."
echo "Your backend colleague should point Nginx /api to http://127.0.0.1:${API_PORT} (no AI nginx changes from this repo)."
echo "Health check: curl http://${DEPLOY_HOST}:${API_PORT}/api/health (or via /api/health after nginx is configured)."
