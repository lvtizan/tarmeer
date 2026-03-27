#!/bin/bash
# Safe database migration script for Tarmeer image fields fix
# Usage: bash server/scripts/apply-migration.sh

set -e  # Exit on error

echo "🔧 Tarmeer Database Migration - Image Fields Fix"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're on the server
if [ ! -f "/tarmeer/tarmeer_api/package.json" ]; then
    echo -e "${RED}❌ Error: This script must be run on the production server${NC}"
    echo "Expected path: /tarmeer/tarmeer_api/"
    exit 1
fi

cd /tarmeer/tarmeer_api

echo -e "${YELLOW}📋 Step 1: Backup current database${NC}"
echo "Creating backup before migration..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tarmeer/backups/tarmeer_before_migration_${TIMESTAMP}.sql"

mkdir -p /tarmeer/backups

# Read database config from .env or use defaults
if [ -f ".env" ]; then
    source .env
    DB_HOST=${DB_HOST:-"localhost"}
    DB_USER=${DB_USER:-"root"}
    DB_PASS=${DB_PASSWORD:-""}
    DB_NAME=${DB_NAME:-"tarmeer"}
else
    echo -e "${RED}❌ Error: .env file not found${NC}"
    exit 1
fi

echo "Database: ${DB_NAME}"
echo "Backup to: ${BACKUP_FILE}"

# Create backup
mysqldump -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" > "${BACKUP_FILE}" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backup created successfully${NC}"
    ls -lh "${BACKUP_FILE}"
else
    echo -e "${RED}❌ Backup failed, aborting migration${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 Step 2: Check current schema${NC}"

# Check current field types
echo "Current avatar_url field type:"
mysql -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -e "
SELECT COLUMN_TYPE FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '${DB_NAME}'
  AND TABLE_NAME = 'designers'
  AND COLUMN_NAME = 'avatar_url';
" 2>/dev/null

echo ""
echo "Current images field type:"
mysql -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -e "
SELECT COLUMN_TYPE FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '${DB_NAME}'
  AND TABLE_NAME = 'projects'
  AND COLUMN_NAME = 'images';
" 2>/dev/null

echo ""
echo -e "${YELLOW}📋 Step 3: Apply migration${NC}"

# Apply the migration
if [ -f "server/schema/migration-2026-03-23-fix-image-fields.sql" ]; then
    mysql -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" < server/schema/migration-2026-03-23-fix-image-fields.sql 2>/dev/null

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migration applied successfully${NC}"
    else
        echo -e "${RED}❌ Migration failed, restoring backup...${NC}"
        mysql -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" < "${BACKUP_FILE}" 2>/dev/null
        echo -e "${YELLOW}⚠️  Backup restored from: ${BACKUP_FILE}${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Migration file not found${NC}"
    echo "Expected: server/schema/migration-2026-03-23-fix-image-fields.sql"
    exit 1
fi

echo ""
echo -e "${YELLOW}📋 Step 4: Verify migration${NC}"

# Verify the changes
mysql -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -e "
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = '${DB_NAME}'
  AND TABLE_NAME IN ('designers', 'projects')
  AND COLUMN_NAME IN ('avatar_url', 'images')
ORDER BY TABLE_NAME, COLUMN_NAME;
" 2>/dev/null

echo ""
echo -e "${GREEN}✅ Migration completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Test avatar upload in designer dashboard"
echo "2. Test project image upload"
echo "3. Verify images display correctly in admin panel"
echo ""
echo "Backup saved at: ${BACKUP_FILE}"
echo "Keep this backup until you've verified everything works."
