/**
 * 批量创建供应商账号（跳过邮箱验证，可直接登录）
 * 用法: node scripts/create-supplier-accounts.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

// 从 node_modules 解析依赖（兼容本地 server/node_modules 和生产 node_modules）
const candidates = [
  join(dirname(fileURLToPath(import.meta.url)), '../server/package.json'),
  join(dirname(fileURLToPath(import.meta.url)), '../package.json'),
  '/tarmeer/tarmeer_api/package.json',
];
let requireServer;
for (const c of candidates) {
  try { requireServer = createRequire(c); requireServer('bcryptjs'); break; } catch {}
}
if (!requireServer) throw new Error('Cannot resolve bcryptjs from any candidate path');
const bcrypt = requireServer('bcryptjs');
const { createPool } = requireServer('mysql2/promise');

// 读取 .env
function loadEnv() {
  const envCandidates = [
    '/tarmeer/tarmeer_api/.env',
    join(dirname(fileURLToPath(import.meta.url)), '../server/.env'),
    join(dirname(fileURLToPath(import.meta.url)), '../.env'),
  ];
  let envPath = envCandidates.find(p => { try { readFileSync(p); return true; } catch { return false; } });
  if (!envPath) { console.warn('No .env found, using env vars as-is'); return; }
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ── 账号配置 ──────────────────────────────────────────────────────────────────
// 可根据需要修改邮箱前缀和密码
const PASSWORD = process.env.SUPPLIER_DEFAULT_PASSWORD || '';   // 所有账号使用同一密码，通过 SUPPLIER_DEFAULT_PASSWORD 环境变量传入

const ACCOUNTS = [
  { email: 'supplier01@tarmeer-team.com', full_name: '供应商账号 01' },
  { email: 'supplier02@tarmeer-team.com', full_name: '供应商账号 02' },
  { email: 'supplier03@tarmeer-team.com', full_name: '供应商账号 03' },
  { email: 'supplier04@tarmeer-team.com', full_name: '供应商账号 04' },
  { email: 'supplier05@tarmeer-team.com', full_name: '供应商账号 05' },
  { email: 'supplier06@tarmeer-team.com', full_name: '供应商账号 06' },
  { email: 'supplier07@tarmeer-team.com', full_name: '供应商账号 07' },
  { email: 'supplier08@tarmeer-team.com', full_name: '供应商账号 08' },
  { email: 'supplier09@tarmeer-team.com', full_name: '供应商账号 09' },
  { email: 'supplier10@tarmeer-team.com', full_name: '供应商账号 10' },
];
// ─────────────────────────────────────────────────────────────────────────────

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[\u4e00-\u9fff]+/g, '')   // 去除中文
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'supplier';
}

async function main() {
  const pool = createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tarmeer',
    waitForConnections: true,
    connectionLimit: 5,
  });

  const hashedPassword = await bcrypt.hash(PASSWORD, 10);
  const results = [];

  for (const account of ACCOUNTS) {
    const { email, full_name } = account;
    try {
      // 检查是否已存在
      const [existing] = await pool.query(
        'SELECT id FROM supplier_users WHERE email = ? LIMIT 1',
        [email]
      );
      if (existing.length > 0) {
        results.push({ email, status: 'SKIP（已存在）', id: existing[0].id });
        continue;
      }

      // 插入 supplier_users，email_verified = 1 跳过验证
      const [userResult] = await pool.query(
        `INSERT INTO supplier_users (email, password, full_name, email_verified)
         VALUES (?, ?, ?, 1)`,
        [email, hashedPassword, full_name]
      );
      const userId = userResult.insertId;

      // 生成唯一 slug
      const baseSlug = slugify(full_name) || `supplier-${userId}`;
      const slug = `${baseSlug}-${userId}`;

      // 插入 supplier_profiles
      await pool.query(
        `INSERT INTO supplier_profiles (supplier_user_id, company_name, slug, status)
         VALUES (?, ?, ?, 'pending')`,
        [userId, full_name, slug]
      );

      results.push({ email, status: 'OK', id: userId, slug });
    } catch (err) {
      results.push({ email, status: `ERROR: ${err.message}`, id: null });
    }
  }

  await pool.end();

  // ── 输出结果 ──────────────────────────────────────────────────────────────
  console.log('\n=== 供应商账号创建结果 ===\n');
  console.log(`统一密码: ${PASSWORD}\n`);
  console.log('登录地址: https://www.tarmeer.com/supplier/auth\n');
  console.log('─'.repeat(70));

  for (const r of results) {
    const icon = r.status === 'OK' ? '✅' : r.status.startsWith('SKIP') ? '⏭️ ' : '❌';
    console.log(`${icon} [${r.id ?? '-'}] ${r.email}  →  ${r.status}`);
  }

  console.log('─'.repeat(70));
  const ok = results.filter(r => r.status === 'OK').length;
  const skip = results.filter(r => r.status.startsWith('SKIP')).length;
  const err = results.filter(r => r.status.startsWith('ERROR')).length;
  console.log(`\n共 ${results.length} 条：新建 ${ok} | 跳过 ${skip} | 失败 ${err}\n`);
}

main().catch(err => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
