#!/usr/bin/env bash
# 在 ECS 的 /tarmeer/tarmeer_api/.env 中追加阿里云邮件推送配置，并重启后端。
# 运行后需在 ECS 上执行 pm2 restart tarmeer-api（本脚本会尝试自动执行）。
# 用法：./scripts/set-ecs-env-smtp.sh

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

echo "Appending SMTP config to ${BACKEND_PATH}/.env and restarting backend..."
ssh $SSH_OPTS "${DEPLOY_USER}@${DEPLOY_HOST}" 'grep -q "^SMTP_HOST=" "'"${BACKEND_PATH}"'/.env" 2>/dev/null && echo "SMTP already in .env" || (echo ""; echo "# SMTP 阿里云邮件推送"; echo "SMTP_HOST=smtpdm.aliyun.com"; echo "SMTP_PORT=465"; echo "SMTP_SECURE=true"; echo "SMTP_USER=noreply@mail.kptom.com"; echo "SMTP_PASS=KPbec9f642d822488b"; echo "SMTP_FROM=noreply@mail.kptom.com") >> "'"${BACKEND_PATH}"'/.env"; cd "'"${BACKEND_PATH}"'" && pm2 restart tarmeer-api 2>/dev/null || true; echo Done.'
