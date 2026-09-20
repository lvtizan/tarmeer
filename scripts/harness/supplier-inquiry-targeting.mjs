#!/usr/bin/env node

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const envPath = path.join(ROOT, 'server/.env');
if (!existsSync(envPath)) throw new Error('拒绝执行：找不到 server/.env。');

const serverRequire = createRequire(path.join(ROOT, 'server/package.json'));
serverRequire('dotenv').config({ path: envPath, override: true, quiet: true });
if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || '') || process.env.DB_NAME !== 'tarmeer') {
  throw new Error('拒绝执行：仅允许连接本地 tarmeer 数据库。');
}

const controller = serverRequire(path.join(ROOT, 'server/dist/controllers/sourcingRequestController.js'));
const pool = serverRequire(path.join(ROOT, 'server/dist/config/database.js')).default;
const marker = `supplier-inquiry-${Date.now()}-${process.pid}`;
const createdSupplierIds = [];
const createdRequestIds = [];
let passed = 0;
let failed = 0;

const check = (label, condition, detail = '') => {
  if (condition) { passed++; console.log(`✓ ${label}`); }
  else { failed++; console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};

const invoke = async (body, country = 'ae') => {
  const response = { statusCode: 200, body: null };
  response.status = (code) => { response.statusCode = code; return response; };
  response.json = (payload) => { response.body = payload; return response; };
  await controller.submitSourcingRequest({ body, country }, response);
  return response;
};

const invokeAdminList = async (country) => {
  const response = { statusCode: 200, body: null };
  response.status = (code) => { response.statusCode = code; return response; };
  response.json = (payload) => { response.body = payload; return response; };
  await controller.adminListSourcingRequests({ country, query: { country, page: '1', limit: '100' } }, response);
  return response;
};

let primaryError = null;
try {
  const [approved] = await pool.execute(
    `INSERT INTO supplier_profiles
      (company_name, slug, origin, status, country, is_published, categories)
     VALUES (?, ?, 'china', 'approved', 'vn', 1, '[]')`,
    [`Harness Supplier Inquiry ${marker}`, `${marker}-approved`],
  );
  const approvedId = Number(approved.insertId);
  createdSupplierIds.push(approvedId);

  const response = await invoke({
    request_type: 'sourcing',
    name: 'Harness Buyer',
    phone: '+971501234567',
    city: 'Dubai',
    message: '[Material Inquiry] Project area: 120m²',
    supplier_profile_id: approvedId,
    source_page: `http://localhost:5180/materials/suppliers/${marker}-approved`,
  }, 'ae');
  if (response.body?.id) createdRequestIds.push(Number(response.body.id));
  const [rows] = response.body?.id
    ? await pool.execute(
      'SELECT supplier_profile_id, country, source_page, message FROM sourcing_requests WHERE id = ?',
      [response.body.id],
    )
    : [[]];
  const saved = rows[0];
  check('supplier inquiry is accepted by the sourcing request pipeline', response.statusCode === 201, String(response.statusCode));
  check('supplier inquiry persists the exact supplier target', Number(saved?.supplier_profile_id) === approvedId);
  check('supplier reference country wins over phone and request fallback country', saved?.country === 'vn', String(saved?.country));
  check('supplier inquiry persists source page and material context',
    saved?.source_page?.includes(`${marker}-approved`) && saved?.message?.includes('[Material Inquiry]'));
  const adminList = await invokeAdminList('vn');
  const adminItem = adminList.body?.requests?.find((item) => Number(item.id) === Number(response.body?.id));
  check('VN admin list resolves the exact target supplier name',
    adminList.statusCode === 200
      && Number(adminItem?.supplier_profile_id) === approvedId
      && adminItem?.supplier_name === `Harness Supplier Inquiry ${marker}`);

  const [hidden] = await pool.execute(
    `INSERT INTO supplier_profiles
      (company_name, slug, origin, status, country, is_published, categories)
     VALUES (?, ?, 'china', 'pending', 'ae', 0, '[]')`,
    [`Harness Hidden Supplier ${marker}`, `${marker}-hidden`],
  );
  const hiddenId = Number(hidden.insertId);
  createdSupplierIds.push(hiddenId);
  const rejected = await invoke({
    request_type: 'sourcing',
    name: 'Harness Buyer',
    phone: '+971501234567',
    supplier_profile_id: hiddenId,
  });
  check('unpublished supplier targets are rejected', rejected.statusCode === 400, String(rejected.statusCode));
} catch (error) {
  primaryError = error;
  console.error(error);
} finally {
  if (createdRequestIds.length) {
    await pool.execute(`DELETE FROM sourcing_requests WHERE id IN (${createdRequestIds.map(() => '?').join(',')})`, createdRequestIds);
  }
  if (createdSupplierIds.length) {
    await pool.execute(`DELETE FROM supplier_profiles WHERE id IN (${createdSupplierIds.map(() => '?').join(',')})`, createdSupplierIds);
  }
  await pool.end();
}

console.log(`\n${passed}/${passed + failed} checks passed`);
if (primaryError || failed) process.exit(1);
