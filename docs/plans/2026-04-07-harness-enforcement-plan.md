# Harness Engineering 强制执行层实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 Tarmeer 4.0 实现 Harness Engineering 的五个高级层：强制执行（linter）、部署门禁（CI）、文档保鲜（垃圾回收）、可观测性（生产监控脚本）、UI 验证（冒烟测试脚本）

**Architecture:** 全部工具用 Node.js 脚本实现，放在 `scripts/harness/` 目录。CI 用 GitHub Actions。不引入新依赖。

**Tech Stack:** Node.js 脚本、GitHub Actions、shell 脚本、现有 TypeScript 编译器

---

## Task 1: 创建 scripts/harness/ 目录结构

**Files:**
- Create: `scripts/harness/README.md`

**Step 1: 创建目录和说明文件**

```markdown
# Harness Engineering 工具集

自定义 linter 和检查工具，机械强制执行 docs/RELIABILITY.md 中的不变量。

## 工具列表

| 脚本 | 功能 | 何时运行 |
|------|------|---------|
| `lint-reliability.mjs` | 检查数据源合并顺序、base64禁令等不变量 | 每次提交前、CI |
| `lint-cors-nginx.mjs` | 检查 CORS 白名单与 Nginx 配置一致性 | 部署前 |
| `lint-docs-freshness.mjs` | 检查文档是否过时（超过30天未更新） | 每周 |
| `smoke-production.mjs` | 生产环境冒烟测试（首页、API、图片） | 部署后 |
| `pre-deploy-gate.sh` | 部署前门禁：跑 linter + 构建 + 测试 | 部署前 |

## 使用方式

\`\`\`bash
node scripts/harness/lint-reliability.mjs     # 检查不变量
node scripts/harness/lint-cors-nginx.mjs      # 检查 CORS/Nginx 一致性
node scripts/harness/smoke-production.mjs     # 生产冒烟测试
bash scripts/harness/pre-deploy-gate.sh       # 部署前完整检查
\`\`\`
```

**Step 2: Commit**

```bash
git add scripts/harness/README.md
git commit -m "chore: add harness engineering scripts directory"
```

---

## Task 2: 不变量 Linter — lint-reliability.mjs

**Files:**
- Create: `scripts/harness/lint-reliability.mjs`

**Step 1: 编写 linter 脚本**

这个 linter 机械检查 docs/RELIABILITY.md 中的所有不变量：

