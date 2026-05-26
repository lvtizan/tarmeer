/**
 * 批量创建供应商账号（免邮箱验证）
 * 用法：node scripts/harness/create-supplier-accounts.mjs
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url.replace('/scripts/harness/', '/server/'));
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tarmeer',
});

const PASSWORD = 'Tarmeer2025!';
const START = 11;
const END = 30;

async function createAccount(n) {
  const num = String(n).padStart(2, '0');
  const email = `supplier${num}@tarmeer-team.com`;
  const companyName = `Supplier ${num}`;
  const slug = `supplier-${num}`;

  const [existing] = await pool.execute('SELECT id FROM supplier_users WHERE email = ?', [email]);
  if (existing.length > 0) {
    console.log(`⏭  跳过（已存在）: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const [userResult] = await pool.execute(
    'INSERT INTO supplier_users (email, password, full_name, email_verified) VALUES (?, ?, ?, 1)',
    [email, passwordHash, companyName]
  );
  const userId = userResult.insertId;

  let finalSlug = slug;
  const [slugCheck] = await pool.execute('SELECT id FROM supplier_profiles WHERE slug = ?', [finalSlug]);
  if (slugCheck.length > 0) finalSlug = `${slug}-${userId}`;

  await pool.execute(
    `INSERT INTO supplier_profiles (supplier_user_id, company_name, slug, status, origin) VALUES (?, ?, ?, 'approved', 'china')`,
    [userId, companyName, finalSlug]
  );

  console.log(`✅ ${email}  (slug: ${finalSlug})`);
}

console.log(`开始创建 supplier${String(START).padStart(2,'0')} ~ supplier${String(END).padStart(2,'0')}...\n`);
for (let i = START; i <= END; i++) {
  await createAccount(i);
}
console.log(`\n完成。密码统一：${PASSWORD}`);
console.log(`登录地址：https://www.tarmeer.com/supplier/auth`);
await pool.end();
