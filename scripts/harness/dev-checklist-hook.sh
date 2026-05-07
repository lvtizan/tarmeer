#!/bin/bash
# UserPromptSubmit hook: 检测开发关键词，注入组件规则提醒
# 触发条件：用户消息含新页面/新功能相关词汇

PROMPT=$(jq -r '.prompt // ""' 2>/dev/null)

if echo "$PROMPT" | grep -qiE '新页面|new page|新功能|new feature|写.{0,6}页面|做.{0,6}页面|build.*page|create.*page|开发新|改版|重写|新.*tab|添加.*页|新.*section|新.*组件|new component'; then
  printf '%s\n' '{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": "[TARMEER 开发前必走 — 写代码前必须完成]\n1. 运行: node scripts/harness/lint-admin-ui.mjs --guide（获取完整组件目录）\n2. 找最相似的已有页面 → 直接复用布局骨架\n3. 组件规则：下拉=AdminSelect(size=\"sm\"用于筛选栏，默认lg用于表单)，Tooltip=FloatingTip，Logo=TarmeerLogo，搜索框禁止在子组件内重复\n4. PC端 + 移动端：同时阅读两端现有实现，交互/数据/路由必须一致\n5. 新路由 → 立即注册到对应路由文件，不能只写 controller"
  }
}'
fi
