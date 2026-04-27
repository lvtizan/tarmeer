#!/usr/bin/env bash
# Stop hook: runs tsc check when src/ code was changed this session.
# Outputs JSON for Claude Code hook system.
# Exit 0 = pass, Exit 2 = fail (asyncRewake wakes Claude with error context).

SENTINEL=/tmp/tarmeer-check-needed

# Only run if a TS/TSX file was edited this session
[ -f "$SENTINEL" ] || exit 0
rm -f "$SENTINEL"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

OUT=$("$ROOT/node_modules/.bin/tsc" --noEmit --skipLibCheck 2>&1)
CODE=$?

if [ $CODE -eq 0 ]; then
  jq -cn '{"systemMessage":"✅ tsc 0 errors — 代码检查通过，可以运行 harness 并通知用户"}'
  exit 0
else
  TRIMMED=$(printf '%s' "$OUT" | head -40)
  jq -cn --arg m "$TRIMMED" \
    '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":("⛔ tsc 失败，请修复后再通知用户：\n" + $m)}}'
  exit 2
fi
