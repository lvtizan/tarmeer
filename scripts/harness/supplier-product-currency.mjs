// 供应商产品「报价币种 + 价格解析」端到端回归（控制器级，不经 HTTP）
//
// 为什么不复用 supplier-product-price.mjs：那份走 HTTP，需要完整后端起在 3002；
// 本地 checkout 没有 server/package.json、缺 @xenova/transformers，app.js 起不来。
// 本脚本直接调控制器函数打真实 MySQL，因此本地也能跑，SQL 与 schema 假设都真验证。
//
// 用法：node scripts/harness/supplier-product-currency.mjs
// 安全：仅允许连本地库（DB_HOST 非 localhost 直接拒跑），绝不碰生产 RDS。
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'server/dist/app.js'));

const host = process.env.DB_HOST || 'localhost';
if (!['localhost', '127.0.0.1'].includes(host)) {
  console.error(`拒绝执行：DB_HOST=${host} 不是本地库。本脚本会写入并删除数据，只允许本地运行。`);
  process.exit(1);
}

const pool = require(path.join(ROOT, 'server/dist/config/database.js')).default;
const { runAutoMigrate } = require(path.join(ROOT, 'server/dist/lib/autoMigrate.js'));
const ctrl = require(path.join(ROOT, 'server/dist/controllers/supplierProductController.js'));
const admin = require(path.join(ROOT, 'server/dist/controllers/supplierAdminController.js'));

let pass = 0, fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} — ${detail}`); }
};

/** 伪造 express res，捕获 status/json */
function mkRes() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

await runAutoMigrate();
const [cols] = await pool.execute(
  `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplier_products' AND COLUMN_NAME = 'price_currency'`);
check('迁移后 price_currency 列存在', cols.length === 1, JSON.stringify(cols));
check('列类型 varchar(8) NULL',
  cols[0]?.DATA_TYPE === 'varchar' && Number(cols[0]?.CHARACTER_MAXIMUM_LENGTH) === 8 && cols[0]?.IS_NULLABLE === 'YES',
  JSON.stringify(cols[0]));

// 宿主 profile：优先用已有的，本地空库则临时造一个（跑完删除）
let [profs] = await pool.execute('SELECT id, supplier_user_id FROM supplier_profiles WHERE supplier_user_id IS NOT NULL ORDER BY id LIMIT 1');
let seeded = null;
if (profs.length === 0) {
  const [u] = await pool.execute("INSERT INTO supplier_users (email, password, full_name) VALUES ('harness-currency@local.test', 'x', 'harness')");
  const [p] = await pool.execute(
    "INSERT INTO supplier_profiles (supplier_user_id, company_name, slug, origin, status, country) VALUES (?, 'Harness Currency Co', 'harness-currency-co', 'china', 'approved', 'ae')",
    [u.insertId]);
  seeded = { userId: u.insertId, profileId: p.insertId };
  profs = [{ id: p.insertId, supplier_user_id: u.insertId }];
}
const { id: profileId, supplier_user_id: userId } = profs[0];

const created = [];
const IMG = { image_urls: ['/uploads/harness-currency.jpg'] };
const add = async (body) => {
  const res = mkRes();
  await ctrl.addProduct({ supplierUser: { id: userId }, body }, res);
  if (res.body?.product?.id) created.push(res.body.product.id);
  return res;
};

let r = await add({ ...IMG });
check('UC1 不填价格 → 400', r.statusCode === 400, `got ${r.statusCode}`);

r = await add({ ...IMG, price: 0, price_unit: 'SQM' });
check('UC2 价格<=0 → 400', r.statusCode === 400, `got ${r.statusCode}`);

r = await add({ ...IMG, price: 100 });
check('UC3 缺单位 → 400', r.statusCode === 400, `got ${r.statusCode}`);

