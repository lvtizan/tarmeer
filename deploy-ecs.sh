#!/usr/bin/env bash
# Deploy tarmeer-4.0 build to ECS
# Usage: ./deploy-ecs.sh
# You will be prompted for SSH password unless you use key-based auth.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ECS server (do not commit credentials to git)
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_HOST="${DEPLOY_HOST:-47.91.108.104}"
DEPLOY_PATH="${DEPLOY_PATH:-/tarmeer/tarmeer_web_portal}"
SSH_PORT="${SSH_PORT:-22}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/tarmeer_ecs}"

echo "Building..."
npm run build

echo "Deploying dist/ to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH} (port ${SSH_PORT})..."
SSH_OPTS="-p $SSH_PORT -o StrictHostKeyChecking=accept-new"
[[ -f "$SSH_KEY" ]] && SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" "mkdir -p ${DEPLOY_PATH} && rm -rf ${DEPLOY_PATH}/*"
scp -r -P "$SSH_PORT" -o StrictHostKeyChecking=no ${SSH_KEY:+-i "$SSH_KEY"} dist/* "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "Done. Site should be live at the path your web server uses for ${DEPLOY_PATH}."