```javascript
#!/usr/bin/env node
/**
 * Reliability Invariant Linter
 * 机械检查 docs/RELIABILITY.md 中定义的不变量
 * 用法: node scripts/harness/lint-reliability.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
let failures = 0;
let passes = 0;

function check(name, passed, detail) {
  if (passed) {
    console.log(`  ✅ ${name}`);
    passes++;
  } else {
    console.log(`  ❌ ${name}`);
    if (detail) console.log(`     → ${detail}`);
    failures++;
  }
}

// ── Rule 1: fetchPublicCompanies 合并顺序 ──
// 目录公司必须排在注册公司前面
console.log('\n📋 Rule 1: Data source merge order');
const publicApiPath = resolve(ROOT, 'src/lib/publicApi.ts');
const publicApi = readFileSync(publicApiPath, 'utf-8');

// 检查合并数组中 directoryCompanies 是否在 approvedCompanies 前面
const mergePattern = /const\s+merged\s*=\s*\[\s*\.\.\.(\w+)/;
const mergeMatch = publicApi.match(mergePattern);
if (mergeMatch) {
  const firstSource = mergeMatch[1];
  check(
    'Directory companies come first in merge',
    firstSource === 'directoryCompanies',
    `Found: ...${firstSource} is first. Expected: ...directoryCompanies`
  );
} else {
  check('Merge pattern found in publicApi.ts', false, 'Could not find merge array pattern');
}

// ── Rule 2: base64 禁令 ──
// validateNoBase64Images 必须存在且被使用
console.log('\n📋 Rule 2: No base64 in database');
const persistencePath = resolve(ROOT, 'server/src/lib/projectPersistence.ts');
try {
  const persistence = readFileSync(persistencePath, 'utf-8');
  check(
    'validateNoBase64Images exists in projectPersistence.ts',
    persistence.includes('validateNoBase64Images')
  );
} catch {
  check('projectPersistence.ts exists', false, 'File not found');
}

// ── Rule 3: CORS 白名单包含所有已知域名 ──
console.log('\n📋 Rule 3: CORS whitelist completeness');
const corsPath = resolve(ROOT, 'server/src/lib/corsOrigins.ts');
const cors = readFileSync(corsPath, 'utf-8');
const requiredDomains = [
  'https://www.tarmeer.com',
  'https://tarmeer.com',
  'https://admin.tarmeer.com',
];
for (const domain of requiredDomains) {
  check(`CORS includes ${domain}`, cors.includes(`'${domain}'`));
}

// ── Rule 4: Nginx 裸域名处理 ──
console.log('\n📋 Rule 4: Nginx bare domain config');
const nginxPath = resolve(ROOT, 'nginx-tarmeer.conf');
try {
  const nginx = readFileSync(nginxPath, 'utf-8');
  check(
    'Nginx config handles bare domain tarmeer.com',
    nginx.includes('server_name tarmeer.com') || nginx.includes('server_name www.tarmeer.com tarmeer.com')
  );
  check(
    'Bare domain redirects to www',
    nginx.includes('www.tarmeer.com$request_uri')
  );
} catch {
  check('nginx-tarmeer.conf exists locally', false, 'File not found — run: scp from server');
}

// ── Rule 5: NotificationBell 仅 admin 可见 ──
console.log('\n📋 Rule 5: NotificationBell admin-only');
const navbarPath = resolve(ROOT, 'src/components/Navbar.tsx');
const navbar = readFileSync(navbarPath, 'utf-8');
check(
  'NotificationBell wrapped with admin check',
  navbar.includes("activeRole === 'admin'") && navbar.includes('NotificationBell')
);

// ── Rule 6: Image storage paths ──
console.log('\n📋 Rule 6: Image storage conventions');
const storagePath = resolve(ROOT, 'server/src/lib/projectImageStorage.ts');
try {
  const storage = readFileSync(storagePath, 'utf-8');
  check('projectImageStorage uses /uploads/projects/ path', storage.includes('/uploads/projects/'));
} catch {
  check('projectImageStorage.ts exists', false);
}

// ── Summary ──
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passes} passed, ${failures} failed`);
if (failures > 0) {
  console.log('\n⚠️  Fix the above failures before deploying.');
  process.exit(1);
} else {
  console.log('\n✅ All reliability invariants verified.');
}
```

**Step 2: 运行验证**

```bash
node scripts/harness/lint-reliability.mjs
```

Expected: 全部通过

**Step 3: Commit**

```bash
git add scripts/harness/lint-reliability.mjs
git commit -m "feat(harness): add reliability invariant linter"
```

---

## Task 3: CORS/Nginx 一致性 Linter — lint-cors-nginx.mjs

**Files:**
- Create: `scripts/harness/lint-cors-nginx.mjs`

**Step 1: 编写一致性检查脚本**

```javascript
#!/usr/bin/env node
/**
 * CORS ↔ Nginx 一致性检查
 * 确保 CORS 白名单中的每个域名都有对应的 Nginx 配置
 * 用法: node scripts/harness/lint-cors-nginx.mjs
 */

import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
let failures = 0;
let passes = 0;

function check(name, passed, detail) {
  if (passed) { console.log(`  ✅ ${name}`); passes++; }
  else { console.log(`  ❌ ${name}`); if (detail) console.log(`     → ${detail}`); failures++; }
}

// 1. 从 corsOrigins.ts 提取生产域名
console.log('\n📋 CORS ↔ Nginx Consistency Check');
const corsFile = readFileSync(resolve(ROOT, 'server/src/lib/corsOrigins.ts'), 'utf-8');

const productionBlock = corsFile.match(/production:\s*\[([\s\S]*?)\]/);
const corsDomains = [];
if (productionBlock) {
  const matches = productionBlock[1].matchAll(/'(https?:\/\/[^']+)'/g);
  for (const m of matches) {
    const url = new URL(m[1]);
    if (!url.hostname.match(/^\d/)) { // 跳过 IP 地址
      corsDomains.push(url.hostname);
    }
  }
}
console.log(`  Found ${corsDomains.length} production domains in CORS config`);

// 2. 从本地 nginx 配置文件提取 server_name
const nginxFiles = readdirSync(ROOT).filter(f => f.startsWith('nginx-') && f.endsWith('.conf'));
const nginxDomains = new Set();
for (const file of nginxFiles) {
  const content = readFileSync(resolve(ROOT, file), 'utf-8');
  const serverNames = content.matchAll(/server_name\s+([^;]+)/g);
  for (const m of serverNames) {
    m[1].trim().split(/\s+/).forEach(d => nginxDomains.add(d));
  }
}
console.log(`  Found ${nginxDomains.size} domains in Nginx configs: ${[...nginxDomains].join(', ')}`);

