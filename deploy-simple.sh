#!/bin/bash
# Tarmeer 网站快速部署脚本
# 给 CodeX 使用
#
# 重要：文件权限修复
# - rsync 后自动修复文件权限为 644（文件）和 755（目录）
# - 部署后验证头像文件返回 200（不是 403）
# - 历史问题：2026-03-26 头像因 600 权限导致 403 Forbidden

set -euo pipefail

RULES_FILE="docs/operations/deploy-safety-workflow.md"

ensure_rules_file() {
  if [[ ! -f "${RULES_FILE}" ]]; then
    echo "❌ 部署已阻止：规则文件不存在 -> ${RULES_FILE}"
    echo "请先创建规则文件后再执行发布。"
    exit 1
  fi
}

print_rules_digest() {
  echo ""
  echo "📘 发布规则摘要（完整规则见 ${RULES_FILE}）"
  sed -n '1,120p' "${RULES_FILE}"
  echo ""
}

require_rules_ack() {
  if [[ "${DEPLOY_RULES_ACK:-}" != "YES" ]]; then
    echo "❌ 部署已阻止：请先阅读并确认规则文件 ${RULES_FILE}"
    echo "阅读后使用以下命令重新执行："
    echo "DEPLOY_RULES_ACK=YES DEPLOY_USER_APPROVED=YES bash deploy-simple.sh"
    print_rules_digest
    exit 1
  fi
}

require_user_approval() {
  if [[ "${DEPLOY_USER_APPROVED:-}" == "YES" ]]; then
    return 0
  fi

  echo "🛑 发布前确认：是否已得到用户明确批准发布？"
  if [[ -t 0 ]]; then
    local answer
    read -r -p "输入 YES 继续发布，其它任意内容取消: " answer
    if [[ "${answer}" != "YES" ]]; then
      echo "❌ 已取消发布。"
      exit 1
    fi
    return 0
  fi

  echo "❌ 非交互环境下未检测到发布批准。"
  echo "请在命令中显式添加：DEPLOY_USER_APPROVED=YES"
  exit 1
}

