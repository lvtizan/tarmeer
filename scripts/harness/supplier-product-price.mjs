// 供应商产品价格 端到端回归
// 用法：先确保本地后端 3002 在跑（已含价格校验改动），然后 node scripts/harness/supplier-product-price.mjs
// 校验：UC1 不填价格→400, UC2 价格<=0→400, UC3 缺单位→400, UC4 合法→201 且落库, 然后清理
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'server/dist/app.js'));
const jwt = require('jsonwebtoken');

const BASE = process.env.API_BASE || 'http://localhost:3002/api';
const SUPPLIER_USER_ID = 910; // atelier-dune (approved seed)

function readJwtSecret() {
  try {
    const env = fs.readFileSync(path.join(ROOT, 'server/.env'), 'utf8');
    const m = env.match(/^JWT_SECRET=(.*)$/m);
    if (m) return m[1].trim();
  } catch { /* fall through to default */ }
  return process.env.JWT_SECRET || 'dev_jwt_secret_min_32_chars_for_local_testing_only';
}

const token = jwt.sign({ supplierUserId: SUPPLIER_USER_ID }, readJwtSecret());
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const post = (body) =>
  fetch(`${BASE}/suppliers/me/products`, { method: 'POST', headers: H, body: JSON.stringify(body) })
    .then(async (r) => [r.status, await r.json()]);

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} — ${detail}`); }
}

// 先确认 token 有效
const [ps, pj] = await fetch(`${BASE}/suppliers/me/profile`, { headers: H }).then(async (r) => [r.status, await r.json()]);
check('auth: GET /me/profile 200', ps === 200, `got ${ps}`);
if (ps !== 200) { console.error('鉴权失败，后端未起或 JWT_SECRET 不匹配。终止。'); process.exit(1); }

// UC1 不填价格 → 400
let [s] = await post({ image_urls: ['/uploads/x.jpg'] });
check('UC1 不填价格 → 400', s === 400, `got ${s}`);

// UC2 价格<=0 → 400
[s] = await post({ image_urls: ['/uploads/x.jpg'], price: 0, price_unit: 'SQM' });
check('UC2 价格<=0 → 400', s === 400, `got ${s}`);

// UC3 缺单位 → 400
[s] = await post({ image_urls: ['/uploads/x.jpg'], price: 100 });
check('UC3 缺单位 → 400', s === 400, `got ${s}`);

// UC4 合法 → 201 且落库
let [s4, j4] = await post({ image_urls: ['/uploads/x.jpg'], price: 1200, price_unit: 'SQM', price_from: true });
check('UC4 合法 → 201', s4 === 201, `got ${s4}`);
check('UC4 price 落库 = 1200', Number(j4.product?.price) === 1200, `got ${j4.product?.price}`);
check('UC4 unit 落库 = SQM', j4.product?.price_unit === 'SQM', `got ${j4.product?.price_unit}`);
check('UC4 from 落库 = 1', Number(j4.product?.price_from) === 1, `got ${j4.product?.price_from}`);

// 清理
const id = j4.product?.id;
if (id) {
  const d = await fetch(`${BASE}/suppliers/me/products/${id}`, { method: 'DELETE', headers: H });
  check('cleanup: DELETE 200', d.status === 200, `got ${d.status}`);
}

console.log(`\nsupplier-product-price: ${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
