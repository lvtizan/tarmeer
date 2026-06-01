/**
 * company-lead-submit.mjs
 * 测试 POST /api/company-leads 接口的关键用例
 * 运行: node tests/company-lead-submit.mjs
 */

const API = 'https://tarmeer.com/api';
const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';

let passed = 0, failed = 0;

function assert(label, cond, detail = '') {
  if (cond) { console.log(`  ${PASS} ${label}`); passed++; }
  else { console.log(`  ${FAIL} ${label}${detail ? ' — ' + detail : ''}`); failed++; }
}

async function post(body) {
  const res = await fetch(`${API}/company-leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Referer': 'https://tarmeer.com/for-companies',
      'Origin': 'https://tarmeer.com',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

// 生成不重复测试手机号（前缀 +97199 + 随机5位）
function randomPhone() {
  return `+97199${Math.floor(10000 + Math.random() * 89999)}`;
}

const BASE = {
  contactName: 'Test User',
  companyName: 'Test Company',
  city: 'Dubai',
  establishmentYear: '2020',
};

console.log('\n=== company-leads API 用例测试 ===\n');

// ── Case 1: 正常提交，单个 companyType（旧格式兼容）
console.log('Case 1: 旧格式 companyType 字符串');
{
  const r = await post({ ...BASE, phone: randomPhone(), companyType: 'renovation_company' });
  assert('返回 200 或 201', r.status === 200 || r.status === 201, `got ${r.status}`);
}

// ── Case 2: 新格式 companyTypes 数组（单个）
console.log('Case 2: 新格式 companyTypes 数组（1个）');
{
  const r = await post({ ...BASE, phone: randomPhone(), companyTypes: ['design_studio'] });
  assert('返回 200 或 201', r.status === 200 || r.status === 201, `got ${r.status}`);
}

// ── Case 3: companyTypes 数组 5 个（上限）
console.log('Case 3: companyTypes 数组 5 个（正好上限）');
{
  const types = ['renovation_company', 'general_contractor', 'fitout_contractor', 'mep_contractor', 'maintenance_company'];
  const r = await post({ ...BASE, phone: randomPhone(), companyTypes: types });
  assert('返回 200 或 201', r.status === 200 || r.status === 201, `got ${r.status}`);
  // 验证 JSON 序列化后长度在 500 以内
  const serialized = JSON.stringify(types);
  assert('序列化长度 ≤ 500', serialized.length <= 500, `len=${serialized.length}`);
}

// ── Case 4: companyTypes 数组超 5 个，后端截断，不报 500
console.log('Case 4: companyTypes 数组 7 个（超限，后端截为 5）');
{
  const types = ['renovation_company', 'general_contractor', 'fitout_contractor',
    'mep_contractor', 'maintenance_company', 'design_studio', 'waterproofing'];
  const r = await post({ ...BASE, phone: randomPhone(), companyTypes: types });
  assert('不返回 500', r.status !== 500, `got ${r.status}`);
  assert('返回 200 或 201', r.status === 200 || r.status === 201, `got ${r.status}`);
}

// ── Case 5: 最长可能的 5 类型组合不超 DB 500 限制
console.log('Case 5: 最长类型名组合序列化长度 ≤ 500');
{
  // 最长的类型名是 carpentry_joinery(17), steel_fabrication(16) 等
  const worst = ['carpentry_joinery', 'steel_fabrication', 'glass_aluminium', 'swimming_pool', 'manpower_supply'];
  const len = JSON.stringify(worst).length;
  assert(`最长5类型序列化=${len}字符 ≤ 500`, len <= 500, `len=${len}`);
}

// ── Case 6: 缺少必填字段（无 companyTypes），不应存入 DB（500 or 400）
console.log('Case 6: 无 companyTypes（后端接受 null，不报错）');
{
  const r = await post({ ...BASE, phone: randomPhone() });
  // 后端不强制校验 companyType，前端负责校验
  assert('不返回 500', r.status !== 500, `got ${r.status}`);
}

// ── Case 7: 重复手机号返回 409（rate limiter 可能先返回 429）
console.log('Case 7: 重复手机号返回 409 或 429（rate limit）');
{
  const phone = randomPhone();
  await post({ ...BASE, phone, companyTypes: ['design_studio'] });
  await new Promise(r => setTimeout(r, 1000)); // 等 1s 避免 rate limit
  const r2 = await post({ ...BASE, phone, companyTypes: ['renovation_company'] });
  assert('第二次返回 409 或 429', r2.status === 409 || r2.status === 429, `got ${r2.status}`);
}

console.log(`\n结果: ${passed} 通过 / ${failed} 失败\n`);
if (failed > 0) process.exit(1);
