#!/usr/bin/env node
/**
 * Admin-created supplier accounts must be login-ready without email verification.
 *
 * This is a controller-level local-DB regression check. It deliberately avoids
 * the public registration endpoint: that flow must keep its email verification.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(ROOT, 'server/dist/app.js'));
const envPath = path.join(ROOT, 'server/.env');

if (!existsSync(envPath)) throw new Error('Refusing to run: server/.env is missing.');
require('dotenv').config({ path: envPath, override: true, quiet: true });
if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST || '') || process.env.DB_NAME !== 'tarmeer') {
  throw new Error('Refusing to run outside the local tarmeer database.');
}

const pool = require(path.join(ROOT, 'server/dist/config/database.js')).default;
const admin = require(path.join(ROOT, 'server/dist/controllers/supplierAdminController.js'));
const supplierAuth = require(path.join(ROOT, 'server/dist/controllers/supplierAuthController.js'));
const jwt = require('jsonwebtoken');
const config = require(path.join(ROOT, 'server/dist/config/index.js')).default;

let pass = 0;
let fail = 0;
const check = (label, condition, detail = '') => {
  if (condition) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`); }
};

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const marker = `${Date.now()}-${process.pid}-${randomUUID().slice(0, 8)}`;
const createdEmails = [];
const createdAdminIds = [];

async function create(req) {
  const res = response();
  await admin.createAdminSupplierAccount(req, res);
  if (res.body?.supplier?.email) createdEmails.push(res.body.supplier.email);
  return res;
}

try {
  console.log('\n[admin supplier account]');
  const adminApiSource = readFileSync(path.join(ROOT, 'src/lib/adminApi.ts'), 'utf8');
  const supplierPageSource = readFileSync(path.join(ROOT, 'src/app/admin/suppliers/page.tsx'), 'utf8');
  const adminRoutesSource = readFileSync(path.join(ROOT, 'server/dist/routes/admin.js'), 'utf8');
  const publicRegistrationSource = readFileSync(path.join(ROOT, 'server/dist/controllers/supplierAuthController.js'), 'utf8');
  const supplierAdminSource = readFileSync(path.join(ROOT, 'server/dist/controllers/supplierAdminController.js'), 'utf8');
  check('admin API exposes the protected supplier-create request', /createSupplierAccount\(/.test(adminApiSource) && /request\('\/suppliers'/.test(adminApiSource), 'missing admin API method');
  check('supplier admin page has the account-creation form', /showCreateForm/.test(supplierPageSource) && /New Supplier/.test(supplierPageSource), 'missing supplier creation UI');
  check('supplier admin page has no email-verification bypass toggle', !/email verification.*checkbox|免邮箱验证.*(checkbox|勾选)/i.test(supplierPageSource), 'creation path must be fixed, not optional');
  check('creation route requires approval permission', /router\.post\('\/suppliers',\s*\(0, adminAuth_1\.requirePermission\)\('can_approve'\)/.test(adminRoutesSource), 'route must stay behind can_approve');
  const supplierControllerSource = readFileSync(path.join(ROOT, 'server/dist/controllers/supplierAdminController.js'), 'utf8');
  check('account creation writes its audit row before transaction commit', /INSERT INTO activity_log[\s\S]*?await connection\.commit\(\)/.test(supplierControllerSource), 'audit must be part of the creation transaction');
  check('public supplier registration remains verification-gated', /INSERT INTO supplier_users \(email, password, full_name, phone, verification_token, verification_expires\)/.test(publicRegistrationSource), 'public registration must not set email_verified');
  check('supplier deletion is country-scoped and audited with that country', /WHERE id = \? AND country = \?/.test(supplierAdminSource) && /supplier_delete/.test(supplierAdminSource) && /删除供应商#\$\{id\}`, country\)/.test(supplierAdminSource), 'delete must use selected country for query and audit');
  check('country switch resets stale mutation loading state', /setDeleteLoading\(false\)[\s\S]{0,120}setCreateSubmitting\(false\)/.test(supplierPageSource), 'stale requests must not leave controls disabled');

  const invalidCountry = await create({
    body: { companyName: 'Unsupported Country', email: `harness-invalid-country-${marker}@local.test`, password: 'SafePass123', country: 'sa' },
    admin: { id: 990003, email: 'harness-invalid@local.test', full_name: 'Harness Invalid', role: 'sub_admin', country: 'sa' },
    headers: {},
  });
  check('unsupported admin country is rejected instead of falling back to AE', invalidCountry.statusCode === 400, `${invalidCountry.statusCode} ${JSON.stringify(invalidCountry.body)}`);

  const tooLongPassword = await create({
    body: { companyName: 'Long Password', email: `harness-long-password-${marker}@local.test`, password: 'a'.repeat(73), country: 'ae' },
    admin: { id: 990004, email: 'harness-password@local.test', full_name: 'Harness Password', role: 'super_admin', country: 'ae' },
    headers: {},
  });
  check('passwords beyond bcrypt\'s 72-byte limit are rejected', tooLongPassword.statusCode === 400, `${tooLongPassword.statusCode} ${JSON.stringify(tooLongPassword.body)}`);

  const tooLongCompanyName = await create({
    body: { companyName: 'a'.repeat(101), email: `harness-long-name-${marker}@local.test`, password: 'SafePass123', country: 'ae' },
    admin: { id: 990005, email: 'harness-name@local.test', full_name: 'Harness Name', role: 'super_admin', country: 'ae' },
    headers: {},
  });
  check('company names beyond the supplier user display-name limit are rejected', tooLongCompanyName.statusCode === 400, `${tooLongCompanyName.statusCode} ${JSON.stringify(tooLongCompanyName.body)}`);

  const superEmail = `harness-admin-supplier-super-${marker}@local.test`;
  const superResult = await create({
    body: { companyName: 'Harness Supplier Account', email: superEmail, password: 'SafePass123', phone: '+971501234567', country: 'vn' },
    admin: { id: 990001, email: 'harness-super@local.test', full_name: 'Harness Super', role: 'super_admin', country: 'ae' },
    headers: {},
  });

  check('super admin can create a supplier account', superResult.statusCode === 201, `${superResult.statusCode} ${JSON.stringify(superResult.body)}`);
  check('creation response marks the account email-verified', superResult.body?.supplier?.email_verified === true, JSON.stringify(superResult.body));

  const [superRows] = await pool.execute(
    `SELECT su.email_verified, su.password, sp.id AS supplier_profile_id, sp.country, sp.status
     FROM supplier_users su JOIN supplier_profiles sp ON sp.supplier_user_id = su.id
     WHERE su.email = ?`, [superEmail]);
  const superAccount = superRows[0];
  check('created account is stored as verified', Number(superAccount?.email_verified) === 1, JSON.stringify(superAccount));
  check('password is hashed rather than stored as plaintext', Boolean(superAccount?.password) && superAccount.password !== 'SafePass123', JSON.stringify(superAccount));
  check('super admin creation uses the active selected country', superAccount?.country === 'vn', JSON.stringify(superAccount));
  check('new supplier profile remains pending review', superAccount?.status === 'pending', JSON.stringify(superAccount));
  const [auditRows] = await pool.execute(
    "SELECT action, country FROM activity_log WHERE target_type = 'supplier' AND target_id = ? ORDER BY id DESC LIMIT 1",
    [superAccount?.supplier_profile_id || 0],
  );
  check('account creation records a country-scoped audit event', auditRows[0]?.action === 'supplier_account_create' && auditRows[0]?.country === 'vn', JSON.stringify(auditRows[0]));

  const loginRes = response();
  await supplierAuth.login({ body: { email: superEmail, password: 'SafePass123' } }, loginRes);
  check('created supplier can log in without email verification', loginRes.statusCode === 200 && Boolean(loginRes.body?.token), `${loginRes.statusCode} ${JSON.stringify(loginRes.body)}`);

  const duplicate = await create({
    body: { companyName: 'Duplicate Supplier', email: superEmail, password: 'SafePass123', country: 'vn' },
    admin: { id: 990001, email: 'harness-super@local.test', full_name: 'Harness Super', role: 'super_admin', country: 'ae' },
    headers: {},
  });
  check('duplicate supplier email is rejected', duplicate.statusCode === 409, `${duplicate.statusCode} ${JSON.stringify(duplicate.body)}`);

  const subEmail = `harness-admin-supplier-sub-${marker}@local.test`;
  const subResult = await create({
    body: { companyName: 'Scoped Supplier', email: subEmail, password: 'SafePass123', country: 'vn' },
    admin: { id: 990002, email: 'harness-sub@local.test', full_name: 'Harness Sub', role: 'sub_admin', country: 'ae' },
    headers: {},
  });
  check('supplier manager can create in their own country', subResult.statusCode === 201, `${subResult.statusCode} ${JSON.stringify(subResult.body)}`);
  const [subRows] = await pool.execute(
    `SELECT sp.country FROM supplier_users su JOIN supplier_profiles sp ON sp.supplier_user_id = su.id WHERE su.email = ?`, [subEmail]);
  check('non-super admin cannot create a cross-country supplier', subRows[0]?.country === 'ae', JSON.stringify(subRows[0]));

  if (process.env.TARMEER_HTTP_TESTS === '1') {
    const route = 'http://localhost:3002/api/admin/suppliers';
    const request = (token, body) => fetch(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const unauthenticated = await request(null, {});
    check('route rejects unauthenticated account creation', unauthenticated.status === 401, `HTTP ${unauthenticated.status}`);

    const insertAdmin = async (email, role, permissions, country) => {
      const [result] = await pool.execute(
        'INSERT INTO admin_users (email, password, full_name, role, permissions, is_active, country) VALUES (?, ?, ?, ?, ?, 1, ?)',
        [email, 'unused', 'Harness Admin', role, JSON.stringify(permissions), country],
      );
      createdAdminIds.push(result.insertId);
      return jwt.sign({ adminId: result.insertId, type: 'admin' }, config.jwt.secret, { expiresIn: '5m' });
    };
    const noPermissionToken = await insertAdmin(`harness-no-permission-${marker}@local.test`, 'sub_admin', {}, 'ae');
    const denied = await request(noPermissionToken, { companyName: 'Denied Supplier', email: `harness-denied-${marker}@local.test`, password: 'SafePass123', country: 'ae' });
    check('route rejects admins without supplier permission', denied.status === 403, `HTTP ${denied.status}`);

    const readOnlyToken = await insertAdmin(`harness-readonly-route-${marker}@local.test`, 'sub_admin', { can_view_suppliers: true }, 'vn');
    const readOnly = await request(readOnlyToken, { companyName: 'Denied Supplier', email: `harness-readonly-${marker}@local.test`, password: 'SafePass123', country: 'vn' });
    check('route rejects supplier read-only admins from creating accounts', readOnly.status === 403, `HTTP ${readOnly.status}`);

    const supplierManagerToken = await insertAdmin(`harness-manager-route-${marker}@local.test`, 'sub_admin', { can_approve: true }, 'vn');
    const routeEmail = `harness-route-${marker}@local.test`;
    const allowed = await request(supplierManagerToken, { companyName: 'HTTP Supplier', email: routeEmail, password: 'SafePass123', country: 'ae' });
    const allowedBody = await allowed.json();
    if (allowedBody?.supplier?.email) createdEmails.push(allowedBody.supplier.email);
    check('route permits a supplier manager to create a login-ready account in its own country', allowed.status === 201 && allowedBody?.supplier?.email_verified === true && allowedBody?.supplier?.country === 'vn', `HTTP ${allowed.status} ${JSON.stringify(allowedBody)}`);
  }
} catch (error) {
  fail++;
  console.error(`  ✗ harness execution — ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (createdEmails.length > 0) {
    const placeholders = createdEmails.map(() => '?').join(', ');
    const [profiles] = await pool.execute(`SELECT id, supplier_user_id FROM supplier_profiles WHERE supplier_user_id IN (SELECT id FROM supplier_users WHERE email IN (${placeholders}))`, createdEmails);
    const profileIds = profiles.map((profile) => profile.id);
    if (profileIds.length > 0) {
      const ids = profileIds.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM activity_log WHERE target_type = 'supplier' AND target_id IN (${ids})`, profileIds);
      await pool.execute(`DELETE FROM supplier_products WHERE supplier_profile_id IN (${ids})`, profileIds);
      await pool.execute(`DELETE FROM supplier_catalogs WHERE supplier_profile_id IN (${ids})`, profileIds);
      await pool.execute(`DELETE FROM supplier_projects WHERE supplier_profile_id IN (${ids})`, profileIds);
    }
    await pool.execute(`DELETE FROM supplier_profiles WHERE supplier_user_id IN (SELECT id FROM supplier_users WHERE email IN (${placeholders}))`, createdEmails);
    await pool.execute(`DELETE FROM supplier_users WHERE email IN (${placeholders})`, createdEmails);
  }
  if (createdAdminIds.length > 0) {
    const placeholders = createdAdminIds.map(() => '?').join(', ');
    await pool.execute(`DELETE FROM admin_users WHERE id IN (${placeholders})`, createdAdminIds);
  }
  await pool.end();
}

const total = pass + fail;
console.log(`\n${'─'.repeat(40)}`);
if (fail === 0) console.log(` All ${total} checks passed`);
else {
  console.error(` ${fail}/${total} checks FAILED`);
  process.exit(1);
}
