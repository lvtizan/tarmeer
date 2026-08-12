#!/usr/bin/env node

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { buildProductPriceLabel, ProductPriceText } from '../../src/lib/productPriceDisplay.ts';
import { normalizeProductPriceFields } from '../../src/lib/supplierProductUnits.ts';

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
const marker = `harness-public-price-${Date.now()}-${process.pid}-${randomUUID().slice(0, 8)}`;
const createdProfileIds = [];
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

let primaryError = null;
try {
  const [categoryRows] = await pool.execute(
    "SELECT value FROM product_categories WHERE is_enabled = 1 AND parent_value IS NOT NULL ORDER BY sort_order, id LIMIT 1");
  const category = categoryRows[0]?.value;
  if (!category) throw new Error('本地库没有可用的产品子分类 seed。');

  const fixtureIds = {};
  for (const country of ['ae', 'vn']) {
    const [profileResult] = await pool.execute(
      `INSERT INTO supplier_profiles
       (company_name, slug, origin, status, country, is_published, categories, weight_score)
       VALUES (?, ?, 'china', 'approved', ?, 1, ?, 999999)`,
      [`Harness Public Price ${country.toUpperCase()}`, `${marker}-${country}`, country, JSON.stringify([category])]);
    const profileId = Number(profileResult.insertId);
    createdProfileIds.push(profileId);
    fixtureIds[country] = {};
    const fixtures = country === 'ae' ? [
      ['range', 120, 200, 'SQM', null, 1],
      ['from', 80, null, 'PCS', 'USD', 1],
      ['none', null, null, null, null, 0],
    ] : [
      ['range', 50000, 75000, 'PCS', null, 0],
      ['from', 90000, null, 'PCS', 'VND', 1],
      ['none', null, null, null, null, 0],
    ];
    for (const [kind, price, priceMax, unit, currency, from] of fixtures) {
      const [productResult] = await pool.execute(
        `INSERT INTO supplier_products
         (supplier_profile_id, title, image_url, category, sort_order, price, price_max, price_unit, price_currency, price_from)
         VALUES (?, ?, ?, ?, -999999, ?, ?, ?, ?, ?)`,
        [profileId, `${marker}-${country}-${kind}`, `/uploads/${marker}-${country}-${kind}.jpg`, category,
          price, priceMax, unit, currency, from]);
      fixtureIds[country][kind] = Number(productResult.insertId);
    }
  }
  check('harness seeds unique AE/VN price fixtures', createdProfileIds.length === 2);

  const feeds = [];
  for (const country of ['ae', 'vn']) {
    feeds.push({ country, response: await invoke(products.listPublicProductsFeed, { country, query: { limit: '100' } }) });
  }
  const seeded = feeds.find(({ country }) => country === 'ae');
  const selected = seeded.response.body.products.find((item) => item.id === fixtureIds.ae.range);
  if (!selected) throw new Error('AE range fixture 未进入标准公开 feed。');
  const otherCountry = 'vn';

  check('standard feed exposes five price fields', seeded.response.body.products.every(hasPriceContract));
  const detail = await invoke(products.getPublicProductDetail, { country: seeded.country, params: { id: String(selected.id) } });
  check('standard detail exposes five price fields', detail.statusCode === 200 && hasPriceContract(detail.body?.product));
  check('related is non-empty, same-country only, and exposes five price fields',
    Array.isArray(detail.body?.related)
      && detail.body.related.length > 0
      && detail.body.related.some((item) => item.id === fixtureIds.ae.from)
      && !detail.body.related.some((item) => Object.values(fixtureIds.vn).includes(item.id))
      && detail.body.related.every(hasPriceContract));
  const wrongDetail = await invoke(products.getPublicProductDetail, { country: otherCountry, params: { id: String(selected.id) } });
  check('wrong country cannot return selected detail', wrongDetail.statusCode === 404, `got ${wrongDetail.statusCode}`);
  const wrongFeed = feeds.find((entry) => entry.country === otherCountry)?.response.body?.products || [];
  check('wrong country feed excludes selected product', !wrongFeed.some((product) => product.id === selected.id));

  for (const country of ['ae', 'vn']) {
    const fallbackCurrency = country === 'ae' ? 'AED' : 'VND';
    const expected = country === 'ae'
      ? { range: 'AED 120–200 / ㎡', from: 'USD 80 (from) / pcs' }
      : { range: 'VND 50,000–75,000 / pcs', from: 'VND 90,000 (from) / pcs' };
    for (const kind of ['range', 'from', 'none']) {
      const feedRaw = feeds.find((entry) => entry.country === country)?.response.body?.products
        ?.find((item) => item.id === fixtureIds[country][kind]);
      const feedMapped = { ...feedRaw, ...normalizeProductPriceFields(feedRaw) };
      const feedLabel = buildProductPriceLabel(feedMapped, fallbackCurrency);
      const feedHtml = renderToStaticMarkup(createElement(ProductPriceText, { product: feedMapped, fallbackCurrency }));
      const response = await invoke(products.getPublicProductDetail, {
        country, params: { id: String(fixtureIds[country][kind]) },
      });
      const raw = response.body?.product;
      const mapped = { ...raw, ...normalizeProductPriceFields(raw) };
      const label = buildProductPriceLabel(mapped, fallbackCurrency);
      const html = renderToStaticMarkup(createElement(ProductPriceText, { product: mapped, fallbackCurrency }));
      if (kind === 'none') {
        check(`${country} ${kind} feed→mapper hides DOM`, feedRaw && feedLabel === '' && feedHtml === '', `${feedLabel} ${feedHtml}`);
        check(`${country} no-price mapper hides DOM`, response.statusCode === 200 && raw && label === '' && html === '', `${response.statusCode} ${label} ${html}`);
      } else {
        check(`${country} ${kind} feed→mapper→DOM exact`,
          feedRaw && feedLabel === expected[kind] && feedHtml.includes(`>${expected[kind]}</p>`) && feedHtml.includes('text-[#b8864a]'),
          `${feedLabel} ${feedHtml}`);
        check(`${country} ${kind} controller→mapper→DOM exact`,
          response.statusCode === 200 && raw && label === expected[kind] && html.includes(`>${expected[kind]}</p>`) && html.includes('text-[#b8864a]'),
          `${label} ${html}`);
      }
    }
    const opposite = country === 'ae' ? 'vn' : 'ae';
    const isolated = await invoke(products.getPublicProductDetail, {
      country: opposite, params: { id: String(fixtureIds[country].range) },
    });
    check(`${country} fixture hidden from ${opposite}`, isolated.statusCode === 404, `got ${isolated.statusCode}`);
  }

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
} catch (error) {
  primaryError = error;
} finally {
  const cleanupErrors = [];
  try { await pool.execute('DELETE FROM supplier_products WHERE title LIKE ?', [`${marker}%`]); }
  catch (error) { cleanupErrors.push(error); }
  try { await pool.execute('DELETE FROM supplier_profiles WHERE slug LIKE ?', [`${marker}%`]); }
  catch (error) { cleanupErrors.push(error); }
  try {
    const [productsLeft] = await pool.execute('SELECT COUNT(*) c FROM supplier_products WHERE title LIKE ?', [`${marker}%`]);
    const [profilesLeft] = await pool.execute('SELECT COUNT(*) c FROM supplier_profiles WHERE slug LIKE ?', [`${marker}%`]);
    const clean = Number(productsLeft[0]?.c) === 0 && Number(profilesLeft[0]?.c) === 0;
    check('cleanup removes unique marker fixtures', clean);
    if (!clean) cleanupErrors.push(new Error('unique marker fixtures remain after cleanup'));
  } catch (error) { cleanupErrors.push(error); }
  try { await pool.end(); } catch (error) { cleanupErrors.push(error); }
  if (cleanupErrors.length) {
    primaryError = new AggregateError(primaryError ? [primaryError, ...cleanupErrors] : cleanupErrors, 'fixture run/cleanup failed');
  }
}

console.log(`\n${passed}/${passed + failed} checks passed`);
if (primaryError) throw primaryError;
if (failed) process.exit(1);
