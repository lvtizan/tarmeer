#!/usr/bin/env bash
# Run on Aliyun server to create DB and tables.
# Usage:
#   cd /tarmeer/tarmeer_api && bash server/schema/init-db.sh
#   Or: MYSQL_PWD=yourpassword bash server/schema/init-db.sh
# If MYSQL_PWD is not set, mysql will prompt for password.

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_HOST="${MYSQL_HOST:-localhost}"
DB_NAME="${DB_NAME:-tarmeer}"

render_sql() {
  sed \
    -e "s/CREATE DATABASE IF NOT EXISTS tarmeer/CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`/g" \
    -e "s/USE tarmeer;/USE \`${DB_NAME}\`;/g" \
    "$1"
}

echo "Creating database $DB_NAME and base tables..."
render_sql "$SCRIPT_DIR/init.sql" | mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p

echo "Applying admin and migration schemas..."
render_sql "$SCRIPT_DIR/admin_tables.sql" | mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$DB_NAME"
render_sql "$SCRIPT_DIR/designer-title-migration.sql" | mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$DB_NAME"
render_sql "$SCRIPT_DIR/project-review-migration.sql" | mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$DB_NAME"
render_sql "$SCRIPT_DIR/avatar-url-migration.sql" | mysql -h "$MYSQL_HOST" -u "$MYSQL_USER" -p "$DB_NAME"

echo "Done. Database, tables, admin schema, and migrations are ready."
echo "Set DB_NAME=$DB_NAME and DB_USER/DB_PASSWORD in .env then restart: pm2 restart tarmeer-api"
