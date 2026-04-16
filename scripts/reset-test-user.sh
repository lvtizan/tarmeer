#!/bin/bash
# 重置测试账号 — 从生产 RDS 删除指定邮箱的所有数据
# 用法: bash scripts/reset-test-user.sh lvyiming@kp99.cn

EMAIL="${1:-lvyiming@kp99.cn}"
SSH_KEY=~/.ssh/tarmeer_ecs
SERVER=root@47.91.108.104

echo "→ 重置测试账号: $EMAIL"

ssh -i "$SSH_KEY" "$SERVER" bash <<EOF
  set -a
  source /tarmeer/tarmeer_api/.env
  set +a

  MYSQL="mysql -h\$DB_HOST -u\$DB_USER -p\$DB_PASSWORD \$DB_NAME -se"

  echo "删除前记录数:"
  echo "  users:            \$(\$MYSQL \"SELECT COUNT(*) FROM users WHERE email='$EMAIL'\")"
  echo "  company_profiles: \$(\$MYSQL \"SELECT COUNT(*) FROM company_profiles WHERE user_id IN (SELECT id FROM users WHERE email='$EMAIL')\")"
  echo "  designers:        \$(\$MYSQL \"SELECT COUNT(*) FROM designers WHERE email='$EMAIL'\")"
  echo "  company_leads:    \$(\$MYSQL \"SELECT COUNT(*) FROM company_leads WHERE contact_name IS NOT NULL\" 2>/dev/null || echo 0)"

  # Delete company_profiles via user_id FK (no email column in company_profiles)
  \$MYSQL "DELETE FROM company_profiles WHERE user_id IN (SELECT id FROM users WHERE email='$EMAIL')"
  \$MYSQL "DELETE FROM homeowner_profiles WHERE user_id IN (SELECT id FROM users WHERE email='$EMAIL')"
  # Unlink designers association before deleting user
  \$MYSQL "UPDATE designers SET user_id = NULL WHERE user_id IN (SELECT id FROM users WHERE email='$EMAIL')"
  \$MYSQL "DELETE FROM users WHERE email='$EMAIL'"
  # Also delete from designers table (legacy OAuth accounts without users row)
  \$MYSQL "DELETE FROM designers WHERE email='$EMAIL'"
  \$MYSQL "DELETE FROM company_leads WHERE phone IN (SELECT phone FROM users WHERE email='$EMAIL')" 2>/dev/null || true

  echo "✓ 删除完成，账号已重置"
EOF
