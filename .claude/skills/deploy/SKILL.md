# Deploy Checklist

**使用时机**：用户说"部署"时，必须按此清单执行，不得跳过任何步骤。

## Step 1: TypeScript 检查

```bash
cd /Users/kp/.warp/worktrees/tarmeer-4.0-local/organ-pipe-horned-toad
npx tsc --skipLibCheck --noEmit
```

有错误 → 先修复，不得继续。

## Step 2: 路由覆盖检查

```bash
node scripts/harness/lint-route-coverage.mjs
```

## Step 3: 运行相关 harness 测试

运行本次功能涉及的测试脚本，确认全部 PASS。

## Step 4: 冻结契约检查

```bash
node scripts/harness/test-frozen-contracts.mjs
```

## Step 5: 告知用户，等待确认

列出本次改动摘要，明确询问："确认部署？"

**STOP — 等用户明确回复确认后才继续。**

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
