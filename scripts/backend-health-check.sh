#!/usr/bin/env bash
set -euo pipefail

echo "[backend-health] checking http://127.0.0.1:3002/api/health"
curl --noproxy '*' -i -sS "http://127.0.0.1:3002/api/health"
