#!/usr/bin/env bash
# Stop hook: runs tsc check when src/ code was changed this session,
# then runs the pending harness (if registered), then notifies user.
#
# Outputs JSON for Claude Code hook system.
# Exit 0 = pass, Exit 2 = fail (asyncRewake wakes Claude with error context).
#
# Harness registration: write harness path to /tmp/tarmeer-pending-harness.txt
# before stopping. Claude does this as part of Feature Completion Workflow.

SENTINEL=/tmp/tarmeer-check-needed
HARNESS_FILE=/tmp/tarmeer-pending-harness.txt

# Run if TS code was changed OR if a harness is pending
[ -f "$SENTINEL" ] || [ -f "$HARNESS_FILE" ] || exit 0

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# ── Step 1: tsc (only when TS files were changed) ──────────────────────────
if [ -f "$SENTINEL" ]; then
  rm -f "$SENTINEL"
  OUT=$(cd "$ROOT" && "$ROOT/node_modules/.bin/tsc" --noEmit --skipLibCheck 2>&1)
  CODE=$?
  if [ $CODE -ne 0 ]; then
    TRIMMED=$(printf '%s' "$OUT" | head -40)
    jq -cn --arg m "$TRIMMED" \
      '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":("⛔ tsc 失败，请修复后再通知用户：\n" + $m)}}'
    exit 2
  fi
fi

# ── Step 2: harness (if registered) ────────────────────────────────────────
if [ -f "$HARNESS_FILE" ]; then
  HARNESS=$(tr -d '[:space:]' < "$HARNESS_FILE")

  if [ ! -f "$HARNESS" ]; then
    rm -f "$HARNESS_FILE"
    jq -cn --arg h "$HARNESS" \
      '{"systemMessage":("⚠️ Harness 文件不存在: " + $h + "，已清除")}'
    exit 0
  fi

  # Kill any existing server on port 3099 so harness can start fresh
  lsof -ti:3099 | xargs kill -9 2>/dev/null || true
  sleep 1

  OUT=$(node "$HARNESS" 2>&1)
  CODE=$?

  if [ $CODE -ne 0 ]; then
    # Keep harness file — Claude must fix and retry
    TRIMMED=$(printf '%s' "$OUT" | tail -60)
    jq -cn --arg m "$TRIMMED" \
      '{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":("⛔ Harness 失败，请修复后重试：\n" + $m)}}'
    exit 2
  fi

  # All passed — clear file, macOS notification, systemMessage
  rm -f "$HARNESS_FILE"
  HARNESS_NAME=$(basename "$HARNESS")
  PASSED=$(printf '%s' "$OUT" | grep -o '[0-9]* passed' | tail -1)
  osascript -e "display notification \"$HARNESS_NAME $PASSED ✅ 请验收功能\" with title \"Tarmeer 测试通过\" sound name \"Glass\"" 2>/dev/null || true
  jq -cn --arg n "$HARNESS_NAME" --arg p "$PASSED" \
    '{"systemMessage":("✅ Harness 全部通过 — " + $n + " " + $p + " — 已通知用户验收")}'
  exit 0
fi

# tsc passed, no harness pending
jq -cn '{"systemMessage":"✅ tsc 0 errors — 代码检查通过"}'
exit 0