validate_remote_assets() {
  echo "🩺 校验线上资源可用性..."
  local refs=()
  while IFS= read -r ref; do
    refs+=("$ref")
  done < <(grep -oE '/assets/[A-Za-z0-9._-]+\.(js|css)' dist/index.html | sort -u)

  if [[ ${#refs[@]} -eq 0 ]]; then
    echo "❌ 未在 dist/index.html 中找到资产引用，停止发布。"
    exit 1
  fi

  local ref
  local code
  for ref in "${refs[@]}"; do
    code=$(curl -sS -o /dev/null -w "%{http_code}" "https://www.tarmeer.com${ref}")
    if [[ "${code}" != "200" ]]; then
      echo "❌ 资源校验失败：${ref} -> HTTP ${code}"
      exit 1
    fi
    echo "✓ ${ref} -> HTTP 200"
  done
}

ensure_rules_file
require_rules_ack
require_user_approval

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
  --checksum
  --itemize-changes
  --stats
  --human-readable
  --exclude=.DS_Store
  --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r
)
# Note: --delete removed intentionally. Keeps old chunk files on server so users
# with stale browser tabs can still lazy-load their cached bundles after a deploy.
# This prevents the annoying "A new version is available" prompt.

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
    /usr/bin/expect << EXPECT_EOF
set timeout 1200
spawn rsync -az --delete --checksum --itemize-changes --stats --human-readable --exclude=.DS_Store -e {ssh -o StrictHostKeyChecking=no} $local_path ${SERVER_USER}@${SERVER_HOST}:${remote_path}
expect "password:"
send "${DEPLOY_SSH_PASSWORD}\r"
expect eof
lassign [wait] pid spawnid os_error_flag value
exit \$value
EXPECT_EOF
  fi
}

run_scp_to_remote() {
  local local_file="$1"
  local remote_path="$2"
  if [[ "$AUTH_MODE" == "key" ]]; then
    scp -i "$SELECTED_SSH_KEY" -o StrictHostKeyChecking=accept-new "$local_file" "${SERVER_USER}@${SERVER_HOST}:${remote_path}"
  else
    /usr/bin/expect << EXPECT_EOF
set timeout 120
spawn scp -o StrictHostKeyChecking=no $local_file ${SERVER_USER}@${SERVER_HOST}:${remote_path}
expect "password:"
send "${DEPLOY_SSH_PASSWORD}\r"
expect eof
lassign [wait] pid spawnid os_error_flag value
exit \$value
EXPECT_EOF
  fi
}

echo "🔐 检测服务器认证方式..."
detect_auth_mode
if [[ "$AUTH_MODE" == "key" ]]; then
  echo "✅ 使用 SSH key 认证: $SELECTED_SSH_KEY"
else
  echo "✅ 使用密码认证回退通道（expect）"
fi

# Schema验证 - 部署前检查数据库字段类型
echo ""
if [[ "${SKIP_SCHEMA_CHECK:-}" == "YES" ]]; then
  echo "⏭️ 步骤 0/4: 已跳过数据库Schema验证（SKIP_SCHEMA_CHECK=YES）"
else
  echo "🔍 步骤 0/4: 验证数据库Schema..."
  SCHEMA_CHECK_OUTPUT=$(run_ssh "cd /tarmeer/tarmeer_api && bash server/scripts/verify-schema.sh 2>&1" || true)

  if echo "$SCHEMA_CHECK_OUTPUT" | grep -q "✅ All schema checks passed"; then
      echo "✓ Schema验证通过"
  else
      echo "❌ Schema验证失败"
      echo ""
      echo "$SCHEMA_CHECK_OUTPUT"
      echo ""
      echo "数据库Schema不匹配，需要先运行迁移脚本"
      echo "请联系系统管理员执行以下命令："
      echo "  ssh ${SERVER_USER}@${SERVER_HOST} 'cd /tarmeer/tarmeer_api && bash server/scripts/apply-migration.sh'"
      echo ""
      echo "或者手动执行SQL迁移："
      echo "  ssh ${SERVER_USER}@${SERVER_HOST} 'mysql -u root -p tarmeer < /tarmeer/tarmeer_api/server/schema/migration-2026-03-23-fix-image-fields.sql'"
      exit 1
  fi
fi

# 0. 同步最新代码（防止覆盖他人已推送的热修复）
echo "🔄 步骤 0/3: 同步最新代码..."
if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️  检测到未提交的本地修改："
  git status --short
  if [[ "${ALLOW_DIRTY_DEPLOY:-NO}" != "YES" ]]; then
    echo ""
    echo "❌ 部署已阻止：请先提交或 stash 本地修改"
    echo "强制部署（不推荐）：ALLOW_DIRTY_DEPLOY=YES"
    exit 1
  fi
  echo "⏭️  ALLOW_DIRTY_DEPLOY=YES，跳过脏工作区检查"
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "当前分支: ${CURRENT_BRANCH}"
git fetch origin "${CURRENT_BRANCH}"
git fetch origin main 2>/dev/null || true

# ── 防覆盖检查：main 有未合并的 commit 时必须先 merge ──────────────────────────
MAIN_BEHIND=$(git rev-list --count "HEAD..origin/main" 2>/dev/null || echo 0)
if [[ "${MAIN_BEHIND}" -gt 0 ]]; then
  echo ""
  echo "❌ 部署已阻止：origin/main 有 ${MAIN_BEHIND} 个 commit 不在当前分支"
  git log --oneline "HEAD..origin/main" | head -10
  echo ""
  echo "请先执行：git merge origin/main"
  echo "解决冲突后再重新部署，否则会覆盖其他人的工作"
  exit 1
fi

LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse "origin/${CURRENT_BRANCH}")
if [[ "${LOCAL_SHA}" != "${REMOTE_SHA}" ]]; then
  BEHIND=$(git rev-list --count "HEAD..origin/${CURRENT_BRANCH}")
  AHEAD=$(git rev-list --count "origin/${CURRENT_BRANCH}..HEAD")
  if [[ "${BEHIND}" -gt 0 ]]; then
    echo "📥 本地落后远端 ${BEHIND} 个 commit，执行 git pull..."
    git pull --ff-only origin "${CURRENT_BRANCH}"
  fi
  if [[ "${AHEAD}" -gt 0 ]]; then
    echo "📤 本地领先远端 ${AHEAD} 个 commit，建议先 push"
    if [[ "${ALLOW_UNPUSHED_DEPLOY:-NO}" != "YES" ]]; then
      echo "❌ 部署已阻止：请先 git push 把本地 commit 推到远端"
      echo "强制部署（不推荐）：ALLOW_UNPUSHED_DEPLOY=YES"
      exit 1
    fi
    echo "⏭️  ALLOW_UNPUSHED_DEPLOY=YES，跳过未推送检查"
  fi