// 3. 检查每个 CORS 域名都有 Nginx 配置
console.log('\n📋 Every CORS domain has Nginx config:');
for (const domain of corsDomains) {
  check(domain, nginxDomains.has(domain), `Missing Nginx server block for ${domain}`);
}

// 4. 检查 Nginx 配置文件是否存在
console.log('\n📋 Nginx config files present:');
check('nginx-tarmeer.conf (main site)', nginxFiles.includes('nginx-tarmeer.conf'));
check('nginx-admin.conf (admin site)', nginxFiles.includes('nginx-admin.conf'));

console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passes} passed, ${failures} failed`);
if (failures > 0) { console.log('\n⚠️  CORS/Nginx mismatch detected.'); process.exit(1); }
else { console.log('\n✅ CORS and Nginx configs are consistent.'); }
```

**Step 2: 运行验证**

```bash
node scripts/harness/lint-cors-nginx.mjs
```

**Step 3: Commit**

```bash
git add scripts/harness/lint-cors-nginx.mjs
git commit -m "feat(harness): add CORS/Nginx consistency linter"
```

---

## Task 4: 文档保鲜检查 — lint-docs-freshness.mjs

**Files:**
- Create: `scripts/harness/lint-docs-freshness.mjs`

**Step 1: 编写文档保鲜检查**

```javascript
#!/usr/bin/env node
/**
 * 文档保鲜检查（垃圾回收层）
 * 检测超过 30 天未更新的文档，提醒更新或归档
 * 用法: node scripts/harness/lint-docs-freshness.mjs
 */

import { execSync } from 'child_process';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '../..');
const STALE_DAYS = 30;
const now = Date.now();
let staleCount = 0;

console.log(`\n📋 Documentation Freshness Check (stale > ${STALE_DAYS} days)\n`);

// 关键文档列表（必须保持更新的文档）
const criticalDocs = [
  'docs/RELIABILITY.md',
  'docs/SECURITY.md',
  'docs/DESIGN.md',
  'docs/FRONTEND.md',
  'docs/QUALITY.md',
  'docs/operations/deploy-runbook.md',
  'docs/testing/index.md',
  'docs/references/cors-domains.md',
  'ARCHITECTURE.md',
];

for (const doc of criticalDocs) {
  try {
    // 用 git log 获取最后修改时间
    const lastCommit = execSync(
      `git log -1 --format="%ai" -- "${doc}"`,
      { cwd: ROOT, encoding: 'utf-8' }
    ).trim();

    if (!lastCommit) {
      // 文件未被 git 跟踪（新文件）
      console.log(`  🆕 ${doc} — not yet committed`);
      continue;
    }

    const lastDate = new Date(lastCommit);
    const daysAgo = Math.floor((now - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysAgo > STALE_DAYS) {
      console.log(`  ⚠️  ${doc} — last updated ${daysAgo} days ago (${lastCommit.slice(0, 10)})`);
      staleCount++;
    } else {
      console.log(`  ✅ ${doc} — updated ${daysAgo} days ago`);
    }
  } catch {
    console.log(`  ❓ ${doc} — file not found`);
  }
}

console.log(`\n${'═'.repeat(50)}`);
if (staleCount > 0) {
  console.log(`⚠️  ${staleCount} document(s) may be stale. Review and update or archive.`);
} else {
  console.log('✅ All critical documents are fresh.');
}
```

**Step 2: 运行验证**

```bash
node scripts/harness/lint-docs-freshness.mjs
```

**Step 3: Commit**

```bash
git add scripts/harness/lint-docs-freshness.mjs
git commit -m "feat(harness): add docs freshness checker (garbage collection)"
```

---

## Task 5: 生产冒烟测试 — smoke-production.mjs

**Files:**
- Create: `scripts/harness/smoke-production.mjs`

**Step 1: 编写冒烟测试脚本**

