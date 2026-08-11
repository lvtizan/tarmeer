#!/usr/bin/env node

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const commonDir = path.resolve(ROOT, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: ROOT, encoding: 'utf8' }).trim());
const MAIN_SERVER = process.env.TARMEER_MAIN_SERVER_DIR
  ? path.resolve(process.env.TARMEER_MAIN_SERVER_DIR)
  : path.join(path.dirname(commonDir), 'server');
const envPath = existsSync(path.join(ROOT, 'server/.env'))
  ? path.join(ROOT, 'server/.env')
  : path.join(MAIN_SERVER, '.env');
if (!existsSync(envPath)) throw new Error('拒绝执行：找不到 server/.env。');

const mainRequire = createRequire(path.join(MAIN_SERVER, 'package.json'));
mainRequire('dotenv').config({ path: envPath, override: true, quiet: true });
if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || '') || process.env.DB_NAME !== 'tarmeer') {
  throw new Error('拒绝执行：仅允许连接本地 tarmeer 数据库。');
}
process.env.NODE_PATH = path.join(MAIN_SERVER, 'node_modules');
mainRequire('module').Module._initPaths();

const require = createRequire(path.join(ROOT, 'server/dist/app.js'));
const products = require(path.join(ROOT, 'server/dist/controllers/supplierProductController.js'));
const macros = require(path.join(ROOT, 'server/dist/controllers/materialsMacroController.js'));
const pool = require(path.join(ROOT, 'server/dist/config/database.js')).default;
const priceFields = ['price', 'price_max', 'price_unit', 'price_currency', 'price_from'];
let passed = 0;
let failed = 0;

const check = (label, condition, detail = '') => {
  if (condition) { passed++; console.log(`✓ ${label}`); }
  else { failed++; console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};
const hasPriceContract = (item) => item && priceFields.every((field) => Object.hasOwn(item, field));
const invoke = async (controller, { country, params = {}, query = {} }) => {
  const response = { statusCode: 200, body: null };
  response.status = (code) => { response.statusCode = code; return response; };
  response.json = (body) => { response.body = body; return response; };
  await controller({ country, params, query: { ...query, country } }, response);
  return response;
};

try {
  const feeds = [];
  for (const country of ['ae', 'vn']) {
    feeds.push({ country, response: await invoke(products.listPublicProductsFeed, { country, query: { limit: '100' } }) });
  }
  const seeded = feeds.find(({ response }) => response.statusCode === 200 && response.body?.products?.length > 0);
  if (!seeded) throw new Error('本地库没有可见的公开产品 seed。');
  const selected = seeded.response.body.products[0];
  const otherCountry = seeded.country === 'ae' ? 'vn' : 'ae';

  check('standard feed exposes five price fields', seeded.response.body.products.every(hasPriceContract));
  const detail = await invoke(products.getPublicProductDetail, { country: seeded.country, params: { id: String(selected.id) } });
  check('standard detail exposes five price fields', detail.statusCode === 200 && hasPriceContract(detail.body?.product));
  check('related exposes five price fields', Array.isArray(detail.body?.related) && detail.body.related.every(hasPriceContract));
  const wrongDetail = await invoke(products.getPublicProductDetail, { country: otherCountry, params: { id: String(selected.id) } });
  check('wrong country cannot return selected detail', wrongDetail.statusCode === 404, `got ${wrongDetail.statusCode}`);
  const wrongFeed = feeds.find((entry) => entry.country === otherCountry)?.response.body?.products || [];
  check('wrong country feed excludes selected product', !wrongFeed.some((product) => product.id === selected.id));

  const popular = await invoke(macros.getPopularProducts, { country: seeded.country, query: { limit: '24' } });
  check('popular exposes five price fields', popular.statusCode === 200 && popular.body?.products?.length > 0 && popular.body.products.every(hasPriceContract));
  const q = String(selected.title || selected.category || '').trim().split(/\s+/)[0] || String(selected.id);
  const search = await invoke(macros.getMaterialSearch, { country: seeded.country, query: { type: 'products', q, limit: '48' } });
  check('search exposes five price fields', search.statusCode === 200 && search.body?.results?.length > 0 && search.body.results.every(hasPriceContract));
  const categoryList = await invoke(macros.getMacroCategories, { country: seeded.country });
  const populated = categoryList.body?.macros?.find((macro) => Number(macro.productCount) > 0);
  check('macro category returns populated seed', categoryList.statusCode === 200 && Boolean(populated));
  if (populated) {
    const category = await invoke(macros.getMacroProducts, { country: seeded.country, params: { key: populated.key }, query: { limit: '48' } });
    check('macro category products expose five price fields', category.statusCode === 200 && category.body?.products?.length > 0 && category.body.products.every(hasPriceContract));
  }
} finally {
  await pool.end();
}

console.log(`\n${passed}/${passed + failed} checks passed`);
if (failed) process.exit(1);
