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
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'server/dist/app.js'));
const resolveMainServer = () => {
  if (process.env.TARMEER_MAIN_SERVER_DIR) return path.resolve(process.env.TARMEER_MAIN_SERVER_DIR);
  try {
    const commonDirRaw = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8' }).trim();
    const commonDir = path.resolve(ROOT, commonDirRaw);
    return path.join(path.dirname(commonDir), 'server');
  } catch {
    throw new Error('拒绝执行：无法从 Git common dir 推导主 checkout；请设置 TARMEER_MAIN_SERVER_DIR。');
  }
};
const MAIN_SERVER = resolveMainServer();
const worktreeEnv = path.join(ROOT, 'server/.env');
const envPath = existsSync(worktreeEnv) ? worktreeEnv : path.join(MAIN_SERVER, '.env');
if (!existsSync(envPath)) throw new Error('拒绝执行：找不到 server/.env，无法确认数据库环境。');

// 必须在 require database/config 之前加载并验证最终环境，避免 config 内部 dotenv 后加载绕过安全闸门。
const mainRequire = createRequire(path.join(MAIN_SERVER, 'package.json'));
mainRequire('dotenv').config({ path: envPath, override: true, quiet: true });
const host = process.env.DB_HOST;
const databaseName = process.env.DB_NAME;
if (!['localhost', '127.0.0.1', '::1'].includes(host || '') || databaseName !== 'tarmeer') {
  throw new Error('拒绝执行：数据库环境未明确指向本地 tarmeer；不会显示或连接实际配置值。');
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

const created = [];
let seeded = null;
const marker = `${Date.now()}-${process.pid}-${randomUUID().slice(0, 8)}`;
const IMG = { image_urls: [`/uploads/harness-currency-${marker}.jpg`] };
let primaryError = null;

try {
await runAutoMigrate();
const [cols] = await pool.execute(
  `SELECT DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplier_products' AND COLUMN_NAME = 'price_currency'`);
check('迁移后 price_currency 列存在', cols.length === 1, JSON.stringify(cols));
check('列类型 varchar(8) NULL',
  cols[0]?.DATA_TYPE === 'varchar' && Number(cols[0]?.CHARACTER_MAXIMUM_LENGTH) === 8 && cols[0]?.IS_NULLABLE === 'YES',
  JSON.stringify(cols[0]));
const [maxCols] = await pool.execute(
  `SELECT DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'supplier_products' AND COLUMN_NAME = 'price_max'`);
check('迁移后 price_max 列存在', maxCols.length === 1, JSON.stringify(maxCols));
check('price_max 类型 decimal(12,2) NULL',
  maxCols[0]?.DATA_TYPE === 'decimal'
    && Number(maxCols[0]?.NUMERIC_PRECISION) === 12
    && Number(maxCols[0]?.NUMERIC_SCALE) === 2
    && maxCols[0]?.IS_NULLABLE === 'YES',
  JSON.stringify(maxCols[0]));
const hasPriceMaxColumn = maxCols.length === 1;
const readBounds = async (productId) => {
  if (!hasPriceMaxColumn) return null;
  const [rows] = await pool.execute('SELECT price, price_max FROM supplier_products WHERE id = ?', [productId]);
  return rows[0] || null;
};
const checkBounds = async (name, productId, expectedPrice, expectedMax) => {
  const bounds = await readBounds(productId);
  check(name,
    Number(bounds?.price) === expectedPrice
      && (expectedMax === null ? bounds?.price_max === null : Number(bounds?.price_max) === expectedMax),
    bounds ? JSON.stringify(bounds) : 'price_max schema missing');
};

// 宿主 profile：优先用已有的，本地空库则临时造一个（跑完删除）
let [profs] = await pool.execute('SELECT id, supplier_user_id FROM supplier_profiles WHERE supplier_user_id IS NOT NULL ORDER BY id LIMIT 1');
if (profs.length === 0) {
  const [u] = await pool.execute(
    'INSERT INTO supplier_users (email, password, full_name) VALUES (?, ?, ?)',
    [`harness-currency-${marker}@local.test`, 'x', 'harness']);
  seeded = { userId: u.insertId, profileId: null };
  const [p] = await pool.execute(
    "INSERT INTO supplier_profiles (supplier_user_id, company_name, slug, origin, status, country) VALUES (?, 'Harness Currency Co', ?, 'china', 'approved', 'ae')",
    [u.insertId, `harness-currency-${marker}`]);
  seeded = { ...seeded, profileId: p.insertId };
  profs = [{ id: p.insertId, supplier_user_id: u.insertId }];
}
const { id: profileId, supplier_user_id: userId } = profs[0];

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

r = await add({ ...IMG, price: 200, price_max: 199.99, price_unit: 'SQM' });
check('UC6b 最高价低于最低价 → 400', r.statusCode === 400, `got ${r.statusCode}`);

const invalidDecimals = [
  ['', '空串'], [' ', '空白'], [null, 'null'], [Infinity, 'Infinity'], [NaN, 'NaN'],
  ['1e2', '科学计数'], ['0x10', '十六进制'], ['0.001', '超过2位小数'], ['10000000000', '超过DECIMAL上界'],
];
for (const [value, label] of invalidDecimals) {
  const invalidPrice = await add({ ...IMG, price: value, price_unit: 'SQM' });
  check(`UC6c price拒绝${label}`, invalidPrice.statusCode === 400 && /price/i.test(invalidPrice.body?.error || ''), `got ${invalidPrice.statusCode} ${JSON.stringify(invalidPrice.body)}`);
}
for (const [value, label] of invalidDecimals.filter(([value]) => value !== null)) {
  const invalidMax = await add({ ...IMG, price: 1, price_max: value, price_unit: 'SQM' });
  check(`UC6d price_max拒绝${label}`, invalidMax.statusCode === 400 && /price_max/i.test(invalidMax.body?.error || ''), `got ${invalidMax.statusCode} ${JSON.stringify(invalidMax.body)}`);
}
const upperBound = await add({ ...IMG, price: '9999999999.99', price_max: '9999999999.99', price_unit: 'SQM' });
check('UC6e DECIMAL(12,2)上界可写', upperBound.statusCode === 201, `got ${upperBound.statusCode} ${JSON.stringify(upperBound.body)}`);

const r7 = await add({ ...IMG, price: 88, price_unit: 'PCS' });
check('UC7 缺省币种 → 201', r7.statusCode === 201, `got ${r7.statusCode}`);
check('UC7 price_currency = null（展示层回落国家币种）', r7.body?.product?.price_currency === null, `got ${JSON.stringify(r7.body?.product?.price_currency)}`);
check('UC7 price_max = null（无最高价不虚构范围）', r7.body?.product?.price_max === null, `got ${JSON.stringify(r7.body?.product?.price_max)}`);
if (r7.body?.product?.id) await checkBounds('UC7 price_max 真实落库 = null', r7.body.product.id, 88, null);

const rangeCreated = await add({ ...IMG, price: 120, price_max: 200, price_unit: 'SQM', price_currency: 'AED', price_from: true });
check('UC7b 合法区间创建 → 201', rangeCreated.statusCode === 201, `got ${rangeCreated.statusCode} ${JSON.stringify(rangeCreated.body)}`);
check('UC7b price 保留最低价 = 120', Number(rangeCreated.body?.product?.price) === 120, `got ${rangeCreated.body?.product?.price}`);
check('UC7b price_max 创建响应/落库 = 200', Number(rangeCreated.body?.product?.price_max) === 200, `got ${rangeCreated.body?.product?.price_max}`);

const rangePid = rangeCreated.body?.product?.id;
check('UC7b 区间产品 id 存在（后续用例不得静默跳过）', Number.isInteger(Number(rangePid)) && Number(rangePid) > 0, `got ${rangePid}`);
if (rangePid) {
  const rangeUpdate = mkRes();
  await ctrl.updateProduct({ supplierUser: { id: userId }, params: { id: rangePid }, body: { ...IMG, price: 130, price_max: 240, price_unit: 'SQM', price_currency: 'AED' } }, rangeUpdate);
  check('UC7c 合法区间更新 → 200', rangeUpdate.statusCode === 200, `got ${rangeUpdate.statusCode} ${JSON.stringify(rangeUpdate.body)}`);
  check('UC7c price 更新响应仍为最低价 130', Number(rangeUpdate.body?.product?.price) === 130, `got ${rangeUpdate.body?.product?.price}`);
  check('UC7c price_max 更新响应/落库 = 240', Number(rangeUpdate.body?.product?.price_max) === 240, `got ${rangeUpdate.body?.product?.price_max}`);
  await checkBounds('UC7c price/price_max 真实落库 = 130/240', rangePid, 130, 240);

  const invalidSupplierUpdate = mkRes();
  await ctrl.updateProduct({ supplierUser: { id: userId }, params: { id: rangePid }, body: { ...IMG, price: 130, price_max: 129, price_unit: 'SQM' } }, invalidSupplierUpdate);
  check('UC7d 供应商更新最高价低于最低价 → 400', invalidSupplierUpdate.statusCode === 400, `got ${invalidSupplierUpdate.statusCode}`);
  await checkBounds('UC7d 拒绝后两端仍为 130/240', rangePid, 130, 240);

  const invalidAdminMin = mkRes();
  await admin.adminUpdateProduct({ admin: { id: 1, role: 'admin' }, params: { id: profileId, productId: rangePid }, body: { price: 250 } }, invalidAdminMin);
  check('UC7e admin 只提高最低价越过已存最高价 → 400', invalidAdminMin.statusCode === 400, `got ${invalidAdminMin.statusCode}`);
  await checkBounds('UC7e 拒绝后两端仍为 130/240', rangePid, 130, 240);

  const invalidAdminMax = mkRes();
  await admin.adminUpdateProduct({ admin: { id: 1, role: 'admin' }, params: { id: profileId, productId: rangePid }, body: { price_max: 100 } }, invalidAdminMax);
  check('UC7f admin 只降低最高价到已存最低价以下 → 400', invalidAdminMax.statusCode === 400, `got ${invalidAdminMax.statusCode}`);
  await checkBounds('UC7f 拒绝后两端仍为 130/240', rangePid, 130, 240);

  const boundaryAdmin = mkRes();
  await admin.adminUpdateProduct({ admin: { id: 1, role: 'admin' }, params: { id: profileId, productId: rangePid }, body: { price_max: 130 } }, boundaryAdmin);
  check('UC7g admin 最高价等于最低价边界 → 200', boundaryAdmin.statusCode === 200, `got ${boundaryAdmin.statusCode}`);
  await checkBounds('UC7g 边界值真实落库 = 130/130', rangePid, 130, 130);

  const clearSupplierMax = mkRes();
  await ctrl.updateProduct({ supplierUser: { id: userId }, params: { id: rangePid }, body: { ...IMG, price: 130, price_max: null, price_unit: 'SQM' } }, clearSupplierMax);
  check('UC7h 供应商用 null 清除已有最高价 → 200', clearSupplierMax.statusCode === 200, `got ${clearSupplierMax.statusCode}`);
  check('UC7h 清除响应 price_max = null', clearSupplierMax.body?.product?.price_max === null, `got ${JSON.stringify(clearSupplierMax.body?.product?.price_max)}`);
  await checkBounds('UC7h 清除后真实落库 = 130/null', rangePid, 130, null);

  const restoreSupplierMax = mkRes();
  await ctrl.updateProduct({ supplierUser: { id: userId }, params: { id: rangePid }, body: { ...IMG, price: 130, price_max: 240, price_unit: 'SQM' } }, restoreSupplierMax);
  check('UC7i 为 admin 清除用例恢复最高价 → 200', restoreSupplierMax.statusCode === 200, `got ${restoreSupplierMax.statusCode}`);
  await checkBounds('UC7i 最高价恢复为 240', rangePid, 130, 240);

  const concurrentMin = mkRes();
  const concurrentMax = mkRes();
  await Promise.all([
    admin.adminUpdateProduct({ admin: { id: 1, role: 'admin' }, params: { id: profileId, productId: rangePid }, body: { price: 230 } }, concurrentMin),
    admin.adminUpdateProduct({ admin: { id: 1, role: 'admin' }, params: { id: profileId, productId: rangePid }, body: { price_max: 220 } }, concurrentMax),
  ]);
  const concurrentBounds = await readBounds(rangePid);
  const concurrentValid = concurrentBounds?.price_max === null || Number(concurrentBounds?.price_max) >= Number(concurrentBounds?.price);
  check('UC7j admin 并发局部更新至少一方拒绝', [concurrentMin.statusCode, concurrentMax.statusCode].filter((code) => code === 400).length >= 1,
    `got ${concurrentMin.statusCode}/${concurrentMax.statusCode}`);
  check('UC7j admin 并发后区间仍合法', concurrentValid, JSON.stringify(concurrentBounds));

  const resetConcurrent = mkRes();
  await ctrl.updateProduct({ supplierUser: { id: userId }, params: { id: rangePid }, body: { ...IMG, price: 130, price_max: 240, price_unit: 'SQM' } }, resetConcurrent);
  check('UC7k 并发用例后恢复区间', resetConcurrent.statusCode === 200, `got ${resetConcurrent.statusCode}`);

  const blocker = await pool.getConnection();
  await blocker.beginTransaction();
  await blocker.execute('SELECT id FROM supplier_products WHERE id = ? FOR UPDATE', [rangePid]);
  let beforeLockReached = false;
  let afterLockReached = false;
  let lockRequestCompleted = false;
  const lockedUpdate = mkRes();
  const lockedUpdatePromise = admin.adminUpdateProduct({
    admin: { id: 1, role: 'admin' },
    params: { id: profileId, productId: rangePid },
    body: { price_from: false },
    priceRangeTestHooks: {
      beforeLock: () => { beforeLockReached = true; },
      afterLock: () => { afterLockReached = true; },
    },
  }, lockedUpdate).finally(() => { lockRequestCompleted = true; });
  await new Promise((resolve) => setTimeout(resolve, 100));
  check('UC7l admin 已发起加锁读取', beforeLockReached, `beforeLock=${beforeLockReached}`);
  check('UC7l blocker COMMIT 前不能越过行锁', !afterLockReached && !lockRequestCompleted,
    `afterLock=${afterLockReached}, completed=${lockRequestCompleted}`);
  await blocker.commit();
  blocker.release();
  await lockedUpdatePromise;
  check('UC7l blocker COMMIT 后更新完成', afterLockReached && lockRequestCompleted && lockedUpdate.statusCode === 200,
    `afterLock=${afterLockReached}, completed=${lockRequestCompleted}, status=${lockedUpdate.statusCode}`);

  const clearAdminMax = mkRes();
  await admin.adminUpdateProduct({ admin: { id: 1, role: 'admin' }, params: { id: profileId, productId: rangePid }, body: { price_max: null } }, clearAdminMax);
  check('UC7m admin 用 null 清除已有最高价 → 200', clearAdminMax.statusCode === 200, `got ${clearAdminMax.statusCode}`);
  await checkBounds('UC7m admin 清除后真实落库 = 130/null', rangePid, 130, null);
}

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

const [legacyInsert] = await pool.execute(
  `INSERT INTO supplier_products
   (supplier_profile_id, title, image_url, price, price_max, price_unit, price_currency, price_from)
   VALUES (?, ?, ?, NULL, NULL, NULL, ?, 1)`,
  [profileId, `Legacy ${marker}`, IMG.image_urls[0], 'CNY']);
const legacyPid = legacyInsert.insertId;
created.push(legacyPid);
const legacyTitleUpdate = mkRes();
await ctrl.updateProduct({
  supplierUser: { id: userId }, params: { id: legacyPid },
  body: { title: `Legacy renamed ${marker}`, image_url: IMG.image_urls[0] },
}, legacyTitleUpdate);
check('UC11 legacy无价产品省略价格组仍可编辑', legacyTitleUpdate.statusCode === 200,
  `got ${legacyTitleUpdate.statusCode} ${JSON.stringify(legacyTitleUpdate.body)}`);
const [legacyAfterTitle] = await pool.execute(
  'SELECT title, price, price_max, price_unit, price_currency, price_from FROM supplier_products WHERE id = ?',
  [legacyPid]);
check('UC11 legacy编辑不触碰五个价格字段',
  legacyAfterTitle[0]?.title === `Legacy renamed ${marker}`
    && legacyAfterTitle[0]?.price === null
    && legacyAfterTitle[0]?.price_max === null
    && legacyAfterTitle[0]?.price_unit === null
    && legacyAfterTitle[0]?.price_currency === 'CNY'
    && Number(legacyAfterTitle[0]?.price_from) === 1,
  JSON.stringify(legacyAfterTitle[0]));

const incompletePriceGroup = mkRes();
await ctrl.updateProduct({
  supplierUser: { id: userId }, params: { id: legacyPid },
  body: { title: 'must not persist', price_from: false },
}, incompletePriceGroup);
check('UC12 supplier更新出现任一价格键但缺完整组 → 400', incompletePriceGroup.statusCode === 400,
  `got ${incompletePriceGroup.statusCode} ${JSON.stringify(incompletePriceGroup.body)}`);

const completePriceGroup = mkRes();
await ctrl.updateProduct({
  supplierUser: { id: userId }, params: { id: legacyPid },
  body: { title: `Priced ${marker}`, price: '12.50', price_max: '20.00', price_unit: 'SQM', price_currency: 'AED', price_from: false },
}, completePriceGroup);
check('UC13 supplier更新完整价格组成功', completePriceGroup.statusCode === 200
  && Number(completePriceGroup.body?.product?.price) === 12.5
  && Number(completePriceGroup.body?.product?.price_max) === 20,
  `got ${completePriceGroup.statusCode} ${JSON.stringify(completePriceGroup.body)}`);

} catch (error) {
  primaryError = error;
} finally {
  const cleanupErrors = [];
  let fallbackAffected = null;
  let leftoverCount = null;
  for (const id of created) {
    try { await pool.execute('DELETE FROM supplier_products WHERE id = ?', [id]); }
    catch (error) { cleanupErrors.push(error); }
  }
  try {
    const [fallback] = await pool.execute('DELETE FROM supplier_products WHERE image_url = ?', [IMG.image_urls[0]]);
    fallbackAffected = Number(fallback.affectedRows);
    const [leftover] = await pool.execute('SELECT COUNT(*) c FROM supplier_products WHERE image_url = ?', [IMG.image_urls[0]]);
    leftoverCount = Number(leftover[0]?.c);
  } catch (error) {
    cleanupErrors.push(error);
  }
  check('cleanup: marker 兜底删除已执行并返回 affectedRows', Number.isInteger(fallbackAffected) && fallbackAffected >= 0, `got ${fallbackAffected}`);
  check('cleanup: 本轮 marker 产品残留 = 0', leftoverCount === 0, `残留 ${leftoverCount}`);
  if (seeded?.profileId) {
    try { await pool.execute('DELETE FROM supplier_profiles WHERE id = ?', [seeded.profileId]); }
    catch (error) { cleanupErrors.push(error); }
  }
  if (seeded?.userId) {
    try { await pool.execute('DELETE FROM supplier_users WHERE id = ?', [seeded.userId]); }
    catch (error) { cleanupErrors.push(error); }
  }
  try { await pool.end(); }
  catch (error) { cleanupErrors.push(error); }

  check('cleanup: 已记录的测试数据均已尝试清理', cleanupErrors.length === 0, `${cleanupErrors.length} 个清理错误`);
  if (cleanupErrors.length > 0 && !primaryError) primaryError = new AggregateError(cleanupErrors, '测试清理失败');
  else if (cleanupErrors.length > 0) console.error(`另有 ${cleanupErrors.length} 个清理错误；保留原始失败。`);
}

console.log(`\nsupplier-product-currency: ${pass}/${pass + fail} PASS`);
if (primaryError) throw primaryError;
process.exitCode = fail === 0 ? 0 : 1;
