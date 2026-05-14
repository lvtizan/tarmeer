#!/usr/bin/env bash
# Test Mall→CRM: provision a partner
# Usage: ./test-provision.sh [partner_id] [admin_email]
#
# Prerequisites:
#   export MALL_INTEGRATION_SECRET=<shared secret>
#   export CRM_BASE_URL=http://localhost:3000  (or ngrok URL)
#
# Output: saves tenantId to /tmp/crm-test-tenant.txt for use by other scripts
set -euo pipefail

CRM_BASE="${CRM_BASE_URL:-http://localhost:3000}"
HMAC_KEY="${MALL_INTEGRATION_SECRET:?Set MALL_INTEGRATION_SECRET first}"

PARTNER_ID="${1:-9001}"
EMAIL="${2:-crm-dev-test@tarmeer.com}"

BODY=$(node -e "process.stdout.write(JSON.stringify({
  mallPartnerId: '$PARTNER_ID',
  partnerName: 'Dev Test Company',
  adminEmail: '$EMAIL',
  adminPasswordHash: null,
  adminGoogleId: null,
  adminName: 'Dev Tester',
  adminPhone: '+971501234567',
  companyName: 'Dev Test Company LLC',
  businessType: 'interior_designer',
  city: 'Dubai',
  address: 'Test Address, Dubai',
  tradeRegistrationNo: 'TEST-0000001',
  website: 'https://test.tarmeer.com',
  description: 'Integration test company — safe to delete',
  emiratesServed: ['Dubai'],
  services: ['Interior Design', 'Fit-Out']
}))")

TIMESTAMP=$(date +%s)
SIG=$(printf '%s\n%s' "$TIMESTAMP" "$BODY" | openssl dgst -sha256 -hmac "$HMAC_KEY" | awk '{print $NF}')

echo "→ POST $CRM_BASE/api/integration/mall/partner/provision"
echo "  mallPartnerId=$PARTNER_ID  adminEmail=$EMAIL"
echo ""

RESULT=$(curl -sf -X POST "$CRM_BASE/api/integration/mall/partner/provision" \
  -H "Content-Type: application/json" \
  -H "X-Mall-Timestamp: $TIMESTAMP" \
  -H "X-Mall-Signature: $SIG" \
  -d "$BODY" 2>&1) || {
  echo "✗ Request failed:"
  echo "$RESULT"
  exit 1
}

echo "$RESULT" | python3 -m json.tool 2>/dev/null || echo "$RESULT"

TENANT_ID=$(echo "$RESULT" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).tenantId||'')}catch{}})" 2>/dev/null || true)

if [ -z "$TENANT_ID" ]; then
  echo ""
  echo "✗ FAIL: tenantId missing from response"
  exit 1
fi

echo "$TENANT_ID" > /tmp/crm-test-tenant.txt
echo ""
echo "✓ PASS  tenantId=$TENANT_ID  (saved to /tmp/crm-test-tenant.txt)"
