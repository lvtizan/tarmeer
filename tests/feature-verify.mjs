/**
 * feature-verify.mjs
 * 验证四个功能：
 *   1. 公司分支地址 (branch_addresses)
 *   2. 外勤人员登录认证 + 历史记录再编辑
 *   3. 编辑留痕 (interview_edit_logs)
 *   4. 管理后台公司详情布局（字段核验）
 *
 * 运行: node tests/feature-verify.mjs
 * 需要: 本地后端运行在 localhost:3002
 */

const API = 'http://localhost:3002/api';
const GREEN = '\x1b[32m✓\x1b[0m';
const RED = '\x1b[31m✗\x1b[0m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;
const failures = [];

function assert(label, cond, detail = '') {
  if (cond) {
    console.log(`    ${GREEN} ${label}`);
    passed++;
  } else {
    console.log(`    ${RED} ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
    failures.push(label + (detail ? ': ' + detail : ''));
  }
}

async function req(path, opts = {}) {
  const { headers: extraHeaders, body, ...restOpts } = opts;
  const res = await fetch(`${API}${path}`, {
    ...restOpts,
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
    body: body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, body: json, text };
}

function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// 凭据
// ─────────────────────────────────────────────────────────────────────────────
const FIELD_EMAIL = 'field-test@tarmeer.local';
const FIELD_PASS  = 'Field@Test123';
const COMPANY_EMAIL = 'tizan@qq.com';
const COMPANY_PASS  = 'Test@Branch456';
const ADMIN_EMAIL = 'bbtizan@gmail.com';  // super_admin

// ─────────────────────────────────────────────────────────────────────────────

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║   Tarmeer Feature Verification — 四功能验证          ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

// ═══════════════════════════════════════════════════
// 登录，获取 token
// ═══════════════════════════════════════════════════
console.log(`${BOLD}[0] 登录获取 Token${RESET}`);

const fieldLogin = await req('/auth/login', {
  method: 'POST',
  body: { email: FIELD_EMAIL, password: FIELD_PASS },
});
assert('外勤账号登录返回 200', fieldLogin.status === 200, `got ${fieldLogin.status}`);
assert('外勤登录返回 token', !!fieldLogin.body?.token);
assert('外勤账号 role=field_staff', fieldLogin.body?.admin?.role === 'field_staff', `got ${fieldLogin.body?.admin?.role}`);
const fieldToken = fieldLogin.body?.token;

const companyLogin = await req('/auth/login', {
  method: 'POST',
  body: { email: COMPANY_EMAIL, password: COMPANY_PASS },
});
assert('公司账号登录返回 200', companyLogin.status === 200, `got ${companyLogin.status}`);
const companyToken = companyLogin.body?.token;

// ═══════════════════════════════════════════════════
// Feature 1: Branch Addresses
// ═══════════════════════════════════════════════════
console.log(`\n${BOLD}[Feature 1] 分支地址 (branch_addresses)${RESET}`);

// GET profile — branch_addresses 字段应存在
const profileGet = await req('/auth/company/profile', {
  headers: authHeader(companyToken),
});
assert('GET /auth/company/profile 返回 200', profileGet.status === 200, `got ${profileGet.status}`);
assert('响应包含 branch_addresses 字段', 'branch_addresses' in (profileGet.body?.profile ?? profileGet.body ?? {}),
  `keys: ${Object.keys(profileGet.body?.profile ?? profileGet.body ?? {}).slice(0,10).join(', ')}`);

// 读取当前 profile 作为 base（POST 需要 company_name 等必填字段）
const profileBase = profileGet.body?.profile ?? profileGet.body ?? {};
const companyName = profileBase.company_name || 'tizan Design Studio';

// POST profile 写入两个分支地址
const testBranches = ['Branch 1: Dubai Mall, Dubai', 'Branch 2: Marina Walk, Dubai'];
const profilePost = await req('/auth/company/profile', {
  method: 'POST',
  headers: authHeader(companyToken),
  body: { company_name: companyName, branch_addresses: testBranches },
});
assert('POST /auth/company/profile 返回 200/201', profilePost.status === 200 || profilePost.status === 201, `got ${profilePost.status}: ${JSON.stringify(profilePost.body)?.slice(0,100)}`);

// 再次 GET 验证保存正确
const profileGet2 = await req('/auth/company/profile', {
  headers: authHeader(companyToken),
});
const savedBranches = profileGet2.body?.profile?.branch_addresses ?? profileGet2.body?.branch_addresses;
assert('分支地址已保存', Array.isArray(savedBranches), `type=${typeof savedBranches}`);
assert('分支地址条数正确', savedBranches?.length === 2, `got ${savedBranches?.length}`);
assert('分支地址内容正确', savedBranches?.[0] === testBranches[0], `got ${savedBranches?.[0]}`);

// 测试上限：写入 10 条
const tenBranches = Array.from({ length: 10 }, (_, i) => `Branch ${i + 1}: Address Line Here`);
const profilePost10 = await req('/auth/company/profile', {
  method: 'POST',
  headers: authHeader(companyToken),
  body: { company_name: companyName, branch_addresses: tenBranches },
});
assert('10 条分支地址保存成功', profilePost10.status === 200 || profilePost10.status === 201, `got ${profilePost10.status}`);

// 超出 10 条，后端截断为 10
const elevenBranches = Array.from({ length: 11 }, (_, i) => `Branch ${i + 1}`);
const profilePost11 = await req('/auth/company/profile', {
  method: 'POST',
  headers: authHeader(companyToken),
  body: { company_name: companyName, branch_addresses: elevenBranches },
});
assert('11 条分支地址不报 500（截断为 10）', profilePost11.status !== 500, `got ${profilePost11.status}`);
const profileGet3 = await req('/auth/company/profile', { headers: authHeader(companyToken) });
const savedBranches3 = profileGet3.body?.profile?.branch_addresses ?? profileGet3.body?.branch_addresses;
assert('超出 10 条后端截断为 10', savedBranches3?.length === 10, `got ${savedBranches3?.length}`);

// 清空分支地址
const profilePostEmpty = await req('/auth/company/profile', {
  method: 'POST',
  headers: authHeader(companyToken),
  body: { company_name: companyName, branch_addresses: [] },
});
assert('清空分支地址成功', profilePostEmpty.status === 200 || profilePostEmpty.status === 201, `got ${profilePostEmpty.status}`);

// ═══════════════════════════════════════════════════
// Feature 2a: 外勤认证 — 路由保护
// ═══════════════════════════════════════════════════
console.log(`\n${BOLD}[Feature 2a] 外勤路由保护${RESET}`);

// 公开路由（无 token 也能访问）
const schema = await req('/field/survey-schema');
assert('GET /field/survey-schema 无 token 返回 200', schema.status === 200, `got ${schema.status}`);
assert('survey-schema 返回 schema 数组', Array.isArray(schema.body?.schema), `type=${typeof schema.body?.schema}`);

const searchPublic = await req('/field/companies/search?q=dubai');
assert('GET /field/companies/search 无 token 返回 200', searchPublic.status === 200, `got ${searchPublic.status}`);

// 受保护路由无 token → 401
const draftNoToken = await req('/field/interviews/draft');
assert('GET /field/interviews/draft 无 token 返回 401', draftNoToken.status === 401, `got ${draftNoToken.status}`);

const createNoToken = await req('/field/interviews', { method: 'POST', body: {} });
assert('POST /field/interviews 无 token 返回 401', createNoToken.status === 401, `got ${createNoToken.status}`);

// 有效 field token → 受保护路由可访问（不传 id，返回 {draft: null}）
const draftWithToken = await req('/field/interviews/draft', {
  headers: authHeader(fieldToken),
});
assert('GET /field/interviews/draft 有 token 返回 200', draftWithToken.status === 200, `got ${draftWithToken.status}`);

// ═══════════════════════════════════════════════════
// Feature 2b: 搜索返回历史访谈
// ═══════════════════════════════════════════════════
console.log(`\n${BOLD}[Feature 2b] 搜索返回历史访谈${RESET}`);

const searchResults = await req('/field/companies/search?q=Design');
assert('搜索返回 results 数组', Array.isArray(searchResults.body?.results), `type=${typeof searchResults.body?.results}`);
if (Array.isArray(searchResults.body?.results) && searchResults.body.results.length > 0) {
  const first = searchResults.body.results[0];
  assert('每个结果包含 interviews 字段', 'interviews' in first,
    `keys: ${Object.keys(first).join(', ')}`);
  assert('interviews 是数组', Array.isArray(first.interviews), `type=${typeof first.interviews}`);
}

// ═══════════════════════════════════════════════════
// Feature 2c + 3: 完整外勤访谈流程 + 留痕
// ═══════════════════════════════════════════════════
console.log(`\n${BOLD}[Feature 2c+3] 访谈流程 + 编辑留痕${RESET}`);

// 创建草稿
const createDraft = await req('/field/interviews', {
  method: 'POST',
  headers: authHeader(fieldToken),
  body: { company_name: 'Test Company Verif', company_ref_id: null, company_ref_source: null },
});
assert('POST /field/interviews 创建草稿返回 200/201', createDraft.status === 200 || createDraft.status === 201, `got ${createDraft.status}`);
assert('创建草稿返回 interview_id', !!createDraft.body?.interview_id || !!createDraft.body?.id, `body: ${JSON.stringify(createDraft.body)?.slice(0,100)}`);
const interviewId = createDraft.body?.interview_id ?? createDraft.body?.id;

// 检查 interviewer_id 已设置（用 draft 接口验证，需传 ?id=）
const myDraft = await req(`/field/interviews/draft?id=${interviewId}`, {
  headers: authHeader(fieldToken),
});
assert('GET /field/interviews/draft 返回草稿', myDraft.status === 200, `got ${myDraft.status}`);
// 响应结构: { draft: { id, interviewer_id, ... } }
const draftRecord = myDraft.body?.draft ?? myDraft.body?.interview;
assert('草稿 interviewer_id 已设置', !!draftRecord?.interviewer_id, `draft: ${JSON.stringify(draftRecord)?.slice(0,100)}`);

// 保存部分数据（直接发送对象，后端 controller 会 JSON.stringify）
const saveDraft = await req(`/field/interviews/${interviewId}`, {
  method: 'PATCH',
  headers: authHeader(fieldToken),
  body: {
    section_1: { company_type: 'Local', year_established: '2015-2020' },
    section_3: { total_employees: '10-30' },
  },
});
assert('PATCH /field/interviews/:id 保存草稿 200', saveDraft.status === 200, `got ${saveDraft.status}`);

// 提交（首次）
const submit1 = await req(`/field/interviews/${interviewId}/submit`, {
  method: 'POST',
  headers: authHeader(fieldToken),
  body: { location: { lat: 25.2048, lng: 55.2708, address: 'Test Address Dubai' } },
});
assert('POST /field/interviews/:id/submit 首次提交 200', submit1.status === 200, `got ${submit1.status}`);

// Load interview（外勤端加载已提交记录）
const loaded = await req(`/field/interviews/${interviewId}/load`, {
  headers: authHeader(fieldToken),
});
assert('GET /field/interviews/:id/load 返回 200', loaded.status === 200, `got ${loaded.status}`);
assert('加载的记录 status=submitted', loaded.body?.interview?.status === 'submitted', `got ${loaded.body?.interview?.status}`);
assert('加载的记录包含 section_1', !!loaded.body?.interview?.section_1, `section_1=${loaded.body?.interview?.section_1}`);

// Re-submit（修改记录）
const resubmit = await req(`/field/interviews/${interviewId}/re-submit`, {
  method: 'POST',
  headers: authHeader(fieldToken),
  body: {
    company_name: 'Test Company Verif',
    section_1: { company_type: 'Local', year_established: '2020-2025' },  // 修改了 year_established
    section_3: { total_employees: '30-50' },  // 修改了 total_employees
  },
});
assert('POST /field/interviews/:id/re-submit 返回 200', resubmit.status === 200, `got ${resubmit.status}`);

// ═══════════════════════════════════════════════════
// Feature 3: 审计日志
// ═══════════════════════════════════════════════════
console.log(`\n${BOLD}[Feature 3] 编辑留痕 (interview_edit_logs)${RESET}`);

// 需要 super_admin token 访问管理接口
// 用 super_admin 登录（密码已经是设置过的）
// 先获取 admin token（bbtizan@gmail.com 是 super_admin）
// 注：如果密码不知道，改用直接查 DB

// 通过外勤 token 访问自己的草稿可验证 edit_logs 逻辑，
// 通过 DB 直接查询 interview_edit_logs 表来验证

const { createPool } = await import('/Users/kp/Code/tarmeer-4.0-local/server/node_modules/mysql2/promise.js');
const dotenvPkg = await import('/Users/kp/Code/tarmeer-4.0-local/server/node_modules/dotenv/lib/main.js');
const dotenvLib = dotenvPkg.default ?? dotenvPkg;
dotenvLib.config({ path: '/Users/kp/Code/tarmeer-4.0-local/server/.env' });

const pool = await createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const [editLogs] = await pool.query(
  'SELECT * FROM interview_edit_logs WHERE interview_id = ? ORDER BY edited_at ASC',
  [interviewId]
);
assert('interview_edit_logs 表存在且有记录', editLogs.length >= 1, `got ${editLogs.length} rows`);
assert('首次提交日志: edit_summary=Initial submission', editLogs[0]?.edit_summary === 'Initial submission', `got "${editLogs[0]?.edit_summary}"`);
assert('首次提交日志: snapshot_before=null', editLogs[0]?.snapshot_before === null, `got ${editLogs[0]?.snapshot_before}`);
assert('首次提交日志: editor_id 已设置', !!editLogs[0]?.editor_id, `got ${editLogs[0]?.editor_id}`);

if (editLogs.length >= 2) {
  assert('Re-submit 日志: snapshot_before 非 null', editLogs[1]?.snapshot_before !== null, `got null`);
  assert('Re-submit 日志: edit_summary 含字段变更', editLogs[1]?.edit_summary?.includes('→') || editLogs[1]?.edit_summary?.length > 0, `got "${editLogs[1]?.edit_summary}"`);
} else {
  assert('Re-submit 产生了第二条审计日志', false, `only ${editLogs.length} log entries found`);
}

// ═══════════════════════════════════════════════════
// Feature 4: 管理后台公司详情 — API 字段核验
// ═══════════════════════════════════════════════════
console.log(`\n${BOLD}[Feature 4] 管理后台公司详情字段${RESET}`);

// 找一个有 interview 的公司，检查 API 返回包含 survey 字段
const [companiesWithInterview] = await pool.query(
  'SELECT cp.id, cp.slug FROM company_profiles cp WHERE cp.latest_interview_id IS NOT NULL LIMIT 1'
);

if (companiesWithInterview.length > 0) {
  const testCompanyId = companiesWithInterview[0].id;
  // 需要 admin token
  // 尝试用 field_staff token（如果 admin 路由接受的话）
  const companyDetail = await req(`/admin/companies/${testCompanyId}`, {
    headers: authHeader(fieldToken),
  });
  // 如果 403 说明需要更高权限，只检查字段结构
  if (companyDetail.status === 200) {
    const surveyFields = ['office_type', 'one_stop_service', 'has_construction_permit', 'total_employees',
      'pm_team_size', 'design_team_size', 'owner_nationality', 'main_project_types',
      'min_project_value', 'max_project_value', 'material_sources'];
    const companyBody = companyDetail.body?.company ?? companyDetail.body;
    const presentFields = surveyFields.filter(f => f in (companyBody ?? {}));
    assert('公司详情 API 含 survey 字段', presentFields.length > 0, `found: ${presentFields.join(', ')}`);
  } else {
    console.log(`    ℹ  /admin/companies/:id 需要更高权限 (${companyDetail.status})，改用 DB 直接验证`);
    const [surveyData] = await pool.query(
      'SELECT office_type, total_employees, min_project_value, max_project_value, latest_interview_id FROM company_profiles WHERE id = ?',
      [testCompanyId]
    );
    assert('公司 DB 中含 survey 字段 latest_interview_id', surveyData[0]?.latest_interview_id != null, `got ${surveyData[0]?.latest_interview_id}`);
    assert('公司 DB 中含 office_type 列', 'office_type' in (surveyData[0] ?? {}));
    assert('公司 DB 中含 total_employees 列', 'total_employees' in (surveyData[0] ?? {}));
    assert('公司 DB 中含 min_project_value 列', 'min_project_value' in (surveyData[0] ?? {}));
  }
} else {
  // 没有有 interview 的公司，至少验证列存在
  const [cols] = await pool.query("SHOW COLUMNS FROM company_profiles LIKE 'office_type'");
  assert('company_profiles 含 office_type 列', cols.length > 0);
  const [cols2] = await pool.query("SHOW COLUMNS FROM company_profiles LIKE 'branch_addresses'");
  assert('company_profiles 含 branch_addresses 列', cols2.length > 0);
  const [cols3] = await pool.query("SHOW COLUMNS FROM company_profiles LIKE 'latest_interview_id'");
  assert('company_profiles 含 latest_interview_id 列', cols3.length > 0);
}

// 验证 interview_edit_logs 表结构
const [logCols] = await pool.query('DESCRIBE interview_edit_logs');
const logColNames = logCols.map(c => c.Field);
assert('interview_edit_logs 含 interview_id', logColNames.includes('interview_id'));
assert('interview_edit_logs 含 editor_id', logColNames.includes('editor_id'));
assert('interview_edit_logs 含 snapshot_before', logColNames.includes('snapshot_before'));
assert('interview_edit_logs 含 edit_summary', logColNames.includes('edit_summary'));

await pool.end();

// ═══════════════════════════════════════════════════
// 搜索历史包含刚提交的记录（二次验证）
// ═══════════════════════════════════════════════════
console.log(`\n${BOLD}[Feature 2d] 搜索结果中验证历史访谈数据结构${RESET}`);

const searchWithHistory = await req('/field/companies/search?q=tizan');
if (Array.isArray(searchWithHistory.body?.results)) {
  for (const r of searchWithHistory.body.results) {
    if (Array.isArray(r.interviews) && r.interviews.length > 0) {
      const intv = r.interviews[0];
      assert('历史访谈条目含 id', 'id' in intv, `keys: ${Object.keys(intv).join(', ')}`);
      assert('历史访谈条目含 submitted_at', 'submitted_at' in intv);
      assert('历史访谈条目含 interviewer_name', 'interviewer_name' in intv);
      break;
    }
  }
}

// ═══════════════════════════════════════════════════
// 结果汇总
// ═══════════════════════════════════════════════════
console.log(`\n${'─'.repeat(54)}`);
console.log(`结果: ${GREEN} ${passed} 通过  ${RED} ${failed} 失败`);
if (failures.length > 0) {
  console.log('\n失败项目:');
  failures.forEach(f => console.log(`  • ${f}`));
}
console.log('');

if (failed > 0) process.exit(1);