```javascript
#!/usr/bin/env node
/**
 * 生产环境冒烟测试
 * 部署后运行，验证关键功能正常
 * 用法: node scripts/harness/smoke-production.mjs [--url https://www.tarmeer.com]
 */

const BASE = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'https://www.tarmeer.com';

let failures = 0;
let passes = 0;

async function check(name, fn) {
  try {
    const result = await fn();
    if (result) { console.log(`  ✅ ${name}`); passes++; }
    else { console.log(`  ❌ ${name}`); failures++; }
  } catch (err) {
    console.log(`  ❌ ${name} — ${err.message}`);
    failures++;
  }
}

console.log(`\n🔍 Production Smoke Test: ${BASE}\n`);

// 1. 首页 200
console.log('📋 Page Access:');
await check('Homepage returns 200', async () => {
  const res = await fetch(BASE);
  return res.status === 200;
});

// 2. 裸域名重定向
await check('tarmeer.com redirects to www', async () => {
  const res = await fetch('https://tarmeer.com', { redirect: 'manual' });
  const location = res.headers.get('location') || '';
  return res.status === 301 && location.includes('www.tarmeer.com');
});

// 3. API 健康检查
console.log('\n📋 API Health:');
await check('API /health returns 200', async () => {
  const res = await fetch(`${BASE}/api/health`);
  return res.status === 200;
});

// 4. 公司列表 API
await check('Companies API returns data', async () => {
  const res = await fetch(`${BASE}/api/companies?limit=1`);
  if (res.status !== 200) return false;
  const data = await res.json();
  return data.companies && data.companies.length > 0;
});

// 5. 公司有图片（合并顺序正确）
await check('First company has portfolio images', async () => {
  const res = await fetch(`${BASE}/api/companies?limit=1&order=list`);
  if (res.status !== 200) return false;
  const data = await res.json();
  const company = data.companies?.[0];
  return company?.portfolio_images?.length > 0 || company?.portfolio_categories;
});

// 6. 静态图片可访问
console.log('\n📋 Image Access:');
await check('Logo image accessible', async () => {
  const res = await fetch(`${BASE}/images/tarmeer_logo.svg`);
  return res.status === 200;
});

await check('Portfolio image accessible', async () => {
  const res = await fetch(`${BASE}/images/uae-companies/portfolio/hba-hirsch-bedner/general/6.jpg`);
  return res.status === 200;
});

// 7. Admin 站点可访问
console.log('\n📋 Subdomain Access:');
await check('admin.tarmeer.com returns 200', async () => {
  const res = await fetch('https://admin.tarmeer.com');
  return res.status === 200;
});

// Summary
console.log(`\n${'═'.repeat(50)}`);
console.log(`Results: ${passes} passed, ${failures} failed`);
if (failures > 0) {
  console.log('\n🚨 Production smoke test FAILED. Investigate immediately.');
  process.exit(1);
} else {
  console.log('\n✅ Production smoke test PASSED.');
}
```

**Step 2: 运行验证（对线上）**

```bash
node scripts/harness/smoke-production.mjs
```

**Step 3: Commit**

```bash
git add scripts/harness/smoke-production.mjs
git commit -m "feat(harness): add production smoke test"
```

---

## Task 6: 部署前门禁 — pre-deploy-gate.sh

**Files:**
- Create: `scripts/harness/pre-deploy-gate.sh`

**Step 1: 编写部署门禁脚本**

```bash
#!/usr/bin/env bash
# 部署前门禁 — 必须全部通过才能部署
# 用法: bash scripts/harness/pre-deploy-gate.sh [frontend|backend|both]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TARGET="${1:-both}"

echo "═══════════════════════════════════════════"
echo "  Tarmeer Pre-Deploy Gate"
echo "  Target: $TARGET"
echo "═══════════════════════════════════════════"

FAIL=0

run_check() {
  echo ""
  echo "▶ $1"
  if eval "$2"; then
    echo "  ✅ PASSED"
  else
    echo "  ❌ FAILED"
    FAIL=1
  fi
}

# 1. 不变量检查
run_check "Reliability invariants" "node $SCRIPT_DIR/lint-reliability.mjs"

# 2. CORS/Nginx 一致性
run_check "CORS/Nginx consistency" "node $SCRIPT_DIR/lint-cors-nginx.mjs"

# 3. 前端构建
if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "both" ]; then
  run_check "Frontend type check" "cd $ROOT && ./node_modules/.bin/tsc --noEmit --skipLibCheck"
  run_check "Frontend build" "cd $ROOT && ./node_modules/.bin/vite build > /dev/null 2>&1"
fi

# 4. 后端构建
if [ "$TARGET" = "backend" ] || [ "$TARGET" = "both" ]; then
  run_check "Backend build" "cd $ROOT/server && npx tsc > /dev/null 2>&1"
fi

# Summary
echo ""
echo "═══════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then
  echo "✅ ALL CHECKS PASSED — safe to deploy"
else
  echo "🚨 DEPLOY BLOCKED — fix failures above"
  exit 1
fi
```

