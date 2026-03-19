#!/usr/bin/env bash
# Run init.sql against Aliyun RDS. Set env vars or pass connection string.
# Example (from project root):
#   DB_HOST=rm-xxx.mysql.dubai.rds.aliyuncs.com DB_USER=tarmeerCRM DB_PASSWORD='Tarmeer2026@' DB_NAME=tarmeer bash server/schema/run-init-rds.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-tarmeer}"

render_sql() {
  sed \
    -e "s/CREATE DATABASE IF NOT EXISTS tarmeer/CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`/g" \
    -e "s/USE tarmeer;/USE \`${DB_NAME}\`;/g" \
    "$1"
}

if [[ -z "$DB_HOST" || -z "$DB_USER" ]]; then
  echo "Usage: DB_HOST=rm-xxx.mysql.dubai.rds.aliyuncs.com DB_USER=tarmeerCRM DB_PASSWORD='yourpass' DB_NAME=tarmeer $0"
  exit 1
fi

echo "Creating database and base tables on $DB_HOST (database: $DB_NAME)..."
export MYSQL_PWD="$DB_PASSWORD"
render_sql "$SCRIPT_DIR/init.sql" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER"
render_sql "$SCRIPT_DIR/admin_tables.sql" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME"
render_sql "$SCRIPT_DIR/designer-title-migration.sql" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME"
render_sql "$SCRIPT_DIR/project-review-migration.sql" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME"
render_sql "$SCRIPT_DIR/avatar-url-migration.sql" | mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME"
unset MYSQL_PWD
echo "Done. Base schema, admin schema, and migrations are applied."
echo "Set the same DB_* and JWT_SECRET in /tarmeer/tarmeer_api/.env on ECS, then pm2 restart tarmeer-api."
