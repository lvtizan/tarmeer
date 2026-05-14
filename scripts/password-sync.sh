#!/usr/bin/env bash
# Test Mall→CRM: sync password hash after partner changes password
# Usage: ./password-sync.sh [tenant_id]
#   If tenant_id is omitted, reads /tmp/crm-test-tenant.txt (set by test-provision.sh)
#
# Prerequisites:
#   export MALL_INTEGRATION_SECRET=<shared secret>
#   export CRM_BASE_URL=http://localhost:3000
set -euo pipefail

CRM_BASE="${CRM_BASE_URL:-http://localhost:3000}"
HMAC_KEY="${MALL_INTEGRATION_SECRET:?Set MALL_INTEGRATION_SECRET first}"

if [ -n "${1:-}" ]; then
  TENANT_ID="$1"
elif [ -f /tmp/crm-test-tenant.txt ]; then
  TENANT_ID=$(cat /tmp/crm-test-tenant.txt)
else
  echo "✗ No tenantId provided and /tmp/crm-test-tenant.txt not found"
  echo "  Run test-provision.sh first"
  exit 1
fi

# bcrypt hash of "TestPassword123!" — safe dummy hash for integration testing
DUMMY_HASH='$2b$10$abcdefghijklmnopqrstuvuGx3.Hf3qFQc3aFPM6RCDjn6mNxiE7i'

BODY=$(node -e "process.stdout.write(JSON.stringify({
  tenantId: '$TENANT_ID',
  passwordHash: '$DUMMY_HASH'
}))")

TIMESTAMP=$(date +%s)
SIG=$(printf '%s\n%s' "$TIMESTAMP" "$BODY" | openssl dgst -sha256 -hmac "$HMAC_KEY" | awk '{print $NF}')

echo "→ POST $CRM_BASE/api/integration/mall/user/password-sync"
echo "  tenantId=$TENANT_ID"
echo ""

RESULT=$(curl -sf -X POST "$CRM_BASE/api/integration/mall/user/password-sync" \
  -H "Content-Type: application/json" \
  -H "X-Mall-Timestamp: $TIMESTAMP" \
  -H "X-Mall-Signature: $SIG" \
  -d "$BODY" 2>&1) || {
  echo "✗ Request failed:"
  echo "$RESULT"
  exit 1
}

echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"

CODE=$(echo "$RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const r=JSON.parse(d);console.log(r.code!==undefined?r.code:(r.ok?0:1))}catch{console.log(1)}})" 2>/dev/null || echo "1")

if [ "$CODE" != "0" ]; then
  echo ""
  echo "✗ FAIL: response code=$CODE"
  exit 1
fi

echo ""
echo "✓ PASS  password-sync accepted"
