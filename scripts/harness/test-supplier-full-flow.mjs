/**
 * 供应商完整流程端到端测试
 * 覆盖：注册 → 邮箱验证 → 登录 → 填写资料 → 添加产品 → 查询 → 清理
 *
 * 用法：
 *   node scripts/harness/test-supplier-full-flow.mjs
 *
 * 环境变量（可选）：
 *   API_BASE       后端地址，默认 https://www.tarmeer.com
 *   SSH_KEY        SSH 密钥路径，默认 ~/.ssh/tarmeer_ecs
 *   SERVER_IP      服务器 IP，默认 47.91.108.104
 */

import { execSync } from 'child_process';

const API  = process.env.API_BASE  || 'https://www.tarmeer.com';
const SSH  = process.env.SSH_KEY   || `${process.env.HOME}/.ssh/tarmeer_ecs`;
const HOST = process.env.SERVER_IP || '47.91.108.104';

const TEST_EMAIL    = `harness-supplier-${Date.now()}@tarmeer-test.example`;
const TEST_PASSWORD = 'HarnessTest123!';
const TEST_NAME     = 'Harness Test Supplier Co.';

let pass = 0, fail = 0;
let jwt_token = null;
let supplier_user_id = null;

// ─── helpers ───────────────────────────────────────────────────────────────

async function req(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try { json = await res.json(); } catch { json = {}; }
  return { status: res.status, json };
}

async function check(label, fn) {
  try {
    await fn();
    console.log(`  PASS  ${label}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL  ${label}: ${e.message}`);
    fail++;
  }
}

function sshRun(remoteScript) {
  // Write script to server as temp file then run — avoids shell escaping hell
  const tmpPath = `/tmp/harness_db_${Date.now()}.py`;
  execSync(`cat > /tmp/_harness_upload.py << 'PYEOF'\n${remoteScript}\nPYEOF`, { shell: '/bin/bash' });
  execSync(`scp -i ${SSH} -o StrictHostKeyChecking=no /tmp/_harness_upload.py root@${HOST}:${tmpPath}`, { encoding: 'utf8' });
  const result = execSync(
    `ssh -i ${SSH} -o StrictHostKeyChecking=no root@${HOST} "python3 ${tmpPath} && rm -f ${tmpPath}"`,
    { encoding: 'utf8', timeout: 15000 }
  ).trim();
  return result;
}

function dbQuery(sql) {
  const script = `
import subprocess, re
env_txt = open("/tarmeer/tarmeer_api/.env").read()
def env(k):
    import re as r
    m = r.search(rf"^{k}=(.+)$", env_txt, r.MULTILINE)
    return m.group(1).strip().strip('"') if m else ""
h,u,p = env("DB_HOST"), env("DB_USER"), env("DB_PASSWORD")
r2 = subprocess.run(["mysql", f"-h{h}", f"-u{u}", f"-p{p}", "tarmeer", "-sNe", ${JSON.stringify(sql)}], capture_output=True, text=True)
print(r2.stdout.strip())
`;
  return sshRun(script);
}

// ─── test suite ─────────────────────────────────────────────────────────────

console.log('\n=== supplier full-flow harness ===');
console.log(`    email: ${TEST_EMAIL}\n`);

// 1. 邮箱可用性检查
await check('check-availability → isNewEmail:true', async () => {
  const { status, json } = await req('POST', '/api/supplier/auth/check-availability', { email: TEST_EMAIL });
  if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(json)}`);
  if (!json.isNewEmail) throw new Error('Expected isNewEmail:true');
});

// 2. 注册
await check('register → 201', async () => {
  const { status, json } = await req('POST', '/api/supplier/auth/register', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    full_name: TEST_NAME,
  });
  if (status !== 201) throw new Error(`HTTP ${status}: ${JSON.stringify(json)}`);
  if (!json.user?.id) throw new Error('No user.id in response');
  supplier_user_id = json.user.id;
});

if (!supplier_user_id) {
  console.log('\n  ABORT: registration failed, cannot continue\n');
  process.exit(1);
}

// 3. 未验证邮箱前登录 → 应返回 403
await check('login before email verify → 403', async () => {
  const { status } = await req('POST', '/api/supplier/auth/login', {
    email: TEST_EMAIL, password: TEST_PASSWORD,
  });
  if (status !== 403) throw new Error(`Expected 403, got ${status}`);
});

// 4. 从 DB 取 verification_token
let verificationToken = null;
await check('fetch verification_token from DB via SSH', async () => {
  const result = dbQuery(
    `SELECT verification_token FROM supplier_users WHERE email='${TEST_EMAIL}' LIMIT 1`
  );
  if (!result || result.length < 10) throw new Error(`Token not found or too short: ${result}`);
  verificationToken = result.trim();
});

if (!verificationToken) {
  console.log('\n  ABORT: could not get verification token\n');
  // cleanup
  try { dbQuery(`DELETE FROM supplier_profiles WHERE supplier_user_id=${supplier_user_id}`); } catch {}
  try { dbQuery(`DELETE FROM supplier_users WHERE id=${supplier_user_id}`); } catch {}
  process.exit(1);
}

// 5. 验证邮箱 → 拿到 JWT
await check('verify-email → 200 + token', async () => {
  const { status, json } = await req('POST', '/api/supplier/auth/verify-email', {
    token: verificationToken,
  });
  if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(json)}`);
  if (!json.token) throw new Error('No token in response');
  jwt_token = json.token;
});

