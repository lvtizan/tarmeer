/**
 * 测试：Materials 页面 "Apply to Join" 按钮入口
 * 验证点：
 *   1. GET /materials 返回 200
 *   2. GET /supplier/auth 返回 200（注册页可访问）
 *   3. /for-suppliers 返回 200（供应商介绍页）
 */

const BASE = process.env.API_BASE || 'http://localhost:3002';
const FRONTEND = process.env.FRONTEND_BASE || 'http://localhost:5180';

let pass = 0, fail = 0;

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

async function get(url) {
  const res = await fetch(url);
  return res;
}

console.log('\n=== supplier-auth-entry harness ===\n');

// 1. Materials 页可访问
await check('GET /materials → 200', async () => {
  const res = await get(`${FRONTEND}/materials`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
});

// 2. /supplier/auth 可访问（注册/登录页）
await check('GET /supplier/auth → 200', async () => {
  const res = await get(`${FRONTEND}/supplier/auth`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
});

// 3. /for-suppliers 可访问
await check('GET /for-suppliers → 200', async () => {
  const res = await get(`${FRONTEND}/for-suppliers`);
  if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
});

// 4. 后端供应商注册 endpoint 可达（空 body → 400，不是 404/500）
await check('POST /api/supplier/auth/register → 400', async () => {
  const res = await fetch(`${BASE}/api/supplier/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (res.status === 404 || res.status === 500) throw new Error(`HTTP ${res.status}`);
  if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
});

// 5. 供应商邮箱可用性查询 endpoint 可达
await check('POST /api/supplier/auth/check-availability → not 404/500', async () => {
  const res = await fetch(`${BASE}/api/supplier/auth/check-availability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (res.status === 404 || res.status === 500) throw new Error(`HTTP ${res.status}`);
});

console.log(`\n${'='.repeat(40)}`);
console.log(`  RESULT: ${pass} PASS, ${fail} FAIL`);
console.log('='.repeat(40) + '\n');
if (fail > 0) process.exit(1);
