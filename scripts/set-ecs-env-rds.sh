#!/usr/bin/env bash
# Set RDS env vars on ECS /tarmeer/tarmeer_api/.env and restart backend.
# Run from project root. Uses SSH (password or key).
# Usage: ./scripts/set-ecs-env-rds.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_HOST="${DEPLOY_HOST:-47.91.108.104}"
BACKEND_PATH="${BACKEND_PATH:-/tarmeer/tarmeer_api}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/tarmeer_ecs}"

SSH_OPTS="-p $SSH_PORT -o StrictHostKeyChecking=accept-new"
[[ -f "$SSH_KEY" ]] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"

# RDS connection (same as docs)
DB_HOST="rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com"
DB_PORT="3306"
DB_USER="tarmeerCRM"
DB_PASSWORD="Tarmeer2026@"
DB_NAME="tarmeer"

REMOTE_SCRIPT=$(cat << 'REMOTE'
cd BACKEND_PATH_PLACEHOLDER
# Remove old DB_ lines, keep rest
grep -v '^DB_' .env 2>/dev/null | grep -v '^$' > .env.bak || true
echo 'DB_HOST=rm-eb3t6y5093m91i2wzqo.mysql.dubai.rds.aliyuncs.com' >> .env.bak
echo 'DB_PORT=3306' >> .env.bak
echo 'DB_USER=tarmeerCRM' >> .env.bak
echo 'DB_PASSWORD=Tarmeer2026@' >> .env.bak
echo 'DB_NAME=tarmeer' >> .env.bak
mv .env.bak .env
pm2 restart tarmeer-api 2>/dev/null || true
echo "Done. .env updated, tarmeer-api restarted."
REMOTE
)
REMOTE_SCRIPT="${REMOTE_SCRIPT//BACKEND_PATH_PLACEHOLDER/$BACKEND_PATH}"

ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" "$REMOTE_SCRIPT"
