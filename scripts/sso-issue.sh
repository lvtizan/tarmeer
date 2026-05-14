#!/usr/bin/env bash
# Test Mall→CRM: issue SSO consume URL for a partner user
# Usage: ./sso-issue.sh [tenant_id] [admin_email]
#   If tenant_id is omitted, reads /tmp/crm-test-tenant.txt (set by test-provision.sh)
#
# Prerequisites:
#   export MALL_INTEGRATION_SECRET=<shared secret>
#   export CRM_BASE_URL=http://localhost:3000
#
# On success, prints consumeUrl — paste into browser or test with curl to verify SSO flow
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

EMAIL="${2:-crm-dev-test@tarmeer.com}"

BODY=$(node -e "process.stdout.write(JSON.stringify({
  tenantId: '$TENANT_ID',
  adminEmail: '$EMAIL'
}))")

TIMESTAMP=$(date +%s)
SIG=$(printf '%s\n%s' "$TIMESTAMP" "$BODY" | openssl dgst -sha256 -hmac "$HMAC_KEY" | awk '{print $NF}')

echo "→ POST $CRM_BASE/api/integration/mall/sso/issue"
echo "  tenantId=$TENANT_ID  adminEmail=$EMAIL"
echo ""

RESULT=$(curl -sf -X POST "$CRM_BASE/api/integration/mall/sso/issue" \
  -H "Content-Type: application/json" \
  -H "X-Mall-Timestamp: $TIMESTAMP" \
  -H "X-Mall-Signature: $SIG" \
  -d "$BODY" 2>&1) || {
  echo "✗ Request failed:"
  echo "$RESULT"
  exit 1
}

echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"

CONSUME_URL=$(echo "$RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).consumeUrl||'')}catch{}})" 2>/dev/null || true)

if [ -z "$CONSUME_URL" ]; then
  echo ""
  echo "✗ FAIL: consumeUrl missing from response"
  exit 1
fi

echo ""
echo "✓ PASS  consumeUrl=$CONSUME_URL"
echo ""
echo "Next: open the consumeUrl in a browser (or follow the redirect with curl -L)"
echo "      to verify the SSO handoff lands on Mall dashboard"
