#!/bin/bash

set -euo pipefail

DOMAIN="${1:-kptom.com}"
MAIL_DOMAIN="${2:-mail.${DOMAIN}}"

echo "Email deliverability audit"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "Domain: ${DOMAIN}"
echo "Mail domain: ${MAIL_DOMAIN}"
echo

echo "[SPF] ${DOMAIN}"
dig +short TXT "${DOMAIN}" | sed 's/^/  /'
echo

echo "[SPF] ${MAIL_DOMAIN}"
dig +short TXT "${MAIL_DOMAIN}" | sed 's/^/  /'
echo

echo "[DMARC] _dmarc.${DOMAIN}"
dig +short TXT "_dmarc.${DOMAIN}" | sed 's/^/  /'
echo

echo "[DMARC] _dmarc.${MAIL_DOMAIN}"
dig +short TXT "_dmarc.${MAIL_DOMAIN}" | sed 's/^/  /'
echo

echo "[MX] ${DOMAIN}"
dig +short MX "${DOMAIN}" | sed 's/^/  /'
echo

echo "[A] ${MAIL_DOMAIN}"
dig +short A "${MAIL_DOMAIN}" | sed 's/^/  /'
echo

echo "[AAAA] ${MAIL_DOMAIN}"
dig +short AAAA "${MAIL_DOMAIN}" | sed 's/^/  /'
echo

echo "[Common Aliyun DKIM selectors to verify manually if configured]"
for selector in default dm mail tarmeer aliyun; do
  echo "  selector=${selector}"
  dig +short TXT "${selector}._domainkey.${DOMAIN}" | sed 's/^/    /'
done
