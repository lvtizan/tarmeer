#!/bin/bash
# Schema verification script for Tarmeer deployment
# Run this before deploying to check if database schema matches expected schema

set -e

echo "🔍 Tarmeer Schema Verification"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Read database config
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

# Expected schema (from server/schema/init.sql)
EXPECTED_SCHEMA=(
    "designers:avatar_url:MEDIUMTEXT"
    "projects:images:JSON"
)

SCHEMA_OK=true

echo "Checking critical fields..."
echo ""

for spec in "${EXPECTED_SCHEMA[@]}"; do
    IFS=':' read -r table column expected_type <<< "$spec"

    echo -n "Checking $table.$column... "

    # Get actual type from database
    actual_type=$(mysql -h"${DB_HOST}" -u"${DB_USER}" -p"${DB_PASS}" "${DB_NAME}" -sN -e "
        SELECT DATA_TYPE
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = '${DB_NAME}'
          AND TABLE_NAME = '${table}'
          AND COLUMN_NAME = '${column}';
    " 2>/dev/null)

    # Normalize types (case-insensitive comparison)
    actual_type_upper=$(echo "$actual_type" | tr '[:lower:]' '[:upper:]')
    expected_type_upper=$(echo "$expected_type" | tr '[:lower:]' '[:upper:]')

    if [ "$actual_type_upper" = "$expected_type_upper" ]; then
        echo -e "${GREEN}✓ OK${NC} (${actual_type})"
    else
        echo -e "${RED}✗ MISMATCH${NC}"
        echo "  Expected: ${expected_type}"
        echo "  Actual:   ${actual_type}"
        SCHEMA_OK=false
    fi
done

echo ""
echo "=============================="

if [ "$SCHEMA_OK" = true ]; then
    echo -e "${GREEN}✅ All schema checks passed${NC}"
    echo "Safe to proceed with deployment"
    exit 0
else
    echo -e "${RED}❌ Schema mismatch detected${NC}"
    echo ""
    echo "Please run the migration script first:"
    echo "  bash server/scripts/apply-migration.sh"
    echo ""
    echo "Or manually update the database:"
    echo "  mysql -h${DB_HOST} -u${DB_USER} -p ${DB_NAME} < server/schema/migration-2026-03-23-fix-image-fields.sql"
    exit 1
fi
