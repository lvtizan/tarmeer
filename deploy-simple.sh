#!/bin/bash
# Tarmeer 网站快速部署脚本
# 给 CodeX 使用

set -euo pipefail

RULES_FILE="docs/operations/deploy-safety-workflow.md"

# 部署前强制阅读规则
if [[ "${DEPLOY_RULES_ACK:-}" != "YES" ]]; then
  echo "❌ 部署已阻止：请先阅读规则文件 ${RULES_FILE}"
  echo "阅读后使用以下命令重新执行："
  echo "DEPLOY_RULES_ACK=YES bash deploy-simple.sh"
  echo ""
  sed -n '1,80p' "${RULES_FILE}"
  exit 1
fi

echo "🚀 开始部署 Tarmeer 网站..."

# 服务器配置
SERVER_HOST="47.91.108.104"
SERVER_USER="root"
DEPLOY_PATH="/tarmeer/tarmeer_web_portal"

# 认证配置
SSH_KEY_CANDIDATES=(
  "${DEPLOY_SSH_KEY:-}"
  "$HOME/.ssh/mastery_github"
  "$HOME/.ssh/id_ed25519"
  "$HOME/.ssh/id_rsa"
)
DEPLOY_SSH_PASSWORD="${DEPLOY_SSH_PASSWORD:-}"
AUTH_MODE=""
SELECTED_SSH_KEY=""
RSYNC_FLAGS=(
  -az
  --delete
  --checksum
  --itemize-changes
  --stats
  --human-readable
  --exclude=.DS_Store
)

try_ssh_key_auth() {
  local key_path="$1"
  [[ -n "$key_path" ]] || return 1
  [[ -f "$key_path" ]] || return 1
  ssh -i "$key_path" -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_HOST}" "echo ok" >/dev/null 2>&1
}

detect_auth_mode() {
  local key_path
  for key_path in "${SSH_KEY_CANDIDATES[@]}"; do
    if try_ssh_key_auth "$key_path"; then
      AUTH_MODE="key"
      SELECTED_SSH_KEY="$key_path"
      return 0
    fi
  done

  if [[ -n "$DEPLOY_SSH_PASSWORD" ]]; then
    AUTH_MODE="password"
    return 0
  fi

  echo "❌ 无法完成服务器认证："
  echo "- 已尝试 SSH key: ${SSH_KEY_CANDIDATES[*]}"
  echo "- 也未提供 DEPLOY_SSH_PASSWORD"
  echo ""
  echo "请设置其一后重试："
  echo "1) export DEPLOY_SSH_KEY=~/.ssh/your_key"
  echo "2) export DEPLOY_SSH_PASSWORD='your_password'"
  exit 1
}

run_ssh() {
  local remote_cmd="$1"
  if [[ "$AUTH_MODE" == "key" ]]; then
    ssh -i "$SELECTED_SSH_KEY" -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_HOST}" "$remote_cmd"
  else
    /usr/bin/expect -c "set timeout 600; spawn ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_HOST} \"$remote_cmd\"; expect \"password:\"; send \"$DEPLOY_SSH_PASSWORD\r\"; expect eof"
  fi
}

run_rsync_to_remote() {
  local local_path="$1"
  local remote_path="$2"

  if [[ ! -d "$local_path" ]]; then
    echo "❌ 增量部署失败：本地目录不存在 -> $local_path"
    exit 1
  fi

  if [[ "$AUTH_MODE" == "key" ]]; then
    rsync "${RSYNC_FLAGS[@]}" -e "ssh -i $SELECTED_SSH_KEY -o StrictHostKeyChecking=accept-new" "$local_path" "${SERVER_USER}@${SERVER_HOST}:${remote_path}"
  else
    /usr/bin/expect -c "set timeout 1200; spawn rsync -az --delete --checksum --itemize-changes --stats --human-readable --exclude=.DS_Store -e \"ssh -o StrictHostKeyChecking=no\" $local_path ${SERVER_USER}@${SERVER_HOST}:${remote_path}; expect \"password:\"; send \"$DEPLOY_SSH_PASSWORD\r\"; expect eof"
  fi
}

echo "🔐 检测服务器认证方式..."
detect_auth_mode
if [[ "$AUTH_MODE" == "key" ]]; then
  echo "✅ 使用 SSH key 认证: $SELECTED_SSH_KEY"
else
  echo "✅ 使用密码认证回退通道（expect）"
fi

# 1. 构建项目
echo "📦 步骤 1/3: 构建项目..."
npm run build

# 2. 增量同步文件（仅增量部署，按内容校验）
echo "📤 步骤 2/3: 增量同步文件到服务器..."
run_rsync_to_remote "dist/" "${DEPLOY_PATH}/"

# 3. 统一权限并重载 Nginx
echo "🔐 步骤 3/3: 统一权限并重载 Nginx..."
run_ssh "find ${DEPLOY_PATH} -type d -exec chmod 755 {} + && find ${DEPLOY_PATH} -type f -exec chmod 644 {} + && nginx -t && systemctl reload nginx"

# 4. 基础可用性检查
echo "🩺 校验线上可用性..."
curl -sS -I https://www.tarmeer.com | head -n 1
curl -sS -I https://www.tarmeer.com/images/designers/avatars/omar-farouk.jpg | head -n 1

echo "✅ 部署完成！"
echo "🌐 访问: https://www.tarmeer.com"
