#!/bin/bash
# Tarmeer 数据库数据同步脚本
# 用途：将本地数据库数据同步到线上RDS
# 用法：DEPLOY_SSH_PASSWORD='password' bash deploy-db-sync.sh

set -euo pipefail

echo "🚀 Tarmeer 数据库数据同步工具"
echo "=========================================="
echo ""

# 配置
SERVER_HOST="47.91.108.104"
SERVER_USER="root"
ECS_API_PATH="/tarmeer/tarmeer_api"

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

# SSH 密钥认证尝试
try_ssh_key_auth() {
  local key_path="$1"
  [[ -n "$key_path" ]] || return 1
  [[ -f "$key_path" ]] || return 1
  ssh -i "$key_path" -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_HOST}" "echo ok" >/dev/null 2>&1
}

# 检测认证方式
detect_auth_mode() {
  local key_path
  for key_path in "${SSH_KEY_CANDIDATES[@]}"; do
    if try_ssh_key_auth "$key_path"; then
      AUTH_MODE="key"
      SELECTED_SSH_KEY="$key_path"
      echo "✅ 检测到SSH密钥: $SELECTED_SSH_KEY"
      return 0
    fi
  done

  if [[ -n "$DEPLOY_SSH_PASSWORD" ]]; then
    AUTH_MODE="password"
    echo "✅ 使用密码认证"
    return 0
  fi

  echo "❌ 无法完成服务器认证:"
  echo "  - SSH密钥未找到（尝试过: ${SSH_KEY_CANDIDATES[*]}）"
  echo "  - 也未提供 DEPLOY_SSH_PASSWORD"
  echo ""
  echo "请使用以下方式之一:"
  echo "  1) export DEPLOY_SSH_KEY=~/.ssh/your_key && bash deploy-db-sync.sh"
  echo "  2) DEPLOY_SSH_PASSWORD='password' bash deploy-db-sync.sh"
  exit 1
}

run_ssh() {
  local remote_cmd="$1"
  if [[ "$AUTH_MODE" == "key" ]]; then
    ssh -i "$SELECTED_SSH_KEY" -o StrictHostKeyChecking=accept-new "${SERVER_USER}@${SERVER_HOST}" "$remote_cmd"
  else
    sshpass -p "$DEPLOY_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "${SERVER_USER}@${SERVER_HOST}" "$remote_cmd"
  fi
}

# 检测认证方式
echo "🔐 检测服务器认证方式..."
detect_auth_mode

# 检查本地SQL文件
if [[ ! -f "/tmp/sync-projects-final.sql" ]]; then
  echo "❌ 未找到 /tmp/sync-projects-final.sql"
  echo "请确保SQL文件已生成"
  exit 1
fi

echo "✅ SQL文件已准备: /tmp/sync-projects-final.sql"
echo "   大小: $(du -h /tmp/sync-projects-final.sql | cut -f1)"
echo ""

# 上传SQL文件到ECS
echo "📤 上传SQL文件到ECS..."
if [[ "$AUTH_MODE" == "key" ]]; then
  scp -i "$SELECTED_SSH_KEY" -o StrictHostKeyChecking=accept-new /tmp/sync-projects-final.sql "${SERVER_USER}@${SERVER_HOST}:/tmp/sync-projects.sql"
else
  sshpass -p "$DEPLOY_SSH_PASSWORD" scp -o StrictHostKeyChecking=no /tmp/sync-projects-final.sql "${SERVER_USER}@${SERVER_HOST}:/tmp/sync-projects.sql"
fi
echo "✅ 文件已上传"
echo ""

# 在ECS上执行部署
echo "🚀 在ECS上执行数据库同步..."
echo ""

REMOTE_SCRIPT=$(cat <<'REMOTESH'
#!/bin/bash
set -e

echo "📋 加载RDS配置..."
cd /tarmeer/tarmeer_api
source .env

echo "✅ RDS配置已加载"
echo "  主机: $DB_HOST"
echo "  用户: $DB_USER"
echo ""

echo "🔗 测试RDS连接..."
if mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" -e "SELECT 1;" > /dev/null 2>&1; then
  echo "✅ RDS连接成功"
else
  echo "❌ RDS连接失败"
  exit 1
fi
echo ""

echo "📤 上传项目数据到RDS..."
echo "（这可能需要 1-2 分钟）"
echo ""

mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" < /tmp/sync-projects.sql

echo ""
echo "✅ 数据上传成功！"
echo ""
echo "🔍 验证数据..."
mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" -D"$DB_NAME" << VERIFY
SELECT 
  CONCAT('项目 #', id) as '项目ID',
  title as '项目名称',
  ROUND(LENGTH(images)/(1024*1024), 2) as '大小(MB)',
  status as '状态',
  designer_id as '设计师ID'
FROM projects 
WHERE designer_id IN (2035, 2041)
ORDER BY id;
VERIFY

echo ""
echo "✅ 验证完成！"
echo ""
echo "📌 重启API服务..."
pm2 restart tarmeer-api

echo ""
echo "✅ API服务已重启"
echo ""
echo "📊 API日志（最后10行）："
pm2 logs tarmeer-api --lines 10

REMOTESH
)

run_ssh "$REMOTE_SCRIPT"

echo ""
echo "=========================================="
echo "✅ 数据库数据同步完成！"
echo "=========================================="
echo ""
echo "📌 后续步骤:"
echo "1. 清除浏览器缓存"
echo "2. 访问前端检查是否正常显示:"
echo "   https://designer.tarmeer.com"
echo ""
echo "🔍 如果前端仍无法显示，可以:"
echo "1. 检查API日志: ssh root@47.91.108.104 'pm2 logs tarmeer-api'"
echo "2. 测试API: curl https://designer.tarmeer.com/api/projects"
echo ""