const r4 = await add({ ...IMG, price: 1200, price_unit: 'SQM', price_from: true });
check('UC4 合法 → 201', r4.statusCode === 201, `got ${r4.statusCode} ${JSON.stringify(r4.body)}`);
check('UC4 price 落库 = 1200', Number(r4.body?.product?.price) === 1200, `got ${r4.body?.product?.price}`);
check('UC4 unit 落库 = SQM', r4.body?.product?.price_unit === 'SQM', `got ${r4.body?.product?.price_unit}`);
check('UC4 from 落库 = 1', Number(r4.body?.product?.price_from) === 1, `got ${r4.body?.product?.price_from}`);

const r5 = await add({ ...IMG, price: 150, price_unit: 'SQM', price_currency: 'CNY' });
check('UC5 带币种 → 201', r5.statusCode === 201, `got ${r5.statusCode}`);
check('UC5 price_currency 落库 = CNY', r5.body?.product?.price_currency === 'CNY', `got ${r5.body?.product?.price_currency}`);

r = await add({ ...IMG, price: 150, price_unit: 'SQM', price_currency: '元' });
check('UC6 非白名单币种 → 400（防脏值入库）', r.statusCode === 400, `got ${r.statusCode}`);

const r7 = await add({ ...IMG, price: 88, price_unit: 'PCS' });
check('UC7 缺省币种 → 201', r7.statusCode === 201, `got ${r7.statusCode}`);
check('UC7 price_currency = null（展示层回落国家币种）', r7.body?.product?.price_currency === null, `got ${JSON.stringify(r7.body?.product?.price_currency)}`);

const pid = r5.body?.product?.id;
if (pid) {
  const ru = mkRes();
  await ctrl.updateProduct({ supplierUser: { id: userId }, params: { id: pid }, body: { ...IMG, price: 150, price_unit: 'SQM', price_currency: 'USD' } }, ru);
  check('UC8 供应商侧改币种 → 200', ru.statusCode === 200, `got ${ru.statusCode}`);
  check('UC8 币种更新为 USD', ru.body?.product?.price_currency === 'USD', `got ${ru.body?.product?.price_currency}`);

  // admin 是局部更新：只传 price_currency 不得把 price 清成 null
  const ra = mkRes();
  await admin.adminUpdateProduct({ admin: { id: 1, role: 'admin' }, params: { id: profileId, productId: pid }, body: { price_currency: 'AED' } }, ra);
  check('UC9 admin 局部更新 → 200', ra.statusCode === 200, `got ${ra.statusCode}`);
  const [after] = await pool.execute('SELECT price, price_currency FROM supplier_products WHERE id = ?', [pid]);
  check('UC9 币种改为 AED', after[0]?.price_currency === 'AED', `got ${after[0]?.price_currency}`);
  check('UC9 price 未被连带清空（仍 150）', Number(after[0]?.price) === 150, `got ${after[0]?.price}`);

  const rb = mkRes();
  await admin.adminUpdateProduct({ admin: { id: 1, role: 'admin' }, params: { id: profileId, productId: pid }, body: { price_currency: '元' } }, rb);
  const [dirty] = await pool.execute('SELECT price_currency FROM supplier_products WHERE id = ?', [pid]);
  check('UC10 admin 非白名单币种落 null（不入脏值）', dirty[0]?.price_currency === null, `got ${dirty[0]?.price_currency}`);
}

// 清理
for (const id of created) await pool.execute('DELETE FROM supplier_products WHERE id = ?', [id]);
if (seeded) {
  await pool.execute('DELETE FROM supplier_profiles WHERE id = ?', [seeded.profileId]);
  await pool.execute('DELETE FROM supplier_users WHERE id = ?', [seeded.userId]);
}
const [leftover] = await pool.execute('SELECT COUNT(*) c FROM supplier_products WHERE image_url = ?', [IMG.image_urls[0]]);
check('cleanup: 测试数据已删净', Number(leftover[0].c) === 0, `残留 ${leftover[0].c} 条`);

console.log(`\nsupplier-product-currency: ${pass}/${pass + fail} PASS`);
await pool.end();
process.exit(fail === 0 ? 0 : 1);
