// scripts/harness/test-company-leads.mjs
import http from 'http';
import { createRequire } from 'module';

const require = createRequire(import.meta.url.replace('/scripts/harness/', '/server/'));
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_min_32_chars_for_local_testing_only';
const pool = mysql.createPool({ host: '127.0.0.1', user: 'root', password: '', database: 'tarmeer' });

let pass = 0; let fail = 0;

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: 3099, path, method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const r = http.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buf) }); }
        catch { resolve({ status: res.statusCode, body: buf }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function check(label, cond, detail = '') {
  if (cond) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); fail++; }
}

async function main() {
  console.log('\n=== Company Leads Harness ===\n');

  // Cleanup
  await pool.execute("DELETE FROM design_inquiries WHERE source_company_name = '__harness_lead_test__'");
  await pool.execute("DELETE FROM company_profiles WHERE company_name = '__harness_company_leads__'");
  await pool.execute("DELETE FROM users WHERE email = 'harness-leads@test.tarmeer'");

  // Setup test data
  await pool.execute(
    "INSERT INTO users (email, password, full_name, role) VALUES ('harness-leads@test.tarmeer', '', 'Harness Leads', 'company')"
  );
  const [[{ id: userId }]] = await pool.execute("SELECT id FROM users WHERE email = 'harness-leads@test.tarmeer'");

  await pool.execute(
    `INSERT INTO company_profiles (user_id, company_name, status, description, contact_person, phone, city, address, services)
     VALUES (?, '__harness_company_leads__', 'approved', '', '', '', 'Dubai', '', '[]')`,
    [userId]
  );
  const [[{ id: companyId }]] = await pool.execute("SELECT id FROM company_profiles WHERE user_id = ?", [userId]);

  await pool.execute(
    `INSERT INTO design_inquiries (name, phone, city, area_range, message, company_id, source_company_name, status)
     VALUES ('Test Lead', '+971501234567', 'Dubai', '100-150 sqm', 'Test message', ?, '__harness_lead_test__', 'new')`,
    [companyId]
  );
  const [[{ id: inquiryId }]] = await pool.execute(
    "SELECT id FROM design_inquiries WHERE company_id = ? ORDER BY id DESC LIMIT 1", [companyId]
  );

  const token = signToken({ userId, role: 'company' });
  const auth = { Authorization: `Bearer ${token}` };

  // 1. No token → 401
  const r1 = await req('GET', '/api/inquiries/mine', null, {});
  check('GET /mine without token → 401', r1.status === 401);

  // 2. With token → 200 + array
  const r2 = await req('GET', '/api/inquiries/mine', null, auth);
  check('GET /mine with token → 200', r2.status === 200);
  check('GET /mine returns inquiries array', Array.isArray(r2.body.inquiries));

  // 3. PATCH my-status: invalid status → 400
  const r3 = await req('PATCH', `/api/inquiries/${inquiryId}/my-status`, { status: 'archived' }, auth);
  check('PATCH my-status archived → 400', r3.status === 400);

  // 4. PATCH my-status: contacted → 200
  const r4 = await req('PATCH', `/api/inquiries/${inquiryId}/my-status`, { status: 'contacted' }, auth);
  check('PATCH my-status contacted → 200', r4.status === 200, JSON.stringify(r4.body));
  check('PATCH my-status returns ok:true', r4.body.ok === true);

  // 5. PATCH wrong inquiry → 404
  const r5 = await req('PATCH', '/api/inquiries/999999/my-status', { status: 'contacted' }, auth);
  check('PATCH my-status wrong id → 404', r5.status === 404);

  // 6. PATCH no token → 401
  const r6 = await req('PATCH', `/api/inquiries/${inquiryId}/my-status`, { status: 'new' }, {});
  check('PATCH my-status no token → 401', r6.status === 401);

  // Cleanup
  await pool.execute("DELETE FROM design_inquiries WHERE source_company_name = '__harness_lead_test__'");
  await pool.execute("DELETE FROM company_profiles WHERE company_name = '__harness_company_leads__'");
  await pool.execute("DELETE FROM users WHERE email = 'harness-leads@test.tarmeer'");
  await pool.end();

  console.log(`\nResults: ${pass} PASS / ${fail} FAIL`);
  if (fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
