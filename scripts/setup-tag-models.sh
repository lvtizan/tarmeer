#!/bin/bash
# Pre-download CLIP model to cache on production server.
# Run once after deploying the new tag engine.
# Usage: bash scripts/setup-tag-models.sh
# First run downloads ~350MB (CLIP ViT-B/32). Subsequent runs are instant.
set -e

echo "[setup] Pre-warming CLIP model cache (~350MB on first run, may take 5 minutes)..."
cd "$(dirname "$0")/.."
cd server
node -e "
const { warmupClip } = require('./dist/services/tagEngine/onnxTagger');
warmupClip()
  .then(() => { console.log('[setup] Model ready.'); process.exit(0); })
  .catch(err => { console.error('[setup] Failed:', err); process.exit(1); });
"