fi
echo "✓ 代码已是最新，main 已合并"
echo ""

# 0. Bump release version (patch +1; every 50 patch releases carry to minor)
CURRENT_VER=$(node -p "require('./package.json').version")
IFS='.' read -r V_MAJOR V_MINOR V_PATCH <<< "$CURRENT_VER"
V_PATCH=$((V_PATCH + 1))
if [[ "${V_PATCH}" -ge 50 ]]; then
  V_MINOR=$((V_MINOR + (V_PATCH / 50)))
  V_PATCH=$((V_PATCH % 50))
fi
NEW_VER="${V_MAJOR}.${V_MINOR}.${V_PATCH}"
echo "🔖 版本号：${CURRENT_VER} → ${NEW_VER}"
npm version "$NEW_VER" --no-git-tag-version --allow-same-version
git add package.json package-lock.json 2>/dev/null || true
git commit -m "chore: bump version to ${NEW_VER}" --allow-empty
git tag -a "v${NEW_VER}" -m "Release v${NEW_VER}"
echo "✓ 已打 tag v${NEW_VER}"
echo ""

# 0.5 Push current branch tip to main (keep main in sync with what's deployed)
if [[ "${CURRENT_BRANCH}" != "main" ]]; then
  echo "🔀 同步到 main 分支..."
  if git push origin "HEAD:main" --no-verify 2>/dev/null; then
    echo "✓ main 已同步（fast-forward）"
  else
    echo "⚠️  main 无法 fast-forward（可能有 main 上的独立提交），跳过自动同步"
    echo "   请手动执行：git checkout main && git merge ${CURRENT_BRANCH}"
  fi
  echo ""
fi

# 1. 构建项目
echo "📦 步骤 1/3: 构建项目..."
npm run build

# 2. 增量同步文件（仅增量部署，按内容校验）
echo "📤 步骤 2/3: 增量同步文件到服务器..."
run_rsync_to_remote "dist/" "${DEPLOY_PATH}/"

# index.html 强制覆盖（rsync --checksum 在文件大小相同时可能跳过，导致旧版本残留）
echo "🔄 强制覆盖 index.html..."
run_scp_to_remote "dist/index.html" "${DEPLOY_PATH}/index.html"
# 3. 统一权限（默认禁止任何 Nginx 操作）
echo "🔐 步骤 3/3: 统一权限..."
if [[ "${ALLOW_NGINX_ACTIONS:-NO}" == "YES" ]]; then
  echo "⚠️ 已显式开启 Nginx 操作：执行 nginx -t 与 reload"
  run_ssh "find ${DEPLOY_PATH} -type d -exec chmod 755 {} + && find ${DEPLOY_PATH} -type f -exec chmod 644 {} + && nginx -t && systemctl reload nginx"
else
  echo "🛡️ 按规则跳过 Nginx 命令（未设置 ALLOW_NGINX_ACTIONS=YES）"
  run_ssh "find ${DEPLOY_PATH} -type d -exec chmod 755 {} + && find ${DEPLOY_PATH} -type f -exec chmod 644 {} +"
fi

# 4. 基础可用性检查
echo "🩺 校验线上页面可用性..."
HOMEPAGE_CODE=$(curl -sS -o /dev/null -w "%{http_code}" https://www.tarmeer.com)
if [[ "${HOMEPAGE_CODE}" != "200" ]]; then
  echo "❌ 首页校验失败：HTTP ${HOMEPAGE_CODE}"
  exit 1
fi
echo "✓ 首页 -> HTTP 200"

# 头像文件权限检查（防止 403 Forbidden）
AVATAR_CODE=$(curl -sS -o /dev/null -w "%{http_code}" https://www.tarmeer.com/images/designers/avatars/omar-farouk.jpg)
if [[ "${AVATAR_CODE}" != "200" ]]; then
  echo "❌ 头像校验失败：/images/designers/avatars/omar-farouk.jpg -> HTTP ${AVATAR_CODE}"
  echo "提示：这通常是文件权限问题（600 vs 644），请检查服务器文件权限"
  exit 1
fi
echo "✓ 头像文件 -> HTTP 200"

validate_remote_assets

echo "✅ 部署完成！"
echo "🌐 访问: https://www.tarmeer.com"
