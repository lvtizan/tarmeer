/**
 * Create verification-free supplier *operator* accounts for the team.
 *   Email:    supplierNN@tarmeer-team.com   (NN auto-continues from the current max)
 *   Password: Tarmeer2025!  (shared, configurable via PASSWORD env)
 *   Login-ready: supplier_users.email_verified = 1  (skips email verification)
 *   Profile:  supplier_profiles status='approved', country='ae', slug='NN-<userId>'
 *             company_name is a placeholder the operator renames later.
 *
 * Idempotent — re-running skips emails that already exist.
 *
 * Usage (PRODUCTION — run ON the server, per AGENTS.md):
 *   cd /tarmeer/tarmeer_api
 *   COUNT=100 node create-supplier-team-accounts.mjs
 *
 * Local test:
 *   COUNT=5 ENV_PATH=server/.env node scripts/create-supplier-team-accounts.mjs
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const API = '/tarmeer/tarmeer_api';
const mysql = require(`${API}/node_modules/mysql2/promise`);
const bcrypt = require(`${API}/node_modules/bcryptjs`);

const COUNT = parseInt(process.env.COUNT || '100', 10);
const PASSWORD = process.env.PASSWORD || 'Tarmeer2025!';
const DOMAIN = 'tarmeer-team.com';
const ENV_PATH = process.env.ENV_PATH || `${API}/.env`;

const env = {};
for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) env[m[1]] = m[2].trim();
}

const pad = n => String(n).padStart(2, '0');

(async () => {
  const conn = await mysql.createConnection({
    host: env.DB_HOST || process.env.DB_HOST,
    port: parseInt(env.DB_PORT || '3306', 10),
    user: env.DB_USER || process.env.DB_USER,
    password: env.DB_PASSWORD || process.env.DB_PASSWORD,
    database: env.DB_NAME || process.env.DB_NAME,
    charset: 'utf8mb4',
  });

  const [[{ maxn }]] = await conn.execute(
    `SELECT MAX(CAST(REGEXP_REPLACE(SUBSTRING_INDEX(email,'@',1),'[^0-9]','') AS UNSIGNED)) maxn
     FROM supplier_users WHERE email LIKE 'supplier%@${DOMAIN}'`,
  );
  const start = (maxn || 0) + 1;
  const hash = await bcrypt.hash(PASSWORD, 10);

  console.log(`DB=${env.DB_HOST} | existing max NN=${maxn || 0} | creating ${COUNT}: supplier${pad(start)}..supplier${pad(start + COUNT - 1)}`);

  let created = 0, skipped = 0;
  for (let n = start; n < start + COUNT; n++) {
    const email = `supplier${pad(n)}@${DOMAIN}`;
    const fullName = `供应商账号 ${pad(n)}`;

    const [ex] = await conn.execute('SELECT id FROM supplier_users WHERE email = ? LIMIT 1', [email]);
    if (ex.length) { skipped++; continue; }

    const [r] = await conn.execute(
      'INSERT INTO supplier_users (email, password, full_name, email_verified, created_at) VALUES (?, ?, ?, 1, NOW())',
      [email, hash, fullName],
    );
    const uid = r.insertId;
    const slug = `${pad(n)}-${uid}`;

    const [pe] = await conn.execute('SELECT id FROM supplier_profiles WHERE supplier_user_id = ? LIMIT 1', [uid]);
    if (!pe.length) {
      await conn.execute(
        `INSERT INTO supplier_profiles (supplier_user_id, company_name, slug, status, country, created_at)
         VALUES (?, ?, ?, 'approved', 'ae', NOW())`,
        [uid, fullName, slug],
      );
    }
    created++;
  }

  const [[{ total }]] = await conn.execute(
    `SELECT COUNT(*) total FROM supplier_users WHERE email LIKE 'supplier%@${DOMAIN}'`,
  );
  console.log(`Done. created=${created} skipped=${skipped} | total tarmeer-team accounts now=${total}`);
  console.log(`Login example: supplier${pad(start)}@${DOMAIN}  password=${PASSWORD}`);
  await conn.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
