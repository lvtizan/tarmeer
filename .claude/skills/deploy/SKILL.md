# Deploy Checklist

**使用时机**：用户说"部署"时，必须按此清单执行，不得跳过任何步骤。任何一步失败 → 停止，修复后从头重跑整个 pipeline，不得跳过。

---

## Step 1: TypeScript 检查

```bash
cd /Users/kp/.warp/worktrees/tarmeer-4.0-local/organ-pipe-horned-toad
npx tsc --skipLibCheck --noEmit
```

失败 → 修复错误，重跑全部 pipeline。

## Step 2: 完整 harness 测试

```bash
node scripts/harness/lint-route-coverage.mjs
node scripts/harness/test-frozen-contracts.mjs
```

同时运行本次功能相关的 harness 测试脚本，汇报每项结果。

任何 FAIL → 修复，重跑全部 pipeline。

## Step 3: 检查硬编码 localhost

```bash
grep -r "localhost" src/ server/src/ --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules \
  | grep -v "// " | grep -v "__tests__" | grep -v ".test."
```

有输出 → 逐条确认是否是生产代码中的硬编码 URL，是则修复，重跑 pipeline。

## Step 4: 重新构建，确认产物新鲜

```bash
cd server && rm -rf dist && npx tsc --skipLibCheck
```

构建失败 → 修复，重跑 pipeline。

## Step 5: API 健康检查

启动本地服务器（`PORT=3099 DEV_SKIP_EMAIL=true node dist/app.js &`），对本次改动涉及的每个 API endpoint 发送请求，确认全部返回 200。

任何非 200 → 修复，重跑 pipeline。

---

## STOP — 等用户确认

全部 5 步通过后，列出改动摘要，明确询问："Ready to deploy — 确认？"

**等用户明确回复后才继续。**

---

## Step 6: 执行部署

```bash
# 同步主分支
git push origin HEAD:main

# 有后端改动时，先部署后端
bash deploy-backend-ecs.sh

# 部署前端
DEPLOY_SSH_KEY=~/.ssh/tarmeer_ecs DEPLOY_RULES_ACK=YES DEPLOY_USER_APPROVED=YES SKIP_SCHEMA_CHECK=YES bash deploy-simple.sh
```

## Step 7: 验证生产环境

部署完成后提供生产测试链接，告知用户可以验证的具体页面/功能。
