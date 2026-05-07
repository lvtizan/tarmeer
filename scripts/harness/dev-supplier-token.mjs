#!/usr/bin/env node
/**
 * dev-supplier-token.mjs
 * 本地开发用：自动注册/登录测试供应商账号，输出可直接粘贴到浏览器 Console 的命令。
 *
 * 用法：
 *   node scripts/harness/dev-supplier-token.mjs
 *
 * 首次运行会注册账号，之后直接登录。
 * 把输出的那行命令粘贴到 http://localhost:5180 的 Console 里，刷新即可。
 */

const API = 'http://localhost:3099/api';
const EMAIL = 'dev-supplier@test.local';
const PASSWORD = 'dev123456';
const NAME = 'Dev Supplier Co.';

async function tryLogin() {
  const r = await fetch(`${API}/suppliers/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const data = await r.json();
  if (r.ok && data.token) return data.token;
  return null;
}

async function tryRegister() {
  const r = await fetch(`${API}/suppliers/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, full_name: NAME }),
  });
  const data = await r.json();
  if (r.ok && data.token) return data.token;
  // Already exists — ignore error
  return null;
}

async function main() {
  let token = await tryLogin();

  if (!token) {
    console.log('账号不存在，正在注册...');
    await tryRegister();
    token = await tryLogin();
  }

  if (!token) {
    console.error('❌ 无法获取 token，确认后端在 :3099 运行中。');
    process.exit(1);
  }

  console.log('\n✅ 复制下面这行到浏览器 Console（F12）然后刷新页面：\n');
  console.log(`localStorage.setItem('supplier_token', '${token}'); location.reload();`);
  console.log('');
}

main();