// 6. 登录
await check('login after verify → 200 + token', async () => {
  const { status, json } = await req('POST', '/api/supplier/auth/login', {
    email: TEST_EMAIL, password: TEST_PASSWORD,
  });
  if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(json)}`);
  if (!json.token) throw new Error('No token');
  jwt_token = json.token; // 使用 login 返回的 token
});

// 7. 无 token 访问受保护路由 → 401
await check('GET /me/profile without token → 401', async () => {
  const { status } = await req('GET', '/api/suppliers/me/profile', null, null);
  if (status !== 401) throw new Error(`Expected 401, got ${status}`);
});

// 8. 获取 profile（注册时自动创建）
await check('GET /me/profile with token → 200', async () => {
  const { status, json } = await req('GET', '/api/suppliers/me/profile', null, jwt_token);
  if (status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(json)}`);
  if (!json.profile) throw new Error('No profile in response');
});

// 9. 填写/更新供应商资料
let profile_slug = null;
await check('POST /me/profile (upsert) → 200/201', async () => {
  const { status, json } = await req('POST', '/api/suppliers/me/profile', {
    company_name: TEST_NAME,
    description: 'End-to-end harness test supplier. Auto-generated.',
    origin: 'china',
    categories: ['Furniture', 'Lighting'],
    contact_phone: '+8613800000000',
    has_physical_store: false,
  }, jwt_token);
  if (status !== 200 && status !== 201) throw new Error(`HTTP ${status}: ${JSON.stringify(json)}`);
  if (!json.profile?.company_name) throw new Error('No company_name in response');
  if (json.profile.company_name !== TEST_NAME) throw new Error(`Name mismatch: ${json.profile.company_name}`);
  profile_slug = json.profile.slug;
});

// 10. 新注册供应商 status=pending，公开接口只暴露 approved → 期望 404（正确行为）
await check(`GET /api/suppliers/detail/:slug for pending → 404 (correct, pending not public)`, async () => {
  if (!profile_slug) throw new Error('No profile slug');
  const { status } = await req('GET', `/api/suppliers/detail/${profile_slug}`, null, null);
  if (status !== 404) throw new Error(`Expected 404 (pending not public), got ${status}`);
});

// 11. 添加产品（image_url 为必填）
let product_id = null;
await check('POST /me/products → 201', async () => {
  const { status, json } = await req('POST', '/api/suppliers/me/products', {
    title: 'Harness Test Product',
    description: 'Auto-generated test product',
    image_url: 'https://via.placeholder.com/400x400.jpg',
    sort_order: 1,
  }, jwt_token);
  if (status !== 201 && status !== 200) throw new Error(`HTTP ${status}: ${JSON.stringify(json)}`);
  product_id = json.product?.id;
});

// 12. 查看产品列表
await check('GET /me/products → contains test product', async () => {
  const { status, json } = await req('GET', '/api/suppliers/me/products', null, jwt_token);
  if (status !== 200) throw new Error(`HTTP ${status}`);
  const found = (json.products || []).some(p => p.title === 'Harness Test Product');
  if (!found) throw new Error('Test product not in list');
});

// 13. 删除测试产品
await check('DELETE /me/products/:id → 200', async () => {
  if (!product_id) throw new Error('No product_id');
  const { status } = await req('DELETE', `/api/suppliers/me/products/${product_id}`, null, jwt_token);
  if (status !== 200 && status !== 204) throw new Error(`HTTP ${status}`);
});

// ─── cleanup ──────────────────────────────────────────────────────────────

console.log('\n  [cleanup] removing test supplier from DB...');
try {
  dbQuery(`DELETE FROM supplier_products WHERE supplier_profile_id IN (SELECT id FROM supplier_profiles WHERE supplier_user_id=${supplier_user_id})`);
  dbQuery(`DELETE FROM supplier_profiles WHERE supplier_user_id=${supplier_user_id}`);
  dbQuery(`DELETE FROM supplier_users WHERE id=${supplier_user_id}`);
  console.log('  [cleanup] done');
} catch (e) {
  console.log(`  [cleanup] WARN: ${e.message}`);
}

// ─── result ───────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`  RESULT: ${pass} PASS, ${fail} FAIL`);
console.log('='.repeat(50) + '\n');
if (fail > 0) process.exit(1);
