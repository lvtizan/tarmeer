#!/bin/bash
# PostToolUse hook: run tsc after editing TS/TSX files
f=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
if echo "$f" | grep -qE '\.(ts|tsx)$'; then
  cd /Users/kp/Code/tarmeer-4.0-local && npx tsc --noEmit --skipLibCheck 2>&1 | head -20
fi