**Step 2: 测试**

```bash
chmod +x scripts/harness/pre-deploy-gate.sh
bash scripts/harness/pre-deploy-gate.sh
```

**Step 3: Commit**

```bash
git add scripts/harness/pre-deploy-gate.sh
git commit -m "feat(harness): add pre-deploy gate script"
```

---

## Task 7: GitHub Actions CI — 自动检查

**Files:**
- Create: `.github/workflows/harness-checks.yml`

**Step 1: 编写 CI 工作流**

```yaml
name: Harness Engineering Checks

on:
  push:
    branches: [main, harness-engineering]
  pull_request:
    branches: [main]

jobs:
  reliability-check:
    name: Reliability Invariants
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Check reliability invariants
        run: node scripts/harness/lint-reliability.mjs
      - name: Check CORS/Nginx consistency
        run: node scripts/harness/lint-cors-nginx.mjs

  build-check:
    name: Build Verification
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - name: Install frontend deps
        run: npm ci
      - name: TypeScript check
        run: npx tsc --noEmit --skipLibCheck
      - name: Vite build
        run: npx vite build
      - name: Install backend deps
        run: cd server && npm ci
      - name: Backend build
        run: cd server && npx tsc

  docs-freshness:
    name: Documentation Freshness
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: Check docs freshness
        run: node scripts/harness/lint-docs-freshness.mjs
```

**Step 2: Commit**

```bash
git add .github/workflows/harness-checks.yml
git commit -m "feat(harness): add GitHub Actions CI for invariant checks"
```

---

## Task 8: 更新 npm scripts 和文档

**Files:**
- Modify: `package.json`
- Modify: `docs/operations/deploy-runbook.md`
- Modify: `CLAUDE.md`

**Step 1: 在 package.json 添加 harness 命令**

在 scripts 中添加：
```json
"lint:reliability": "node scripts/harness/lint-reliability.mjs",
"lint:cors": "node scripts/harness/lint-cors-nginx.mjs",
"lint:docs": "node scripts/harness/lint-docs-freshness.mjs",
"smoke:prod": "node scripts/harness/smoke-production.mjs",
"predeploy:gate": "bash scripts/harness/pre-deploy-gate.sh"
```

**Step 2: 在 deploy-runbook.md 开头添加门禁步骤**

在 Pre-Deploy Checklist 最前面加：
```markdown
- [ ] Run pre-deploy gate: `bash scripts/harness/pre-deploy-gate.sh`
```

在 Post-Deploy Verification 最后加：
```markdown
- [ ] Run smoke test: `node scripts/harness/smoke-production.mjs`
```

**Step 3: 在 CLAUDE.md 的 Quick Nav 添加**

添加一行：
```
| Harness tools            | `scripts/harness/README.md`             |
```

**Step 4: Commit**

```bash
git add package.json docs/operations/deploy-runbook.md CLAUDE.md
git commit -m "feat(harness): wire up npm scripts and update deploy runbook"
```

---

## Task 9: 验证所有工具联动

**Step 1: 跑全套检查**

```bash
node scripts/harness/lint-reliability.mjs
node scripts/harness/lint-cors-nginx.mjs
node scripts/harness/lint-docs-freshness.mjs
bash scripts/harness/pre-deploy-gate.sh
node scripts/harness/smoke-production.mjs
```

**Step 2: 确认全部通过**

Expected: 所有工具零失败

**Step 3: 最终提交**

```bash
git add -A
git commit -m "feat(harness): complete harness engineering enforcement layer"
```

---

## 执行总结

| Task | 内容 | 对应层级 |
|------|------|---------|
| 1 | 目录结构 + README | 基础 |
| 2 | lint-reliability.mjs | 强制执行层 |
| 3 | lint-cors-nginx.mjs | 强制执行层 |
| 4 | lint-docs-freshness.mjs | 垃圾回收层 |
| 5 | smoke-production.mjs | 可观测性 + UI 验证层 |
| 6 | pre-deploy-gate.sh | 部署门禁 |
| 7 | GitHub Actions CI | 智能体审查层（自动化） |
| 8 | npm scripts + 文档更新 | 集成 |
| 9 | 全量验证 | 验证 |
