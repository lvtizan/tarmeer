// 供应商产品自动翻译 端到端回归 — node scripts/harness/supplier-product-translate.mjs
// 前置:本地后端3002在跑(含翻译端点改动);需联网(实调 Google 免费翻译)
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'server/dist/app.js'));
const jwt = require('jsonwebtoken');
const BASE = process.env.API_BASE || 'http://localhost:3002/api';
const secret = (fs.readFileSync(path.join(ROOT, 'server/.env'), 'utf8').match(/^JWT_SECRET=(.*)$/m) || [])[1]?.trim() || 'dev_jwt_secret_min_32_chars_for_local_testing_only';
const token = jwt.sign({ supplierUserId: 910 }, secret); // ae → en
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
let pass = 0, fail = 0;
const ck = (n, c, d) => { c ? (pass++, console.log('  ✓ ' + n)) : (fail++, console.log('  ✗ ' + n + ' — ' + d)); };

// UC1: translate 端点中文→英文
let r = await fetch(`${BASE}/suppliers/me/translate`, { method: 'POST', headers: H, body: JSON.stringify({ text: '大理石地砖' }) });
let j = await r.json();
ck('translate 200', r.status === 200, 'got ' + r.status);
ck('返回非空译文', !!(j.translated && j.translated.trim()), JSON.stringify(j));
ck('译文是英文(含拉丁字母,无中文)', /[a-zA-Z]/.test(j.translated || '') && !/[一-龥]/.test(j.translated || ''), j.translated);

// UC2: 空 text → 空译文
r = await fetch(`${BASE}/suppliers/me/translate`, { method: 'POST', headers: H, body: JSON.stringify({ text: '' }) });
j = await r.json();
ck('空 text → 空译文', j.translated === '', JSON.stringify(j));

// UC3: addProduct 存译文
r = await fetch(`${BASE}/suppliers/me/products`, { method: 'POST', headers: H, body: JSON.stringify({ image_urls: ['/uploads/x.jpg'], price: 100, price_unit: 'SQM', title: '实木门', title_translated: 'Solid wood door', description: '描述', description_translated: 'desc en' }) });
j = await r.json();
ck('addProduct 201', r.status === 201, 'got ' + r.status);
ck('title_translated 落库', j.product?.title_translated === 'Solid wood door', JSON.stringify(j.product));
ck('description_translated 落库', j.product?.description_translated === 'desc en', JSON.stringify(j.product));
const id = j.product?.id;
if (id) { const d = await fetch(`${BASE}/suppliers/me/products/${id}`, { method: 'DELETE', headers: H }); ck('cleanup DELETE 200', d.status === 200, 'got ' + d.status); }
console.log(`\nsupplier-product-translate: ${pass}/${pass + fail} PASS`);
process.exit(fail === 0 ? 0 : 1);
