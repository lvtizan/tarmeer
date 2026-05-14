#!/usr/bin/env bash
# Test Mall→CRM: sync new email after partner changes email
# Usage: ./email-sync.sh [tenant_id] [new_email]
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

NEW_EMAIL="${2:-crm-dev-test-newemail@tarmeer.com}"

BODY=$(node -e "process.stdout.write(JSON.stringify({
  tenantId: '$TENANT_ID',
  newEmail: '$NEW_EMAIL'
}))")

TIMESTAMP=$(date +%s)
SIG=$(printf '%s\n%s' "$TIMESTAMP" "$BODY" | openssl dgst -sha256 -hmac "$HMAC_KEY" | awk '{print $NF}')

echo "→ POST $CRM_BASE/api/integration/mall/user/email-sync"
echo "  tenantId=$TENANT_ID  newEmail=$NEW_EMAIL"
echo ""

RESULT=$(curl -sf -X POST "$CRM_BASE/api/integration/mall/user/email-sync" \
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
echo "✓ PASS  email-sync accepted"
